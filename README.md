# FX Trading Journal — MT5取引の分析・日記

MT5（MetaTrader 5）の取引履歴をアップロードして、**リスクリワード（RR）比・実際に利確できた比率・ロット・時間帯**などを自動分析し、日別カレンダーで振り返り＆日記を書けるダッシュボードです。参考UI（取引所のPNLカレンダー）に近い見た目にしています。

- **フロント**: React + TypeScript + Vite + Tailwind CSS
- **DB**: Supabase (PostgreSQL)
- **ホスティング**: Netlify
- **ソース**: GitHub

> 時刻について：MT5のスクショ／サーバー時刻は **ドバイ時間 (UTC+4)** として取り込み、すべて **日本時間 (UTC+9)** に変換して記録・集計します。

---

## 画面構成

モバイルは画面下のタブ、PCは上部のナビゲーションで切り替えます。

| タブ | できること |
|---|---|
| **ホーム** | 累計損益・今日・勝率、損益の推移グラフ、最近の取引 |
| **カレンダー** | 日ごと／月ごとの成績。色付きの日をタップで日記へ |
| **記録** | スクショ＋手入力、またはMT5レポート/CSVの取り込み |
| **分析** | 勝率・損益比・リスクリワード・利確率・ロット・時間帯 |
| **日記** | 日付ごとの振り返りメモと、その日の取引 |

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
- **トレーダータイプ診断**（分析タブ → タイプ診断）
  - 24問のアンケート＋取引記録から、いまの傾向を6タイプ（BLAZE/LOGIC/GUARD/SHIFT/WATCH/RISE）で整理
  - 採点はすべてサーバー側（Netlify Function）。画面から点数は送れない
  - 「なぜこのタイプになったのか」を必ず表示。結果は上書きせず履歴として残る
  - 詳しくは [`docs/trader-diagnosis-spec.md`](./docs/trader-diagnosis-spec.md)
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

### ログイン（必須）

メールアドレスとパスワードでログインします。**データはログインした人ごとに分かれ、他人の取引は見えません**。

Supabase の **Authentication → Providers → Email** が有効であることを確認してください。
確認メールを省きたい場合は、同画面の **Confirm email** をオフにします。

### すでに旧バージョンで動かしている場合

`supabase/migrations/` の中を、日付順に SQL Editor で実行してください。
（トレーダータイプ診断を使うには `2026-08-06_trader_diagnosis.sql` の実行が必要です）
最後の `2026-08-05_multi_user.sql` は**アプリでアカウント登録を済ませてから**実行すると、
これまでのデータがそのアカウントに引き継がれます。

日付ごとにまとめたものもあります。1回貼るだけで済みます。
何度実行しても壊れません（すでに済んでいる部分は飛ばされます）。

| まとめ | 中身 |
| --- | --- |
| [`supabase/setup_2026-08-06.sql`](./supabase/setup_2026-08-06.sql) | 複数口座 / チャート画像の表 / 画像の重複防止 |
| [`supabase/setup_2026-08-07.sql`](./supabase/setup_2026-08-07.sql) | トレードの「型」 / 日記の記事化（題名・気持ち・振り返り・学び） |

**日記が保存できないとき**は [`supabase/fix_diary.sql`](./supabase/fix_diary.sql) を1枚流してください。
日記の表そのものが無い場合も含めて、表の作成・権限・列の追加までまとめて入ります。
最後に「入ったか」の一覧が出るので、11行すべてが `○ ある` になっていれば完了です。

画像の置き場所（Storage）まわりだけは、バケットの作成と権限の設定が要るので
まとめには入れていません。[`2026-08-07_storage_images.sql`](./supabase/migrations/2026-08-07_storage_images.sql)
と [`2026-08-07_image_nullable.sql`](./supabase/migrations/2026-08-07_image_nullable.sql) を個別に実行してください。

[`2026-08-07_drop_image_columns.sql`](./supabase/migrations/2026-08-07_drop_image_columns.sql) は
「古い画像の列を消す」ものです。消すと元に戻せないので、
まだ移せていない画像が残っているうちは実行しないでください。

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

   | キー | 値 | 用途 |
   |---|---|---|
   | `VITE_SUPABASE_URL` | Project URL | 画面から接続 |
   | `VITE_SUPABASE_ANON_KEY` | anon public キー | 画面から接続 |
   | `SUPABASE_URL` | Project URL | MT5からの受信 / タイプ診断 |
   | `SUPABASE_SERVICE_ROLE_KEY` | **service_role** キー | MT5からの受信 / タイプ診断 |
   | `SUPABASE_ANON_KEY` | anon public キー（任意） | タイプ診断のログイン確認 |
   | `STRIPE_SECRET_KEY` | `sk_live_…` / `sk_test_…` | 課金 |
   | `STRIPE_PRICE_PRO` | 月額プランの `price_…` | 課金 |
   | `STRIPE_PRICE_CREDIT` | 画像の枠の `price_…` | 課金 |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` | 課金（通知の署名確認） |

   > `SUPABASE_SERVICE_ROLE_KEY` と `STRIPE_` で始まるものには `VITE_` を付けません。
   > 付けると画面側に埋め込まれて漏れます。
   > これらは `/api/ingest`（MT5からの受信）、`/api/trader-diagnosis`（タイプ診断の採点）、
   > `/api/checkout`・`/api/stripe-webhook`（課金）だけがサーバー側で使います。

4. Deploy

### 5. 課金（Stripe）

課金を使わないなら、この節は飛ばして構いません。上の `STRIPE_` を登録しなければ、
料金ページは開けますが「お支払いの準備がまだ整っていません」と出ます。

1. **Supabase → SQL Editor** で [`supabase/migrations/2026-08-19_billing.sql`](./supabase/migrations/2026-08-19_billing.sql) を流す
   - プランとクレジットの表ができ、**無料プランは直近30日ぶんしか読めない**壁が入ります
   - 壁はデータベース側（RLS）にあります。画面の判定ではないので、書き換えても抜けられません
2. **Stripe → 商品** を2つ作る
   - 月額プラン … 980円・継続課金 → `price_…` を `STRIPE_PRICE_PRO` へ
   - 画像の枠 … 500円・1回きり → `price_…` を `STRIPE_PRICE_CREDIT` へ
   - 金額は [`src/lib/plan.ts`](./src/lib/plan.ts) の数字と合わせること（画面の表示はこのファイルから出ています）
3. **Stripe → 開発者 → Webhook** で送信先を追加
   - URL: `https://<あなたのサイト>/api/stripe-webhook`
   - 送るイベント: `checkout.session.completed` /
     `customer.subscription.created` / `.updated` / `.deleted`
   - 出てきた `whsec_…` を `STRIPE_WEBHOOK_SECRET` へ
4. テストモードのカード（`4242 4242 4242 4242`）で、一度通してみる

> **まだ足りないもの**：日本でお金を受け取るには
> 「特定商取引法に基づく表記」「利用規約」「プライバシーポリシー」が要ります。
> 表記には氏名・住所・電話番号など、こちらでは用意できない情報が入るため、
> ページはまだ作っていません。

---

## ホーム画面に置いて使う（PWA）

ブラウザで開いたまま使うと、画面の下に Safari のアドレスバーが残ります。
ホーム画面に追加すると、そのバーが消えて全画面になり、アイコンからすぐ開けます。

**iPhone / iPad**
1. Safari で開く（Chrome や Firefox では追加できません）
2. 下の共有ボタン → 「ホーム画面に追加」
3. アプリのアイコンから開く

初めて Safari で開いた人には、画面の上に一度だけ案内が出ます。閉じれば二度と出ません。

**Android**
Chrome が「インストールしますか」と聞いてきます。

**電波が無いときも**
一度開いたことがあれば、画面の形だけは出ます。ただし取引や日記は
そのつど取りに行くので、中身は電波があるときにしか読めません。
（古い中身を控えておくと、消したはずの取引が生き返るため、あえてしていません）

**新しい版の届き方**

画面(HTML)は毎回インターネットを先に見るので、**開き直せばその場で新しい版**になります
（実際に配信し直して確かめています。閉じてから開き直した場合も同じ）。

ただし iPhone は、アイコンをタップしてもページを生かしたまま復帰することが多く、
その場合は読み込みが起きません。放っておくと何日も古いままになるので、
**画面に戻ってきたときに新しい版が出ていないか見て、あれば上に知らせを出します**。
勝手に読み込み直さないのは、日記を書いている最中に画面が作り直されると
打っていた文が消えたように見えるためです。押すのは本人に任せています。

> `public/sw.js` を書き換えたときは、ファイル先頭の `VERSION` を上げてください。
> 上げないと、古い控えが残ったままになります。
>
> なお `sw.js` そのものの入れ替えは、開いている画面が全部閉じるまで待ちます。
> 途中で入れ替えると、古い画面が古い部品を探しに行って壊れるためです。
> 中身（画面や機能）の更新は、この待ちとは関係なく届きます。

---

## MT5 データの出し方

### HTMLレポート（推奨・S/L・T/P含む）

PC版MT5 → **ツールボックスの「口座履歴」タブを右クリック → レポート → HTML(Internet Explorer)**。
出力された `.html` をアプリの「HTML / CSV を選択」からアップロードします。`Positions` テーブル（建値・S/L・T/P・決済価格・損益・手数料）を自動解析します。

### CSV

以下のような列名（日本語/英語どちらも可、順不同）を持つCSVに対応します：
`ticket, symbol, side(type), volume(lot), open_price, close_price, sl, tp, open_time, close_time, commission, swap, profit`
日時は `2026.08.03 17:23:23` 形式（ドバイ時間として解釈）。

### MT5から自動連携（EA）★もっとも正確

MT5にEA（`mt5/FxJournalSync.mq5`）を入れると、決済のたびに自動で記録されます。
S/L・T/P・手数料・スワップが正確な数値で入り、時刻もUTCで送られるため変換のズレがありません。
導入手順は [`mt5/README.md`](./mt5/README.md) を参照してください。

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
├── netlify/functions/         # /api/ingest（MT5受信）と /api/trader-diagnosis（診断採点）
├── docs/                      # 仕様書（trader-diagnosis-spec.md ほか）
├── src/
│   ├── lib/
│   │   ├── types.ts           # 型定義
│   │   ├── timezone.ts        # ドバイ→日本時間 変換 / セッション判定
│   │   ├── mt5Parser.ts       # HTMLレポート / CSV パーサー
│   │   ├── analytics.ts       # RR・勝率・時間帯などの集計
│   │   ├── seed.ts            # スクショ2件の初期データ
│   │   ├── repo.ts            # Supabase CRUD
│   │   ├── supabase.ts        # クライアント
│   │   ├── format.ts          # 表示整形
│   │   ├── diagnosisClient.ts # タイプ診断APIの呼び出し
│   │   └── diagnosis/         # タイプ診断の採点ロジック（純粋関数＋テスト）
│   ├── hooks/useTrades.ts
│   └── components/
│       ├── diagnosis/         # 診断・結果・キャラクター表示
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
