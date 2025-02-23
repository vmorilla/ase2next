import { nextColor256 } from "./colors";
import { Cel, RGBAColor, Tile, TileRef } from "./sprite";


export function celNumberOfPatterns(cel: Cel): number {
    const patternIndexes = new Set(cel.tilemap.map(tileRef => tileRef.tile.tileIndex));
    return patternIndexes.size;
}

// This function is now broken: remove it
export function celAttrs(cel: Cel): Buffer {
    const anchor = tilemapAnchor(cel);
    const buffer = spriteNextAttrs(anchor, 0);

    return cel.tilemap.reduce((acc_buffer, tileRef, index) => {
        if (tileRef === anchor)
            return acc_buffer;

        const nextBuffer = spriteNextAttrs(tileRef, 0);
        return Buffer.concat([acc_buffer, nextBuffer]);
    }, buffer);
}

/**
 * Relative pixel coordinates are limited to a range of -128 to 127. If the sprite is too large, we must use an anchor that is closer to the center
 * to avoid an overflow in the relative coordinates.
 *  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
 *                          A               
 * -8 -7 -6 -5 -4 -3 -2 -1 -0 +1 +2 +3 +4 +5 +6 +7
 *  
 * @param cel 
 * @returns 
 */
export function tilemapAnchor(cel: Cel): TileRef {

    if (cel.width > 16 || cel.height > 16)
        throw new Error("The tilemap is too large to be converted to a unified sprite");

    const minX = Math.max(0, cel.width - 8);
    const minY = Math.max(0, cel.height - 8);

    const tilemap = cel.tilemap;
    const anchor = tilemap.find(tile => tile.x >= minX && tile.y >= minY);

    if (!anchor)
        throw new Error("All tiles are empty: no anchor can be used");

    return anchor;
}

export function spriteNextAttrs(tileRef: TileRef, anchorPatternIndex: number): Buffer {
    const buffer = Buffer.alloc(5);
    const isAnchor = tileRef.x === 0 && tileRef.y === 0;

    if (isAnchor) {
        // Anchor tile
        buffer.writeUInt8(tileRef.x * 16, 0);
        buffer.writeUInt8(tileRef.y * 16, 1);
    }
    else {
        buffer.writeInt8(tileRef.x * 16, 0);
        buffer.writeInt8(tileRef.y * 16, 1);
    }

    const patternId = isAnchor ? anchorPatternIndex : tileRef.tile.tileIndex;


    // Attr 2
    const paletteIndex = 0; // For the moment, we asume that we use a common palette
    const attr2bit0 = isAnchor ? (tileRef.x & 0x100) >> 8 : 1;  // X MSB or relative palette
    const attr2bit1to4 = (tileRef.rotation ? 0x02 : 0x00) | (tileRef.yFlip ? 0x04 : 0x00) | (tileRef.xFlip ? 0x08 : 0x00);
    const attr2 = ((paletteIndex) << 4) | attr2bit1to4 | attr2bit0;
    buffer.writeUInt8(attr2, 2);

    // Attr 3
    const attr3 = (patternId & 0x3f) | 0xc0; // Sprite is visible and attribute 4 is used
    buffer.writeUInt8(attr3, 3);

    // Attr 4
    const attr4bit0 = isAnchor ? (tileRef.y & 0x100) >> 8 : 1; // Y MSB or relative pattern
    // Bits 1 to 4 are set to 0 (no scale)
    const attr4bit5 = isAnchor ? 0x20 : 0x00; // Big sprite
    const attr4bit6 = isAnchor ? 0x00 : 0x40; // No collision detection
    buffer.writeUInt8(attr4bit0 | attr4bit5 | attr4bit6, 4);

    return buffer;
}

/**
 * Returns the buffer of attributes and the buffer of sprite patterns (not duplicated) used by the cel. The pattern 
 * and tile attribute that corresponds to the anchor is always the first one.
 * This way, pattern indexes can be relative to the anchor tile.
 * @param cel 
 * @param colorFn 
 * @returns 
 */
export function celSpriteAttrsAndPatterns(cel: Cel, skinOffset: number, colorFn = nextColor256()): [Buffer, Buffer] {
    const tileSize = 16 * 16;
    const anchor = tilemapAnchor(cel);

    const tiles = cel.tilemap.map(tileref => tileref.tile) as Tile<RGBAColor>[];
    // Discard tiles referenced multiple times. First one is the anchor
    const noDupTiles = tiles.reduce((acc, tile) => acc.find(t => t.tileIndex === tile.tileIndex) ? acc : [...acc, tile], [anchor.tile as Tile<RGBAColor>]);

    const patternsBuffer = Buffer.alloc(noDupTiles.length * tileSize);
    for (const [index, tile] of noDupTiles.entries()) {
        for (let i = 0; i < tileSize; i++)
            patternsBuffer.writeUInt8(colorFn(tile.content[i]), index * tileSize + i);
    }

    const tileRemapping = new Map(noDupTiles.map((tile, index) => [tile.tileIndex, index]));
    const reorderedTilemap = [anchor, ...cel.tilemap.filter(tr => tr !== anchor)];
    const remappedTilemap: Array<TileRef> = reorderedTilemap.map(tileref => ({
        ...tileref,
        x: tileref.x - anchor.x,
        y: tileref.y - anchor.y,
        tile: { ...tileref.tile, tileIndex: tileRemapping.get(tileref.tile.tileIndex)! }
    }));

    const attrsBuffer = remappedTilemap.reduce((acc_buffer, tileRef) => Buffer.concat(
        [acc_buffer, spriteNextAttrs(tileRef, skinOffset)]), Buffer.alloc(0));

    return [attrsBuffer, patternsBuffer];
}
