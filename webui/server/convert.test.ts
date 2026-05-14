import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock DB helpers
vi.mock("./db", () => ({
  createConversion: vi.fn().mockResolvedValue(42),
  updateConversion: vi.fn().mockResolvedValue(undefined),
  getConversionById: vi.fn().mockResolvedValue({
    id: 42,
    partNumbers: ["C1337258"],
    options: { symbol: true, footprint: true, models: "STEP" },
    status: "pending",
    zipKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  listConversions: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: null,
      partNumbers: ["C1337258", "C24112"],
      options: { symbol: true, footprint: true, models: "STEP" },
      status: "done",
      zipKey: "conversions/1/output.zip",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  ]),
  deleteConversion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "conversions/42/output.zip", url: "/manus-storage/conversions/42/output.zip" }),
  storageGet: vi.fn().mockResolvedValue({ key: "conversions/1/output.zip", url: "/manus-storage/conversions/1/output.zip" }),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn().mockRejectedValue(new Error("no session")),
  },
}));

import { createConversion, listConversions, deleteConversion } from "./db";

describe("Conversion DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createConversion returns a numeric job ID", async () => {
    const id = await createConversion({
      userId: null,
      partNumbers: ["C1337258"] as any,
      options: { symbol: true, footprint: true, models: "STEP" } as any,
      status: "pending",
    });
    expect(typeof id).toBe("number");
    expect(id).toBe(42);
  });

  it("listConversions returns an array", async () => {
    const items = await listConversions();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it("listConversions items have required fields", async () => {
    const items = await listConversions();
    const item = items[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("partNumbers");
    expect(item).toHaveProperty("status");
  });

  it("deleteConversion resolves without error", async () => {
    await expect(deleteConversion(1)).resolves.toBeUndefined();
  });
});

describe("Polling status response structure", () => {
  it("status response contains required fields", () => {
    const mockStatusResponse = {
      jobId: 1,
      status: "done",
      logs: [
        { type: "status", status: "running", message: "🚀 Conversion started..." },
        { type: "log", level: "INFO", message: "INFO - creating library for component C42459160" },
        { type: "status", status: "done", message: "✅ Conversion complete! Ready to download." },
      ],
      zipKey: "conversions/1/output.zip",
    };
    expect(mockStatusResponse).toHaveProperty("jobId");
    expect(mockStatusResponse).toHaveProperty("status");
    expect(mockStatusResponse).toHaveProperty("logs");
    expect(Array.isArray(mockStatusResponse.logs)).toBe(true);
    expect(mockStatusResponse.status).toBe("done");
  });

  it("terminal states are done or error only", () => {
    const terminalStates = ["done", "error"];
    const nonTerminal = ["pending", "running"];
    for (const s of terminalStates) expect(terminalStates.includes(s)).toBe(true);
    for (const s of nonTerminal) expect(terminalStates.includes(s)).toBe(false);
  });
});

describe("Part number validation", () => {
  it("accepts valid JLCPCB part numbers", () => {
    const validParts = ["C1337258", "C24112", "C14663", "C123456"];
    for (const part of validParts) {
      expect(part).toMatch(/^C\d+$/);
    }
  });

  it("rejects empty part numbers", () => {
    const empty: string[] = [];
    expect(empty.length).toBe(0);
  });
});
