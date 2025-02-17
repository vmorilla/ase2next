import { Cel, TileRef } from "./sprite";

export function celAttrs(cel: Cel, patternIndexOffset: number): Buffer {
    const [anchorX, anchorY] = tilemapAnchor(cel);
    const anchorIndex = anchorX + anchorY * cel.width;
    const buffer = spriteNextAttrs(cel.tilemap[anchorIndex]!, true, 0, 0, patternIndexOffset);

    return cel.tilemap.reduce((acc_buffer, tileRef, index) => {
        if (tileRef === null || index === anchorIndex)
            return acc_buffer;

        const x = index % cel.width - anchorX;
        const y = Math.floor(index / cel.width) - anchorY;
        const nextBuffer = spriteNextAttrs(tileRef, false, x, y, patternIndexOffset);
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

function spriteNextAttrs(tileRef: TileRef, anchor: boolean, x: number, y: number, patternIndexOffset: number): Buffer {
    const patternId = tileRef.tile.tileIndex + patternIndexOffset;
    console.log(`${x},${y}:  ${patternId} - xflip: ${tileRef.xFlip} - yFlip: ${tileRef.yFlip} - rot: ${tileRef.rotation} - ancho: ${anchor}`);
    const buffer = Buffer.alloc(5);

    if (anchor) {
        buffer.writeUInt8(x * 16, 0);
        buffer.writeUInt8(y * 16, 1);
    }
    else {
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

export function celOffset(cel: Cel): [number, number] {
    const [anchorX, anchorY] = tilemapAnchor(cel);
    return [anchorX * 16 - (cel.width * 16 + cel.xPos) / 2, -cel.height * 16];
}