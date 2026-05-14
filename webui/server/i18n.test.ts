import { describe, it, expect } from "vitest";
import { translations } from "../client/src/contexts/I18nContext";

describe("i18n translations", () => {
  it("should have the same keys in both en and ja", () => {
    const enKeys = Object.keys(translations.en).sort();
    const jaKeys = Object.keys(translations.ja).sort();
    expect(enKeys).toEqual(jaKeys);
  });

  it("should have non-empty values for all en keys", () => {
    for (const [key, value] of Object.entries(translations.en)) {
      expect(value, `en.${key} should not be empty`).toBeTruthy();
    }
  });

  it("should have non-empty values for all ja keys", () => {
    for (const [key, value] of Object.entries(translations.ja)) {
      expect(value, `ja.${key} should not be empty`).toBeTruthy();
    }
  });

  it("should have correct key translations for critical UI elements", () => {
    expect(translations.en.nav_convert).toBe("Convert");
    expect(translations.ja.nav_convert).toBe("変換");
    expect(translations.en.btn_download).toBe("Download KiCad Library (.zip)");
    expect(translations.ja.btn_download).toBe("KiCadライブラリをダウンロード (.zip)");
    expect(translations.en.history_title).toBe("Conversion History");
    expect(translations.ja.history_title).toBe("変換履歴");
  });
});
