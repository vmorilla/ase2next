import { nextColor256 } from "./colors";
import { Cel, RGBAColor, Sprite, Tile } from "./sprite";
import fs from "fs";
import sharp from "sharp";


export async function writeLayer2(sprite: Sprite, layer2Prefix: string) {
    // Assumes one layer... gets first cel
    // Restricted to first cel
    const cel = sprite.layers[0].cels[0];
    const buffer = celBitmap(cel);
    const bankSize = 16384;
    for (let bank = 0; bank < buffer.length / bankSize; bank++) {
        const stream = fs.createWriteStream(layer2Prefix + bank);
        stream.write(buffer.subarray(bank * bankSize, Math.min((bank + 1) * bankSize, buffer.length)));
    }

    await writeToPng(buffer, cel.canvasHeight, cel.canvasWidth, layer2Prefix + ".png");
}

async function writeToPng(buffer: Buffer, width: number, height: number, outputPath: string): Promise<void> {
    // Create a new buffer with RGBA format (4 bytes per pixel)
    const rgbaBuffer = Buffer.alloc(width * height * 4);

    // Convert indexed color buffer to RGBA
    for (let i = 0; i < buffer.length; i++) {
        const color = buffer[i];
        // Simple palette mapping: using colorIndex for all RGB channels
        const r = (color & 0b11100) << 3;
        const g = color & 0b11100000;
        const b = (color & 0b11) << 5;

        rgbaBuffer[i * 4] = r;     // R
        rgbaBuffer[i * 4 + 1] = g; // G
        rgbaBuffer[i * 4 + 2] = b; // B
        rgbaBuffer[i * 4 + 3] = 255;        // A (fully opaque)
    }

    // Use sharp to create a PNG
    await sharp(rgbaBuffer, {
        raw: {
            width,
            height,
            channels: 4
        }
    })
        .png()
        .toFile(outputPath);

    console.log(`PNG file written to ${outputPath}`);
}

function celBitmap(cel: Cel, colorFn = nextColor256()): Buffer {
    const tileHeight = 16;
    const tileWidth = 16;
    const tileSize = tileWidth * tileHeight;
    const tiles = cel.tilemap.map(tileref => tileref.tile) as Tile<RGBAColor>[];

    const buffer = Buffer.alloc(tiles.length * tileSize);
    for (let x = 0; x < cel.canvasWidth; x++) {
        for (let y = 0; y < cel.canvasHeight; y++) {
            const xTile = Math.floor(x / tileWidth);
            const yTile = Math.floor(y / tileHeight);
            const tileIndex = yTile * cel.canvasWidth / tileWidth + xTile;
            const tile = cel.tilemap[tileIndex].tile as Tile<RGBAColor>;
            const xoffset = x - xTile * tileWidth;
            const yoffset = y - yTile * tileHeight;
            const tilePoint = tile.content[xoffset + yoffset * tileWidth];
            buffer.writeUint8(colorFn(tilePoint), x + y * cel.canvasWidth);
        }
    }

    return buffer;
}

function celBitmap2(cel: Cel, colorFn = nextColor256()): Buffer {
    const tileHeight = 16;
    const tileWidth = 16;
    const tileSize = tileWidth * tileHeight;
    const tiles = cel.tilemap.map(tileref => tileref.tile) as Tile<RGBAColor>[];

    const buffer = Buffer.alloc(tiles.length * tileSize);

    for (let tileX = 0; tileX < cel.canvasWidth / tileWidth; tileX++)
        for (let offsetX = 0; offsetX < tileWidth; offsetX++)
            for (let tileY = 0; tileY < cel.canvasHeight / tileHeight; tileY++)
                for (let offsetY = 0; offsetY < tileHeight; offsetY++) {
                    const tileIndex = tileY * cel.canvasWidth / tileWidth + tileX;
                    const tile = cel.tilemap[tileIndex].tile as Tile<RGBAColor>;
                    const tilePoint = tile.content[offsetX + offsetY * tileWidth];
                    buffer.writeUint8(colorFn(tilePoint), offsetX + tileX * tileWidth + (offsetY + tileY * tileHeight) * cel.canvasWidth);
                }

    return buffer;
}
