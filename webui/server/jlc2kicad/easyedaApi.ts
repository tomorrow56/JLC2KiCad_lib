import axios from "axios";

const USER_AGENT = "JLC2KiCadLib/2.0 (https://github.com/TousstNicolas/JLC2KiCad_lib)";

export interface EasyEDASvgResult {
  component_uuid: string;
  updateTime: number;
  svg: string;
  docType: number;
  bbox: { x: number; y: number; width: number; height: number };
  png: string;
}

export interface EasyEDAComponentData {
  uuid: string;
  title: string;
  description: string;
  docType: number;
  type: number;
  lcsc?: { id: number; number: string };
  dataStr: {
    head: {
      x: number;
      y: number;
      c_para?: {
        link?: string;
        pre?: string;
        [key: string]: string | undefined;
      };
    };
    shape: string[];
    canvas?: string;
    BBox?: { x: number; y: number; width: number; height: number };
  };
  packageDetail?: {
    uuid: string;
    title: string;
    docType: number;
    dataStr: {
      head: { x: number; y: number; c_para?: Record<string, string> };
      shape: string[];
    };
  };
}

/** Fetch symbol + footprint UUIDs for a JLCPCB part number */
export async function fetchComponentUUIDs(
  componentId: string
): Promise<{ symbolUuid: string; footprintUuid: string } | null> {
  const url = `https://easyeda.com/api/products/${componentId}/svgs`;
  const resp = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT },
    timeout: 30000,
  });
  const data = resp.data;
  if (!data.success || !Array.isArray(data.result) || data.result.length === 0) {
    return null;
  }
  // docType 2 = symbol, docType 4 = footprint
  const symbolItem = (data.result as EasyEDASvgResult[]).find((r) => r.docType === 2);
  const footprintItem = (data.result as EasyEDASvgResult[]).find((r) => r.docType === 4);
  if (!symbolItem || !footprintItem) {
    const first = data.result[0] as EasyEDASvgResult;
    return { symbolUuid: first.component_uuid, footprintUuid: first.component_uuid };
  }
  return {
    symbolUuid: symbolItem.component_uuid,
    footprintUuid: footprintItem.component_uuid,
  };
}

/** Fetch full component data by UUID */
export async function fetchComponentData(uuid: string): Promise<EasyEDAComponentData | null> {
  const url = `https://easyeda.com/api/components/${uuid}`;
  const resp = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT },
    timeout: 30000,
  });
  const data = resp.data;
  if (!data.success || !data.result) return null;
  return data.result as EasyEDAComponentData;
}

/** Fetch 3D model OBJ text */
export async function fetch3DModelObj(uuid: string): Promise<string | null> {
  const url = `https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/${uuid}`;
  try {
    const resp = await axios.get(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 30000,
      responseType: "text",
    });
    if (resp.status === 200 && resp.data) return resp.data as string;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fetch STEP model binary
 * URL: https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/{svgnode_uuid}
 * Note: uuid must be the SVGNODE attrs.uuid (from footprint shape), NOT the footprint UUID
 * The same URL is used for OBJ (fetch3DModelObj) - the response is STEP binary
 */
export async function fetchStepModel(uuid: string): Promise<Buffer | null> {
  const url = `https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/${uuid}`;
  try {
    const resp = await axios.get(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 60000,
      responseType: "arraybuffer",
    });
    if (resp.status === 200 && resp.data) return Buffer.from(resp.data as ArrayBuffer);
  } catch {
    // ignore
  }
  return null;
}
