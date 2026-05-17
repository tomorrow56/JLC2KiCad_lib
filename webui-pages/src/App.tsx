import { useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import { convertComponents } from "./lib/converter";
import "./App.css";

// ─── i18n ────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title: "JLC2KiCad",
    subtitle: "Convert JLCPCB component libraries to KiCad format",
    partNumbers: "Part Numbers",
    partPlaceholder: "C1337258, C24112...",
    partHint: "Press Enter or Space to add. Paste multiple at once.",
    examples: "Examples:",
    outputOptions: "Output Options",
    symbol: "Symbol (.kicad_sym)",
    footprint: "Footprint (.kicad_mod)",
    model3d: "3D Model",
    modelType: "Model Type",
    modelBase: "Model Base Variable",
    modelBasePlaceholder: "${KICAD6_3DMODEL_DIR}",
    convert: "Convert",
    converting: "Converting...",
    download: "Download ZIP",
    log: "Conversion Log",
    logEmpty: "Conversion log will appear here",
    history: "History",
    historyEmpty: "No conversion history yet",
    reDownload: "Re-download",
    clearHistory: "Clear History",
    langToggle: "JA",
    noPartsError: "Please enter at least one part number.",
    noOutputError: "Please select at least one output type.",
    proxyNote: "Note: This tool uses a public CORS proxy (corsproxy.io) to access the EasyEDA API. If conversion fails, the proxy may be temporarily unavailable.",
    footerNote: "Standalone version for GitHub Pages. No login required.",
    sourceCode: "Source Code",
    manusVersion: "Full Version (Manus)",
  },
  ja: {
    title: "JLC2KiCad",
    subtitle: "JLCPCBの部品ライブラリをKiCad形式に変換",
    partNumbers: "部品番号",
    partPlaceholder: "C1337258, C24112...",
    partHint: "EnterまたはSpaceで追加。複数まとめて貼り付け可。",
    examples: "例:",
    outputOptions: "出力オプション",
    symbol: "シンボル (.kicad_sym)",
    footprint: "フットプリント (.kicad_mod)",
    model3d: "3Dモデル",
    modelType: "モデル形式",
    modelBase: "モデルベース変数",
    modelBasePlaceholder: "${KICAD6_3DMODEL_DIR}",
    convert: "変換",
    converting: "変換中...",
    download: "ZIPをダウンロード",
    log: "変換ログ",
    logEmpty: "変換ログがここに表示されます",
    history: "履歴",
    historyEmpty: "変換履歴はまだありません",
    reDownload: "再ダウンロード",
    clearHistory: "履歴を消去",
    langToggle: "EN",
    noPartsError: "部品番号を1つ以上入力してください。",
    noOutputError: "出力形式を1つ以上選択してください。",
    proxyNote: "注意: このツールはEasyEDA APIへのアクセスに公開CORSプロキシ (corsproxy.io) を使用しています。変換に失敗する場合、プロキシが一時的に利用できない可能性があります。",
    footerNote: "GitHub Pages向けスタンドアロン版。ログイン不要。",
    sourceCode: "ソースコード",
    manusVersion: "フル機能版 (Manus)",
  },
} as const;

type Lang = "en" | "ja";

// ─── History ─────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  partNumbers: string[];
  timestamp: number;
  fileCount: number;
  zipBlob: string; // base64
  zipName: string;
}

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem("jlc2kicad_history") ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  // Keep only last 20 entries
  const trimmed = entries.slice(-20);
  localStorage.setItem("jlc2kicad_history", JSON.stringify(trimmed));
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("jlc2kicad_lang") as Lang | null;
    if (saved === "en" || saved === "ja") return saved;
    return navigator.language.startsWith("ja") ? "ja" : "en";
  });
  const t = T[lang];

  const [parts, setParts] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [symbol, setSymbol] = useState(true);
  const [footprint, setFootprint] = useState(true);
  const [modelEnabled, setModelEnabled] = useState(true);
  const [modelType, setModelType] = useState("STEP");
  const [modelBase, setModelBase] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);
  const [resultZip, setResultZip] = useState<{ blob: Blob; name: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [activeTab, setActiveTab] = useState<"convert" | "history">("convert");
  const logEndRef = useRef<HTMLDivElement>(null);

  const toggleLang = () => {
    const next: Lang = lang === "en" ? "ja" : "en";
    setLang(next);
    localStorage.setItem("jlc2kicad_lang", next);
  };

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const addPart = (raw: string) => {
    const tokens = raw.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    setParts((prev) => {
      const set = new Set(prev);
      tokens.forEach((t) => set.add(t));
      return [...set];
    });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      if (inputVal.trim()) {
        addPart(inputVal);
        setInputVal("");
      }
    } else if (e.key === "Backspace" && !inputVal && parts.length > 0) {
      setParts((prev) => prev.slice(0, -1));
    }
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text.includes(",") || text.includes("\n") || text.includes(" ")) {
      e.preventDefault();
      addPart(text);
      setInputVal("");
    }
  };

  const removePart = (p: string) => setParts((prev) => prev.filter((x) => x !== p));

  const handleConvert = async () => {
    if (parts.length === 0) { alert(t.noPartsError); return; }
    if (!symbol && !footprint) { alert(t.noOutputError); return; }

    setConverting(true);
    setLogs([]);
    setResultZip(null);

    const models = modelEnabled ? modelType : "";

    try {
      const result = await convertComponents({
        partNumbers: parts,
        symbol,
        footprint,
        models,
        modelBaseVariable: modelBase,
        onLog: addLog,
      });

      if (result.files.length > 0) {
        const zipBlob = await result.zip.generateAsync({ type: "blob" });
        const zipName = parts.length === 1
          ? `${parts[0]}.zip`
          : `${parts.slice(0, 3).join("_")}.zip`;

        setResultZip({ blob: zipBlob, name: zipName });

        // Save to history
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          const entry: HistoryEntry = {
            id: Date.now().toString(),
            partNumbers: [...parts],
            timestamp: Date.now(),
            fileCount: result.files.length,
            zipBlob: base64,
            zipName,
          };
          const newHistory = [...history, entry];
          setHistory(newHistory);
          saveHistory(newHistory);
        };
        reader.readAsDataURL(zipBlob);
      }
    } catch (e) {
      addLog(`ERROR: ${e}`);
    } finally {
      setConverting(false);
    }
  };

  const downloadZip = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reDownload = (entry: HistoryEntry) => {
    const binary = atob(entry.zipBlob);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/zip" });
    downloadZip(blob, entry.zipName);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const EXAMPLES = ["C1337258", "C24112", "C14663"];

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⚙</span>
            <span className="logo-text">
              <span className="logo-jlc">JLC</span>
              <span className="logo-2">2</span>
              <span className="logo-kicad">KiCad</span>
            </span>
          </div>
          <nav className="nav">
            <button
              className={`nav-btn ${activeTab === "convert" ? "active" : ""}`}
              onClick={() => setActiveTab("convert")}
            >
              ⚡ {lang === "en" ? "Convert" : "変換"}
            </button>
            <button
              className={`nav-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              🕐 {t.history}
            </button>
          </nav>
          <button className="lang-btn" onClick={toggleLang}>{t.langToggle}</button>
        </div>
      </header>

      <main className="main">
        {activeTab === "convert" ? (
          <div className="convert-layout">
            {/* Left panel */}
            <div className="left-panel">
              {/* Hero */}
              <div className="hero">
                <div className="hero-badge">JLCPCB → KICAD</div>
                <h1 className="hero-title">
                  <span className="hero-accent">{lang === "en" ? "Convert" : "変換"}</span>{" "}
                  {lang === "en" ? "component libraries" : "コンポーネントライブラリ"}
                </h1>
                <p className="hero-sub">{t.subtitle}</p>
              </div>

              {/* Part numbers input */}
              <div className="card">
                <div className="card-title">
                  <span className="card-icon">🔌</span> {t.partNumbers}
                </div>
                <div className="tag-input-wrap">
                  {parts.map((p) => (
                    <span key={p} className="tag">
                      {p}
                      <button className="tag-remove" onClick={() => removePart(p)}>×</button>
                    </span>
                  ))}
                  <input
                    className="tag-input"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onPaste={handleInputPaste}
                    onBlur={() => { if (inputVal.trim()) { addPart(inputVal); setInputVal(""); } }}
                    placeholder={parts.length === 0 ? t.partPlaceholder : ""}
                    disabled={converting}
                  />
                </div>
                <div className="hint">
                  {t.partHint}
                </div>
                <div className="examples">
                  <span className="examples-label">{t.examples}</span>
                  {EXAMPLES.map((ex) => (
                    <button key={ex} className="example-btn" onClick={() => addPart(ex)} disabled={converting}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output options */}
              <div className="card">
                <div className="card-title">
                  <span className="card-icon">⚙</span> {t.outputOptions}
                </div>
                <div className="options">
                  <label className="option-row">
                    <span>{t.symbol}</span>
                    <input type="checkbox" checked={symbol} onChange={(e) => setSymbol(e.target.checked)} disabled={converting} />
                  </label>
                  <label className="option-row">
                    <span>{t.footprint}</span>
                    <input type="checkbox" checked={footprint} onChange={(e) => setFootprint(e.target.checked)} disabled={converting} />
                  </label>
                  <label className="option-row">
                    <span>{t.model3d}</span>
                    <input type="checkbox" checked={modelEnabled} onChange={(e) => setModelEnabled(e.target.checked)} disabled={converting} />
                  </label>
                  {modelEnabled && (
                    <>
                      <div className="option-row sub">
                        <span>{t.modelType}</span>
                        <select
                          value={modelType}
                          onChange={(e) => setModelType(e.target.value)}
                          disabled={converting}
                          className="select"
                        >
                          <option value="STEP">STEP</option>
                          <option value="WRL">WRL</option>
                          <option value="STEP,WRL">STEP + WRL</option>
                        </select>
                      </div>
                      <div className="option-col sub">
                        <span>{t.modelBase}</span>
                        <input
                          type="text"
                          className="text-input"
                          value={modelBase}
                          onChange={(e) => setModelBase(e.target.value)}
                          placeholder={t.modelBasePlaceholder}
                          disabled={converting}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Convert button */}
              <button
                className={`convert-btn ${converting ? "loading" : ""}`}
                onClick={handleConvert}
                disabled={converting || parts.length === 0}
              >
                {converting ? (
                  <><span className="spinner" /> {t.converting}</>
                ) : (
                  <><span>⚡</span> {t.convert}</>
                )}
              </button>

              {/* Download button */}
              {resultZip && (
                <button
                  className="download-btn"
                  onClick={() => downloadZip(resultZip.blob, resultZip.name)}
                >
                  ⬇ {t.download} ({resultZip.name})
                </button>
              )}

              {/* Proxy note */}
              <div className="proxy-note">{t.proxyNote}</div>
            </div>

            {/* Right panel - Log */}
            <div className="right-panel">
              <div className="log-card">
                <div className="log-header">
                  <span className="dot red" />
                  <span className="dot green" />
                  <span className="log-title">conversion.log</span>
                </div>
                <div className="log-body">
                  {logs.length === 0 ? (
                    <div className="log-empty">
                      <span className="log-empty-icon">📦</span>
                      <span>{t.logEmpty}</span>
                    </div>
                  ) : (
                    logs.map((line, i) => (
                      <div key={i} className={`log-line ${getLogClass(line)}`}>{line}</div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* History tab */
          <div className="history-panel">
            <div className="history-header">
              <h2>{t.history}</h2>
              {history.length > 0 && (
                <button className="clear-btn" onClick={clearHistory}>{t.clearHistory}</button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="history-empty">{t.historyEmpty}</div>
            ) : (
              <div className="history-list">
                {[...history].reverse().map((entry) => (
                  <div key={entry.id} className="history-item">
                    <div className="history-parts">
                      {entry.partNumbers.map((p) => (
                        <span key={p} className="tag small">{p}</span>
                      ))}
                    </div>
                    <div className="history-meta">
                      <span>{new Date(entry.timestamp).toLocaleString(lang === "ja" ? "ja-JP" : "en-US")}</span>
                      <span>{entry.fileCount} files</span>
                    </div>
                    <button className="redownload-btn" onClick={() => reDownload(entry)}>
                      ⬇ {t.reDownload}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <span>{t.footerNote}</span>
        <span className="footer-links">
          <a href="https://github.com/tomorrow56/JLC2KiCad_lib" target="_blank" rel="noopener noreferrer">
            {t.sourceCode}
          </a>
          {" · "}
          <a href="https://jlc2kicad-webui.manus.space" target="_blank" rel="noopener noreferrer">
            {t.manusVersion}
          </a>
        </span>
      </footer>
    </div>
  );
}

function getLogClass(line: string): string {
  if (line.includes("ERROR")) return "error";
  if (line.includes("WARNING")) return "warn";
  if (line.includes("✅") || line.includes("Done")) return "success";
  if (line.includes("🚀")) return "info";
  return "";
}
