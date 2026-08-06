-- =============================================================
-- Edgebook セットアップ SQL（2026-08-06 ぶんをまとめたもの）
--
-- 次の3つを、この順番で1つにまとめてあります。
--   1) 2026-08-06_accounts.sql     複数の口座に対応する
--   2) 2026-08-06_trade_images.sql チャート画像を保存する表
--   3) 2026-08-06_image_dedup.sql  同じ画像の二重登録を防ぐ指紋
--
-- Supabase → SQL Editor に貼り付けて Run してください。
-- 何度実行しても壊れません（すでに済んでいる部分は飛ばされます）。
-- 今ある取引が消えることはありません。
-- =============================================================


-- =============================================================
-- 1) 複数の口座に対応する
-- =============================================================

-- ● 口座の表 -----------------------------------------------------
create table if not exists public.accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
  broker            text,                        -- ブローカー名（例: Exness）
  login             text,                        -- 口座番号（MT5のログインID）
  nickname          text,                        -- 表示名（任意）
  currency          text    not null default 'JPY',
  lot_size          numeric not null default 100000,
  broker_utc_offset numeric not null default 4,  -- MT5サーバーの時差
  initial_capital   numeric not null default 0,  -- この口座の原資
  capital_note      text,
  capital_screenshot text,
  -- 既定の口座（記録先の初期値）
  is_default        boolean not null default false,
  created_at        timestamptz default now()
);

create index if not exists accounts_user_idx on public.accounts (user_id);

-- 同じ (利用者, ブローカー, 口座番号) を二重登録させない。
-- 条件付き索引にすると重複判定(ON CONFLICT)に使えないので、条件は付けない。
-- 口座番号が未入力(null)の行は Postgres 上たがいに別物として扱われるため、
-- 番号なしの口座はいくつでも作れる。
create unique index if not exists accounts_user_login_uidx
  on public.accounts (user_id, broker, login);

-- ● 取引を口座に紐づける -----------------------------------------
alter table public.trades
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;
create index if not exists trades_account_idx on public.trades (account_id);

-- ● 既存データの引っ越し（今ある取引を「最初の口座」に移す） -------
--   ・設定を持っている人には、その内容で「最初の口座」を作る
insert into public.accounts
  (user_id, nickname, currency, lot_size, broker_utc_offset,
   initial_capital, capital_note, capital_screenshot, is_default)
select
  s.user_id,
  '最初の口座',
  coalesce(s.account_currency, 'JPY'),
  coalesce(s.lot_size, 100000),
  coalesce(s.broker_utc_offset, 4),
  coalesce(s.initial_capital, 0),
  s.capital_note,
  s.capital_screenshot,
  true
from public.settings s
where not exists (select 1 from public.accounts a where a.user_id = s.user_id);

--   ・設定は無いが取引だけある人にも作る
insert into public.accounts (user_id, nickname, is_default)
select distinct t.user_id, '最初の口座', true
from public.trades t
where t.user_id is not null
  and not exists (select 1 from public.accounts a where a.user_id = t.user_id);

--   ・行き先の無い取引を、その人の既定口座に入れる
update public.trades t
set account_id = a.id
from public.accounts a
where t.account_id is null
  and a.user_id = t.user_id
  and a.is_default;

-- ● 取引の重複判定を口座ごとにする -------------------------------
-- ブローカーが違えば同じ取引番号が来ることがある。
-- (利用者, 取引番号) のままだと、別口座の取引を同じものとみなして
-- 上書きしてしまうため、口座を含めた組み合わせに直す。
drop index if exists public.trades_user_ticket_uidx;
create unique index if not exists trades_account_ticket_uidx
  on public.trades (user_id, account_id, ticket);

-- ● 自分の口座だけ見える・書けるようにする -----------------------
alter table public.accounts enable row level security;

drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- =============================================================
-- 2) チャート画像を保存する表
-- =============================================================

create table if not exists public.trade_images (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  trade_id   uuid not null references public.trades(id) on delete cascade,
  -- 縮小した画像そのもの (data URL)
  image      text not null,
  -- その画像の説明。「エントリー」「決済後」など
  caption    text,
  created_at timestamptz default now()
);

-- 取引を開いたときに、その取引の画像だけを引く
create index if not exists trade_images_trade_idx on public.trade_images (trade_id, created_at);
create index if not exists trade_images_user_idx  on public.trade_images (user_id);

-- 自分の画像だけ見える・書けるようにする
alter table public.trade_images enable row level security;

drop policy if exists "own trade_images" on public.trade_images;
create policy "own trade_images" on public.trade_images
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- =============================================================
-- 3) 同じ画像の二重登録を防ぐ指紋
-- =============================================================

-- ● チャート画像の指紋 -------------------------------------------
alter table public.trade_images
  add column if not exists image_hash text;

-- 「この人が、この指紋の画像をすでに持っているか」を素早く引く
create index if not exists trade_images_user_hash_idx
  on public.trade_images (user_id, image_hash);

-- ● 取込元スクショの指紋 -----------------------------------------
-- 同じMT5のスクショを読み直したとき、文字認識にかける前に気づける
alter table public.trades
  add column if not exists screenshot_hash text;

create index if not exists trades_user_shot_hash_idx
  on public.trades (user_id, screenshot_hash);

-- 既に入っている画像には指紋がありません。
-- そのぶんは「同じ画像かどうか」の判定対象外になりますが、
-- これから登録するものは全て指紋が付きます。
