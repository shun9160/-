-- =============================================================
-- 画像の中身を空にできるようにする
--
-- trade_images.image は「必ず入っている」決まりで作った。
-- 画像がDBの中にしか無かった頃は、それで正しかった。
--
-- いまは Storage に置いて image_path（置き場所）だけを持つので、
-- image は空になる。そのままだと保存が弾かれる。
--
-- かわりに「image と image_path の、どちらかは必ず入っている」
-- という決まりに置き換える。どちらも空の行＝画像の無い画像、は作らせない。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

alter table public.trade_images
  alter column image drop not null;

-- 念のため、両方空の行が生まれないようにする
alter table public.trade_images
  drop constraint if exists trade_images_has_image;

alter table public.trade_images
  add constraint trade_images_has_image
  check (image is not null or image_path is not null);

-- -------------------------------------------------------------
-- 確認用
--   image が YES（空にできる）、制約が1件出れば成功
-- -------------------------------------------------------------
-- select column_name, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'trade_images'
--    and column_name in ('image', 'image_path');

-- select conname from pg_constraint
--  where conrelid = 'public.trade_images'::regclass
--    and conname = 'trade_images_has_image';
