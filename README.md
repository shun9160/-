# FX Trading Journal — MT5取引の分析・日記

MT5（MetaTrader 5）の取引履歴をアップロードして、**リスクリワード（RR）比・実際に利確できた比率・ロット・時間帯**などを自動分析し、日別カレンダーで振り返り＆日記を書けるダッシュボードです。参考UI（取引所のPNLカレンダー）に近い見た目にしています。

- **フロント**: React + TypeScript + Vite + Tailwind CSS
- **DB**: Supabase (PostgreSQL)
- **ホスティング**: Netlify
- **ソース**: GitHub

> 時刻について：MT5のスクショ／サーバー時刻は **ドバイ時間 (UTC+4)** として取り込み、すべて **日本時間 (UTC+9)** に変換して記録・集計します。

---

## 主な機能

- **ダッシュボード**（参考UI準拠）
  - 累計純損益 / 本日のPNL / 7日間のPNL
  - 日別PNL・累積PNL・残高推移タブ
  - 直近7/30/90日・全期間フィルタ
  - **日別カレンダー**（日ごとの損益を色分け表示）＋ 月別ビュー ＋ バーチャート
- **分析パネル**
  - **計画RR比**（平均）＝ `|TP − 建値| ÷ |建値 − SL|`
  - **実現Rマルチプル**（平均）＝ `実現値幅 ÷ リスク幅`
  - **TP到達で利確した比率**（TP設定トレード中）
  - **TP目標の獲得率**（平均）＝ `実現値幅 ÷ TPまでの値幅`
  - 勝率・プロフィットファクター・**ロット**（平均/合計）
  - **時間帯セッション別**（東京/ロンドン/NY, 日本時間）・時間帯別（0〜23時）損益
- **取引一覧**：1件ごとにRR・実現R・獲得率・決済結果・メモを表示/編集
  - **✏️ 編集**：登録後にロット・価格・SL/TP・時刻・損益などを修正可能
  - **📷 スクショ添付**：取引に画像を添付（自動で縮小してDB保存）／表示・差し替え・削除
- **日記**：日付ごとの振り返りメモ（Supabaseに保存）
- **取込**：MT5 HTMLレポート / CSV / 手入力。アップロードいただいたスクショ2件はワンクリックで投入可

---

## セットアップ

### 1. Supabase

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. **SQL Editor** で [`supabase/schema.sql`](./supabase/schema.sql) を実行（テーブルとRLSを作成）
   - すでに旧スキーマで作成済みの場合は、[`supabase/migrations/2026-08-04_add_screenshot.sql`](./supabase/migrations/2026-08-04_add_screenshot.sql) を実行してスクショ列を追加してください
3. **Project Settings → API** から次を控える
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` キー → `VITE_SUPABASE_ANON_KEY`

> ⚠️ 本構成は「個人利用・認証なし」で anon キーを使います。anon キーはフロントに露出するため、**URLとキーを知る人は誰でも読み書き可能**です。公開範囲を絞りたい場合は Supabase Auth を導入し、`schema.sql` のポリシーを `auth.uid()` ベースへ変更してください。

### 2. ローカル開発

```bash
cp .env.example .env      # .env に Supabase の値を入れる
npm install
npm run dev               # http://localhost:5173
```

### 3. GitHub

このリポジトリの `main` ブランチに実装済みです。Netlify はこの `main` を本番ブランチとして接続します。

### 4. Netlify デプロイ

1. Netlify で **Add new site → Import from GitHub** → このリポジトリを選択
2. ビルド設定は [`netlify.toml`](./netlify.toml) が自動適用（`npm run build` / publish `dist`）
3. **Site settings → Environment variables** に次を登録
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

---

## MT5 データの出し方

### HTMLレポート（推奨・S/L・T/P含む）

PC版MT5 → **ツールボックスの「口座履歴」タブを右クリック → レポート → HTML(Internet Explorer)**。
出力された `.html` をアプリの「HTML / CSV を選択」からアップロードします。`Positions` テーブル（建値・S/L・T/P・決済価格・損益・手数料）を自動解析します。

### CSV

以下のような列名（日本語/英語どちらも可、順不同）を持つCSVに対応します：
`ticket, symbol, side(type), volume(lot), open_price, close_price, sl, tp, open_time, close_time, commission, swap, profit`
日時は `2026.08.03 17:23:23` 形式（ドバイ時間として解釈）。

### 手入力 / スクショ

モバイルのポジション詳細（S/L・T/P・時刻）から1件ずつ手入力できます。今回アップロードいただいた画像1・2の2トレードは「スクショ2件を投入」ボタンで登録されます。

---

## 指標の定義

| 指標 | 計算式 | 意味 |
|---|---|---|
| 計画RR比 | `|TP − 建値| ÷ |建値 − SL|` | エントリー時点の想定リスクリワード |
| 実現Rマルチプル | `実現値幅 ÷ リスク幅(|建値−SL|)` | 実際に何R取れた/損したか |
| TP到達で利確した比率 | TP設定トレードのうち決済価格がTP近傍 | 計画通り利確できた割合 |
| TP目標の獲得率 | `実現値幅 ÷ |TP − 建値|` | 狙った利幅の何%を取れたか |
| プロフィットファクター | `総利益 ÷ 総損失` | 収益性 |

> リスク幅は **SLが設定されている取引のみ** 計算対象になります。SL/TP未設定の取引はRR系指標が「—」表示になります。

---

## ディレクトリ構成

```
├── supabase/schema.sql        # DBスキーマ + RLS
├── netlify.toml               # Netlifyビルド設定
├── src/
│   ├── lib/
│   │   ├── types.ts           # 型定義
│   │   ├── timezone.ts        # ドバイ→日本時間 変換 / セッション判定
│   │   ├── mt5Parser.ts       # HTMLレポート / CSV パーサー
│   │   ├── analytics.ts       # RR・勝率・時間帯などの集計
│   │   ├── seed.ts            # スクショ2件の初期データ
│   │   ├── repo.ts            # Supabase CRUD
│   │   ├── supabase.ts        # クライアント
│   │   └── format.ts          # 表示整形
│   ├── hooks/useTrades.ts
│   └── components/
│       ├── Overview.tsx       # ヒーロー + 日別/累積/残高 + カレンダー
│       ├── PnlCalendar.tsx    # 日別/月別カレンダー
│       ├── PnlCharts.tsx      # バー/ライン/エリア
│       ├── StatsPanel.tsx     # RR・利確・ロット・時間帯
│       ├── UploadPanel.tsx    # 取込・手入力
│       ├── TradesTable.tsx    # 取引一覧 + メモ
│       └── Diary.tsx          # 日記
└── ...
```

## 注意・前提

- 損益・残高の通貨は既定で `JPY`。CSVに `currency` 列があればそれを使用します。
- スクショのロット0.02・XAUUSDから、損益はJPY建て口座として取り込んでいます。
- スクショの売り(sell)はエントリー時刻がスクショに無いため、表示時刻を採用しS/L・T/Pは未記録としています。
