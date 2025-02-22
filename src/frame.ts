import { celNumberOfPatterns, celSpriteAttrsAndPatterns } from "./cel";
import { FrameDefFile } from "./framedef_file";
import { Sprite } from "./sprite";
import fs from "fs";



/**
 * Produces a set of asm files with the frame definition of all the sprites, together with binary files for its content
 * Asm files are grouped by memory page (8k) starting in the @page parameter.
 * The content includes both the attributes and the patterns
 * Asm files follow the name convention: @asmDir/sprites_page_nn.asm
 * Binary files follow the name convention: @binaryDir/sprites_skin_nn.bin where nn is the frame number
 */
export async function writeFrameDefinitions(sprites: Sprite[], page: number, asmDir: string, binaryDir: string) {
    const frameDefFiles: FrameDefFile[] = [];
    const skins = sprites.flatMap(sprite => sprite.layers);

    for (const skin of skins) {
        for (const cel of skin.cels) {
            const binaryFile = binaryFilename(binaryDir, skin.name, cel.frame.frameIndex);
            const data = Buffer.concat(celSpriteAttrsAndPatterns(cel));
            fs.writeFileSync(binaryFile, data);

            let defFile = frameDefFiles.find(f => f.fitsInPage(data.length));
            if (!defFile) {
                defFile = new FrameDefFile(page++);
                frameDefFiles.push(defFile);
            }
            defFile.addFrame({
                nTiles: cel.tilemap.length,
                nPatterns: celNumberOfPatterns(cel),
                // TODO: Missing
                offsetX: 0,
                offsetY: 0,
                identifier: `sprite_${skin.name}_${cel.frame.frameIndex}`,
                binary_filename: binaryFile,
                binary_size: data.length
            });
        }
    }

    for (const defFile of frameDefFiles) {
        defFile.writeAsm(asmDir);
    }
}



function binaryFilename(binaryDir: string, skin: string, frameIndex: number) {
    const frameIndexStr = frameIndex.toString().padStart(2, '0');
    const skin_filename = skin.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${binaryDir}/sprites_${skin_filename}_${frameIndexStr}.bin`;
}

