import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import os from "os";
import archiver from "archiver";
import { createConversion, updateConversion, getConversionById, listConversions, deleteConversion } from "./db";
import { storagePut, storageGet, storageGetSignedUrl } from "./storage";
import { sdk } from "./_core/sdk";
import { convertComponents } from "./jlc2kicad/converter";

const router = Router();

export interface ConversionOptions {
  symbol: boolean;
  footprint: boolean;
  models: string | string[];
  symbolLib: string;
  footprintLib: string;
  skipExisting: boolean;
  modelBaseVariable: string;
}

export interface LogEntry {
  type: "log" | "progress" | "status" | "result";
  level?: string;
  message?: string;
  part?: string;
  state?: string;
  error?: string;
  status?: string;
  jobId?: number;
  success?: boolean;
  errors?: Array<{ part: string; error: string }>;
}

async function tryGetUser(req: Request) {
  try { return await sdk.authenticateRequest(req); } catch { return null; }
}

// Append log entries to DB (non-blocking)
async function appendLogs(jobId: number, newEntries: LogEntry[]): Promise<void> {
  if (newEntries.length === 0) return;
  try {
    const job = await getConversionById(jobId);
    if (!job) return;
    const existing: LogEntry[] = job.logs ? JSON.parse(job.logs as string) : [];
    const merged = [...existing, ...newEntries];
    await updateConversion(jobId, { logs: JSON.stringify(merged) } as any);
  } catch (e) {
    console.error("[appendLogs] error:", e);
  }
}

// Normalize models option to string
function normalizeModels(models: string | string[] | undefined): string {
  if (!models) return "";
  if (Array.isArray(models)) return models.join(",").toUpperCase();
  if (models === "none" || models === "") return "";
  return models.toUpperCase();
}

// Background conversion runner — does NOT block the HTTP response
function runConversionBackground(jobId: number, partNumbers: string[], options: ConversionOptions): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `jlc2kicad-${jobId}-`));

  const modelsStr = normalizeModels(options.models);

  const pendingLogs: LogEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Batch log writes to DB every 500ms to reduce DB load
  const scheduledFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      if (pendingLogs.length > 0) {
        const toFlush = pendingLogs.splice(0);
        await appendLogs(jobId, toFlush);
      }
    }, 500);
  };

  const onLog = (msg: string) => {
    console.log(`[job ${jobId}] ${msg}`);
    pendingLogs.push({ type: "log", level: "INFO", message: msg });
    scheduledFlush();
  };

  // Run conversion asynchronously
  (async () => {
    try {
      const result = await convertComponents({
        partNumbers,
        outputDir: tmpDir,
        libraryName: options.symbolLib || options.footprintLib || undefined,
        symbol: options.symbol !== false,
        footprint: options.footprint !== false,
        models: modelsStr,
        skipExisting: options.skipExisting ?? false,
        modelBaseVariable: options.modelBaseVariable ?? "",
        onLog,
      });

      // Flush remaining logs
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (pendingLogs.length > 0) {
        const toFlush = pendingLogs.splice(0);
        await appendLogs(jobId, toFlush);
      }

      if (result.success || result.files.length > 0) {
        await appendLogs(jobId, [{ type: "status", status: "packaging", message: "📦 Packaging output files..." }]);
        const zipBuffer = await zipDirectory(tmpDir);
        const zipKey = `conversions/${jobId}/output.zip`;
        const { key } = await storagePut(zipKey, zipBuffer, "application/zip");
        await appendLogs(jobId, [{ type: "status", status: "done", message: "✅ Conversion complete! Ready to download." }]);
        await updateConversion(jobId, { status: "done", zipKey: key } as any);
      } else {
        const errMsg = result.errors.join("; ");
        await appendLogs(jobId, [{ type: "status", status: "error", message: `❌ Conversion failed: ${errMsg}` }]);
        await updateConversion(jobId, { status: "error", errorMessage: errMsg } as any);
      }
    } catch (e: any) {
      console.error("[convert/background] error:", e);
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (pendingLogs.length > 0) {
        const toFlush = pendingLogs.splice(0);
        await appendLogs(jobId, toFlush);
      }
      await appendLogs(jobId, [{ type: "status", status: "error", message: `❌ Error: ${e.message}` }]);
      await updateConversion(jobId, { status: "error", errorMessage: e.message } as any);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })();
}

// POST /api/convert/start — create job and start background conversion
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { partNumbers, options } = req.body as {
      partNumbers: string[];
      options: ConversionOptions;
    };
    if (!partNumbers || partNumbers.length === 0) {
      res.status(400).json({ error: "partNumbers is required" });
      return;
    }
    const user = await tryGetUser(req);
    const jobId = await createConversion({
      userId: user?.id ?? null,
      partNumbers: partNumbers as any,
      options: options as any,
      status: "running",
      logs: JSON.stringify([{ type: "status", status: "running", message: "🚀 Conversion started..." }]),
    } as any);

    // Fire-and-forget background conversion
    runConversionBackground(jobId, partNumbers, options);

    res.json({ jobId });
  } catch (e: any) {
    console.error("[convert/start]", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/convert/status/:jobId — polling endpoint
router.get("/status/:jobId", async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.jobId, 10);
  if (isNaN(jobId)) { res.status(400).json({ error: "invalid jobId" }); return; }

  try {
    const job = await getConversionById(jobId);
    if (!job) { res.status(404).json({ error: "job not found" }); return; }

    const logs: LogEntry[] = job.logs ? JSON.parse(job.logs as string) : [];
    res.json({
      jobId,
      status: job.status,
      logs,
      zipKey: job.zipKey ?? null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/convert/download/:jobId
router.get("/download/:jobId", async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.jobId, 10);
  if (isNaN(jobId)) { res.status(400).json({ error: "invalid jobId" }); return; }
  const job = await getConversionById(jobId);
  if (!job || !job.zipKey) { res.status(404).json({ error: "file not found" }); return; }
  // Build filename from part numbers: e.g. "C42459160.zip" or "C42459160_C24112.zip"
  const partNumbers = (job.partNumbers as string[]) ?? [];
  const zipFilename = partNumbers.length > 0
    ? partNumbers.join("_") + ".zip"
    : `jlc2kicad_${jobId}.zip`;
  // Proxy the file with correct Content-Disposition filename using signed URL
  try {
    const signedUrl = await storageGetSignedUrl(job.zipKey);
    const fileResp = await fetch(signedUrl);
    if (!fileResp.ok) throw new Error(`Storage fetch failed: ${fileResp.status}`);
    const buffer = Buffer.from(await fileResp.arrayBuffer());
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (e: any) {
    console.error("[download] fallback to redirect:", e.message);
    const { url } = await storageGet(job.zipKey);
    res.redirect(url);
  }
});

// GET /api/convert/history
router.get("/history", async (req: Request, res: Response) => {
  try {
    const user = await tryGetUser(req);
    const items = await listConversions(user?.id);
    // Strip logs from history to keep response small
    const stripped = items.map(({ logs: _logs, ...rest }) => rest);
    res.json({ items: stripped });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/convert/history/:id
router.delete("/history/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  await deleteConversion(id);
  res.json({ success: true });
});

function zipDirectory(dir: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    archive.directory(dir, false);
    archive.finalize();
  });
}

export default router;
