import Aseprite from "ase-parser";


export type TileRef = {
    tileId: number;
    xFlip: boolean;
    yFlip: boolean;
    rotation: boolean;
};

export type TileMapCel = Required<Aseprite.Cel>;

/**
 * Type check for cels of tilemap type
 * @param cel 
 * @returns true is it is a tilemap cel
 */
export function isTileMapCel(cel: Aseprite.Cel): cel is TileMapCel {
    return cel.tilemapMetadata !== undefined;
}

/**
 * Gets the tilemap from a cel
 * @param cel 
 * @returns An array of tile references
 */
export function getTilemap(cel: TileMapCel): TileRef[] {
    const tileMetadata = cel.tilemapMetadata;
    const dataView = new DataView(cel.rawCelData.buffer);
    const tilemap: TileRef[] = [];
    for (let i = 0; i < cel.rawCelData.byteLength; i += 4) {
        const value = dataView.getUint32(i, true);
        const tileId = value & tileMetadata.bitmaskForTileId;
        const xFlip = (value & tileMetadata.bitmaskForXFlip) !== 0;
        const yFlip = (value & tileMetadata.bitmaskForYFlip) !== 0;
        const rotation = (value & tileMetadata.bitmaskFor90CWRotation) !== 0;
        tilemap.push({ tileId, xFlip, yFlip, rotation });
    }
    return tilemap;
}

/**
 * Obtains the number of non-empty tiles in the tilemap
 * @param cel  The cel with the tilemap
 * @returns 
 */
export function nonEmptyTiles(cel: TileMapCel): number {
    return getTilemap(cel).filter(tile => tile.tileId != 0).length;
}

/**
 * Obtains the offset of the sprite in the tilemap to be used as anchor, using the middle of x axis
 * and the bottom of the y axis as reference.
 * @param cel 
 * @returns 
 */
export function tilemapOffset(cel: TileMapCel): [number, number] {
    const [x, y] = tileMapAnchor(cel);
    return [x * 16 - cel.w * 8, (y - cel.h) * 16];
}

/**
 * Obtains a buffer with the sprite representation of the spectrum next of the tilemap in the cel
 * @param cel 
 */
export function tilemapToNextSprite(cel: TileMapCel, patternIndexOffset: number): Buffer {

    const [anchorX, anchorY] = tileMapAnchor(cel);
    const anchorIndex = anchorY * cel.w + anchorX;

    const tilemap = getTilemap(cel);
    const anchor = tilemap[anchorIndex];

    let buffer = spriteNextAttrs(anchor, true, 0, 0, patternIndexOffset);

    for (let y = 0; y < cel.h; y++) {
        for (let x = 0; x < cel.w; x++) {
            const index = y * cel.w + x;
            const tile = tilemap[index];
            if (tile.tileId != 0 && (x != anchorX || y != anchorY)) {
                const relativeSprite = spriteNextAttrs(tile, false, (x - anchorX) * 16, (y - anchorY) * 16, patternIndexOffset);
                buffer = Buffer.concat([buffer, relativeSprite]);
            }
        }
    }

    return buffer;
}

function tileMapAnchor(cel: TileMapCel): [number, number] {

    // Relative pixel coordinates are limited to a range of -128 to 127. If the sprite is too large, we must use an anchor that is closer to the center
    // to avoid an overflow in the relative coordinates.
    //  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    //                          A               
    // -8 -7 -6 -5 -4 -3 -2 -1 -0 +1 +2 +3 +4 +5 +6 +7
    // 
    const celWidth = cel.w;
    const celHeight = cel.h;
    if (celWidth > 16 || celHeight > 16)
        throw new Error("The tilemap is too large to be converted to a unified sprite");

    const minX = Math.max(0, celWidth - 8);
    const minY = Math.max(0, celHeight - 8);

    const tilemap = getTilemap(cel);
    const anchor = tilemap.findIndex((tile, index) => tile.tileId != 0 && index % cel.w >= minX && Math.floor(index / cel.w) >= minY);

    if (anchor < 0)
        throw new Error("All tiles are empty: no anchor can be used");
    return [anchor % cel.w, Math.floor(anchor / cel.w)];
}

function spriteNextAttrs(tile: TileRef, anchor: boolean, x: number, y: number, patternIndexOffset: number): Buffer {
    const patternId = tile.tileId + patternIndexOffset - 1;
    console.log(`${x},${y}:  ${patternId} - xflip: ${tile.xFlip} - yFlip: ${tile.yFlip} - rot: ${tile.rotation} - ancho: ${anchor}`);
    const buffer = Buffer.alloc(5);
    if (anchor) {
        buffer.writeUInt8(x, 0);
        buffer.writeUInt8(y, 1);
    }
    else {
        // Relative sprites coordinates can be negative
        buffer.writeInt8(x, 0);
        buffer.writeInt8(y, 1);
    }

    // Attr 2
    const paletteIndex = 0; // For the moment, we asume that we use a common palette
    const attr2bit0 = anchor ? (x & 0x100) >> 8 : 1;  // X MSB or relative palette
    const attr2bit1to4 = (tile.rotation ? 0x02 : 0x00) | (tile.yFlip ? 0x04 : 0x00) | (tile.xFlip ? 0x08 : 0x00);
    const attr2 = ((paletteIndex) << 4) | attr2bit1to4 | attr2bit0;
    buffer.writeUInt8(attr2, 2);

    // Attr 3
    const attr3 = (patternId & 0x3f) | 0xc0; // Sprite is visible and attribute 4 is used
    buffer.writeUInt8(attr3, 3);

    // Attr 4
    const attr4bit0 = anchor ? (y & 0x100) >> 8 : 0; // Y MSB or absolute pattern
    // Bits 1 to 4 are set to 0 (no scale)
    const attr4bit5 = anchor ? 0x20 : 0x00; // Big sprite
    const attr4bit6 = anchor ? 0x00 : 0x40; // No collision detection
    buffer.writeUInt8(attr4bit0 | attr4bit5 | attr4bit6, 4);

    return buffer;
}


export function tileSetToNextPatterns(tileset: Aseprite.Tileset, transparentIndex = 227): Buffer {
    const bytesPerPoint = 4; // bytes per point in aseprite tileset
    const tileSize = tileset.tileWidth * tileset.tileHeight;
    const buffer = Buffer.alloc(tileSize * (tileset.tileCount - 1));
    const tilesetData = tileset.rawTilesetData!;

    for (let point = 0; point < buffer.length; point += 1) {
        const inputIndex = (tileSize + point) * bytesPerPoint; // The first tile is not used (it is empty)
        const [r, g, b, a] = Array.from(tilesetData.subarray(inputIndex, inputIndex + 4));
        const color = nextColor(r, g, b, a, transparentIndex);
        buffer.writeUInt8(color, point);
    }

    return buffer;
}

function nextColor(r: number, g: number, b: number, a: number, transparentIndex: number): number {
    return a === 0 ? transparentIndex : (r & 0b11100000) | ((g & 0b11100000) >> 3) | ((b & 0b11000000) >> 6);
}


