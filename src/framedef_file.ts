import fs from "fs";
import path from "path";

export interface FrameDefData {
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

export class FrameDefFile {
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

function asmFilename(asmDir: string, page: number) {
    const pageStr = page.toString().padStart(2, '0');
    return `${asmDir}/sprites_page_${pageStr}.asm`;
}

function formatByte(value: number) {
    return `0x${value.toString(16).padStart(2, "0")}`;
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
