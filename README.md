# Math PDF Generator
upLaTeXを使用して、高校数学の演習プリント（問題編・解答編）を自動生成する Next.js アプリケーションです。

## スクリーンショット

<img width="1920" height="2242" alt="image" src="https://github.com/user-attachments/assets/e1ab8ea8-7130-4d09-981e-6025d39776c0" />

<div style="display: flex; gap: 10px;">
  <img width="48%" alt="スクリーンショット" src="https://github.com/user-attachments/assets/fe6bcfa4-4516-4757-af39-043d3c43dce1" />
  <img width="48%" alt="スクリーンショット" src="https://github.com/user-attachments/assets/c8c90b90-ad6b-4681-ac19-82880493267f" />
</div>

[出力サンプル: 指数・対数関数.pdf](https://github.com/user-attachments/files/24463655/_2025-12-28.pdf)

## 主な機能

### 1. AIによる問題生成 (`/ai-creation`)
- **OpenAI API (GPT-5.2 / GPT-5 mini)**: 選択した単元、難易度、トピックに基づいて、高品質な数学問題を生成します。
- **画像添付機能**: 教科書や問題集の写真をアップロードし、その内容に沿った類似問題を作成できます。
- **インタラクティブな編集**: 生成された問題を個別に確認・修正・再生成が可能。
- **自動検証**: 生成されたLaTeXコードの構文チェックと、簡易的な数式チェックを自動実行します。

### 2. PDF生成
- **ハイブリッドエンジン**: 本番環境向けに高速・省メモリな `upLaTeX + dvipdfmx`、開発用の `LuaLaTeX` の両方に対応。
- **Concept Point Review**: 解答編の末尾に、出題単元の重要公式や定理をまとめた「復習ポイント」セクションを自動生成します。
- **標準LaTeXレイアウト**: 安定性を重視し、TikZなどの重量級パッケージへの依存を排除。標準的なボックスレイアウトで高速かつ確実にPDFを出力します。

## UI/UX の特徴

- **リアルタイム進捗表示**: Server-Sent Events (SSE) を利用し、AIが問題を生成・検証している様子をリアルタイムで可視化。
- **直感的な単元選択**:
  - 数I/A, II/B, III/C のタブ切り替え。
  - フローティングパネルによる選択中の単元・トピックの管理（チップUI）。
- **デスクトップ通知**: 生成完了時にブラウザ通知でお知らせ。待ち時間に他の作業をしていても安心です。
- **完了演出**: 生成成功時に紙吹雪 (Confetti) で祝福。

## 技術スタックと工夫

- **Frontend**: Next.js 16 (Pages Router), React 19, TailwindCSS
- **Backend**: Node.js (API Routes)
- **PDF Engine**:
  - **upLaTeX**: 日本語処理に特化し、高速かつメモリ効率が良い。Docker等のメモリ制限がある環境に最適。
  - **LuaLaTeX**: ローカル開発時のデフォルト。フォント管理が容易。
- **Streaming API**: 生成プロセスが長時間に及ぶため、HTTP接続を切断せずに進捗をストリーミング送信するアーキテクチャを採用。
- **メモリ管理**: PDF生成プロセス (`spawn`) のメモリ使用量を監視。

## 必要条件 (Prerequisites)

### 1. Node.js
Node.js (v18以降) が必要です。

### 2. LaTeX環境 (必須)
ローカルでPDFをビルドするには、LaTeX環境 (`TeX Live 2023` 以降推奨) が必要です。

**macOS (BasicTeXを使用する場合):**
```bash
brew install --cask basictex

# パッケージマネージャーの更新
sudo tlmgr update --self

# 必須パッケージのインストール
# haranoaji: 日本語フォント
# needspace, geometry, multicol: レイアウト調整用
sudo tlmgr install luatexja needspace geometry multicol haranoaji
```

## セットアップと実行

1. 依存関係のインストール:
   ```bash
   npm install
   ```

2. 開発サーバーの起動:
   ```bash
   npm run dev
   ```
   
   **upLaTeXを使用する場合 (推奨/高速):**
   ```bash
   PDF_ENGINE=uplatex npm run dev
   ```

3. ブラウザでアクセス: [http://localhost:3000](http://localhost:3000)

## 既知の問題点

- **大規模な生成時のタイムアウト**: サーバーレス環境（Vercel等）では、タイムアウト制限により生成が中断される場合があります。ローカル環境または長時間実行可能なコンテナ環境（Render, Railway等）での実行を推奨します。
- **LaTeX環境依存**: 実行環境に TeX Live がインストールされていない場合、PDF生成は失敗します。Docker環境では日本語対応のTeXイメージを使用してください。
