/**
 * Browser-side JLC2KiCad converter
 * No Node.js fs/path - generates files in memory and returns them as a JSZip
 */

import JSZip from "jszip";
import {
  fetchComponentUUIDs,
  fetchComponentData,
  fetch3DModelObj,
  fetchStepModel,
  type EasyEDAComponentData,
} from "./easyedaApi";
import { generateFootprint, type FootprintOptions } from "./footprintGenerator";
import { generateSymbolLib, type SymbolOptions } from "./symbolGenerator";
import { convertObjToWrl } from "./model3dGenerator";

export interface ConvertOptions {
  partNumbers: string[];
  libraryName?: string;
  symbol?: boolean;
  footprint?: boolean;
  models?: string; // "STEP" | "WRL" | "STEP,WRL" | ""
  modelBaseVariable?: string;
  onLog?: (msg: string) => void;
}

export interface ConvertResult {
  success: boolean;
  zip: JSZip;
  files: string[];
  errors: string[];
}

function log(opts: ConvertOptions, msg: string) {
  if (opts.onLog) opts.onLog(msg);
  else console.log(msg);
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_");
}

async function convertOne(
  componentId: string,
  opts: ConvertOptions,
  zip: JSZip,
  files: string[],
  errors: string[]
): Promise<void> {
  log(opts, `[${componentId}] Fetching component data...`);

  // Step 1: Get UUIDs
  let uuids: { symbolUuid: string; footprintUuid: string } | null = null;
  try {
    uuids = await fetchComponentUUIDs(componentId);
  } catch (e) {
    errors.push(`[${componentId}] Failed to fetch UUIDs: ${e}`);
    log(opts, `[${componentId}] ERROR: Failed to fetch UUIDs: ${e}`);
    return;
  }

  if (!uuids) {
    errors.push(`[${componentId}] Component not found on EasyEDA`);
    log(opts, `[${componentId}] ERROR: Component not found on EasyEDA`);
    return;
  }

  log(opts, `[${componentId}] Symbol UUID: ${uuids.symbolUuid}`);
  log(opts, `[${componentId}] Footprint UUID: ${uuids.footprintUuid}`);

  // Step 2: Fetch symbol data
  let symbolData: EasyEDAComponentData | null = null;
  if (opts.symbol !== false) {
    try {
      symbolData = await fetchComponentData(uuids.symbolUuid);
    } catch (e) {
      log(opts, `[${componentId}] WARNING: Failed to fetch symbol data: ${e}`);
    }
  }

  // Step 3: Fetch footprint data
  let footprintData: EasyEDAComponentData | null = null;
  if (opts.footprint !== false) {
    try {
      footprintData = await fetchComponentData(uuids.footprintUuid);
    } catch (e) {
      log(opts, `[${componentId}] WARNING: Failed to fetch footprint data: ${e}`);
    }
  }

  // Determine component name and library name
  const componentName = sanitizeName(
    symbolData?.title ?? footprintData?.title ?? componentId
  );
  const libName = sanitizeName(opts.libraryName ?? componentName);

  // Extract metadata
  const cPara = symbolData?.dataStr?.head?.c_para ?? {};
  const prefix = cPara.pre ?? "U";
  const datasheetLink = cPara.link ?? "";
  const footprintTitle = sanitizeName(footprintData?.title ?? componentName);

  // Extract component type/value pairs
  const componentTypesValues: [string, string][] = [];
  for (const [k, v] of Object.entries(cPara)) {
    if (k !== "pre" && k !== "link" && v) {
      componentTypesValues.push([k, v]);
    }
  }

  // ─── Generate Symbol ───────────────────────────────────────────────────────
  if (opts.symbol !== false && symbolData) {
    log(opts, `[${componentId}] Generating symbol...`);

    const symOpts: SymbolOptions = {
      componentId,
      componentName,
      libraryName: libName,
      prefix,
      footprintName: `${libName}:${footprintTitle}`,
      datasheetLink,
      componentTypesValues,
    };

    const shapes = symbolData.dataStr?.shape ?? [];
    const translation: [number, number] = [
      symbolData.dataStr?.head?.x ?? 0,
      symbolData.dataStr?.head?.y ?? 0,
    ];

    const symContent = generateSymbolLib(shapes, translation, symOpts);
    const symPath = `symbol/${libName}.kicad_sym`;
    zip.file(symPath, symContent);
    files.push(symPath);
    log(opts, `[${componentId}] Symbol generated: ${symPath}`);
  }

  // ─── Generate Footprint ────────────────────────────────────────────────────
  if (opts.footprint !== false && footprintData) {
    log(opts, `[${componentId}] Generating footprint...`);

    // Determine origin from canvas or head
    let originX = footprintData.dataStr?.head?.x ?? 0;
    let originY = footprintData.dataStr?.head?.y ?? 0;
    if (footprintData.dataStr?.canvas) {
      const canvasParts = footprintData.dataStr.canvas.split("~");
      if (canvasParts.length >= 17) {
        originX = parseFloat(canvasParts[16]) || originX;
        originY = parseFloat(canvasParts[17]) || originY;
      }
    }

    const models = opts.models ?? "STEP";
    const modelDir = "3dmodels";

    const fpOpts: FootprintOptions = {
      footprintName: footprintTitle,
      footprintLib: `${libName}.pretty`,
      modelDir,
      modelBaseVariable: opts.modelBaseVariable ?? "",
      origin: [originX, originY],
      models,
      componentId,
    };

    const shapes = footprintData.dataStr?.shape ?? [];
    const fpContent = generateFootprint(shapes, fpOpts);
    const fpPath = `footprint/${libName}.pretty/${footprintTitle}.kicad_mod`;
    zip.file(fpPath, fpContent);
    files.push(fpPath);
    log(opts, `[${componentId}] Footprint generated: ${fpPath}`);

    // ─── Generate 3D Models ─────────────────────────────────────────────────
    if (models && models !== "none") {
      const svgNodes = shapes.filter((s) => s.startsWith("SVGNODE~"));
      for (const svgNode of svgNodes) {
        try {
          const jsonStr = svgNode.slice("SVGNODE~".length);
          const parsed = JSON.parse(jsonStr) as { attrs?: { uuid?: string } };
          const uuid = parsed.attrs?.uuid;
          if (!uuid) continue;

          if (models.includes("STEP")) {
            log(opts, `[${componentId}] Downloading STEP model...`);
            const stepBuf = await fetchStepModel(uuid);
            if (stepBuf) {
              const stepPath = `footprint/${libName}.pretty/${modelDir}/${footprintTitle}.step`;
              zip.file(stepPath, stepBuf);
              files.push(stepPath);
              log(opts, `[${componentId}] STEP model downloaded: ${stepPath}`);
            } else {
              log(opts, `[${componentId}] WARNING: STEP model not available`);
            }
          }

          if (models.includes("WRL")) {
            log(opts, `[${componentId}] Downloading WRL model...`);
            const objText = await fetch3DModelObj(uuid);
            if (objText) {
              const wrlContent = convertObjToWrl(objText);
              const wrlPath = `footprint/${libName}.pretty/${modelDir}/${footprintTitle}.wrl`;
              zip.file(wrlPath, wrlContent);
              files.push(wrlPath);
              log(opts, `[${componentId}] WRL model generated: ${wrlPath}`);
            } else {
              log(opts, `[${componentId}] WARNING: WRL model not available`);
            }
          }
        } catch (e) {
          log(opts, `[${componentId}] WARNING: 3D model generation failed: ${e}`);
        }
      }
    }
  }

  log(opts, `[${componentId}] Done!`);
}

export async function convertComponents(opts: ConvertOptions): Promise<ConvertResult> {
  const zip = new JSZip();
  const files: string[] = [];
  const errors: string[] = [];

  log(opts, `🚀 Conversion started...`);
  log(opts, `Processing ${opts.partNumbers.length} component(s): ${opts.partNumbers.join(", ")}`);

  for (const partNumber of opts.partNumbers) {
    try {
      await convertOne(partNumber.trim(), opts, zip, files, errors);
    } catch (e) {
      errors.push(`[${partNumber}] Unexpected error: ${e}`);
      log(opts, `[${partNumber}] ERROR: ${e}`);
    }
  }

  log(opts, `✅ Conversion complete. ${files.length} file(s) generated.`);
  if (errors.length > 0) {
    log(opts, `⚠️  ${errors.length} error(s) occurred.`);
  }

  return { success: errors.length === 0, zip, files, errors };
}
