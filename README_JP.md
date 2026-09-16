# JLC2KiCadLib

<p style="text-align: center;">

[![PyPI version](https://badge.fury.io/py/JLC2KiCadLib.svg)](https://badge.fury.io/py/JLC2KiCadLib)
![Python versions](https://img.shields.io/pypi/pyversions/JLC2KiCadLib.svg)
[![Downloads](https://pepy.tech/badge/jlc2kicadlib)](https://pepy.tech/project/jlc2kicadlib)
[![Code style: ruff](https://img.shields.io/badge/Linter-Ruff-D7FF64?style=flat-square&logo=ruff)](https://github.com/astral-sh/ruff)
[![Code style: ruff](https://img.shields.io/badge/Formatter-Ruff-D7FF64?style=flat-square&logo=ruff)](https://github.com/astral-sh/ruff)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</p>

JLC2KiCadLib は、JLCPCB / EasyEDA の部品ライブラリから KiCad 用のライブラリ（シンボル、フットプリント、3D モデル）を生成する Python スクリプトです。
Python 3.8 以上が必要です。

このリポジトリには、ライブラリ本体に加えて、以下の Web UI も含まれています。

- `webui-pages/` — GitHub Pages 公開用のブラウザ完結版
- `webui/` — Node.js + Express + tRPC によるフルスタック版

## 例

easyEDA オリジナル | KiCad 出力
---- | ----
![JLCSymbol](https://raw.githubusercontent.com/TousstNicolas/JLC2KiCad_lib/master/images/JLC_Symbol_1.png) | ![KiCadSymbol](https://raw.githubusercontent.com/TousstNicolas/JLC2KiCad_lib/master/images/KiCad_Symbol_1.png)
![JLCFootprint](https://raw.githubusercontent.com/TousstNicolas/JLC2KiCad_lib/master/images/JLC_Footprint_1.png) | ![KiCadFootprint](https://raw.githubusercontent.com/TousstNicolas/JLC2KiCad_lib/master/images/KiCad_Footprint_1.png)
![JLC3Dmodel](https://raw.githubusercontent.com/TousstNicolas/JLC2KiCad_lib/master/images/JLC_3Dmodel.png) | ![KiCad3Dmodel](https://raw.githubusercontent.com/TousstNicolas/JLC2KiCad_lib/master/images/KiCad_3Dmodel.png)

## インストール

### Python ライブラリ

pip 経由:

```bash
pip install JLC2KiCadLib
```

ソースからインストール:

```bash
git clone https://github.com/TousstNicolas/JLC2KiCad_lib.git
cd JLC2KiCad_lib
pip install .
```

### Web UI

#### GitHub Pages 版 (`webui-pages/`)

ローカルで開発する場合:

```bash
cd webui-pages
pnpm install
pnpm dev      # http://localhost:5173/JLC2KiCad_lib/
pnpm build    # dist/ へ本番ビルド
```

公開サイト: https://tomorrow56.github.io/JLC2KiCad_lib/

#### フルスタック版 (`webui/`)

Node.js サーバーとして実行します。

```bash
cd webui
pnpm install
pnpm dev      # 開発サーバ起動
pnpm build    # ビルド
pnpm start    # 本番サーバ起動
```

## 使い方

```bash
usage: JLC2KiCadLib [-h] [-dir OUTPUT_DIR] [--no_footprint] [--no_symbol] [-symbol_lib SYMBOL_LIB] [-footprint_lib FOOTPRINT_LIB]
                    [-models [{STEP,WRL} ...]] [--skip_existing] [-model_base_variable MODEL_BASE_VARIABLE]
                    [-logging_level {DEBUG,INFO,WARNING,ERROR,CRITICAL}] [--log_file] [--version]
                    JLCPCB_part_# [JLCPCB_part_# ...]

JLCPCB 部品番号から対応する KiCad ライブラリを作成します

positional arguments:
  JLCPCB_part_#         作成したい JLCPCB 部品番号のリスト (例: Cxxxxx)

options:
  -h, --help            ヘルプを表示して終了
  -dir OUTPUT_DIR       出力ライブラリファイルの基準ディレクトリ
  --no_footprint        フットプリントを作成しない場合に指定
  --no_symbol           シンボルを作成しない場合に指定
  -symbol_lib SYMBOL_LIB
                        シンボルライブラリ名を設定。デフォルトは "default_lib"
  -symbol_lib_dir SYMBOL_LIB_DIR
                        シンボルライブラリのパスを設定。デフォルトは "symbol"（OUTPUT_DIR 相対）
  -footprint_lib FOOTPRINT_LIB
                        フットプリントライブラリ名を設定。デフォルトは "footprint"
  -models [{STEP,WRL} ...]
                        使用する 3D モデルを選択。デフォルトは STEP。
                        両方選択した場合、フットプリントには STEP のみ追加されます（WRL は STEP と一緒に生成されます）。
                        3D モデルを一切生成したくない場合は、--models のみ指定してください
  -model_dir MODEL_DIR  3D モデルの保存ディレクトリを設定。デフォルトは "packages3d"（FOOTPRINT_LIB 相対）
  --skip_existing       既存のフットプリントやシンボルを上書きしたくない場合に指定
  -model_base_variable MODEL_BASE_VARIABLE
                        3D モデルのベースパスをパス変数で指定したい場合に指定
  -logging_level {DEBUG,INFO,WARNING,ERROR,CRITICAL}
                        ログレベルを設定。DEBUG を使う場合、--log_file を指定しないとデバッグログはファイルにのみ書き込まれます
  --log_file            ログをファイルに書き込みたい場合に指定
  --version             バージョン番号を表示して終了

使用例:
        JLC2KiCadLib C1337258 C24112 -dir My_lib -symbol_lib My_Symbol_lib --no_footprint
```

唯一の必須引数は JLCPCB 部品番号です。

例:

```bash
JLC2KiCadLib C1337258 C24112 -dir My_lib                       \
                             -model_dir My_model_dir           \
                             -footprint_lib My_footprint_lib   \
                             -symbol_lib_dir My_symbol_lib_dir \
                             -symbol_lib My_symbol_lib
```

この例では、指定した 2 つの部品のシンボル、フットプリント、3D モデルを作成し、シンボルを `./My_lib/symbol/My_symbol_lib.kicad_sym` に、フットプリントと 3D モデルを `./My_lib/Footprint` に出力します。

## 依存関係

JLC2KiCadLib は、フットプリント生成に [KicadModTree](https://gitlab.com/kicad/libraries/kicad-footprint-generator) フレームワークを使用しています。

## テスト

`test/` ディレクトリに pytest ベースのテストスイートがあります。

- ユニットテスト（例: `test/test_courtyard.py`）はオフラインで動作し、合成データを使って個別のハンドラやヘルパーをテストします。
- 統合テスト（`test/test_components.py`）は、JLCPCB 部品番号（`test/component_cases.py` で定義）から実際に部品を生成し、KiCad の [KLC](https://klc.kicad.org/) ルールに対して `kicad-library-utils` サブモジュールを使って検証します。

テスト実行:

```bash
git submodule update --init
uv sync --group test
uv run pytest                       # ユニットテストのみ
uv run pytest -m integration        # 統合テスト（ネットワークアクセスが必要）
```

## Web UI に関する注意

- `webui-pages/` はブラウザ内で完結するため、EasyEDA API へのアクセスにパブリック CORS プロキシを使用します。プロキシが一時的に利用できない場合、変換に失敗することがあります。詳細は `webui-pages/README_JP.md` を参照してください。
- `webui/` は Node.js サーバーとして実行し、CORS プロキシを必要とせず直接 EasyEDA API にアクセスできます。

## 注意

- 多くの部品でテストしていますが、出力されたフットプリントとシンボルは必ず確認してください。
- EasyEDA は courtyard データを提供していないため、フットプリントには銅箔 / Fab / Paste / Mask / Edge.Cuts の外形を 0.25mm クリアランスで膨らませた近似 courtyard（`F.CrtYd`）が自動生成されます。これは KiCad 独自の EasyEDA インポータと同様のアプローチです。

## ライセンス

Copyright © 2021 TousstNicolas

The code is released under the MIT license.
