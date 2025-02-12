import Aseprite from "ase-parser";
import fs from "fs";

export interface Sprite {
    name: string;
    layers: Layer[];
    frames: Frame[];
    tilesets: Tileset[];
}

export interface Layer {
    layerIndex: number;
    name: string;
    tileset: Tileset;
    cels: Cel[];
}

export interface Tileset {
    tilesetIndex: number;
    tiles: Tile[];
}

export interface Tile {
    tileIndex: number;
    content: number[];
}

export interface Frame {
    frameIndex: number;
}

export interface Cel {
    frame: Frame;
    width: number;
    height: number;
    tilemap: Array<TileRef | null>;
}

export interface TileRef {
    tile: Tile;
    xFlip: boolean;
    yFlip: boolean;
    rotation: boolean;
}

export function loadSprite(file: string): Sprite {
    const buffer = fs.readFileSync(file);
    const ase = new Aseprite(buffer, file);
    ase.parse();

    const tilesets = loadTilesets(ase);
    const frames = loadFrames(ase);
    const layers = loadLayers(ase, tilesets, frames);
    // Regular expression to extract the file name without extension or path
    const name = file.match(/([^\/\\]+)(?=\.\w+$)/)![0];
    return {
        name,
        layers,
        tilesets,
        frames
    }
}

function loadFrames(ase: Aseprite): Frame[] {
    return ase.frames.map((frame, frameIndex) => {
        return { frameIndex, duration: frame.frameDuration };
    });
}

function loadTilesets(ase: Aseprite): Tileset[] {
    return ase.tilesets.map((tileset, tilesetIndex) => {
        return {
            tilesetIndex,
            tiles: Array.from(loadTiles(tileset))
        };
    });
}

function* loadTiles(tileset: Aseprite.Tileset): Generator<Tile> {
    const bytesPerPoint = 4; // bytes per point in aseprite tileset
    const tileSize = tileset.tileWidth * tileset.tileHeight;

    for (let tileIndex = 1; tileIndex < tileset.tileCount; tileIndex += 1) {
        const tile: Tile = { tileIndex: tileIndex - 1, content: [] };
        for (let point = 0; point < tileSize; point += 1) {
            const pointIndex = (tileSize * tileIndex + point) * bytesPerPoint;
            const [r, g, b, a] = Array.from(tileset.rawTilesetData!.subarray(pointIndex, pointIndex + 4));
            const color = nextColor(r, g, b, a, 227);
            tile.content.push(color);
        }
        yield tile;
    }
}

function nextColor(r: number, g: number, b: number, a: number, transparentIndex: number): number {
    return a === 0 ? transparentIndex : (r & 0b11100000) | ((g & 0b11100000) >> 3) | ((b & 0b11000000) >> 6);
}


function loadLayers(ase: Aseprite, tilesets: Tileset[], frames: Frame[]): Layer[] {
    const layers: Layer[] = [];

    for (let layerIndex = 0; layerIndex < ase.layers.length; layerIndex++) {
        const layer = ase.layers[layerIndex];
        if (layer.tilesetIndex !== undefined) {
            const tileset = tilesets[layer.tilesetIndex];
            const cels = frames.map(frame => loadCel(ase.frames[frame.frameIndex].cels[layerIndex], frame, tileset));
            layers.push({
                layerIndex,
                name: layer.name,
                tileset,
                cels
            });
        }
    }

    return layers;
}

function loadCel(cel: Aseprite.Cel, frame: Frame, tileset: Tileset): Cel {

    const tilemap: Array<TileRef | null> = [];
    const tileMetadata = cel.tilemapMetadata!;
    const bytesPerTile = Math.ceil(tileMetadata.bitsPerTile / 8);
    const dataView = new DataView(cel.rawCelData.buffer);

    for (let i = 0; i < cel.rawCelData.byteLength; i += bytesPerTile) {
        const value = dataView.getUint32(i, true);
        const tileId = value & tileMetadata.bitmaskForTileId;

        if (tileId !== 0) {
            const xFlip = (value & tileMetadata.bitmaskForXFlip) !== 0;
            const yFlip = (value & tileMetadata.bitmaskForYFlip) !== 0;
            const rotation = (value & tileMetadata.bitmaskFor90CWRotation) !== 0;
            const tile = tileset.tiles[tileId - 1];
            tilemap.push({ tile, xFlip, yFlip, rotation });
        }
        else
            tilemap.push(null);
    }

    return {
        frame,
        width: cel.w,
        height: cel.h,
        tilemap
    };
}