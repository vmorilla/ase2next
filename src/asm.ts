
import { Writable } from 'stream';
import * as fs from 'fs';

export class OutputAsmFile {
    private output: Writable;
    constructor(outputFile: string) {
        this.output = fs.createWriteStream(outputFile);
    }

    addHeader(section: string, publics: string[] = []) {
        this.output.write(`\tSECTION ${section}\n\n`);
        if (publics.length > 0) {
            this.output.write(`\tPUBLIC ${publics.join(", ")}\n\n`);
        }
    }

    addLabel(label: string) {
        this.output.write(`${label}:\n`);
    }

    addComment(comment: string) {
        this.output.write(`\t; ${comment}\n`);
    }

    writeBuffer(buffer: Buffer, bytesPerLine: number = 8) {
        for (let i = 0; i < buffer.length; i += bytesPerLine) {
            this.output.write("\tdb ");
            const line = Array.from(buffer.subarray(i, i + bytesPerLine));
            this.output.write(line.map(formatByte).join(", "));
            this.output.write("\n");
        }
        this.output.write("\n");
    }

    close() {
        return new Promise<void>((resolve, reject) => {
            this.output.end(() => {
                this.output.on('finish', resolve);
                this.output.on('error', reject);
            });
        });
    }
}

function formatByte(value: number) {
    return `0x${value.toString(16).padStart(2, "0")}`;
}
