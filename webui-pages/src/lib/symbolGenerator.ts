/**
 * KiCad symbol (.kicad_sym) generator
 * Ported from JLC2KiCadLib Python implementation
 *
 * IMPORTANT: EasyEDA pin data format
 * The entire shape string is split by "~", including "^^" separators embedded within.
 * Example: "P~show~0~1~345~280~180~gge41~0^^345~280^^M345,280h10~#880000^^1~358.7~284~0~VHV~start~~~#0000FF^^1~354.5~279~0~1~end~~~#0000FF^^0~352~280^^0~M 355 283 L 358 280 L 355 277"
 * Split by "~" gives 30 elements, matching Python's args = line.split("~")
 */

function mil2mm(val: string | number): number {
  return parseFloat(String(val)) / 3.937;
}

function fmt(n: number): string {
  return parseFloat(n.toFixed(6)).toString();
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ─── Symbol drawing context ───────────────────────────────────────────────────

interface SymbolCtx {
  drawing: string;
  pinNamesHide: string;
  pinNumbersHide: string;
}

function newSymCtx(): SymbolCtx {
  return { drawing: "", pinNamesHide: "", pinNumbersHide: "" };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Rectangle handler
 * data = [x1, y1, ?, ?, width, length, color, ?, stroke_style, fill_color, id, locked]
 */
function h_R(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  const x1 = parseFloat(data[0]);
  const y1 = parseFloat(data[1]);
  const width = parseFloat(data[4]);
  const length = parseFloat(data[5]);
  const x2 = x1 + width;
  const y2 = y1 + length;
  const x1mm = mil2mm(x1 - tx);
  const y1mm = -mil2mm(y1 - ty);
  const x2mm = mil2mm(x2 - tx);
  const y2mm = -mil2mm(y2 - ty);
  let strokeStyle = "default";
  if (data[8] === "1") strokeStyle = "dash";
  else if (data[8] === "2") strokeStyle = "dot";
  ctx.drawing += `
      (rectangle
        (start ${fmt(x1mm)} ${fmt(y1mm)})
        (end ${fmt(x2mm)} ${fmt(y2mm)})
        (stroke (width 0) (type ${strokeStyle}) (color 0 0 0 0))
        (fill (type background))
      )`;
}

/**
 * Ellipse/Circle handler
 * data = [cx, cy, rx, ry, color, stroke_width, fill, id, ...]
 */
function h_E(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  const cx = mil2mm(parseFloat(data[0]) - tx);
  const cy = -mil2mm(parseFloat(data[1]) - ty);
  const rx = mil2mm(parseFloat(data[2]));
  ctx.drawing += `
      (circle
        (center ${fmt(cx)} ${fmt(cy)})
        (radius ${fmt(rx)})
        (stroke (width 0) (type default) (color 0 0 0 0))
        (fill (type background))
      )`;
}

/**
 * Pin handler
 * Python splits the ENTIRE line by "~", so "^^" separators are embedded in values.
 *
 * Full tilde-split indices (from Python's args[1:]):
 * data[0]  = show/hide ("show")
 * data[1]  = electrical type (0=unspecified, 1=input, 2=output, 3=bidirectional, 4=power_in)
 * data[2]  = pin number ("1")
 * data[3]  = x1 ("345")
 * data[4]  = y1 ("280")
 * data[5]  = rotation ("180")
 * data[6]  = id ("gge41")
 * data[7]  = "0^^345"  (contains ^^, first part is visibility)
 * data[8]  = "280^^M345,280h10"  (path with ^^, contains 'h' or 'v' for length)
 * data[9]  = "#880000^^1"  (color^^nameVisibility)
 * data[10] = name_x ("358.7")
 * data[11] = name_y ("284")
 * data[12] = name_rotation ("0")
 * data[13] = pin_name ("VHV")
 * data[14] = name_anchor ("start")
 * data[15] = "" (empty)
 * data[16] = "" (name_size, may be empty)
 * data[17] = "#0000FF^^1"  (color^^numberVisibility)
 * data[18] = number_x ("354.5")
 * data[19] = number_y ("279")
 * data[20] = number_rotation ("0")
 * data[21] = pin_number_label ("1")
 * data[22] = number_anchor ("end")
 * data[23] = "" (empty)
 * data[24] = "" (number_size, may be empty)
 */
function h_P(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  const electricalTypeMap: Record<string, string> = {
    "0": "unspecified",
    "1": "input",
    "2": "output",
    "3": "bidirectional",
    "4": "power_in",
  };

  const electricalType = electricalTypeMap[data[1]] ?? "unspecified";
  const pinNumber = data[2];
  const pinName = data[13] ?? "~";

  const x1 = round3(mil2mm(parseFloat(data[3]) - tx));
  const y1 = round3(-mil2mm(parseFloat(data[4]) - ty));
  const rotation = data[5] ? ((parseInt(data[5]) + 180) % 360) : 180;

  // Length from path in data[8]: "280^^M345,280h10" or "260^^M 415 260 v 10"
  // The path is after "^^", and contains 'h' (horizontal) or 'v' (vertical) for length
  let length = 2.54;
  const pathField = data[8] ?? "";
  if (rotation === 0 || rotation === 180) {
    const hIdx = pathField.lastIndexOf("h");
    if (hIdx !== -1) {
      const lenVal = parseFloat(pathField.slice(hIdx + 1).trim());
      if (!isNaN(lenVal)) length = round3(mil2mm(Math.abs(lenVal)));
    }
  } else if (rotation === 90 || rotation === 270) {
    const vIdx = pathField.lastIndexOf("v");
    if (vIdx !== -1) {
      const lenVal = parseFloat(pathField.slice(vIdx + 1).trim());
      if (!isNaN(lenVal)) length = mil2mm(Math.abs(lenVal));
    }
  }

  // Check pin names/numbers visibility
  // data[9] = "#880000^^1" -> split by "^^" -> [1] is nameVisibility flag
  const nameVisField = data[9] ?? "";
  const nameVisParts = nameVisField.split("^^");
  if (nameVisParts.length > 1 && nameVisParts[1] !== "0") {
    ctx.pinNamesHide = "";
  }
  // data[17] = "#0000FF^^1" -> split by "^^" -> [1] is numberVisibility flag
  const numVisField = data[17] ?? "";
  const numVisParts = numVisField.split("^^");
  if (numVisParts.length > 1 && numVisParts[1] !== "0") {
    ctx.pinNumbersHide = "";
  }

  // Name size from data[16], number size from data[24]
  let nameSize = 1.0;
  if (data[16] && data[16].trim()) {
    const ns = mil2mm(parseFloat(data[16].replace("pt", "")));
    if (!isNaN(ns) && ns > 0) nameSize = ns;
  }
  let numberSize = 1.0;
  if (data[24] && data[24].trim()) {
    const ns = mil2mm(parseFloat(data[24].replace("pt", "")));
    if (!isNaN(ns) && ns > 0) numberSize = ns;
  }

  ctx.drawing += `
      (pin ${electricalType} line
        (at ${fmt(x1)} ${fmt(y1)} ${rotation})
        (length ${fmt(length)})
        (name "${pinName}" (effects (font (size ${fmt(nameSize)} ${fmt(nameSize)}))))
        (number "${pinNumber}" (effects (font (size ${fmt(numberSize)} ${fmt(numberSize)}))))
      )`;
}

/**
 * Text handler
 * data = [?, x, y, rotation, color, font, size, ?, ?, ?, ?, text, ?, anchor]
 */
function h_T(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  const x = mil2mm(parseFloat(data[1]) - tx);
  const y = -mil2mm(parseFloat(data[2]) - ty);
  const rotation = parseFloat(data[3] ?? "0") || 0;
  const kicadRotation = rotation % 360;
  const text = data[11] ?? "";
  ctx.drawing += `
      (text "${text}"
        (at ${fmt(x)} ${fmt(y)} ${kicadRotation})
        (effects (font (size 1.27 1.27) (thickness 0.127)))
      )`;
}

/**
 * Polyline handler
 * data = [points_space_separated, id, locked, ...]
 */
function h_PL(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  const pts = data[0].split(" ").filter(Boolean);
  const polyPts: string[] = [];
  for (let i = 0; i < pts.length - 1; i += 2) {
    const x = mil2mm(parseFloat(pts[i]) - tx);
    const y = -mil2mm(parseFloat(pts[i + 1]) - ty);
    polyPts.push(`(xy ${fmt(x)} ${fmt(y)})`);
  }
  if (polyPts.length < 2) return;
  ctx.drawing += `
      (polyline
        (pts
          ${polyPts.join("\n          ")}
        )
        (stroke (width 0) (type default) (color 0 0 0 0))
        (fill (type none))
      )`;
}

/**
 * Polygon handler
 * data = [points_space_separated, id, locked, ...]
 */
function h_PG(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  const pts = data[0].split(" ").filter(Boolean);
  const polyPts: string[] = [];
  for (let i = 0; i < pts.length - 1; i += 2) {
    const x = mil2mm(parseFloat(pts[i]) - tx);
    const y = -mil2mm(parseFloat(pts[i + 1]) - ty);
    polyPts.push(`(xy ${fmt(x)} ${fmt(y)})`);
  }
  if (polyPts.length < 2) return;
  ctx.drawing += `
      (polyline
        (pts
          ${polyPts.join("\n          ")}
        )
        (stroke (width 0) (type default) (color 0 0 0 0))
        (fill (type background))
      )`;
}

/**
 * Path/Triangle handler
 */
function h_PT(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  const pts = data[0].split(" ").filter(Boolean);
  const polyPts: string[] = [];
  for (let i = 0; i < pts.length - 1; i += 2) {
    const x = mil2mm(parseFloat(pts[i]) - tx);
    const y = -mil2mm(parseFloat(pts[i + 1]) - ty);
    polyPts.push(`(xy ${fmt(x)} ${fmt(y)})`);
  }
  if (polyPts.length < 2) return;
  polyPts.push(polyPts[0]); // close polygon
  ctx.drawing += `
      (polyline
        (pts
          ${polyPts.join("\n          ")}
        )
        (stroke (width 0) (type default) (color 0 0 0 0))
        (fill (type background))
      )`;
}

/**
 * Arc handler
 * data = [svgPath, id, ...]
 * SVG path format: "M x1 y1 A rx ry rotation large-arc sweep x2 y2"
 */
function h_A(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  try {
    const path = data[0].trim();
    const parts = path.split(/[MA]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return;

    const startCoords = parts[0].split(/[\s,]+/);
    const x1 = parseFloat(startCoords[0]);
    const y1 = parseFloat(startCoords[1]);

    const arcParams = parts[1].split(/[\s,]+/);
    const rx = parseFloat(arcParams[0]);
    const ry = parseFloat(arcParams[1]);
    const rotation = parseFloat(arcParams[2]);
    const largeArcFlag = parseInt(arcParams[3]);
    const sweepFlag = parseInt(arcParams[4]);
    const x2 = parseFloat(arcParams[5]);
    const y2 = parseFloat(arcParams[6]);

    const cosRot = Math.cos((rotation * Math.PI) / 180);
    const sinRot = Math.sin((rotation * Math.PI) / 180);

    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const x1p = cosRot * dx + sinRot * dy;
    const y1p = -sinRot * dx + cosRot * dy;

    let rxA = rx, ryA = ry;
    let rxSq = rxA * rxA, rySq = ryA * ryA;
    const x1pSq = x1p * x1p, y1pSq = y1p * y1p;
    const lambda = x1pSq / rxSq + y1pSq / rySq;
    if (lambda > 1) {
      rxA *= Math.sqrt(lambda); ryA *= Math.sqrt(lambda);
      rxSq = rxA * rxA; rySq = ryA * ryA;
    }

    const sign = largeArcFlag === sweepFlag ? -1 : 1;
    const denom = rxSq * y1pSq + rySq * x1pSq;
    if (denom === 0) return;
    const sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / denom);
    const coef = sign * Math.sqrt(sq);
    const cxp = coef * rxA * y1p / ryA;
    const cyp = -coef * ryA * x1p / rxA;
    const cx = cosRot * cxp - sinRot * cyp + (x1 + x2) / 2;
    const cy = sinRot * cxp + cosRot * cyp + (y1 + y2) / 2;

    const angleBetween = (ux: number, uy: number, vx: number, vy: number): number => {
      const n = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
      const c = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / n));
      let angle = Math.acos(c);
      if (ux * vy - uy * vx < 0) angle = -angle;
      return angle;
    };

    const theta1 = angleBetween(1, 0, (x1p - cxp) / rxA, (y1p - cyp) / ryA);
    let dtheta = angleBetween(
      (x1p - cxp) / rxA, (y1p - cyp) / ryA,
      (-x1p - cxp) / rxA, (-y1p - cyp) / ryA
    );
    if (sweepFlag === 0 && dtheta > 0) dtheta -= 2 * Math.PI;
    else if (sweepFlag === 1 && dtheta < 0) dtheta += 2 * Math.PI;

    const midAngle = theta1 + dtheta / 2;
    const xMid = cx + rxA * Math.cos(midAngle) * cosRot - ryA * Math.sin(midAngle) * sinRot;
    const yMid = cy + rxA * Math.cos(midAngle) * sinRot + ryA * Math.sin(midAngle) * cosRot;

    const x1mm = mil2mm(x1 - tx);
    const y1mm = -mil2mm(y1 - ty);
    const x2mm = mil2mm(x2 - tx);
    const y2mm = -mil2mm(y2 - ty);
    const xMidMm = mil2mm(xMid - tx);
    const yMidMm = -mil2mm(yMid - ty);

    ctx.drawing += `
      (arc
        (start ${fmt(x1mm)} ${fmt(y1mm)})
        (mid ${fmt(xMidMm)} ${fmt(yMidMm)})
        (end ${fmt(x2mm)} ${fmt(y2mm)})
        (stroke (width 0) (type default) (color 0 0 0 0))
        (fill (type none))
      )`;
  } catch { /* skip */ }
}

/**
 * Arrowhead handler
 * data = [type, x, y, ?, rotation, svgPath, color, ?, strokeWidth, ?]
 */
function h_AR(data: string[], tx: number, ty: number, ctx: SymbolCtx) {
  const svgPath = data[5] ?? "";
  const cleaned = svgPath.replace(/[MLZ]/gi, " ").trim();
  const coords = cleaned.split(/[\s,]+/).filter(Boolean);
  const polyPts: string[] = [];
  for (let i = 0; i < coords.length - 1; i += 2) {
    const x = mil2mm(parseFloat(coords[i]) - tx);
    const y = -mil2mm(parseFloat(coords[i + 1]) - ty);
    polyPts.push(`(xy ${fmt(x)} ${fmt(y)})`);
  }
  if (polyPts.length < 2) return;
  polyPts.push(polyPts[0]);
  ctx.drawing += `
      (polyline
        (pts
          ${polyPts.join("\n          ")}
        )
        (stroke (width 0) (type default) (color 0 0 0 0))
        (fill (type background))
      )`;
}

// ─── Main generator ──────────────────────────────────────────────────────────

export interface SymbolOptions {
  componentId: string;
  componentName: string;
  libraryName: string;
  prefix: string;
  footprintName: string;
  datasheetLink: string;
  componentTypesValues: [string, string][];
}

const TEMPLATE_LIB_HEADER = `(kicad_symbol_lib (version 20210201) (generator TousstNicolas/JLC2KiCad_lib)\n`;
const TEMPLATE_LIB_FOOTER = `)\n`;

export function generateSymbolLib(
  shapes: string[],
  translation: [number, number],
  opts: SymbolOptions
): string {
  const ctx = newSymCtx();
  const [tx, ty] = translation;

  // Python: kicad_symbol.drawing += f'\n    (symbol "{component_title}_1"'
  // component_title = f"{ComponentName}_{loop_index}" -> for single component it's "CH224A_0"
  // So the unit name is "{ComponentName}_0_1"
  ctx.drawing += `\n    (symbol "${opts.componentName}_0_1"`;

  for (const line of shapes) {
    // Python: args = [i for i in line.split("~")]
    // This splits the ENTIRE string by "~", including embedded "^^" parts
    const args = line.split("~");
    const model = args[0];
    const data = args.slice(1);

    switch (model) {
      case "R": h_R(data, tx, ty, ctx); break;
      case "E": h_E(data, tx, ty, ctx); break;
      case "P": h_P(data, tx, ty, ctx); break;
      case "T": h_T(data, tx, ty, ctx); break;
      case "PL": h_PL(data, tx, ty, ctx); break;
      case "PG": h_PG(data, tx, ty, ctx); break;
      case "PT": h_PT(data, tx, ty, ctx); break;
      case "A": h_A(data, tx, ty, ctx); break;
      case "AR": h_AR(data, tx, ty, ctx); break;
      default: break;
    }
  }

  ctx.drawing += `\n    )`;

  // Build type/value properties
  const typeValProps = opts.componentTypesValues
    .map(([k, v], i) => `    (property "${k}" "${v}" (id ${6 + i}) (at 0 0 0)\n      (effects (font (size 1.27 1.27)) hide)\n    )`)
    .join("\n");

  const component = `  (symbol "${opts.componentName}" ${ctx.pinNamesHide} ${ctx.pinNumbersHide} (in_bom yes) (on_board yes)
    (property "Reference" "${opts.prefix}" (id 0) (at 0 1.27 0)
      (effects (font (size 1.27 1.27)))
    )
    (property "Value" "${opts.componentName}" (id 1) (at 0 -2.54 0)
      (effects (font (size 1.27 1.27)))
    )
    (property "Footprint" "${opts.footprintName}" (id 2) (at 0 -10.16 0)
      (effects (font (size 1.27 1.27) italic) hide)
    )
    (property "Datasheet" "${opts.datasheetLink}" (id 3) (at -2.286 0.127 0)
      (effects (font (size 1.27 1.27)) (justify left) hide)
    )
    (property "ki_keywords" "${opts.componentId}" (id 4) (at 0 0 0)
      (effects (font (size 1.27 1.27)) hide)
    )
    (property "LCSC" "${opts.componentId}" (id 5) (at 0 0 0)
      (effects (font (size 1.27 1.27)) hide)
    )
${typeValProps ? typeValProps + "\n" : ""}${ctx.drawing}
  )
`;

  return TEMPLATE_LIB_HEADER + component + TEMPLATE_LIB_FOOTER;
}
