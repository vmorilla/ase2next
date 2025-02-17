import { Command } from "commander";
import { loadSprite } from "./sprite";
import { writeMetadata, writeNextPatterns } from "./next";


async function main(inputFiles: string[], metadataFile: string, outputDir: string, attributesFile: string) {

    const patternsFile = `${outputDir}/sprite-patterns.bin`;
    const sprites = inputFiles.map(file => loadSprite(file));
    const layers = sprites.flatMap(sprite => sprite.layers);
    const tilesets = layers.map(layer => layer.tileset);
    await writeNextPatterns(tilesets, patternsFile);

    // const attrsFile = `${outputDir}/attributes.asm`;
    // await writeNextAttributes(sprites, attrsFile);

    // Opens the metadata file and parses it as a JSON object
    await writeMetadata(sprites, metadataFile, attributesFile);


    console.log("Done");

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
