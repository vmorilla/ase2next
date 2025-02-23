import { RGBAColor } from "./sprite";

export type ColorFn = (color: RGBAColor) => number;

/**
 * Returns a funcion that maps a color to a 256 color index
 * @param transparentIndex Index of the transparent color
 * @param alternativeTransparentColor Color to be used if a non-transparent color matches the index of the transparent one
 * @returns 
 */
export function nextColor256(transparentIndex = 227, alternativeTransparentColor = 228) {
    return (color: RGBAColor) => {
        const [r, g, b, a] = color;
        if (a === 0)
            return transparentIndex;
        const index = (r & 0b11100000) | ((g & 0b11100000) >> 3) | ((b & 0b11000000) >> 6);
        return index === transparentIndex ? alternativeTransparentColor : index;
    }
}
