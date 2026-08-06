-- =============================================================
-- 取引ごとのチャート画像を保存する表を作る
--
-- 1つの取引に何枚でも貼れるようにするため、trades とは別の表にする。
-- 別表にしておくと、一覧を出すときに重い画像を読まずに済む。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
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
