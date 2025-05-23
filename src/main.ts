import { Command } from "commander";
import { loadSprite, Point, Tileset } from "./sprite";
import { writeTileDefinitions } from "./tiledefs_writer";
import { writePalettes } from "./palettes_writer";
import { writeFrameDefinitions } from "./framedef_file";
import { writeLayer2 } from "./layer2_writer";
import { writeBalloonMap } from "./balloon";

interface Options {
    sourcesDir?: string;
    assetsDir?: string;
    bank?: number;
    writeTileDefinitions?: string;
    writePalettes?: string;
    layer2Prefix?: string;
    balloonMap?: string;
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

    if (options.layer2Prefix) {
        // For the moment, we only process a sprite file
        await writeLayer2(sprites[0], options.layer2Prefix);
    }

    if (options.bank || options.assetsDir || options.sourcesDir) {
        if (!options.bank || !options.assetsDir || !options.sourcesDir) {
            throw new Error("Bank, assets directory and sources directory must be specified together");
        }
        // Write sprite definitions mode
        writeFrameDefinitions(sprites, options.bank, options.sourcesDir, options.assetsDir, ReferencePoint.BottomCenter);
        console.log(`Wrote sprite definitions starting in bank ${options.bank}`);

    }

    const tileDefinitionsFile = options.writeTileDefinitions;
    if (tileDefinitionsFile !== undefined) {
        const layers = sprites.flatMap(sprite => sprite.layers);
        const tilesets = layers.filter(layer => layer.tileset).map(layer => layer.tileset) as Tileset[];
        await writeTileDefinitions(tilesets, tileDefinitionsFile);
        if (options.balloonMap !== undefined) {
            await writeBalloonMap(sprites[0], options.balloonMap); // Ad hoc call to get the balloon map
        }
    }

    const palettesFile = options.writePalettes;
    if (palettesFile !== undefined) {
        await writePalettes(sprites, palettesFile);
    }

    return 0;
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
    .option('-l, --layer2-prefix <prefix>', 'Write layer2 files using the provided prefix')
    .option('-m, --balloon-map <file>', 'Write balloon map to binary file')
    .parse(process.argv);

const options = program.opts();
const inputFiles = program.args;

// Call the function to process the Aseprite file
main(options, inputFiles);
