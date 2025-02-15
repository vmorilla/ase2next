import { OutputAsmFile } from "./asm";
import { Cel, Layer, RGBAColor, Sprite, TileRef, Tileset } from "./sprite";
import fs, { write } from "fs";

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


export async function writeNextPatterns(tilesets: Tileset[], filename: string, colorFn = nextColor256()) {

    // Open the file for writing
    const stream = fs.createWriteStream(filename);

    for (const tileset of tilesets) {
        const patterns = tilesetToNextPatterns(tileset, colorFn);
        stream.write(patterns);
    }
    await stream.end();
    console.log(`Tileset patterns have been written to ${filename}`);
}


function celAttrs(cel: Cel, patternIndexOffset: number): Buffer {
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

/**
 * Assigns an index in the pattern memory to each sprite familty
 * Sprite families include different skins for the same sprite
 * The function calculates the biggest size in the memory pattern 
 * for all the cel frames with the different skins.
 * @param sprites 
 * @returns a map with the family name as key and the index in the pattern memory as value
 */
export function patternIndexes(sprites: Sprite[]): Map<string, number> {
    const indexes = new Map<string, number>();
    let index = 0;
    const families = spriteFamilies(sprites);
    for (const [family, layers] of families) {
        const maxTiles = Math.max(...layers.map(layer => layer.tileset.tiles.length));
        indexes.set(family, index);
        index += maxTiles;
    }

    if (index > 64) {
        throw new Error(`Too many patterns: ${index}`);
    }

    return indexes;
}

/**
 * Groups the layers of the sprites by family name
 * @param sprites 
 * @returns 
 */
export function spriteFamilies(sprites: Sprite[]): Map<string, Layer[]> {
    return groupBy(sprites.flatMap(sprite => sprite.layers), family_name);
}


function family_name(layer: Layer) {
    // Finds the ocurrence of the ":" character and returns the substring before
    // If the "-" character is not found, the function returns the whole string
    const index = layer.name.indexOf(":");
    return index < 0 ? layer.name : layer.name.substring(0, index);
}



function groupBy<T>(array: T[], key: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();

    for (const item of array) {
        const k = key(item);
        if (!map.has(k)) {
            map.set(k, []);
        }
        map.get(k)!.push(item);
    }

    return map;
}

// =================================================================================================
// C file containing the metadata for the sptrite slots
// =================================================================================================

export async function writeMetadata(sprites: Sprite[], metadataFile: string, metadataOutput: string) {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf-8"));
    const stream = fs.createWriteStream(metadataOutput);
    const families = spriteFamilies(sprites);

    const slots = metadata.slots as string[];
    const patIndexes = patternIndexes(sprites);
    let attrIndex = 0;
    writeMetadataHeader(stream);
    for (const slot of slots) {
        const patIndex = patIndexes.get(slot);
        const family = families.get(slot)!;
        const maxTiles = nMaxAttributes(family);
        const nFrames = family[0].cels.length;
        const nSkins = family.length;
        writeSpriteSlot(stream, slot, [attrIndex, maxTiles, patIndex!, nFrames, nSkins], spriteDefLabel(slot));

        attrIndex += maxTiles;
    }
    closeSpriteSlots(stream);

    for (const [family, layers] of families) {
        const label = spriteDefLabel(family);
        writeSpriteDefHeader(stream, label);
        for (const layer of layers) {
            writeSkinComment(stream, layer);
            for (const cel of layer.cels) {
                const [offsetX, offsetY] = celOffset(cel);
                const nTiles = cel.tilemap.filter(t => t !== null).length;
                const label = frameLabel(layer, cel)
                writeStructContent(stream, nTiles, offsetX, offsetY, label);
            }
        }
        writeEndStatement(stream);
    }

    for (const [family, layers] of families) {
        const patIndex = patIndexes.get(family) ?? 0;
        for (const layer of layers) {
            for (const cel of layer.cels) {
                const attrs = celAttrs(cel, patIndex);
                const label = frameLabel(layer, cel)
                writeSpriteAttrs(stream, label, attrs);
            }
        }
    }

    return closeStream(stream);
}

function nMaxAttributes(layer: Layer[]) {
    const cels = layer.flatMap(l => l.cels);
    return Math.max(...cels.map(c => c.tilemap.filter(t => t != null).length));
}

function writeMetadataHeader(stream: fs.WriteStream) {
    stream.write("// **** File generated by ase2next ***\n");
    stream.write("// **** Do not edit ***\n\n");
    stream.write('#include "sprite_slots.h"\n\n');
    stream.write('SpriteSlot spriteSlots[] = {\n');
}

function writeSpriteSlot(stream: fs.WriteStream, slot: string, values: number[], spriteDefRef: string) {
    stream.write(`\t//${slot}\n`);
    stream.write(`\t{ 0, ${values.join(", ")}, &${spriteDefRef}},\n`);
}

function closeSpriteSlots(stream: fs.WriteStream) {
    stream.write(`};\n\n`);
}

function spriteDefLabel(sprite: string) {
    return `sprite_def_${sprite.replace(/[\-]/g, "_")}`;
}

function writeSpriteDefHeader(stream: fs.WriteStream, label: string) {
    stream.write(`SpriteDef ${label}[] = {\n`);
}

function writeSkinComment(stream: fs.WriteStream, skin: Layer) {
    stream.write(`\t// ${skin.name}\n`);
}

function writeEndStatement(stream: fs.WriteStream) {
    stream.write(`};\n\n`);
}

function writeStructContent(stream: fs.WriteStream, ...content: Array<string | number>) {
    const cntString = content.map(c => typeof c === "string" ? c : c.toString()).join(", ");
    stream.write(`\t{${cntString}},\n`);
}

function celOffset(cel: Cel): [number, number] {
    const [anchorX, anchorY] = tilemapAnchor(cel);
    return [anchorX * 16 - (cel.width * 16 + cel.xPos) / 2, -cel.height * 16];
}

// Name to be used for the array holding the attributes of a frame in a skin
function frameLabel(layer: Layer, cel: Cel) {
    return `${layer.name}_${cel.frame.frameIndex}`.replace(/[\-\:]/g, "_");
}

function writeSpriteAttrs(stream: fs.WriteStream, label: string, attrs: Buffer) {
    stream.write(`uint8_t ${label}[] = { \n`);
    for (let line = 0; line < attrs.length; line += 5) {
        stream.write("\t");
        for (let col = 0; col < 5; col++) {
            stream.write(`0x${attrs.readUInt8(line + col).toString(16).padStart(2, '0')}, `);
        }
        stream.write("\n");
    }
    stream.write("};\n\n");
}

async function closeStream(stream: fs.WriteStream) {
    return new Promise<void>((resolve, reject) => {
        stream.end(() => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    });
}
