import { Command } from "commander";
import { loadSprite, Point, Tileset } from "./sprite";
import { writeTileDefinitions } from "./tiledefs_writer";
import { writePalettes } from "./palettes_writer";
import { writeFrameDefinitions } from "./framedef_file";

interface Options {
    sourcesDir?: string;
    assetsDir?: string;
    bank?: number;
    writeTileDefinitions?: string;
    writePalettes?: string;
}

export const ReferencePoint = {
    TopLeft: [0, 0] as Point,
    TopCenter: [0.5, 0] as Point,
    TopRight: [1, 0] as Point,
    BottomLeft: [0, 1] as Point,
    BottomRight: [1, 1] as Point,
    BottomCenter: [0.5, 1] as Point,
    Center: [0.5, 0.5] as Point
}

async function main(options: Options, inputFiles: string[]) {

    const sprites = inputFiles.map(file => loadSprite(file));

    if (options.bank || options.assetsDir || options.sourcesDir) {
        if (!options.bank || !options.assetsDir || !options.sourcesDir) {
            throw new Error("Bank, assets directory and sources directory must be specified together");
        }
        // Write sprite definitions mode
        writeFrameDefinitions(sprites, options.bank, options.sourcesDir, options.assetsDir, ReferencePoint.BottomCenter);
    }

    const tileDefinitionsFile = options.writeTileDefinitions;
    if (tileDefinitionsFile !== undefined) {
        const layers = sprites.flatMap(sprite => sprite.layers);
        const tilesets = layers.filter(layer => layer.tileset).map(layer => layer.tileset) as Tileset[];
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
    .argument('<inputs...>', 'Input Aseprite files')
    .option('-s, --sources-dir <dir>', 'Output directory for source files (.c, .asm and .h)')
    .option('-a, --assets-dir <dir>', 'Output directory for asset files')
    .option('-b, --bank <number>', 'Starting 8k bank number for sprite assets')
    .option('-t, --write-tile-definitions <file>', 'Write tile definitions to binary file')
    .option('-c, --write-palettes <file>', 'Write palettes to binary file')
    .parse(process.argv);

const options = program.opts();
const inputFiles = program.args;

// Call the function to process the Aseprite file
main(options, inputFiles);
