-- =============================================================
-- FX Trading Journal — Supabase スキーマ
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- =============================================================

-- 取引テーブル -------------------------------------------------
create table if not exists public.trades (
  id           uuid primary key default gen_random_uuid(),
  -- MT5 のポジション番号 (#19235918 など)。重複取込を防ぐためユニーク。
  ticket       text unique,
  symbol       text not null,
  side         text not null check (side in ('buy', 'sell')),
  volume       numeric not null,                 -- ロット
  open_price   numeric not null,
  close_price  numeric,
  sl           numeric,                           -- ストップロス価格
  tp           numeric,                           -- テイクプロフィット価格
  -- 時刻は「真の瞬間」を timestamptz で保存する。
  -- 元データ(ドバイ時間=UTC+4)を UTC に正規化して格納し、
  -- 表示時に日本時間(Asia/Tokyo)へ変換する。
  open_time    timestamptz not null,
  close_time   timestamptz,
  commission   numeric default 0,
  swap         numeric default 0,
  profit       numeric default 0,                 -- 損益(手数料・スワップ除く グロス)
  currency     text default 'JPY',
  note         text,                              -- トレード単位の日記メモ
  screenshot   text,                              -- 添付スクショ (縮小した data URL)
  source       text default 'manual',             -- 取込元 (manual / html / csv / seed / screenshot)
  created_at   timestamptz default now()
);

create index if not exists trades_open_time_idx on public.trades (open_time);
create index if not exists trades_symbol_idx on public.trades (symbol);

-- 日次の日記メモ ----------------------------------------------
create table if not exists public.day_notes (
  day        date primary key,                    -- 日本時間ベースの日付
  note       text,
  updated_at timestamptz default now()
);

-- 設定 (原資など) ----------------------------------------------
-- id = 1 の1行だけを使う
create table if not exists public.settings (
  id                 smallint primary key default 1,
  initial_capital    numeric default 0,           -- 原資（円）
  capital_note       text,                        -- 入金日などのメモ
  capital_screenshot text,                        -- 証拠のスクショ (縮小した data URL)
  updated_at         timestamptz default now(),
  constraint settings_singleton check (id = 1)
);

-- =============================================================
-- RLS (Row Level Security)
-- -------------------------------------------------------------
-- 個人利用・認証なし構成のため anon キーで読み書きできるようにする。
-- ★注意★ anon キーはフロントに露出するので、この構成では
--   「URL とキーを知っている人は誰でも読み書きできる」状態になります。
--   公開範囲を絞りたい場合は Supabase Auth を導入し、下記ポリシーを
--   auth.uid() ベースに変更してください(README 参照)。
-- =============================================================
alter table public.trades enable row level security;
alter table public.day_notes enable row level security;
alter table public.settings enable row level security;

drop policy if exists "anon full access trades" on public.trades;
create policy "anon full access trades" on public.trades
  for all to anon using (true) with check (true);

drop policy if exists "anon full access day_notes" on public.day_notes;
create policy "anon full access day_notes" on public.day_notes
  for all to anon using (true) with check (true);

drop policy if exists "anon full access settings" on public.settings;
create policy "anon full access settings" on public.settings
  for all to anon using (true) with check (true);
