import { ColorFn } from "./colors";
import { IndexedColorTileset, RGBAColorTileset } from "./sprite";

/**
 * Produces a byte buffer with the sprite patterns in a tileset using Next format.
 * @param tileset 
 * @param colorFn Function to transform RGBA colors to a byte index
 * @returns 
 */
export function tilesetToSpritePatterns(tileset: RGBAColorTileset, colorFn: ColorFn): Buffer {
    if (tileset.width !== 16 || tileset.height !== 16)
        throw new Error("Only 16x16 tilesets are supported for sprites");
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

/**
 * Produces a byte buffer with the tile defintions for the tile layer in Next format
 * using 4 bits per pixel
 * @param tileset
 */
export function tilesetToTileDefinitions(tileset: IndexedColorTileset) {
    if (tileset.width !== 8 || tileset.height !== 8)
        throw new Error("Only 8x8 tilesets are supported for tile definitions");

    const tileSize = tileset.width * tileset.height;
    const nTiles = tileset.tiles.length;
    const buffer = Buffer.alloc(tileSize * nTiles / 2);

    for (let tileIndex = 0; tileIndex < nTiles; tileIndex++) {
        const tile = tileset.tiles[tileIndex];
        for (let point = 0; point < tileSize; point += 2) {
            const color = (tile.content[point] << 4) + tile.content[point + 1];
            buffer.writeUInt8(color, (tileIndex * tileSize + point) / 2);
        }
    }

    return buffer;

}