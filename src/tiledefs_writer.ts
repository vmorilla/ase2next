import { IndexedColorTileset, Tileset } from "./sprite";
import { tilesetToTileDefinitions } from "./tileset";
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
