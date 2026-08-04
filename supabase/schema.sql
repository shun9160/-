-- =============================================================
-- FX Trading Journal — Supabase スキーマ（新規作成用）
--
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- すでに旧バージョンで運用している場合は、これではなく
-- supabase/migrations/ の中のファイルを順番に実行してください。
--
-- データはログインした利用者ごとに分かれます（他人の行は見えません）。
-- =============================================================

-- 取引テーブル -------------------------------------------------
create table if not exists public.trades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- MT5 のポジション番号 (#19235918 など)。重複取込を防ぐために使う。
  ticket       text,
  symbol       text not null,
  side         text not null check (side in ('buy', 'sell')),
  volume       numeric not null,                 -- ロット
  open_price   numeric not null,
  close_price  numeric,
  sl           numeric,                           -- ストップロス価格
  tp           numeric,                           -- テイクプロフィット価格
  -- 時刻は「真の瞬間」を timestamptz で保存し、表示時に日本時間へ変換する。
  open_time    timestamptz not null,
  close_time   timestamptz,
  commission   numeric default 0,
  swap         numeric default 0,
  profit       numeric default 0,                 -- 損益(手数料・スワップ除く グロス)
  currency     text default 'JPY',
  note         text,                              -- トレード単位の日記メモ
  screenshot   text,                              -- 添付スクショ (縮小した data URL)
  source       text default 'manual',             -- 取込元 (manual / html / csv / screenshot / mt5)
  created_at   timestamptz default now()
);

create index if not exists trades_user_idx      on public.trades (user_id);
create index if not exists trades_open_time_idx on public.trades (open_time);
create index if not exists trades_symbol_idx    on public.trades (symbol);

-- 同じ取引を二重に取り込まない（利用者ごとに判定）
create unique index if not exists trades_user_ticket_uidx
  on public.trades (user_id, ticket) where ticket is not null;

-- 日次の日記メモ ----------------------------------------------
create table if not exists public.day_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day        date not null,                       -- 日本時間ベースの日付
  note       text,
  updated_at timestamptz default now()
);

create index if not exists day_notes_user_idx on public.day_notes (user_id);
create unique index if not exists day_notes_user_day_uidx on public.day_notes (user_id, day);

-- 設定 (原資など) ----------------------------------------------
create table if not exists public.settings (
  user_id            uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  initial_capital    numeric default 0,           -- 原資（円）
  capital_note       text,                        -- 入金日などのメモ
  capital_screenshot text,                        -- 証拠のスクショ (縮小した data URL)
  updated_at         timestamptz default now()
);

-- 連携コード（MT5のEAなど、外部から書き込むための鍵） -----------
create table if not exists public.ingest_tokens (
  token        text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text,
  created_at   timestamptz default now(),
  last_used_at timestamptz
);
create index if not exists ingest_tokens_user_idx on public.ingest_tokens (user_id);

-- =============================================================
-- RLS (Row Level Security) — 自分の行だけ読み書きできる
-- =============================================================
alter table public.trades        enable row level security;
alter table public.day_notes     enable row level security;
alter table public.settings      enable row level security;
alter table public.ingest_tokens enable row level security;

drop policy if exists "own trades" on public.trades;
create policy "own trades" on public.trades
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own day_notes" on public.day_notes;
create policy "own day_notes" on public.day_notes
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own tokens" on public.ingest_tokens;
create policy "own tokens" on public.ingest_tokens
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 注意:
--  anon(未ログイン)には一切の権限を与えていません。
--  MT5のEAなど外部からの書き込みは、連携コードを使って
--  Netlify Functions 経由(/api/ingest)で行います。
