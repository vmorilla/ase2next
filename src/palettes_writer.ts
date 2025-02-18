import { ColorFn, nextColor256 } from "./colors";
import { Palette, Sprite } from "./sprite";
import fs from "fs";

export async function writePalettes(sprites: Sprite[], palettesFile: string, colorFn = nextColor256()) {
    const palettes: Palette[] = [];
    for (const sprite of sprites)
        if (sprite.palette)
            palettes.push(sprite.palette);

    if (palettes.length === 0)
        throw new Error("No palettes found");

    const stream = fs.createWriteStream(palettesFile);
    for (const palette of palettes) {
        stream.write(serializePalette(palette, colorFn));
    }
    await stream.end();
    console.log(`Tile definitions have been written to ${palettesFile}`);

}


function serializePalette(palette: Palette, colorFn: ColorFn): Buffer {
    const buffer = Buffer.alloc(palette.colors.length);
    palette.colors.forEach((color, index) =>
        buffer.writeUInt8(colorFn(color), index));

    return buffer;
}