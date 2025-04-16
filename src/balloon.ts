import { Sprite, TileRef } from "./sprite";

import fs from "fs";

const BALLOON_MAP_X = 19;
const BALLOON_MAP_Y = 5;
const BALLOON_WIDTH = 13;
const BALLOON_HEIGHT = 4;
const PALETTE = 2;

export async function writeBalloonMap(sprite: Sprite, filename: string) {
    // Assumes one layer... gets first cel
    // Restricted to first cel
    const cel = sprite.layers[0].cels[0];

    // Creates a new list to of size cell.width * cell.height to hold the tilemap
    const tileArray: TileRef[] = new Array(cel.width * cel.height);
    for (const tileref of cel.tilemap) {
        tileArray[tileref.x + tileref.y * cel.width] = tileref;
    }

    // Write character and attrByte bytes to an output stream

    const stream = fs.createWriteStream(filename);

    // Write columns (to facilitate expansion of the ballon runtime)
    for (let x = BALLOON_MAP_X; x < BALLOON_MAP_X + BALLOON_WIDTH; x++) {
        for (let y = BALLOON_MAP_Y; y < BALLOON_MAP_Y + BALLOON_HEIGHT; y++) {
            const tileRef = tileArray[y * cel.width + x];
            if (tileRef === undefined) {
                stream.write(Buffer.from([0x00]));
                stream.write(Buffer.from([0x00]));
            }
            else {
                const character = tileRef.tile.tileIndex + 1;
                const xMirror = tileRef.xFlip ? 1 : 0;
                const yMirror = tileRef.yFlip ? 1 : 0;
                const attrByte = (PALETTE << 4) | (xMirror << 3) | (yMirror << 2);

                // Write character and attrByte to the stream
                stream.write(Buffer.from([character]));
                stream.write(Buffer.from([attrByte]));
            }
        }
    }
    // Close the stream
    await stream.end();
}
