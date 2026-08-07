-- =============================================================
-- 画像の保存先を、データベースから Storage へ移すための下準備
--
-- いまチャート画像は、文字に変換してデータベースの中に入れている。
-- 文字にすると容量が約1.33倍に膨らむうえ、データベースの保管料は
-- ファイル置き場（Storage）よりずっと高い。人が増えると真っ先に効いてくる。
--
-- この SQL でやること:
--   1) Storage の trade-images に「自分のフォルダだけ触れる」権限を付ける
--   2) 画像の置き場所（住所）を入れる列を足す
--
-- 古い列（screenshot / image / capital_screenshot）はまだ消さない。
-- 新しい住所があればそちらを、無ければ今までどおり中身を読む作りにして、
-- 引っ越しが途中でも画像が見えるようにするため。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- 先に Storage で trade-images バケットを作っておくこと（Public はオフ）。
-- =============================================================

-- -------------------------------------------------------------
-- 1) Storage の権限
--
-- ファイルは {自分のユーザーID}/... という形で置く。
-- storage.foldername(name) が階層の配列を返すので、その1つ目が
-- 自分のIDと一致するファイルだけ、読み書き削除できるようにする。
-- 他人のフォルダは、名前が分かっても触れない。
-- -------------------------------------------------------------

drop policy if exists "own trade-images read"   on storage.objects;
drop policy if exists "own trade-images insert" on storage.objects;
drop policy if exists "own trade-images update" on storage.objects;
drop policy if exists "own trade-images delete" on storage.objects;

create policy "own trade-images read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trade-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own trade-images insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trade-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own trade-images update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'trade-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'trade-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own trade-images delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trade-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- -------------------------------------------------------------
-- 2) 住所を入れる列
--
-- 例: "9c1f.../3a7e.../b2d4.webp"
--      ↑ユーザーID  ↑取引ID   ↑ファイル名
-- バケット名は入れない。あとでバケット名を変えても直さずに済む。
-- -------------------------------------------------------------

alter table public.trades
  add column if not exists screenshot_path text;

alter table public.trade_images
  add column if not exists image_path text;

alter table public.accounts
  add column if not exists capital_screenshot_path text;

comment on column public.trades.screenshot_path is
  'Storage(trade-images)内の置き場所。ここが入っていれば screenshot は使わない';
comment on column public.trade_images.image_path is
  'Storage(trade-images)内の置き場所。ここが入っていれば image は使わない';
comment on column public.accounts.capital_screenshot_path is
  'Storage(trade-images)内の置き場所。ここが入っていれば capital_screenshot は使わない';

-- -------------------------------------------------------------
-- 確認用
--   実行後、ここを流すと権限が4件ぶん出る
-- -------------------------------------------------------------
-- select policyname, cmd from pg_policies
--  where schemaname = 'storage' and tablename = 'objects'
--    and policyname like 'own trade-images%';
