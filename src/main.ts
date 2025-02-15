import Aseprite from "ase-parser";
import fs from "fs";
import { Command } from "commander";
import { TileMapCel, isTileMapCel, tileSetToNextPatterns, tilemapOffset, tilemapToNextSprite } from "./tilemap";
import { OutputAsmFile } from "./asm";
import { loadSprite } from "./sprite";
import { writeMetadata, writeNextPatterns } from "./next";

// Function to process the Aseprite file
async function processAsepriteFile(inputFile: string, outputFile: string, patternOffset: number) {
    // Read the input file
    const buffer = fs.readFileSync(inputFile);
    const ase = new Aseprite(buffer, inputFile);
    ase.parse();
    const tileLayers = ase.layers.filter(layer => layer.tilesetIndex !== undefined);
    const attributes = [];

    for (let layerIndex = 0; layerIndex < tileLayers.length; layerIndex++) {
        const layer = tileLayers[layerIndex];
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


async function main(inputFiles: string[], metadataFile: string, outputDir: string, attributesFile: string) {

    const patternsFile = `${outputDir}/patterns.bin`;
    const sprites = inputFiles.map(file => loadSprite(file));
    const layers = sprites.flatMap(sprite => sprite.layers);
    const tilesets = layers.map(layer => layer.tileset);
    await writeNextPatterns(tilesets, patternsFile);

    // const attrsFile = `${outputDir}/attributes.asm`;
    // await writeNextAttributes(sprites, attrsFile);

    // Opens the metadata file and parses it as a JSON object
    await writeMetadata(sprites, metadataFile, attributesFile);


    console.log("Done");



    // const tileLayers = ase.layers.filter(layer => layer.tilesetIndex !== undefined);
    // for (let layerIndex = 0; layerIndex < tileLayers.length; layerIndex++) {
    //     const layer = tileLayers[layerIndex];
    //     if (layer.tilesetIndex !== undefined) {
    //         for (let frameIndex = 0; frameIndex < ase.frames.length; frameIndex++) {
    //             const frame = ase.frames[frameIndex];
    //             const cel = frame.cels[layerIndex];
    //             if (isTileMapCel(cel)) {
    //                 const tileset = ase.tilesets[layer.tilesetIndex];
    //                 const patternOffset = 0;
    //                 await processCel(ase, outputDir, cel, tileset, patternOffset);
    //             }
    //             else {
    //                 console.error("Cel does not have a tileset associated");
    //             }
    //         }
    //     }
    // }



}


// Initialize commander
const program = new Command();

program
    .name('ase2next')
    .version('1.0.0')
    .argument('<inputs...>', 'Input Aseprite file')
    .requiredOption('-m, --metadata-file <file>', 'Sprite metadata file')
    .option('-o, --output-dir <dir>', 'Output directory', './')
    .requiredOption('-a, --attributes-file <file>', '.c file for representation of attribute slots')
    .parse(process.argv);

const options = program.opts();
const inputFiles = program.args;


// Call the function to process the Aseprite file
main(inputFiles, options.metadataFile, options.outputDir, options.attributesFile);
