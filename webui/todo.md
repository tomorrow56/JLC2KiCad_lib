# JLC2KiCad Web UI - TODO

## Backend
- [x] Install JLC2KiCadLib and dependencies (KicadModTree, requests)
- [x] DB schema: conversions table (id, userId, partNumbers, options, status, createdAt)
- [x] DB migration and apply SQL
- [x] Express SSE endpoint: /api/convert/stream (run JLC2KiCadLib, stream logs)
- [x] Express endpoint: /api/convert/download/:jobId (serve ZIP file)
- [x] Express endpoint: /api/convert/history (GET/DELETE)
- [x] ZIP generation of output files
- [x] Cleanup temp files after download
- [x] convert_worker.py: Python worker script for JLC2KiCadLib

## Frontend
- [x] Design system: dark elegant theme (deep navy/slate + gold accent), Google Fonts (Inter)
- [x] Layout: top navigation with logo + auth
- [x] Home page: hero section with part number input form
- [x] Part number input: multi-tag input (add/remove individual part numbers)
- [x] Options panel: symbol/footprint toggles, 3D model format selector (STEP/WRL/both/none)
- [x] Advanced options: symbol lib name, footprint lib name, skip existing toggle
- [x] Convert button with loading state
- [x] Real-time log streaming panel (SSE-based, auto-scroll)
- [x] Progress indicator (steps: Fetching → Packaging → Done)
- [x] Download button (appears when complete)
- [x] History page: table of past conversions with download and delete actions
- [x] Responsive design (mobile-friendly)
- [x] Toast notifications for errors/success

## Bug Fixes
- [x] Fix: __dirname undefined in ESM environment (use fileURLToPath + import.meta.url)
- [x] Fix: PYTHONHOME/PYTHONPATH from Python 3.13 sandbox env breaking python3.11 spawn (strip env vars, use absolute path /usr/bin/python3.11)
- [x] Fix: SSE (EventSource) Connection lost in Cloudflare proxy environment -> replaced with polling-based approach (/api/convert/status/:jobId)
- [x] Add: logs column (mediumtext) to conversions table for polling log storage
- [x] Add: background conversion runner (fire-and-forget) with batched DB log writes every 500ms

## Tests
- [x] Vitest: convert DB helpers (createConversion, listConversions, deleteConversion)
- [x] Vitest: part number validation
- [x] Vitest: auth.logout (existing)
- [x] Vitest: polling status response structure validation

## Docker / Deployment
- [x] Add: Dockerfile (multi-stage: builder + runtime with Python 3 venv + JLC2KiCadLib)
- [x] Add: .dockerignore to speed up Docker builds
- [x] Fix: convertRouter.ts uses PYTHON_BIN env var (Docker: /opt/jlcvenv/bin/python3, dev fallback: /usr/bin/python3.11)
- [x] Remove: incomplete TypeScript jlc2kicad/ directory (was partial reimplementation, not needed)

## TypeScript Port (Python-free, for deployment)
- [x] Implement easyedaApi.ts: fetch component UUIDs, symbol/footprint data, 3D model OBJ/STEP
- [x] Implement footprintGenerator.ts: KiCad .kicad_mod file generation (PAD, LINE, ARC, CIRCLE, TEXT, SVGNODE handlers)
- [x] Implement symbolGenerator.ts: KiCad .kicad_sym file generation (R, E, P, T, PL, PG, PT, A, AR handlers)
- [x] Implement model3dGenerator.ts: OBJ to WRL conversion
- [x] Implement converter.ts: orchestrate all steps, log via callback
- [x] Refactor convertRouter.ts: replace Python spawn with TypeScript converter (no more Python dependency)
- [x] Verify end-to-end: C42459160 converts in <10s, 3 files generated (symbol, footprint, STEP)
- [x] All 9 tests passing

## File Format Bug Fixes
- [x] Fix: KiCad symbol file format error (unit suffix syntax, line 47)
- [x] Fix: KiCad footprint file format error (X coordinate number format)
- [x] Fix: STEP 3D model file has no geometry data (fixed fetchStepModel URL to modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/{svgnode_uuid})
- [x] Fix: symbolGenerator.ts and footprintGenerator.ts fully rewritten to match Python implementation (NaN eliminated, correct data indices)

## UI/UX Improvements
- [x] Fix: ZIP download filename should be Part Number (e.g., C42459160.zip for single, C42459160_C24112.zip for multiple)
- [x] Add: Japanese UI (i18n with language toggle EN/JA)
