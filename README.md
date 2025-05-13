# ASE2NEXT

A utility to convert Aseprite files to various ZX Spectrum Next formats including sprites, fonts, maps, and Layer 2 graphics. This tool is specifically designed for development on [Next Point](https://github.com/vmorilla/next-point).

## Overview

ASE2NEXT processes Aseprite (.ase/.aseprite) files and converts them to formats compatible with ZX Spectrum Next development:

- **Sprites**: Converts Aseprite layers to Next hardware sprites
- **Fonts**: Extracts character sets from tilesets for text display
- **Maps**: Converts tilemaps to binary formats usable in Next games
- **Layer 2 Graphics**: Converts image data to Layer 2 format

For its usage, see the [Makefile](https://github.com/vmorilla/next-point/assets/Makefile) in [Next Point](https://github.com/vmorilla/next-point).

## Future Development
While currently optimized for Next Point development, this tool may evolve into a more generic Aseprite conversion utility for ZX Spectrum Next development.

## Author
Created by Victor Morilla and licensed under the terms of the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).