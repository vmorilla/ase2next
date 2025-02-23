import { IndexedColorTileset, Tileset } from "./sprite";
import fs from "fs";

export async function writeTileDefinitions(tilesets: Tileset[], tileDefinitionsFile: string) {

    // Open the file for writing
    const relevantTilesets = tilesets.filter(tileset => tileset.indexedColor && tileset.height == 8 && tileset.width == 8);
    if (relevantTilesets.length === 0) {
        throw new Error("No 8x8 indexed color tilesets found");
    }
    const stream = fs.createWriteStream(tileDefinitionsFile);
    for (const tileset of relevantTilesets) {
        const patterns = tilesetToTileDefinitions(tileset as IndexedColorTileset);
        stream.write(patterns);
    }
    await stream.end();
    console.log(`Tile definitions have been written to ${tileDefinitionsFile}`);
}


/**
 * Produces a byte buffer with the tile defintions for the tile layer in Next format
 * using 4 bits per pixel
 * @param tileset
 */
function tilesetToTileDefinitions(tileset: IndexedColorTileset) {
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


