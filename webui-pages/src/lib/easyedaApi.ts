/**
 * EasyEDA API client for browser environment
 * Uses CORS proxies to bypass CORS restrictions
 */

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

// CORS proxy list (tried in order)
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url: string, binary = false): Promise<Response> {
  let lastError: Error | null = null;

  for (const proxyFn of CORS_PROXIES) {
    const proxyUrl = proxyFn(url);
    try {
      const resp = await fetch(proxyUrl, {
        headers: {
          "Accept": binary ? "application/octet-stream" : "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) return resp;
      lastError = new Error(`HTTP ${resp.status} from ${proxyUrl}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error(`All CORS proxies failed for: ${url}`);
}

/** Fetch symbol + footprint UUIDs for a JLCPCB part number */
export async function fetchComponentUUIDs(
  componentId: string
): Promise<{ symbolUuid: string; footprintUuid: string } | null> {
  const url = `https://easyeda.com/api/products/${componentId}/svgs`;
  const resp = await fetchWithProxy(url);
  const data = await resp.json() as { success: boolean; result: EasyEDASvgResult[] };

  if (!data.success || !Array.isArray(data.result) || data.result.length === 0) {
    return null;
  }
  // docType 2 = symbol, docType 4 = footprint
  const symbolItem = data.result.find((r) => r.docType === 2);
  const footprintItem = data.result.find((r) => r.docType === 4);
  if (!symbolItem || !footprintItem) {
    const first = data.result[0];
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
  const resp = await fetchWithProxy(url);
  const data = await resp.json() as { success: boolean; result: EasyEDAComponentData };
  if (!data.success || !data.result) return null;
  return data.result;
}

/** Fetch 3D model OBJ text */
export async function fetch3DModelObj(uuid: string): Promise<string | null> {
  const url = `https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/${uuid}`;
  try {
    const resp = await fetchWithProxy(url);
    const text = await resp.text();
    if (text && text.length > 10) return text;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fetch STEP model as ArrayBuffer
 * URL: https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/{svgnode_uuid}
 */
export async function fetchStepModel(uuid: string): Promise<ArrayBuffer | null> {
  const url = `https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/${uuid}`;
  try {
    const resp = await fetchWithProxy(url, true);
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > 100) return buf;
  } catch {
    // ignore
  }
  return null;
}
