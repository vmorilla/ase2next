import Aseprite from "ase-parser";
import fs from "fs";

export interface Sprite {
    name: string;
    width: number;
    height: number;
    palette?: Palette;
    layers: Layer[];
    frames: Frame[];
    tilesets: Tileset[];
}

export type Point = [number, number];

export interface Palette {
    colors: RGBAColor[]
}

export interface Layer {
    layerIndex: number;
    name: string;
    tileset?: Tileset;
    cels: Cel[];
}

interface TilesetBase {
    tilesetIndex: number;
    width: number;
    height: number;
}

export interface IndexedColorTileset extends TilesetBase {
    indexedColor: true;
    tiles: Tile<IndexColor>[];
}

export interface RGBAColorTileset extends TilesetBase {
    indexedColor: false;
    tiles: Tile<RGBAColor>[];
}

export type Tileset = IndexedColorTileset | RGBAColorTileset;

export interface Tile<Color> {
    tileIndex: number;
    content: Color[];
}

export type AnyTile = Tile<IndexColor> | Tile<RGBAColor>;

export interface Frame {
    frameIndex: number;
}

export interface Cel {
    canvasWidth: number;
    canvasHeight: number;
    frame: Frame;
    width: number;
    height: number;
    xPos: number;
    yPos: number;
    tilemap: Array<TileRef>;
}

export interface TileRef {
    x: number;
    y: number;
    tile: Tile<IndexColor> | Tile<RGBAColor>;
    xFlip: boolean;
    yFlip: boolean;
    rotation: boolean;
}

export type RGBAColor = [number, number, number, number];
export const TRANSPARENT_COLOR: RGBAColor = [0, 0, 0, 0];
export type IndexColor = number;

export function loadSprite(file: string): Sprite {
    const buffer = fs.readFileSync(file);
    const ase = new Aseprite(buffer, file);
    try {
        ase.parse();
        const palette = ase.palette ? loadPalette(ase.palette, ase.paletteIndex) : undefined;
        const tilesets = loadTilesets(ase);
        const frames = loadFrames(ase);
        const layers = loadLayers(ase, tilesets, frames);
        // Regular expression to extract the file name without extension or path
        const name = file.match(/([^\/\\]+)(?=\.\w+$)/)![0];
        return {
            width: ase.width,
            height: ase.height,
            name,
            layers,
            tilesets,
            frames,
            palette
        }
    } catch (error: any) {
        throw new Error(`Error parsing file ${file}: ${error.message}`);
    }
}

function loadPalette(palette: Aseprite.Palette | Aseprite.OldPalette, transparentIndex: number): Palette {
    const colors: RGBAColor[] = palette.colors.map(color => color ? [color.red, color.green, color.blue, color.alpha] : [0, 0, 0, 255]);
    if (!palette.hasOwnProperty("firstColor"))
        colors[transparentIndex][3] = 0; // Sets alpha channel to 0
    return {
        colors
    };

}

function loadFrames(ase: Aseprite): Frame[] {
    return ase.frames.map((frame, frameIndex) => {
        return { frameIndex, duration: frame.frameDuration };
    });
}

function loadTilesets(ase: Aseprite): Tileset[] {
    return ase.tilesets.map((tileset, tilesetIndex) => {
        const commonFields = {
            tilesetIndex,
            width: tileset.tileWidth,
            height: tileset.tileHeight
        };

        const bytesPerColor = tileset.rawTilesetData!.byteLength / (tileset.tileWidth * tileset.tileHeight * tileset.tileCount);

        return bytesPerColor === 1 ? {
            ...commonFields,
            indexedColor: true,
            tiles: Array.from(loadIndexedColorTiles(tileset))
        } :
            {
                ...commonFields,
                indexedColor: false,
                tiles: Array.from(loadRGBATiles(tileset)),
            };
    });
}

function* loadRGBATiles(tileset: Aseprite.Tileset): Generator<Tile<RGBAColor>> {
    const bytesPerPoint = 4; // bytes per point in aseprite tileset
    const tileSize = tileset.tileWidth * tileset.tileHeight;

    for (let tileIndex = 1; tileIndex < tileset.tileCount; tileIndex += 1) {
        const tile: Tile<RGBAColor> = { tileIndex: tileIndex - 1, content: [] };
        for (let point = 0; point < tileSize; point += 1) {
            const pointIndex = (tileSize * tileIndex + point) * bytesPerPoint;
            const color = Array.from(tileset.rawTilesetData!.subarray(pointIndex, pointIndex + 4)) as RGBAColor;
            tile.content.push(color);
        }
        yield tile;
    }
}

function* loadIndexedColorTiles(tileset: Aseprite.Tileset): Generator<Tile<IndexColor>> {
    const tileSize = tileset.tileWidth * tileset.tileHeight;

    for (let tileIndex = 0; tileIndex < tileset.tileCount; tileIndex += 1) {
        const tile: Tile<IndexColor> = { tileIndex: tileIndex, content: [] };
        for (let point = 0; point < tileSize; point += 1) {
            const pointIndex = (tileSize * tileIndex + point);
            const color = tileset.rawTilesetData![pointIndex];
            tile.content.push(color);
        }
        yield tile;
    }
}

// Convenience type to add the layer index to the aseprite layer
interface IndexedLayer extends Aseprite.Layer {
    layerIndex: number;
}

function loadLayers(ase: Aseprite, tilesets: Tileset[], frames: Frame[]): Layer[] {
    const layers: Layer[] = [];
    const indexedLayers = ase.layers.map((layer, layerIndex) => ({ ...layer, layerIndex }));
    const visibleLayers = indexedLayers.filter(layer => layer.flags.visible);
    const tiledLayers = visibleLayers.filter(layer => layer.tilesetIndex !== undefined);

    for (const layer of tiledLayers) {
        const tileset = tilesets[layer.tilesetIndex!];
        const cels = frames.map(frame => loadTiledCel(ase.frames[frame.frameIndex].cels[layer.layerIndex], frame, tileset, ase.width, ase.height));
        layers.push({
            layerIndex: layer.layerIndex,
            name: layer.name,
            tileset,
            cels
        });
    }

    const rgbLayers = visibleLayers.filter(layer => layer.tilesetIndex === undefined);
    if (rgbLayers.length > 0) {
        const cels = mergeLayers(rgbLayers, frames, ase);
        const refLayer = rgbLayers[0];
        layers.push({
            layerIndex: refLayer.layerIndex,
            name: refLayer.name,
            cels
        });
    }

    return layers;
}

function loadTiledCel(cel: Aseprite.Cel, frame: Frame, tileset: Tileset, canvasWidth: number, canvasHeight: number): Cel {

    const tilemap: Array<TileRef> = [];
    const tileMetadata = cel.tilemapMetadata!;
    const bytesPerTile = Math.ceil(tileMetadata.bitsPerTile / 8);
    const dataView = new DataView(cel.rawCelData.buffer);

    for (let i = 0; i < cel.rawCelData.byteLength; i += bytesPerTile) {
        const value = dataView.getUint32(i, true);
        const tileId = value & tileMetadata.bitmaskForTileId;
        const x = (i / bytesPerTile) % cel.w;
        const y = Math.floor((i / bytesPerTile) / cel.w);

        if (tileId !== 0) {
            const xFlip = (value & tileMetadata.bitmaskForXFlip) !== 0;
            const yFlip = (value & tileMetadata.bitmaskForYFlip) !== 0;
            const rotation = (value & tileMetadata.bitmaskFor90CWRotation) !== 0;
            const tile = tileset.tiles[tileId - 1];
            tilemap.push({ tile, xFlip, yFlip, rotation, x, y });
        }
    }

    return {
        frame,
        canvasWidth,
        canvasHeight,
        width: cel.w,
        height: cel.h,
        xPos: cel.xpos,
        yPos: cel.ypos,
        tilemap
    };
}


function loadCel(cel: Aseprite.Cel, frame: Frame, canvasWidth: number, canvasHeight: number): Cel {

    const tilemap: Array<TileRef> = [];
    const dataView = new DataView(cel.rawCelData.buffer);
    const tileSide = 16;

    const width = Math.ceil(cel.w / tileSide);
    const height = Math.ceil(cel.h / tileSide);

    let tileIndex = 0;
    for (let celY = 0; celY < height; celY++) {
        for (let celX = 0; celX < width; celX++) {
            let empty = true;
            const tileContent: RGBAColor[] = [];
            for (let pixelY = 0; pixelY < tileSide; pixelY++) {
                const y = celY * tileSide + pixelY;
                for (let pixelX = 0; pixelX < tileSide; pixelX++) {
                    const x = celX * tileSide + pixelX;
                    if (x >= cel.w || y >= cel.h)
                        tileContent.push([0, 0, 0, 0]);
                    else {
                        const pointIndex = 4 * (y * cel.w + x);
                        const color = Array.from({ length: 4 }, (_, i) => dataView.getUint8(pointIndex + i));
                        tileContent.push(color as RGBAColor);
                        if (color[3] !== 0) { // Alpha channel is not zero
                            empty = false;
                        }
                    }
                }
            }
            if (!empty)
                tilemap.push({
                    x: celX,
                    y: celY,
                    tile: { tileIndex: tileIndex++, content: tileContent },
                    xFlip: false,
                    yFlip: false,
                    rotation: false
                });
        }
    }

    return {
        frame,
        canvasWidth,
        canvasHeight,
        width,
        height,
        xPos: cel.xpos,
        yPos: cel.ypos,
        tilemap
    };
}

function mergeLayers(rgbLayers: IndexedLayer[], frames: Frame[], ase: Aseprite): Cel[] {
    const mergedCels: Cel[] = [];
    for (const frame of frames) {
        const cels = rgbLayers.map(layer => ase.frames[frame.frameIndex].cels[layer.layerIndex]).filter(c => c != undefined);
        const mergedCel = mergeCels(cels, ase, frame);
        mergedCels.push(mergedCel);
    }

    return mergedCels;
}

function mergeCels(cels: Aseprite.Cel[], ase: Aseprite, frame: Frame): Cel {
    const canvasWidth = ase.width;
    const canvasHeight = ase.height;

    const xpos = Math.min(...cels.map(cel => cel.xpos));
    const ypos = Math.min(...cels.map(cel => cel.ypos));
    const width = Math.max(...cels.map(cel => cel.xpos + cel.w)) - xpos;
    const height = Math.max(...cels.map(cel => cel.ypos + cel.h)) - ypos;

    const tileSide = 16;
    const nTilesX = Math.ceil(width / tileSide);
    const nTilesY = Math.ceil(height / tileSide);

    let tileIndex = 0;
    const tileRefs: TileRef[] = [];
    for (let tileY = 0; tileY < nTilesY; tileY++) {
        for (let tileX = 0; tileX < nTilesX; tileX++) {
            let empty = true;
            const tileContent: RGBAColor[] = [];
            for (let pixelY = 0; pixelY < tileSide; pixelY++) {
                for (let pixelX = 0; pixelX < tileSide; pixelX++) {
                    const x = tileX * tileSide + pixelX;
                    const y = tileY * tileSide + pixelY;
                    let color = TRANSPARENT_COLOR;
                    for (const cel of cels) {
                        const layerColor = pointInCel(x + xpos, y + ypos, cel);
                        if (layerColor[3] !== 0) {
                            color = layerColor;
                            empty = false;
                        }
                    }
                    tileContent.push(color);
                }
            }
            if (!empty) {
                tileRefs.push({
                    x: tileX,
                    y: tileY,
                    tile: { tileIndex: tileIndex++, content: tileContent },
                    xFlip: false,
                    yFlip: false,
                    rotation: false
                });
            }
        }
    }

    return {
        frame,
        canvasWidth,
        canvasHeight,
        width: nTilesX,
        height: nTilesY,
        xPos: xpos,
        yPos: ypos,
        tilemap: tileRefs
    };
}

function pointInCel(x: number, y: number, cel: Aseprite.Cel): RGBAColor {

    if (x >= cel.xpos && x < cel.xpos + cel.w && y >= cel.ypos && y < cel.ypos + cel.h) {
        const dataView = new DataView(cel.rawCelData.buffer);
        const pointIndex = 4 * ((y - cel.ypos) * cel.w + (x - cel.xpos));
        return Array.from({ length: 4 }, (_, i) => dataView.getUint8(pointIndex + i)) as RGBAColor;
    }
    else
        return TRANSPARENT_COLOR;
}