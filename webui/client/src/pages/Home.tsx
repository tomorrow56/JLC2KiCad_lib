import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Cpu,
  Zap,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  FileCode2,
  Box,
} from "lucide-react";

interface ConversionOptions {
  symbol: boolean;
  footprint: boolean;
  models: string | string[];
  symbolLib: string;
  footprintLib: string;
  skipExisting: boolean;
  modelBaseVariable: string;
}

interface LogEntry {
  type: string;
  level?: string;
  message?: string;
  part?: string;
  state?: string;
  error?: string;
  status?: string;
  jobId?: number;
}

type ConvertStatus = "idle" | "running" | "packaging" | "done" | "error";

// STEPS are defined inside the component to use i18n

// MODEL_OPTIONS is defined inside the component to use i18n

// Polling interval in ms
const POLL_INTERVAL = 1500;

export default function Home() {
  const { t } = useI18n();

  const STEPS = [
    { key: "running", label: t("step_fetching") },
    { key: "packaging", label: t("step_packaging") },
    { key: "done", label: t("step_done") },
  ];

  const MODEL_OPTIONS = [
    { value: "STEP", label: t("model_step_only") },
    { value: "WRL", label: t("model_wrl_only") },
    { value: "BOTH", label: t("model_both") },
    { value: "NONE", label: t("model_none") },
  ];

  const [partNumbers, setPartNumbers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<ConversionOptions>({
    symbol: true,
    footprint: true,
    models: "STEP",
    symbolLib: "jlc_lib",
    footprintLib: "footprint",
    skipExisting: false,
    modelBaseVariable: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<ConvertStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [partProgress, setPartProgress] = useState<Record<string, "start" | "done" | "error">>({});
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenLogCountRef = useRef<number>(0);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const addPart = useCallback((value: string) => {
    const parts = value
      .split(/[\s,;]+/)
      .map((p) => p.trim().toUpperCase())
      .filter((p) => p.length > 0);
    setPartNumbers((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.includes(p)) next.push(p);
      }
      return next;
    });
    setInputValue("");
  }, []);

  const removePart = (part: string) => {
    setPartNumbers((prev) => prev.filter((p) => p !== part));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) addPart(inputValue);
    } else if (e.key === "Backspace" && !inputValue && partNumbers.length > 0) {
      setPartNumbers((prev) => prev.slice(0, -1));
    }
  };

  const getModelsArg = () => {
    if (options.models === "BOTH") return ["STEP", "WRL"];
    if (options.models === "NONE") return [];
    return options.models as string;
  };

  // Process incoming log entries and update UI state
  const processLogs = useCallback((entries: LogEntry[]) => {
    for (const entry of entries) {
      if (entry.type === "log") {
        setLogs((prev) => [...prev, entry]);
      } else if (entry.type === "progress") {
        setPartProgress((prev) => ({ ...prev, [entry.part!]: entry.state as any }));
        if (entry.state === "start") {
          setLogs((prev) => [...prev, { type: "log", level: "INFO", message: `▶ Processing ${entry.part}...` }]);
        } else if (entry.state === "done") {
          setLogs((prev) => [...prev, { type: "log", level: "INFO", message: `✓ ${entry.part} completed` }]);
        } else if (entry.state === "error") {
          setLogs((prev) => [...prev, { type: "log", level: "ERROR", message: `✗ ${entry.part}: ${entry.error}` }]);
        }
      } else if (entry.type === "status") {
        if (entry.status === "packaging") {
          setStatus("packaging");
        } else if (entry.status === "done") {
          setStatus("done");
        } else if (entry.status === "error") {
          setStatus("error");
        }
        if (entry.message) {
          setLogs((prev) => [...prev, { type: "log", level: "INFO", message: entry.message }]);
        }
      }
    }
  }, []);

  // Poll job status from server
  const pollStatus = useCallback(async (currentJobId: number) => {
    try {
      const res = await fetch(`/api/convert/status/${currentJobId}`);
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      const data = await res.json();

      const allLogs: LogEntry[] = data.logs ?? [];
      const newEntries = allLogs.slice(seenLogCountRef.current);
      if (newEntries.length > 0) {
        seenLogCountRef.current = allLogs.length;
        processLogs(newEntries);
      }

      const jobStatus: string = data.status;
      if (jobStatus === "done" || jobStatus === "error") {
        // Final state — stop polling
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
        return;
      }

      // Continue polling
      pollTimerRef.current = setTimeout(() => pollStatus(currentJobId), POLL_INTERVAL);
    } catch (e: any) {
      console.error("[poll] error:", e);
      // Retry on transient errors (network blip)
      pollTimerRef.current = setTimeout(() => pollStatus(currentJobId), POLL_INTERVAL * 2);
    }
  }, [processLogs]);

  const handleConvert = async () => {
    if (partNumbers.length === 0) {
      toast.error(t("err_no_parts"));
      return;
    }
    // Reset state
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    seenLogCountRef.current = 0;
    setStatus("running");
    setLogs([]);
    setPartProgress({});
    setJobId(null);

    try {
      const startRes = await fetch("/api/convert/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumbers,
          options: { ...options, models: getModelsArg() },
        }),
      });
      if (!startRes.ok) throw new Error(t("err_start_failed"));
      const { jobId: newJobId } = await startRes.json();
      setJobId(newJobId);

      // Start polling
      pollTimerRef.current = setTimeout(() => pollStatus(newJobId), POLL_INTERVAL);
    } catch (e: any) {
      setStatus("error");
      toast.error(e.message);
    }
  };

  const handleDownload = () => {
    if (jobId) window.open(`/api/convert/download/${jobId}`, "_blank");
  };

  const handleReset = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    seenLogCountRef.current = 0;
    setStatus("idle");
    setLogs([]);
    setJobId(null);
    setPartProgress({});
  };

  const currentStep = status === "running" ? 0 : status === "packaging" ? 1 : status === "done" ? 2 : -1;

  return (
    <div className="min-h-[calc(100vh-3.5rem-3rem)] flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-primary rounded-full" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                {t("home_breadcrumb")}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              <span className="text-gold-gradient">{t("home_title_convert")}</span>{" "}
              <span className="text-foreground">{t("home_title_rest")}</span>
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              {t("home_subtitle")}<br />
              {t("home_subtitle2")}
            </p>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="container py-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Input panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Part number input */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">{t("section_part_numbers")}</h2>
              </div>

              {/* Tag input */}
              <div
                className="min-h-[80px] flex flex-wrap gap-1.5 p-3 bg-input rounded-lg border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all cursor-text"
                onClick={() => inputRef.current?.focus()}
              >
                {partNumbers.map((part) => (
                  <span key={part} className="part-tag">
                    {part}
                    <button
                      onClick={(e) => { e.stopPropagation(); removePart(part); }}
                      className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => { if (inputValue.trim()) addPart(inputValue); }}
                  placeholder={partNumbers.length === 0 ? t("input_placeholder") : ""}
                  className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("input_hint")}
              </p>

              {/* Quick add examples */}
              {partNumbers.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("examples_label")}</span>
                  {["C1337258", "C24112", "C14663"].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => addPart(ex)}
                      className="text-xs px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors font-mono"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">{t("section_output_options")}</h2>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">{t("opt_symbol")}</Label>
                  <Switch
                    checked={options.symbol}
                    onCheckedChange={(v) => setOptions((o) => ({ ...o, symbol: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">{t("opt_footprint")}</Label>
                  <Switch
                    checked={options.footprint}
                    onCheckedChange={(v) => setOptions((o) => ({ ...o, footprint: v }))}
                  />
                </div>

                {/* 3D model selector */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5" />
                    {t("opt_3d_model")}
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MODEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setOptions((o) => ({ ...o, models: opt.value }))}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          options.models === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {t("section_advanced")}
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-1 border-t border-border/40">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t("opt_symbol_lib")}</Label>
                    <Input
                      value={options.symbolLib}
                      onChange={(e) => setOptions((o) => ({ ...o, symbolLib: e.target.value }))}
                      className="h-8 text-xs font-mono"
                      placeholder="jlc_lib"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t("opt_footprint_lib")}</Label>
                    <Input
                      value={options.footprintLib}
                      onChange={(e) => setOptions((o) => ({ ...o, footprintLib: e.target.value }))}
                      className="h-8 text-xs font-mono"
                      placeholder="footprint"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t("opt_model_base_var")}</Label>
                    <Input
                      value={options.modelBaseVariable}
                      onChange={(e) => setOptions((o) => ({ ...o, modelBaseVariable: e.target.value }))}
                      className="h-8 text-xs font-mono"
                      placeholder="${KICAD_3RD_PARTY}"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{t("opt_skip_existing")}</Label>
                    <Switch
                      checked={options.skipExisting}
                      onCheckedChange={(v) => setOptions((o) => ({ ...o, skipExisting: v }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Convert button */}
            <Button
              onClick={status === "idle" || status === "error" ? handleConvert : handleReset}
              disabled={status === "running" || status === "packaging"}
              className="w-full h-11 text-sm font-semibold btn-glow gap-2"
              size="lg"
            >
              {status === "running" || status === "packaging" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {status === "packaging" ? t("step_packaging") + "..." : t("btn_converting")}
                </>
              ) : status === "done" ? (
                <>
                  <Zap className="w-4 h-4" />
                  {t("btn_convert")}
                </>
              ) : status === "error" ? (
                <>
                  <Zap className="w-4 h-4" />
                  {t("btn_convert")}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  {t("btn_convert")} {partNumbers.length > 0 ? `(${partNumbers.length})` : ""}
                </>
              )}
            </Button>
          </div>

          {/* Right: Progress + Logs */}
          <div className="lg:col-span-3 space-y-4">
            {/* Status card */}
            {status !== "idle" && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                {/* Steps */}
                <div className="flex items-center gap-0">
                  {STEPS.map((step, i) => {
                    const isDone = currentStep > i || status === "done";
                    const isActive = currentStep === i;
                    const isError = status === "error" && i === currentStep;
                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                              isError
                                ? "border-destructive bg-destructive/10"
                                : isDone
                                ? "border-[var(--success)] bg-[var(--success)]/10"
                                : isActive
                                ? "border-primary bg-primary/10 animate-pulse-ring"
                                : "border-border bg-muted/30"
                            }`}
                          >
                            {isError ? (
                              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            ) : isDone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
                            ) : isActive ? (
                              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-medium whitespace-nowrap ${
                              isError ? "text-destructive" : isDone ? "text-[var(--success)]" : isActive ? "text-primary" : "text-muted-foreground/50"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {i < STEPS.length - 1 && (
                          <div
                            className={`flex-1 h-px mx-2 mb-4 transition-colors ${
                              currentStep > i || status === "done" ? "bg-[var(--success)]/40" : "bg-border/40"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Part progress */}
                {partNumbers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {partNumbers.map((part) => {
                      const ps = partProgress[part];
                      return (
                        <Badge
                          key={part}
                          variant="outline"
                          className={`font-mono text-[11px] gap-1 transition-all ${
                            ps === "done"
                              ? "border-[var(--success)]/50 text-[var(--success)] bg-[var(--success)]/5"
                              : ps === "error"
                              ? "border-destructive/50 text-destructive bg-destructive/5"
                              : ps === "start"
                              ? "border-primary/50 text-primary bg-primary/5"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {ps === "done" ? <CheckCircle2 className="w-2.5 h-2.5" /> : ps === "error" ? <AlertCircle className="w-2.5 h-2.5" /> : ps === "start" ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                          {part}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Download button */}
                {status === "done" && jobId && (
                  <Button
                    onClick={handleDownload}
                    className="w-full gap-2 btn-glow"
                    variant="default"
                  >
                    <Download className="w-4 h-4" />
                    {t("btn_download")}
                  </Button>
                )}
              </div>
            )}

            {/* Log terminal */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--success)]/60" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{t("log_title")}</span>
                </div>
                {logs.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">{logs.length} {t("log_lines")}</span>
                )}
              </div>
              <div className="h-72 overflow-y-auto p-4 log-terminal">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/40">
                    <Package className="w-8 h-8" />
                    <p className="text-xs">{t("log_empty")}</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {logs.map((log, i) => (
                      <div key={i} className={`text-xs leading-relaxed ${
                        log.level === "ERROR" ? "text-[var(--log-error)]" :
                        log.level === "WARNING" ? "text-[var(--log-warn)]" :
                        "text-[var(--log-info)]"
                      }`}>
                        <span className="text-muted-foreground/40 select-none mr-2">
                          {String(i + 1).padStart(3, "0")}
                        </span>
                        {log.message}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Info cards */}
            {status === "idle" && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: FileCode2, title: t("info_symbol_title"), desc: t("info_symbol_desc") },
                  { icon: Cpu, title: t("info_footprint_title"), desc: t("info_footprint_desc") },
                  { icon: Box, title: t("info_3d_title"), desc: t("info_3d_desc") },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="rounded-lg border border-border/60 bg-card/50 p-3 space-y-1.5">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-xs font-medium">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
