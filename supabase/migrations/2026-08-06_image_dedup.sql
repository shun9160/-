-- =============================================================
-- 同じ画像を二度と取り込まないようにする
--
-- これまでは「いま画面に出ているぶん」でしか同じ画像を見分けられず、
-- 先週上げた写真を今日また上げると、そのまま二重に入っていた。
--
-- 画像の中身から作った指紋(SHA-256)を保存しておき、
-- 次に選んだときに照らし合わせる。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

-- 1) チャート画像の指紋 -----------------------------------------
alter table public.trade_images
  add column if not exists image_hash text;

-- 「この人が、この指紋の画像をすでに持っているか」を素早く引く
create index if not exists trade_images_user_hash_idx
  on public.trade_images (user_id, image_hash);

-- 2) 取込元スクショの指紋 ---------------------------------------
-- 同じMT5のスクショを読み直したとき、文字認識にかける前に気づける
alter table public.trades
  add column if not exists screenshot_hash text;

create index if not exists trades_user_shot_hash_idx
  on public.trades (user_id, screenshot_hash);

-- 既に入っている画像には指紋がありません。
-- そのぶんは「同じ画像かどうか」の判定対象外になりますが、
-- これから登録するものは全て指紋が付きます。
