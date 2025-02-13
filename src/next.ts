import { OutputAsmFile } from "./asm";
import { Cel, RGBAColor, Sprite, TileRef, Tileset } from "./sprite";
import fs from "fs";

export type ColorFn = (color: RGBAColor) => number;


export function tilesetToNextPatterns(tileset: Tileset, colorFn: ColorFn): Buffer {
    const tileSize = tileset.width * tileset.height;
    const nTiles = tileset.tiles.length;
    const buffer = Buffer.alloc(tileSize * nTiles);

    for (let tile = 0; tile < nTiles; tile += 1) {
        for (let point = 0; point < tileSize; point++) {
            const rgbaColor = tileset.tiles[tile].content[point];
            const nextColor = colorFn(rgbaColor);
            buffer.writeUInt8(nextColor, tile * tileSize + point);
        }
    }

    return buffer;
}

export function nextColor256(transparentIndex = 227) {
    return (color: RGBAColor) => {
        const [r, g, b, a] = color;
        return a === 0 ? transparentIndex : (r & 0b11100000) | ((g & 0b11100000) >> 3) | ((b & 0b11000000) >> 6);
    }
}


export async function writeNextPatters(tilesets: Tileset[], filename: string, colorFn = nextColor256()) {

    // Open the file for writing
    const stream = fs.createWriteStream(filename);

    for (const tileset of tilesets) {
        const patterns = tilesetToNextPatterns(tileset, colorFn);
        stream.write(patterns);
    }
    await stream.end();
    console.log(`Tileset patterns have been written to ${filename}`);
}


export async function writeNextAttributes(sprites: Sprite[], indexes: Map<string, number>, outputFile: string) {
    const asm = new OutputAsmFile(outputFile);

    const layers = sprites.flatMap(sprite => sprite.layers);
    asm.addHeader("BANK 05", layers.map(layer => spriteLabel(layer.name)));

    for (const layer of layers) {
        asm.addLabel(spriteLabel(layer.name));
        const indexOffset = indexes.get(layer.name);
        if (indexOffset === undefined)
            throw new Error(`Layer ${layer.name} not found in indexes`);

        for (const cel of layer.cels) {
            asm.addComment(`Frame ${cel.frame.frameIndex}`);
            asm.writeBuffer(celAttrs(cel, indexOffset), 5);
        }
    }

    await asm.close();

}

function celAttrs(cel: Cel, patternIndexOffset: number): Buffer {
    const [anchorX, anchorY] = tilemapAnchor(cel);
    const anchorIndex = anchorX + anchorY * cel.width;
    const buffer = spriteNextAttrs(cel.tilemap[anchorIndex]!, true, anchorX, anchorY, patternIndexOffset);

    return cel.tilemap.reduce((acc_buffer, tileRef, index) => {
        if (tileRef === null || index === anchorIndex)
            return acc_buffer;

        const x = index % cel.width - anchorX;
        const y = Math.floor(index / cel.width) - anchorY;
        const nextBuffer = spriteNextAttrs(tileRef, false, x, y, tileRef.tile.tileIndex + patternIndexOffset);
        return Buffer.concat([acc_buffer, nextBuffer]);
    }, buffer);
}

function spriteLabel(sprite: string) {
    return `_sprite_${sprite.replace(/[\-]/g, "_")}`;
}

function spriteNextAttrs(tileRef: TileRef, anchor: boolean, x: number, y: number, patternIndexOffset: number): Buffer {
    const patternId = tileRef.tile.tileIndex + patternIndexOffset;
    console.log(`${x},${y}:  ${patternId} - xflip: ${tileRef.xFlip} - yFlip: ${tileRef.yFlip} - rot: ${tileRef.rotation} - ancho: ${anchor}`);
    const buffer = Buffer.alloc(5);
    if (anchor) {
        buffer.writeUInt8(x * 16, 0);
        buffer.writeUInt8(y * 16, 1);
    }
    else {
        // Relative sprites coordinates can be negative
        buffer.writeInt8(x * 16, 0);
        buffer.writeInt8(y * 16, 1);
    }

    // Attr 2
    const paletteIndex = 0; // For the moment, we asume that we use a common palette
    const attr2bit0 = anchor ? (x & 0x100) >> 8 : 1;  // X MSB or relative palette
    const attr2bit1to4 = (tileRef.rotation ? 0x02 : 0x00) | (tileRef.yFlip ? 0x04 : 0x00) | (tileRef.xFlip ? 0x08 : 0x00);
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
function tilemapAnchor(cel: Cel): [number, number] {

    if (cel.width > 16 || cel.height > 16)
        throw new Error("The tilemap is too large to be converted to a unified sprite");

    const minX = Math.max(0, cel.width - 8);
    const minY = Math.max(0, cel.height - 8);

    const tilemap = cel.tilemap;
    const anchor = tilemap.findIndex((tile, index) => tile !== null && index % cel.width >= minX && Math.floor(index / cel.width) >= minY);

    if (anchor < 0)
        throw new Error("All tiles are empty: no anchor can be used");
    return [anchor % cel.width, Math.floor(anchor / cel.width)];
}