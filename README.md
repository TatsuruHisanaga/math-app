# Math PDF Generator MVP

A Next.js application to generate Math Exercise PDFs using LuaLaTeX.

## Prerequisites

### 1. Node.js
Ensure Node.js (v18+) is installed.

### 2. LaTeX Environment (Crucial)
This app requires a local LaTeX installation with LuaLaTeX and Japanese support.

**macOS (using BasicTeX):**
```bash
brew install --cask basictex

# Update package manager
sudo tlmgr update --self

# Install required packages
# haranoaji is REQUIRED for Japanese fonts
sudo tlmgr install luatexja needspace geometry multicol haranoaji
```

## Setup & Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## System Details

- **PDF Generation**: Occurs locally using `spawn` to call `lualatex`.
- **First Run**: The first time you generate a PDF, it may take **several minutes** to build the LuaTeX font cache. Please be patient.
- **Templates**: Located in `data/templates.json`.
- **Layout**: Defined in `src/lib/latex.ts`.

## Troubleshooting

- **"Generation Failed"**: Check the error log in the UI modal.
- **"Font not found"**: Ensure `sudo tlmgr install haranoaji` was run.
- **"lualatex not found"**: The app looks for lualatex at `/Library/TeX/texbin/lualatex`. If your path is different, update `src/lib/latex.ts`.

---

# 仕様書 (Specifications)

## 1. システム概要
本システムは、日本の高校数学（数I・数A・数II・数B・数C・数III）を対象とした演習プリント自動生成アプリケーションです。

### 主要機能
1.  **AI問題生成機能 (`/ai-creation`)**:
    - OpenAI API (GPT-4o) を利用し、単元・難易度・重点トピックを指定して問題を生成。
    - 生成された問題は自動的にLaTeX構文チェックと数式チェックが行われます。
2.  **テンプレート問題生成機能 (`/`)**:
    - 予め用意されたテンプレートに変数を埋め込んで問題を生成（※現在、`unit_map.json` と `templates.json` のID不整合により機能制限あり）。
3.  **PDF出力機能**:
    - LuaLaTeX を使用し、問題編・解答編・講師用ガイドを含むPDFを生成。

## 2. 機能仕様詳細

### 2.1 AI問題作成
- **入力**: 単元、重点トピック、難易度 (L1-L3)、問題数、AIモデル、追加指示。
- **検証プロセス**:
    - 生成後、LaTeXコンパイルチェックと簡易的な数式チェックを実施。
    - エラー時は最大4回まで再試行。
- **出力**: リアルタイムストリーミングによる進捗表示と、完了後のPDFダウンロード。

### 2.2 PDFレイアウト
- **用紙**: A4 縦置き (2段組み対応)
- **構成**:
    - **問題編**: ヘッダー（単元・日付・氏名）、問題ボックス（問題文＋解答欄）
    - **解答編**: 赤字の解答と解説
    - **講師用ガイド**: ヒントと指導案（オプション）

## 3. データ構造

- **Unit Definisions (`data/unit_map.json`)**: 単元ID、タイトル、前提単元を定義。
- **Templates (`data/templates.json`)**: 変数埋め込み可能なLaTeXテンプレート。

## 4. 技術スタック
- **Frontend**: Next.js (Pages Router), React 19, TailwindCSS
- **Backend/PDF**: LuaLaTeX (via `child_process`), KaTeX
- **AI**: OpenAI API (Structured Outputs)
- **Infrastructure**: Docker (Production), Local managed LaTeX (Development)

## 5. 既知の問題点
- **テンプレートID不整合**: `unit_map.json` と `templates.json` の間でIDが一致していないため、テンプレート生成が正しく動作しない場合があります。
- **LaTeX環境依存**: ローカル開発には `luatexja` 等を含むTeX環境の構築が必要です。
