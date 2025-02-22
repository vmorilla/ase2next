import fs from "fs";
import path from "path";
import { Cel, Sprite } from "./sprite";
import { celNumberOfPatterns, celSpriteAttrsAndPatterns, tilemapAnchor } from "./cel";

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
            const binaryFile = binaryFilename(binaryDir, skin.name, cel.frame.frameIndex, skin.cels.length);
            const data = Buffer.concat(celSpriteAttrsAndPatterns(cel));
            fs.writeFileSync(binaryFile, data);

            let defFile = frameDefFiles.find(f => f.fitsInPage(data.length));
            if (!defFile) {
                defFile = new FrameDefFile(page++);
                frameDefFiles.push(defFile);
            }

            const [offsetX, offsetY] = celOffset(cel);
            defFile.addFrame({
                nTiles: cel.tilemap.length,
                nPatterns: celNumberOfPatterns(cel),
                offsetX,
                offsetY,
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



function binaryFilename(binaryDir: string, skin: string, frameIndex: number, nFrames: number) {
    const skin_filename = skin.replace(/[^a-zA-Z0-9_]/g, '_');
    if (nFrames > 1) {
        const frameIndexStr = frameIndex.toString().padStart(2, '0');
        return `${binaryDir}/sprites_${skin_filename}_${frameIndexStr}.bin`;
    }
    else
        return `${binaryDir}/sprites_${skin_filename}.bin`;
}

interface FrameDefData {
    offsetX: number;
    offsetY: number;
    nTiles: number;
    nPatterns: number;
    identifier: string;
    binary_filename: string;
    binary_size: number;
}

const FRAMEDEF_OVERHEAD = 4; // 4 additional bytes for nTiles, nPatterns, offsetX and offsetY
const PAGE_SIZE = 8192;

class FrameDefFile {
    frames: FrameDefData[] = [];

    constructor(public page: number) {
    }

    addFrame(data: FrameDefData) {
        this.frames.push(data);
    }

    memoryUsage() {
        return this.frames.reduce((acc, frame) => acc + frame.binary_size + FRAMEDEF_OVERHEAD, 0);
    }

    fitsInPage(frameSize: number) {
        return this.memoryUsage() + frameSize + FRAMEDEF_OVERHEAD <= PAGE_SIZE;
    }

    writeAsm(asmDir: string) {
        const fileName = asmFilename(asmDir, this.page);
        const fd = fs.openSync(fileName, 'w');
        fs.writeSync(fd, `\tSECTION PAGE_${this.page}\n\n`);
        const symbols = this.frames.map(symbol_name);
        fs.writeSync(fd, `\tPUBLIC ${symbols.join(", ")}\n\n`);

        for (const frame of this.frames) {
            fs.writeSync(fd, `${symbol_name(frame)}:\n`);
            const data = [frame.nTiles, frame.nPatterns, frame.offsetX, frame.offsetY].map(formatByte);
            fs.writeSync(fd, `\tdb ${data.join(", ")}\n`);
            const binary_ref = composePath(asmDir, frame.binary_filename);
            fs.writeSync(fd, `\tincbin "${binary_ref}"\n\n`);
        }

        fs.closeSync(fd);
    }
}


function celOffset(cel: Cel): [number, number] {
    const anchor = tilemapAnchor(cel);
    return [anchor.x * 16 - (cel.width * 16 + cel.xPos) / 2, -cel.height * 16];
}


function asmFilename(asmDir: string, page: number) {
    const pageStr = page.toString().padStart(2, '0');
    return `${asmDir}/sprites_page_${pageStr}.asm`;
}

function formatByte(value: number): string {
    const byteValue = value & 0xFF; // Ensure the value is treated as an 8-bit value
    return `0x${byteValue.toString(16).padStart(2, "0")}`;
}

function symbol_name(frame: FrameDefData) {
    return `_${filename_without_extension(frame.binary_filename)}`;
}


function filename_without_extension(filename: string) {
    return filename.match(/([^\/\\]+)(?=\.\w+$)/)![0];
}

function composePath(referencePath: string, targetPath: string): string {
    const absoluteReferencePath = path.resolve(referencePath);
    const absoluteTargetPath = path.resolve(targetPath);
    const relativePath = path.relative(absoluteReferencePath, absoluteTargetPath);

    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}


