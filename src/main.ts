import Aseprite from "ase-parser";
import fs from "fs";
import { Command } from "commander";
import { TileMapCel, isTileMapCel, tileSetToNextPatterns, tilemapOffset, tilemapToNextSprite } from "./tilemap";
import { OutputAsmFile } from "./asm";

// Function to process the Aseprite file
async function processAsepriteFile(inputFile: string, outputFile: string, patternOffset: number) {
    // Read the input file
    const buffer = fs.readFileSync(inputFile);
    const ase = new Aseprite(buffer, inputFile);
    ase.parse();
    const tileLayers = ase.layers.filter(layer => layer.tilesetIndex !== undefined);

    for (let layerIndex = 0; layerIndex < ase.layers.length; layerIndex++) {
        const layer = ase.layers[layerIndex];
        if (layer.tilesetIndex !== undefined) {
            for (let frameIndex = 0; frameIndex < ase.frames.length; frameIndex++) {
                const frame = ase.frames[frameIndex];
                const cel = frame.cels[layerIndex];
                if (isTileMapCel(cel)) {
                    const tileset = ase.tilesets[layer.tilesetIndex];
                    await processCel(ase, outputFile, cel, tileset, patternOffset);
                }
                else {
                    console.error("Cel does not have a tileset associated");
                }
            }
        }
    }
}

async function processCel(ase: Aseprite, outputFile: string, cel: TileMapCel, tileset: Aseprite.Tileset, patternOffset: number) {
    const asm = new OutputAsmFile(outputFile);
    asm.addHeader("BANK 05", ["_spr_attrs", "_spr_attrs_end"]);

    // Sprite attributes
    const spriteAttrs = tilemapToNextSprite(cel, patternOffset);
    asm.addLabel("_spr_attrs");
    asm.addComment(`Sprite size: [${cel.w},${cel.h}]`);
    asm.addComment(`Offset: [${tilemapOffset(cel)}]`);
    asm.writeBuffer(spriteAttrs, 5);
    asm.addLabel("_spr_patterns_end");
    await asm.close();
    console.log(`Tilemap data has been written to ${outputFile}`);

    // Opens a different file for the patterns
    const patternsFile = "../next-tennis/assets/net.sprite";
    const spritePatterns = tileSetToNextPatterns(tileset);

    // Open a binary file to write the sprite patterns
    fs.writeFileSync(patternsFile, spritePatterns);
    console.log(`Tileset patterns have been written to ${patternsFile}`);
}

// Initialize commander
const program = new Command();

program
    .name('ase2next')
    .version('1.0.0')
    .argument('<input>', 'Input Aseprite file')
    .requiredOption('-o, --output <file>', 'Output file')
    .option('-p, --pattern-offset <offset>', 'Offset for the pattern index', (value) => parseInt(value, 10), 0)
    .parse(process.argv);

const options = program.opts();
const inputFile = program.args[0];


// Call the function to process the Aseprite file
processAsepriteFile(inputFile, options.output, options.patternOffset);
