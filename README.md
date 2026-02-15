# 数学プリントGenerator
https://math-app-yb07.onrender.com/

生成AIと組版の技術で高校数学の演習プリントPDF（問題編・解答編）を自動生成する Next.js アプリケーションです。

---
概要： 
離島の公営塾でのインターン中に開発した、生成AI活用型の学習支援ツール。指導スタッフの要望や生徒の習熟度に応じて、詳細な解説付きの演習プリントを即座に生成できる。教科書や問題集では不足しがちな類題演習や、ランダム出題によるテスト作成に最適。


[出力サンプル: 2次関数_2026-02-16_0346.pdf](https://github.com/user-attachments/files/25328151/2._2026-02-16_0346.pdf)

[出力サンプル: 微分法・積分法_2026-02-15.pdf](https://github.com/user-attachments/files/25328146/_2026-02-15.2.pdf)

## スクリーンショット
<img width="645" height="980" alt="スクリーンショット 2026-02-16 4 54 12" src="https://github.com/user-attachments/assets/e97cccfb-864a-4151-9a59-a50a217b5662" />
<img width="645" height="515" alt="スクリーンショット 2026-02-16 4 54 56" src="https://github.com/user-attachments/assets/08276855-18c5-4bf9-8fdf-54369eedd3c4" />
<img width="645" height="515" alt="スクリーンショット 2026-02-16 4 55 00" src="https://github.com/user-attachments/assets/943eaeb7-f3b1-4b49-9b16-716dbc1e190f" />
<img width="813" height="978" alt="スクリーンショット 2026-02-16 4 58 59" src="https://github.com/user-attachments/assets/9f91c456-9993-4609-b9d3-85c79610b04b" />
<img width="813" height="585" alt="スクリーンショット 2026-02-16 4 59 34" src="https://github.com/user-attachments/assets/ea65aeb3-9a6b-467f-8a62-bfdf2f43c3bd" />
<img width="813" height="823" alt="スクリーンショット 2026-02-16 5 00 08" src="https://github.com/user-attachments/assets/e0279816-833e-4bdf-a285-e0892e562fda" />

## 主な機能

### 1. AIによる問題生成
- **OpenAI API (GPT-5.2 / GPT-5 mini)**: 選択した単元、難易度、トピックに基づいて、高品質な数学問題を生成します。
- **テキスト入力機能**: テキストを入力して、その内容に沿った問題を作成できます。
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

## 4. 技術的なこだわり (Technical Innovations)

本アプリケーションは、単なるAI APIのラッパーではなく、実用的な数学プリント生成ツールとして機能するために、多くの技術的課題を解決しています。

### 堅牢なプロンプトエンジニアリング
- **厳格なスキーマ制御**: OpenAIの `response_format: { type: "json_object" }` と独自の検証ロジックを組み合わせ、AIが生成する不安定なフォーマットを正規化し、常に有効なJSON構造を保証しています。
- **LaTeX特化のチューニング**: バックスラッシュのエスケープ漏れや数式デリミタ（`$`）の欠落を防ぐため、システムプロンプトレベルでLaTeX構文に最適化された厳密な指示を実装しています。

### 自己修復パイプライン
- AIが生成した問題に不備（LaTeX構文エラーや不適切な数式）があった場合、システムが自動的にエラーを検知。
- **自動リトライ**: エラー内容をAIにフィードバックし、ユーザーが気づかない裏側で修正・再生成を行います。これにより、生成失敗率を大幅に低減させています。

### ハイブリッド・レンダリング
- **Webプレビュー (KaTeX)**: フロントエンドでは `KaTeX` を採用し、MathJaxよりも高速に数式をレンダリング。編集時の高いレスポンス性を確保しています。
- **印刷用PDF (upLaTeX)**: 最終出力には、日本語組版の美しさと信頼性に優れた `upLaTeX` を使用。Webの表示速度と、印刷物の品質を両立させています。

### Server-Sent Events (SSE) によるストリーミング
- 数十問の問題生成やPDFビルドには数分単位の時間がかかるため、通常のHTTPリクエストではタイムアウトのリスクがあります。
- 本アプリでは **Server-Sent Events (SSE)** を採用し、生成プロセスをリアルタイムでクライアントにプッシュ通知。進行状況が可視化されるため、ユーザーの体感待ち時間を短縮しています。

## 5. 技術スタック

- **Frontend**: Next.js 16 (Pages Router), React 19, TailwindCSS, canvas-confetti
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
