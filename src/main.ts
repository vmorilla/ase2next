import Aseprite from "ase-parser";
import fs from "fs";
import { Command } from "commander";
import { isTileMapCel, tileSetToNextPatterns, tilemapOffset, tilemapToNextSprite } from "./tilemap";
import { OutputAsmFile } from "./asm";

// Function to process the Aseprite file
async function processAsepriteFile(inputFile: string, outputFile: string) {
    // Read the input file
    const buffer = fs.readFileSync(inputFile);
    const ase = new Aseprite(buffer, inputFile);
    ase.parse();
    const cel = ase.frames[0].cels[0];
    const tileset = ase.tilesets[0];

    if (isTileMapCel(cel)) {
        const asm = new OutputAsmFile(outputFile);
        asm.addHeader("BANK 05", ["spr_attrs", "spr_patterns"]);

        const spriteAttrs = tilemapToNextSprite(cel);
        asm.addLabel("spr_attrs");
        asm.addComment(`Sprite size: [${cel.w},${cel.h}]`);
        asm.addComment(`Offset: [${tilemapOffset(cel)}]`);
        asm.writeBuffer(spriteAttrs, 5);

        const spritePatterns = tileSetToNextPatterns(tileset);
        asm.addLabel("spr_patterns");
        asm.writeBuffer(spritePatterns, 16);

        await asm.close();

        console.log(`Tilemap data has been written to ${outputFile}`);
    } else {
        console.error("The provided cel is not a tilemap cel.");
    }
}

// Initialize commander
const program = new Command();

program
    .name('ase2next')
    .version('1.0.0')
    .argument('<input>', 'Input Aseprite file')
    .requiredOption('-o, --output <file>', 'Output file')
    .parse(process.argv);

const options = program.opts();
const inputFile = program.args[0];


// Call the function to process the Aseprite file
processAsepriteFile(inputFile, options.output);
