import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Download,
  Trash2,
  RefreshCw,
  History as HistoryIcon,
  Clock,
  Package,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

interface ConversionRecord {
  id: number;
  partNumbers: string[];
  options: {
    symbol: boolean;
    footprint: boolean;
    models: string | string[];
    symbolLib: string;
    footprintLib: string;
  };
  status: "pending" | "running" | "done" | "error";
  errorMessage?: string;
  zipKey?: string;
  createdAt: string;
  updatedAt: string;
}

function StatusBadge({ status }: { status: ConversionRecord["status"] }) {
  const { t } = useI18n();
  const config = {
    pending: { label: t("history_status_pending"), icon: Clock, className: "border-muted text-muted-foreground" },
    running: { label: t("history_status_running"), icon: Loader2, className: "border-primary/40 text-primary" },
    done: { label: t("history_status_done"), icon: CheckCircle2, className: "border-[var(--success)]/40 text-[var(--success)]" },
    error: { label: t("history_status_error"), icon: AlertCircle, className: "border-destructive/40 text-destructive" },
  }[status];

  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-[11px] ${config.className}`}>
      <Icon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}

function formatDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  const locale = lang === "ja" ? "ja-JP" : "en-US";
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getModelsLabel(models: string | string[]) {
  if (Array.isArray(models)) return models.length === 0 ? "No 3D" : models.join("+");
  if (models === "BOTH") return "STEP+WRL";
  if (models === "NONE") return "No 3D";
  return models;
}

export default function History() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const [records, setRecords] = useState<ConversionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/convert/history");
      if (!res.ok) throw new Error("Failed to fetch history");
      const { items } = await res.json();
      setRecords(items);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/convert/history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("history_delete_failed"));
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success(t("history_deleted"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (id: number) => {
    window.open(`/api/convert/download/${id}`, "_blank");
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <HistoryIcon className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{t("history_title")}</h1>
            <p className="text-xs text-muted-foreground">{t("history_subtitle")}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHistory}
          disabled={loading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("history_btn_refresh")}
        </Button>
      </div>

      {/* Not signed in notice */}
      {!isAuthenticated && (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
            <LogIn className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t("history_login_desc")}</p>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            <LogIn className="w-3.5 h-3.5" />
            {t("history_btn_signin")}
          </Button>
        </div>
      )}

      {/* Records */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">{t("history_loading")}</span>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t("history_empty_title")}</p>
          <p className="text-xs text-muted-foreground/60">
            {t("history_empty_desc")}
          </p>
          <Link href="/">
            <Button size="sm" className="gap-1.5 mt-2">
              <Zap className="w-3.5 h-3.5" />
              {t("history_btn_convert")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <div
              key={record.id}
              className="rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Part numbers */}
                  <div className="flex flex-wrap gap-1.5">
                    {(record.partNumbers as string[]).map((part) => (
                      <span key={part} className="part-tag text-[11px]">
                        {part}
                      </span>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <StatusBadge status={record.status} />
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(record.createdAt, lang)}
                    </span>
                      <span className="text-muted-foreground/60">
                      {[
                        record.options?.symbol && t("history_opt_symbol"),
                        record.options?.footprint && t("history_opt_footprint"),
                        record.options?.models && getModelsLabel(record.options.models),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>

                  {record.errorMessage && (
                    <p className="text-xs text-destructive/80">{record.errorMessage}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {record.status === "done" && record.zipKey && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => handleDownload(record.id)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t("history_btn_download")}
                    </Button>
                  )}
                  <Link href="/">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {t("history_rerun")}
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(record.id)}
                    disabled={deletingId === record.id}
                  >
                    {deletingId === record.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
