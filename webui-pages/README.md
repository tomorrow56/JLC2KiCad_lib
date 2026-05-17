# JLC2KiCad Web UI — GitHub Pages Version

A standalone browser-based UI for converting JLCPCB/EasyEDA component libraries to KiCad format.

**Live Demo:** https://tomorrow56.github.io/JLC2KiCad_lib/

## Features

- No login required — runs entirely in the browser
- Converts JLCPCB part numbers to KiCad format:
  - Symbol (`.kicad_sym`)
  - Footprint (`.kicad_mod`)
  - 3D Model (`.step` / `.wrl`)
- Downloads result as a ZIP file named after the part number
- Conversion history saved in browser localStorage
- English / Japanese UI

## Technical Notes

This version uses a public CORS proxy ([corsproxy.io](https://corsproxy.io)) to access the EasyEDA API from the browser. If conversion fails, the proxy may be temporarily unavailable.

For a more reliable experience with conversion history and no proxy dependency, use the [full Manus-hosted version](https://jlc2kicad-webui.manus.space).

## Development

```bash
cd webui-pages
pnpm install
pnpm dev      # Start dev server at http://localhost:5173/JLC2KiCad_lib/
pnpm build    # Build for production to dist/
```

## Deployment

Automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to `master`.

To enable GitHub Pages:
1. Go to **Settings → Pages**
2. Set **Source** to **GitHub Actions**
3. Push to `master` to trigger deployment
