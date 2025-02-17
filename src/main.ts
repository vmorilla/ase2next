import { Command, OptionValues } from "commander";
import { loadSprite } from "./sprite";
import { writeMetadata, writeSpritePatterns } from "./next";


async function main(options: OptionValues, inputFiles: string[]) {

    const patternsFile = `${options.outputDir}/sprite-patterns.bin`;
    const sprites = inputFiles.map(file => loadSprite(file));
    const layers = sprites.flatMap(sprite => sprite.layers);
    const tilesets = layers.map(layer => layer.tileset);
    await writeSpritePatterns(tilesets, patternsFile);
    console.log(`Patterns written to ${patternsFile}`);

    // Opens the metadata file and parses it as a JSON object
    await writeMetadata(sprites, options.metadataFile, options.attributesFile);
    console.log(`Metadata written to ${options.attributesFile}`);


    console.log("Done");
}


// Initialize commander
const program = new Command();

program
    .name('ase2next')
    .version('1.0.0')
    .argument('<inputs...>', 'Input Aseprite file')
    .requiredOption('-m, --metadata-file <file>', 'Sprite metadata input file')
    .option('-o, --output-dir <dir>', 'Output directory', './')
    .requiredOption('-a, --attributes-file <file>', 'Output .c file for representation of attribute slots')
    .parse(process.argv);

const options = program.opts();
const inputFiles = program.args;

// Call the function to process the Aseprite file
main(options, inputFiles);
