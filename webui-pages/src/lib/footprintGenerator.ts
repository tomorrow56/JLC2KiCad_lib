/**
 * KiCad footprint (.kicad_mod) generator
 * Ported from JLC2KiCadLib Python implementation
 *
 * Key differences from Python:
 * - Python uses KicadModTree library which handles coordinate transformations
 * - We apply translation (origin offset) directly during generation
 * - ARC format: "ARC~width~layer~~SVGpath~~id~0" (SVG path at index [3])
 */

import { cos, sin, sqrt, PI } from "./mathUtils";

function mil2mm(val: string | number): number {
  return parseFloat(String(val)) / 3.937;
}

function fmt(n: number): string {
  return parseFloat(n.toFixed(6)).toString();
}

// ─── Layer mapping ────────────────────────────────────────────────────────────
const LAYER_MAP: Record<string, string> = {
  "1": "F.Cu",
  "2": "B.Cu",
  "3": "F.SilkS",
  "4": "B.Silks",
  "5": "F.Paste",
  "6": "B.Paste",
  "7": "F.Mask",
  "8": "B.Mask",
  "10": "Edge.Cuts",
  "11": "Cmts.User",
  "12": "F.Fab",
  "99": "Cmts.User",
  "100": "Cmts.User",
  "101": "Cmts.User",
};

// ─── Footprint context ────────────────────────────────────────────────────────
interface FootprintContext {
  lines: string[];
  maxX: number;
  minX: number;
  maxY: number;
  minY: number;
  hasTHT: boolean;
  modelLines: string[];
  footprintName: string;
  footprintLib: string;
  modelDir: string;
  modelBaseVariable: string;
  origin: [number, number];
  models: string;
}

function newCtx(
  footprintName: string,
  footprintLib: string,
  modelDir: string,
  modelBaseVariable: string,
  origin: [number, number],
  models: string
): FootprintContext {
  return {
    lines: [],
    maxX: -Infinity,
    minX: Infinity,
    maxY: -Infinity,
    minY: Infinity,
    hasTHT: false,
    modelLines: [],
    footprintName,
    footprintLib,
    modelDir,
    modelBaseVariable,
    origin,
    models,
  };
}

function updateBounds(ctx: FootprintContext, x: number, y: number) {
  ctx.maxX = Math.max(ctx.maxX, x);
  ctx.minX = Math.min(ctx.minX, x);
  ctx.maxY = Math.max(ctx.maxY, y);
  ctx.minY = Math.min(ctx.minY, y);
}

// ─── Handlers (with translation applied) ─────────────────────────────────────

/**
 * TRACK handler
 * data: [width, layer, ?, points_space_separated, id]
 */
function h_TRACK(data: string[], ctx: FootprintContext, tx: number, ty: number) {
  const width = mil2mm(data[0]);
  const pts = data[3].split(" ").filter(Boolean).map(mil2mm);
  const layer = LAYER_MAP[data[1]] ?? "F.SilkS";
  for (let i = 0; i < pts.length / 2 - 1; i++) {
    const sx = pts[2 * i] + tx, sy = pts[2 * i + 1] + ty;
    const ex = pts[2 * i + 2] + tx, ey = pts[2 * i + 3] + ty;
    updateBounds(ctx, sx, sy);
    updateBounds(ctx, ex, ey);
    ctx.lines.push(
      `  (fp_line (start ${fmt(sx)} ${fmt(sy)}) (end ${fmt(ex)} ${fmt(ey)}) (layer "${layer}") (width ${fmt(width)}))`
    );
  }
}

/**
 * PAD handler
 * data: [shape_type, x, y, size_x, size_y, layer, ?, pad_number, drill_size,
 *        polygon_nodes, rotation, id, drill_offset, ?, plated, ?, ?, ?, ?]
 */
function h_PAD(data: string[], ctx: FootprintContext, tx: number, ty: number) {
  const shapeType = data[0];
  const at = [mil2mm(data[1]) + tx, mil2mm(data[2]) + ty];
  const size = [mil2mm(data[3]), mil2mm(data[4])];
  const layer = data[5];
  const padNumber = data[7];
  const drillDiameter = parseFloat(mil2mm(data[8]).toString()) * 2;
  const rotation = parseFloat(data[10]);
  const drillOffset = data[12] ? parseFloat(mil2mm(data[12]).toString()) : 0;

  let padType: string;
  let padLayers: string;
  if (layer === "11") {
    padType = "thru_hole"; padLayers = '"*.Cu" "*.Mask"'; ctx.hasTHT = true;
  } else if (layer === "1") {
    padType = "smd"; padLayers = '"F.Cu" "F.Paste" "F.Mask"';
  } else if (layer === "2") {
    padType = "smd"; padLayers = '"B.Cu" "B.Paste" "B.Mask"';
  } else {
    padType = "smd"; padLayers = '"F.Cu" "F.Paste" "F.Mask"';
  }

  let kicadShape: string;
  let drillStr = "";
  let customPrimStr = "";

  if (shapeType === "OVAL") {
    kicadShape = "oval";
    if (padType === "thru_hole") {
      if (drillOffset === 0) {
        drillStr = `(drill ${fmt(drillDiameter)})`;
      } else if ((drillDiameter < drillOffset) !== (size[0] > size[1])) {
        drillStr = `(drill oval ${fmt(drillDiameter)} ${fmt(drillOffset)})`;
      } else {
        drillStr = `(drill oval ${fmt(drillOffset)} ${fmt(drillDiameter)})`;
      }
    }
  } else if (shapeType === "RECT") {
    kicadShape = "rect";
    if (padType === "thru_hole") {
      drillStr = drillOffset === 0
        ? `(drill ${fmt(drillDiameter)})`
        : `(drill oval ${fmt(drillDiameter)} ${fmt(drillOffset)})`;
    }
  } else if (shapeType === "ELLIPSE") {
    kicadShape = "circle";
    if (padType === "thru_hole") drillStr = `(drill ${fmt(drillDiameter)})`;
  } else if (shapeType === "POLYGON") {
    kicadShape = "custom";
    const pts = data[9].split(" ").filter(Boolean).map(Number);
    const polyPts = [];
    for (let i = 0; i < pts.length - 1; i += 2) {
      polyPts.push(`(xy ${fmt(mil2mm(pts[i]) - at[0])} ${fmt(mil2mm(pts[i + 1]) - at[1])})`);
    }
    customPrimStr = `(primitives (gr_poly (pts ${polyPts.join(" ")}) (width 0)))`;
    size[0] = 0.1; size[1] = 0.1;
    if (padType === "thru_hole") {
      drillStr = drillOffset === 0
        ? `(drill ${fmt(drillDiameter)})`
        : `(drill oval ${fmt(drillDiameter)} ${fmt(drillOffset)})`;
    }
  } else {
    kicadShape = "oval";
    if (padType === "thru_hole") drillStr = `(drill ${fmt(drillDiameter)})`;
  }

  updateBounds(ctx, at[0], at[1]);
  ctx.lines.push(
    `  (pad "${padNumber}" ${padType} ${kicadShape} (at ${fmt(at[0])} ${fmt(at[1])}${rotation !== 0 ? ` ${fmt(rotation)}` : ""}) (size ${fmt(size[0])} ${fmt(size[1])}) (layers ${padLayers})${drillStr ? " " + drillStr : ""}${customPrimStr ? " " + customPrimStr : ""})`
  );
}

/**
 * ARC handler
 * data: [width, layer, ?, svgPath, ?, id, ?]
 * SVG path format: "M x1 y1 A rx ry rotation large-arc sweep x2 y2"
 *
 * Python uses KicadModTree's Arc(start, end, center) which uses start/end/center format.
 * We convert to KiCad 6+ start/mid/end format.
 */
function h_ARC(data: string[], ctx: FootprintContext, tx: number, ty: number) {
  try {
    const width = mil2mm(data[0]);
    const layer = LAYER_MAP[data[1]] ?? "F.SilkS";
    const svgPath = data[3] ?? "";

    // Parse SVG path: "M x1 y1 A rx ry rotation large-arc sweep x2 y2"
    const pattern = /M\s*([-\d.]+)[\s,]+([-\d.]+)\s*A\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+(\d)[\s,]+(\d)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/;
    const match = pattern.exec(svgPath);
    if (!match) return;

    let startX = mil2mm(parseFloat(match[1]));
    let startY = mil2mm(parseFloat(match[2]));
    const radiusX = mil2mm(parseFloat(match[3]));
    const radiusY = mil2mm(parseFloat(match[4]));
    // match[5] = rotation (ignored for circular arcs)
    const largeArcFlag = parseInt(match[6]);
    const sweepFlag = parseInt(match[7]);
    let endX = mil2mm(parseFloat(match[8]));
    let endY = mil2mm(parseFloat(match[9]));

    // Check if full circle (start == end)
    if (Math.abs(startX - endX) < 1e-6 && Math.abs(startY - endY) < 1e-6) {
      const radius = radiusX;
      const cx = sweepFlag === 1 ? startX + radius : startX - radius;
      const cy = startY;
      ctx.lines.push(
        `  (fp_circle (center ${fmt(cx + tx)} ${fmt(cy + ty)}) (end ${fmt(cx + radius + tx)} ${fmt(cy + ty)}) (layer "${layer}") (width ${fmt(width)}))`
      );
      return;
    }

    // Python: if sweep_flag == 0: start, end = end, start
    if (sweepFlag === 0) {
      [startX, endX] = [endX, startX];
      [startY, endY] = [endY, startY];
    }

    // Find midpoint of start and end
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Vector from start to mid
    const vec1X = midX - startX;
    const vec1Y = midY - startY;

    // Length squared for center calculation
    const vec1Len = sqrt(vec1X * vec1X + vec1Y * vec1Y);
    let lengthSq = radiusX * radiusY - (vec1Len * vec1Len);
    let actualLargeArc = largeArcFlag;
    if (lengthSq < 0) {
      lengthSq = 0;
      actualLargeArc = 1;
    }

    // Perpendicular vector (rotate -90 if large_arc, else +90)
    let perpX: number, perpY: number;
    if (actualLargeArc === 1) {
      // rotate -90: (x, y) -> (y, -x)
      perpX = vec1Y;
      perpY = -vec1X;
    } else {
      // rotate +90: (x, y) -> (-y, x)
      perpX = -vec1Y;
      perpY = vec1X;
    }
    const perpMag = sqrt(perpX * perpX + perpY * perpY);
    if (perpMag === 0) return;
    perpX /= perpMag;
    perpY /= perpMag;

    const length = sqrt(lengthSq);
    const cenX = midX + perpX * length;
    const cenY = midY + perpY * length;

    // Calculate arc midpoint for KiCad 6+ start/mid/end format
    const startAngle = Math.atan2(startY - cenY, startX - cenX);
    const endAngle = Math.atan2(endY - cenY, endX - cenX);
    let dAngle = endAngle - startAngle;
    // Normalize to [-PI, PI]
    while (dAngle > Math.PI) dAngle -= 2 * Math.PI;
    while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
    const midAngle = startAngle + dAngle / 2;
    const radius = sqrt((startX - cenX) ** 2 + (startY - cenY) ** 2);
    const arcMidX = cenX + radius * cos(midAngle);
    const arcMidY = cenY + radius * sin(midAngle);

    updateBounds(ctx, startX + tx, startY + ty);
    updateBounds(ctx, endX + tx, endY + ty);
    ctx.lines.push(
      `  (fp_arc (start ${fmt(startX + tx)} ${fmt(startY + ty)}) (mid ${fmt(arcMidX + tx)} ${fmt(arcMidY + ty)}) (end ${fmt(endX + tx)} ${fmt(endY + ty)}) (layer "${layer}") (width ${fmt(width)}))`
    );
  } catch { /* skip */ }
}

/**
 * CIRCLE handler
 * data: [cx, cy, radius, width, layer, id, ?, ...]
 * Note: Python skips layer 100 (pin soldering layer)
 */
function h_CIRCLE(data: string[], ctx: FootprintContext, tx: number, ty: number) {
  if (data[4] === "100") return; // skip pin soldering layer
  const cx = mil2mm(data[0]) + tx;
  const cy = mil2mm(data[1]) + ty;
  const r = mil2mm(data[2]);
  const width = mil2mm(data[3]);
  const layer = LAYER_MAP[data[4]] ?? "F.SilkS";
  ctx.lines.push(
    `  (fp_circle (center ${fmt(cx)} ${fmt(cy)}) (end ${fmt(cx + r)} ${fmt(cy)}) (layer "${layer}") (width ${fmt(width)}))`
  );
}

/**
 * SOLIDREGION handler
 * data: [layer, ?, svgPath, fill_type, id, ?, ?, ?, ?]
 */
function h_SOLIDREGION(data: string[], ctx: FootprintContext, tx: number, ty: number) {
  const layer = data[3] === "npth" ? "Edge.Cuts" : (LAYER_MAP[data[0]] ?? "F.SilkS");
  const path = data[2];
  const points: [number, number][] = [];
  let currentPos: [number, number] = [0, 0];

  const cmdPattern = /([MLAZ])\s*((?:[-+]?\d*\.?\d+[\s,]*)*)/gi;
  const numPattern = /[-+]?\d*\.?\d+/g;
  let match: RegExpExecArray | null;
  while ((match = cmdPattern.exec(path)) !== null) {
    const cmd = match[1].toUpperCase();
    const nums = (match[2].match(numPattern) ?? []).map(Number);
    if (cmd === "M" && nums.length >= 2) {
      currentPos = [nums[0], nums[1]]; points.push(currentPos);
    } else if (cmd === "L" && nums.length >= 2) {
      currentPos = [nums[0], nums[1]]; points.push(currentPos);
    } else if (cmd === "A" && nums.length >= 7) {
      const arcPts = svgArcToPoints(
        currentPos[0], currentPos[1],
        nums[0], nums[1], nums[2],
        Math.round(nums[3]), Math.round(nums[4]),
        nums[5], nums[6]
      );
      points.push(...arcPts);
      currentPos = [nums[5], nums[6]];
    }
  }
  if (points.length < 2) return;
  const mmPts = points.map(([x, y]) => `(xy ${fmt(mil2mm(x) + tx)} ${fmt(mil2mm(y) + ty)})`);
  ctx.lines.push(
    `  (fp_poly (pts ${mmPts.join(" ")}) (layer "${layer}") (width 0) (fill solid))`
  );
}

/**
 * SVGNODE handler - 3D model reference
 */
function h_SVGNODE(data: string[], ctx: FootprintContext) {
  try {
    const parsed = JSON.parse(data[0]);
    const attrs = parsed.attrs;
    const cOrigin = (attrs.c_origin as string).split(",");
    const tx = (parseFloat(cOrigin[0]) - ctx.origin[0]) / 100;
    const ty = -(parseFloat(cOrigin[1]) - ctx.origin[1]) / 100;
    const tz = parseFloat(attrs.z) / 100;
    const rot = (attrs.c_rotation as string).split(",").map((v: string) => -parseFloat(v));

    if (ctx.models.includes("STEP") || ctx.models.includes("WRL")) {
      const ext = ctx.models.includes("STEP") ? "step" : "wrl";
      let pathName: string;
      if (ctx.modelBaseVariable) {
        const base = ctx.modelBaseVariable.startsWith("$")
          ? ctx.modelBaseVariable
          : `$(${ctx.modelBaseVariable})`;
        pathName = `${base}/${ctx.modelDir}/${ctx.footprintName}.${ext}`;
      } else {
        pathName = `${ctx.modelDir}/${ctx.footprintName}.${ext}`;
      }
      ctx.modelLines.push(
        `  (model "${pathName}"\n    (offset (xyz ${fmt(tx)} ${fmt(ty)} ${fmt(tz)}))\n    (scale (xyz 1 1 1))\n    (rotate (xyz ${fmt(rot[0])} ${fmt(rot[1])} ${fmt(rot[2])})))`
      );
    }
  } catch {
    // ignore
  }
}

/**
 * RECT handler
 * data: [x, y, width, height, layer, ?, ?, stroke_width, id, ...]
 */
function h_RECT(data: string[], ctx: FootprintContext, tx: number, ty: number) {
  const xs = mil2mm(data[0]) + tx;
  const ys = mil2mm(data[1]) + ty;
  const xd = mil2mm(data[2]);
  const yd = mil2mm(data[3]);
  const layer = LAYER_MAP[data[4]] ?? "F.SilkS";
  const width = mil2mm(data[7]);
  updateBounds(ctx, xs, ys);
  updateBounds(ctx, xs + xd, ys + yd);
  if (width === 0) {
    ctx.lines.push(
      `  (fp_rect (start ${fmt(xs)} ${fmt(ys)}) (end ${fmt(xs + xd)} ${fmt(ys + yd)}) (layer "${layer}") (width 0) (fill solid))`
    );
  } else {
    ctx.lines.push(
      `  (fp_rect (start ${fmt(xs)} ${fmt(ys)}) (end ${fmt(xs + xd)} ${fmt(ys + yd)}) (layer "${layer}") (width ${fmt(width)}))`
    );
  }
}

/**
 * HOLE handler
 * data: [x, y, radius, id, ...]
 */
function h_HOLE(data: string[], ctx: FootprintContext, tx: number, ty: number) {
  const x = mil2mm(data[0]) + tx;
  const y = mil2mm(data[1]) + ty;
  const r = mil2mm(data[2]);
  ctx.lines.push(
    `  (pad "" np_thru_hole circle (at ${fmt(x)} ${fmt(y)}) (size ${fmt(r * 2)} ${fmt(r * 2)}) (drill ${fmt(r * 2)}) (layers "*.Cu" "*.Mask"))`
  );
}

/**
 * TEXT handler
 * data: [?, x, y, ?, ?, ?, ?, ?, ?, text, ...]
 */
function h_TEXT(data: string[], ctx: FootprintContext, tx: number, ty: number) {
  const x = mil2mm(data[1]) + tx;
  const y = mil2mm(data[2]) + ty;
  const text = data[9] ?? "";
  ctx.lines.push(
    `  (fp_text user "${text}" (at ${fmt(x)} ${fmt(y)}) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))`
  );
}

// ─── SVG arc to points (for SOLIDREGION) ─────────────────────────────────────
function svgArcToPoints(
  x1: number, y1: number,
  rx: number, ry: number,
  rotation: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number, y2: number
): [number, number][] {
  if (x1 === x2 && y1 === y2) return [];
  if (rx === 0 || ry === 0) return [[x2, y2]];

  rx = Math.abs(rx); ry = Math.abs(ry);
  const cosRot = cos((rotation * PI) / 180);
  const sinRot = sin((rotation * PI) / 180);

  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosRot * dx + sinRot * dy;
  const y1p = -sinRot * dx + cosRot * dy;

  let rxSq = rx * rx, rySq = ry * ry;
  const x1pSq = x1p * x1p, y1pSq = y1p * y1p;
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const scale = sqrt(lambda);
    rx *= scale; ry *= scale;
    rxSq = rx * rx; rySq = ry * ry;
  }

  const denom = rxSq * y1pSq + rySq * x1pSq;
  if (denom === 0) return [[x2, y2]];
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / denom);
  const coef = sign * sqrt(sq);
  const cxp = coef * rx * y1p / ry;
  const cyp = -coef * ry * x1p / rx;
  const cx = cosRot * cxp - sinRot * cyp + (x1 + x2) / 2;
  const cy = sinRot * cxp + cosRot * cyp + (y1 + y2) / 2;

  const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  let dtheta = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - theta1;
  if (sweepFlag === 0 && dtheta > 0) dtheta -= 2 * PI;
  else if (sweepFlag === 1 && dtheta < 0) dtheta += 2 * PI;

  const steps = Math.max(4, Math.ceil(Math.abs(dtheta) / (PI / 8)));
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = theta1 + (dtheta * i) / steps;
    const x = cx + rx * cos(angle) * cosRot - ry * sin(angle) * sinRot;
    const y = cy + rx * cos(angle) * sinRot + ry * sin(angle) * cosRot;
    pts.push([x, y]);
  }
  return pts;
}

// ─── Main generator ──────────────────────────────────────────────────────────

export interface FootprintOptions {
  footprintName: string;
  footprintLib: string;
  modelDir: string;
  modelBaseVariable: string;
  origin: [number, number];
  models: string; // "STEP" | "WRL" | "STEP,WRL" | ""
  componentId: string;
}

export function generateFootprint(
  shapes: string[],
  opts: FootprintOptions
): string {
  // Translation: apply origin offset (same as Python's kicad_mod.insert(Translation(...)))
  const tx = -mil2mm(opts.origin[0]);
  const ty = -mil2mm(opts.origin[1]);

  const ctx = newCtx(
    opts.footprintName,
    opts.footprintLib,
    opts.modelDir,
    opts.modelBaseVariable,
    opts.origin,
    opts.models
  );

  for (const line of shapes) {
    const args = line.split("~");
    const model = args[0];
    const data = args.slice(1);

    switch (model) {
      case "TRACK": h_TRACK(data, ctx, tx, ty); break;
      case "PAD": h_PAD(data, ctx, tx, ty); break;
      case "ARC": h_ARC(data, ctx, tx, ty); break;
      case "CIRCLE": h_CIRCLE(data, ctx, tx, ty); break;
      case "SOLIDREGION": h_SOLIDREGION(data, ctx, tx, ty); break;
      case "SVGNODE": h_SVGNODE(data, ctx); break;
      case "RECT": h_RECT(data, ctx, tx, ty); break;
      case "HOLE": h_HOLE(data, ctx, tx, ty); break;
      case "TEXT": h_TEXT(data, ctx, tx, ty); break;
      case "VIA": break; // not supported
      default: break;
    }
  }

  const attr = ctx.hasTHT ? "through_hole" : "smd";

  // Calculate reference/value/user text positions
  const cx = isFinite(ctx.minX) && isFinite(ctx.maxX) ? (ctx.minX + ctx.maxX) / 2 : 0;
  const refY = isFinite(ctx.minY) ? ctx.minY - 2 : -2;
  const valY = isFinite(ctx.maxY) ? ctx.maxY + 2 : 2;
  const fabY = isFinite(ctx.minY) && isFinite(ctx.maxY) ? (ctx.minY + ctx.maxY) / 2 : 0;

  const header = [
    `(footprint "${opts.footprintName}"`,
    `  (version 20221018)`,
    `  (generator jlc2kicad_ts)`,
    `  (layer "F.Cu")`,
    `  (descr "${opts.footprintName} footprint")`,
    `  (tags "${opts.footprintName} footprint ${opts.componentId}")`,
    `  (attr ${attr})`,
    `  (fp_text reference "REF**" (at ${fmt(cx)} ${fmt(refY)}) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))`,
    `  (fp_text value "${opts.footprintName}" (at ${fmt(cx)} ${fmt(valY)}) (layer "F.Fab") (effects (font (size 1 1) (thickness 0.15))))`,
    `  (fp_text user "\${REFERENCE}" (at ${fmt(cx)} ${fmt(fabY)}) (layer "F.Fab") (effects (font (size 1 1) (thickness 0.15))))`,
  ];

  return [...header, ...ctx.lines, ...ctx.modelLines, ")"].join("\n");
}
