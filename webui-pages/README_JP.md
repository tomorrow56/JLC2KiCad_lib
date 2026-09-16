# JLC2KiCad Web UI — GitHub Pages 版

JLCPCB / EasyEDA の部品ライブラリを KiCad 形式に変換する、ブラウザだけで動作する Web UI です。

**ライブデモ:** https://tomorrow56.github.io/JLC2KiCad_lib/

## 機能

- ログイン不要、ブラウザ内で完結
- JLCPCB 部品番号から以下を一括生成:
  - シンボル (`.kicad_sym`)
  - フットプリント (`.kicad_mod`)
  - 3D モデル (`.step` / `.wrl`)
- 変換結果を部品番号名の ZIP ファイルでダウンロード
- 変換履歴をブラウザの localStorage に保存
- 英語 / 日本語 UI

## 技術的な注意点

この GitHub Pages 版は、ブラウザから EasyEDA API にアクセスするために **パブリック CORS プロキシ** を使用しています。CORS プロキシは無料で不安定なことが多いため、変換に失敗する場合は別のプロキシにフォールバックするよう順次試行します。

現在のプロキシ一覧は `webui-pages/src/lib/easyedaApi.ts` の `CORS_PROXIES` を参照してください。

より安定した変換環境（プロキシ不要、変換履歴あり）を利用する場合は、フルサーバー版の [JLC2KiCad Web UI](https://jlc2kicad-webui.manus.space) をご利用ください。

## 開発

```bash
cd webui-pages
pnpm install
pnpm dev      # http://localhost:5173/JLC2KiCad_lib/ で開発サーバ起動
pnpm build    # dist/ へ本番ビルド
```

## デプロイ

`master` ブランチへの push をトリガーに、GitHub Actions によって GitHub Pages へ自動デプロイされます。

GitHub Pages を有効にする手順:
1. リポジトリの **Settings → Pages** を開く
2. **Source** を **GitHub Actions** に設定
3. `master` ブランチへ push してデプロイを実行
