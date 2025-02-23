import { Command } from "commander";
import { loadSprite } from "./sprite";
// import { writeMetadata, writeSpritePatterns } from "./next";
import { writeTileDefinitions } from "./tiledefs_writer";
import { writePalettes } from "./palettes_writer";
import { writeFrameDefinitions } from "./framedef_file";

interface Options {
    metadataFile?: string;
    writeSpriteAttrSlots?: string;
    writeSpritePatterns?: string;
    writeTileDefinitions?: string;
    writePalettes?: string;
}

async function main(options: Options, inputFiles: string[]) {

    const sprites = inputFiles.map(file => loadSprite(file));
    writeFrameDefinitions(sprites, 28, "../next-tennis/src/", "../next-tennis/assets/");

    const layers = sprites.flatMap(sprite => sprite.layers);
    const tilesets = layers.map(layer => layer.tileset);

    const tileDefinitionsFile = options.writeTileDefinitions;
    if (tileDefinitionsFile !== undefined) {
        await writeTileDefinitions(tilesets, tileDefinitionsFile);
    }

    const palettesFile = options.writePalettes;
    if (palettesFile !== undefined) {
        await writePalettes(sprites, palettesFile);
    }
}


// Initialize commander
const program = new Command();

program
    .name('ase2next')
    .version('1.0.0')
    .argument('<inputs...>', 'Input Aseprite file')
    .option('-m, --metadata-file <file>', 'Sprite metadata input file')
    .option('-s, --write-sprite-attr-slots <file>', 'Output .c file for representation of attribute slots')
    .option('-p, --write-sprite-patterns <file>', 'Output sprite patterns file')
    .option('-t, --write-tile-definitions <file>', 'Write tile definitions to binary file')
    .option('-c, --write-palettes <file>', 'Write palettes to binary file')
    .parse(process.argv);

const options = program.opts();
const inputFiles = program.args;

// Call the function to process the Aseprite file
main(options, inputFiles);
