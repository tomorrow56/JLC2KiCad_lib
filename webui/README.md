# JLC2KiCad Web UI

A web-based interface for converting JLCPCB/EasyEDA component libraries to KiCad format (`.kicad_sym`, `.kicad_mod`, `.step`, `.wrl`).

## Features

- **Symbol generation** — Produces `.kicad_sym` schematic symbols compatible with KiCad 6+
- **Footprint generation** — Produces `.kicad_mod` PCB footprints with correct pad/track/arc geometry
- **3D model download** — Downloads STEP and/or WRL 3D models from EasyEDA's CDN
- **Batch conversion** — Convert multiple JLCPCB part numbers in a single request
- **Conversion history** — Authenticated users can view and re-download past conversions
- **Japanese/English UI** — Language toggle (EN/JA) with browser language auto-detection

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Node.js, Express 4, tRPC 11 |
| Database | MySQL (Drizzle ORM) |
| Auth | Manus OAuth |
| Language | TypeScript |

## Conversion Logic

The TypeScript conversion engine (`server/jlc2kicad/`) is a faithful port of the original Python implementation:

| File | Description |
|---|---|
| `easyedaApi.ts` | Fetches component data from EasyEDA API |
| `symbolGenerator.ts` | Generates KiCad symbol (`.kicad_sym`) |
| `footprintGenerator.ts` | Generates KiCad footprint (`.kicad_mod`) |
| `model3dGenerator.ts` | Converts OBJ to WRL; downloads STEP from EasyEDA CDN |
| `converter.ts` | Orchestrates the full conversion pipeline |

### Key implementation notes

- EasyEDA shape data uses `~` as the primary delimiter; `^^` appears within fields and must **not** be used as a split boundary at the top level.
- STEP model URL: `https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/{svgnode_uuid}` (the UUID comes from the SVGNODE object inside the footprint data, not the footprint UUID itself).
- ARC SVG path is at index `data[3]` after splitting by `~`.

## Getting Started

```bash
cd webui
pnpm install
pnpm dev
```

Environment variables required (see `.env.example` or Manus project secrets):

```
DATABASE_URL=
JWT_SECRET=
VITE_APP_ID=
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
```

## Running Tests

```bash
pnpm test
```

All 13 tests should pass.

## Live Demo

Hosted on Manus: [jlc2kicad-webui.manus.space](https://jlc2kicad-webui.manus.space)
