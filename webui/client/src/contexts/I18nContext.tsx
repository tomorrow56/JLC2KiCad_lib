import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Language = "en" | "ja";

export const translations = {
  en: {
    // Layout
    nav_convert: "Convert",
    nav_history: "History",
    nav_signin: "Sign in",
    nav_signout: "Sign out",
    footer_powered: "Powered by JLC2KiCadLib",

    // Home page
    home_breadcrumb: "JLCPCB → KICAD",
    home_title_convert: "Convert",
    home_title_rest: "component libraries",
    home_subtitle: "Generate KiCad symbols, footprints, and 3D models from JLCPCB part numbers.",
    home_subtitle2: "Enter one or more part numbers below to get started.",

    // Part numbers section
    section_part_numbers: "Part Numbers",
    input_placeholder: "C1337258, C24112...",
    input_hint: "Press Enter or Space to add. Paste multiple at once.",
    examples_label: "Examples:",

    // Output options
    section_output_options: "Output Options",
    opt_symbol: "Symbol (.kicad_sym)",
    opt_footprint: "Footprint (.kicad_mod)",
    opt_3d_model: "3D Model",
    opt_3d_format: "Format",
    opt_3d_none: "None",

    // Advanced options
    section_advanced: "Advanced Options",
    opt_symbol_lib: "Symbol Library Name",
    opt_footprint_lib: "Footprint Library Name",
    opt_skip_existing: "Skip existing files",

    // Convert button
    btn_convert: "Convert",
    btn_converting: "Converting...",
    btn_download: "Download KiCad Library (.zip)",

    // Progress steps
    step_fetching: "Fetching",
    step_packaging: "Packaging",
    step_done: "Done",

    // Log panel
    log_title: "conversion.log",
    log_lines: "lines",
    log_empty: "Conversion logs will appear here",

    // Part status
    part_status_pending: "pending",
    part_status_running: "running",
    part_status_done: "done",
    part_status_error: "error",

    // Model options
    model_step_only: "STEP only",
    model_wrl_only: "WRL only",
    model_both: "STEP + WRL",
    model_none: "No 3D model",
    // Advanced: 3D model base variable
    opt_model_base_var: "3D model base variable",
    // Info cards
    info_symbol_title: "Symbol",
    info_symbol_desc: ".kicad_sym schematic symbol",
    info_footprint_title: "Footprint",
    info_footprint_desc: ".kicad_mod PCB footprint",
    info_3d_title: "3D Model",
    info_3d_desc: ".step / .wrl 3D model",
    // History loading
    history_loading: "Loading history...",
    history_rerun: "Re-run",
    // Errors / toasts
    err_no_parts: "Please add at least one part number",
    err_start_failed: "Failed to start conversion",

    // History page
    history_title: "Conversion History",
    history_subtitle: "Your past conversions are listed below.",
    history_empty_title: "No conversions yet",
    history_empty_desc: "Your conversion history will appear here.",
    history_login_title: "Sign in to view history",
    history_login_desc: "Your conversion history is saved when you are signed in.",
    history_btn_signin: "Sign in to view history",
    history_btn_refresh: "Refresh",
    history_btn_convert: "Start Converting",
    history_col_parts: "Part Numbers",
    history_col_options: "Options",
    history_col_status: "Status",
    history_col_date: "Date",
    history_col_actions: "Actions",
    history_btn_download: "Download",
    history_btn_delete: "Delete",
    history_delete_confirm: "Are you sure you want to delete this conversion?",
    history_deleted: "Conversion deleted",
    history_delete_failed: "Failed to delete conversion",
    history_opt_symbol: "Symbol",
    history_opt_footprint: "Footprint",
    history_opt_3d: "3D",
    history_status_pending: "Pending",
    history_status_running: "Running",
    history_status_done: "Done",
    history_status_error: "Error",
  },
  ja: {
    // Layout
    nav_convert: "変換",
    nav_history: "履歴",
    nav_signin: "サインイン",
    nav_signout: "サインアウト",
    footer_powered: "JLC2KiCadLib を使用",

    // Home page
    home_breadcrumb: "JLCPCB → KICAD",
    home_title_convert: "変換",
    home_title_rest: "コンポーネントライブラリ",
    home_subtitle: "JLCPCBの部品番号からKiCadのシンボル、フットプリント、3Dモデルを生成します。",
    home_subtitle2: "以下に部品番号を1つ以上入力してください。",

    // Part numbers section
    section_part_numbers: "部品番号",
    input_placeholder: "C1337258, C24112...",
    input_hint: "EnterまたはSpaceで追加。複数を一度に貼り付け可能。",
    examples_label: "例：",

    // Output options
    section_output_options: "出力オプション",
    opt_symbol: "シンボル (.kicad_sym)",
    opt_footprint: "フットプリント (.kicad_mod)",
    opt_3d_model: "3Dモデル",
    opt_3d_format: "フォーマット",
    opt_3d_none: "なし",

    // Advanced options
    section_advanced: "詳細オプション",
    opt_symbol_lib: "シンボルライブラリ名",
    opt_footprint_lib: "フットプリントライブラリ名",
    opt_skip_existing: "既存ファイルをスキップ",

    // Convert button
    btn_convert: "変換",
    btn_converting: "変換中...",
    btn_download: "KiCadライブラリをダウンロード (.zip)",

    // Progress steps
    step_fetching: "取得中",
    step_packaging: "パッケージ化",
    step_done: "完了",

    // Log panel
    log_title: "変換ログ",
    log_lines: "行",
    log_empty: "変換ログがここに表示されます",

    // Part status
    part_status_pending: "待機中",
    part_status_running: "処理中",
    part_status_done: "完了",
    part_status_error: "エラー",

    // Model options
    model_step_only: "STEPのみ",
    model_wrl_only: "WRLのみ",
    model_both: "STEP + WRL",
    model_none: "3Dモデルなし",
    // Advanced: 3D model base variable
    opt_model_base_var: "3Dモデルベース変数",
    // Info cards
    info_symbol_title: "シンボル",
    info_symbol_desc: ".kicad_sym 回路図シンボル",
    info_footprint_title: "フットプリント",
    info_footprint_desc: ".kicad_mod PCBフットプリント",
    info_3d_title: "3Dモデル",
    info_3d_desc: ".step / .wrl 3Dモデル",
    // History loading
    history_loading: "履歴を読み込み中...",
    history_rerun: "再実行",
    // Errors / toasts
    err_no_parts: "部品番号を1つ以上追加してください",
    err_start_failed: "変換の開始に失敗しました",

    // History page
    history_title: "変換履歴",
    history_subtitle: "過去の変換履歴が表示されます。",
    history_empty_title: "変換履歴がありません",
    history_empty_desc: "変換を実行すると履歴がここに表示されます。",
    history_login_title: "履歴を表示するにはサインインしてください",
    history_login_desc: "サインインすると変換履歴が保存されます。",
    history_btn_signin: "サインインして履歴を表示",
    history_btn_refresh: "更新",
    history_btn_convert: "変換を開始",
    history_col_parts: "部品番号",
    history_col_options: "オプション",
    history_col_status: "ステータス",
    history_col_date: "日時",
    history_col_actions: "操作",
    history_btn_download: "ダウンロード",
    history_btn_delete: "削除",
    history_delete_confirm: "この変換履歴を削除しますか？",
    history_deleted: "変換履歴を削除しました",
    history_delete_failed: "削除に失敗しました",
    history_opt_symbol: "シンボル",
    history_opt_footprint: "フットプリント",
    history_opt_3d: "3D",
    history_status_pending: "待機中",
    history_status_running: "処理中",
    history_status_done: "完了",
    history_status_error: "エラー",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem("jlc2kicad_lang") as Language | null;
      if (stored === "en" || stored === "ja") return stored;
      // Auto-detect from browser language
      if (navigator.language.startsWith("ja")) return "ja";
    } catch {}
    return "en";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try { localStorage.setItem("jlc2kicad_lang", newLang); } catch {}
  };

  const t = (key: TranslationKey): string => {
    return (translations[lang] as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
