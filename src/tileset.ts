import { ColorFn } from "./colors";
import { Tileset } from "./sprite";

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
