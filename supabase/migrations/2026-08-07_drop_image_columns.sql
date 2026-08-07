-- =============================================================
-- 画像の中身を入れていた列を消す
--
-- ★ このSQLは、次の3つを確かめてから実行してください ★
--   1) 引っ越しが終わっている（下の「確認」で3つとも 0）
--   2) 古い画像が画面でちゃんと表示される
--   3) 逃げ道を外したコードがデプロイ済み
--
-- 列を消すと元に戻せません。順番を飛ばさないこと。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

-- -------------------------------------------------------------
-- 確認（先にこれだけ流す。3つとも 0 でなければ、まだ消さない）
-- -------------------------------------------------------------
-- select
--   (select count(*) from public.trade_images
--      where image_path is null and image is not null)                        as チャート画像,
--   (select count(*) from public.trades
--      where screenshot_path is null and screenshot is not null)              as スクショ登録,
--   (select count(*) from public.accounts
--      where capital_screenshot_path is null and capital_screenshot is not null) as 原資の証拠;

-- -------------------------------------------------------------
-- 1) 古い列を消す
--
-- image を消すと、image を見ていた決まり（trade_images_has_image）も
-- 一緒に消える。かわりに「置き場所は必ず入っている」に置き換える。
-- -------------------------------------------------------------

alter table public.trade_images drop column if exists image;
alter table public.trades       drop column if exists screenshot;
alter table public.accounts     drop column if exists capital_screenshot;

-- 画像の行なのに画像が無い、という状態を作らせない。
-- 引っ越しが本当に終わっていなければ、ここで失敗する（それが狙い）。
alter table public.trade_images
  alter column image_path set not null;

-- trades と accounts は「スクショが無い」ことが普通なので、
-- こちらは空のままでよい。

-- -------------------------------------------------------------
-- 2) 容量を実際に返す
--
-- Postgres は列を消しても、すぐには容量を返さない。
-- 消した跡地は「空き」として残るだけで、DBの使用量は減らない。
-- 下の VACUUM FULL で表を作り直すと、はじめて実際に減る。
--
-- ※ 実行中はその表を読み書きできなくなる（数秒〜。件数しだい）
-- ※ VACUUM は他の文と一緒に実行できない。
--    新しいクエリタブに1行ずつ貼って、単独で実行すること。
-- -------------------------------------------------------------

-- vacuum full public.trades;
-- vacuum full public.trade_images;
-- vacuum full public.accounts;

-- -------------------------------------------------------------
-- 3) 効果の確認
-- -------------------------------------------------------------
-- select
--   pg_size_pretty(pg_total_relation_size('public.trades'))       as trades,
--   pg_size_pretty(pg_total_relation_size('public.trade_images')) as trade_images,
--   pg_size_pretty(pg_total_relation_size('public.accounts'))     as accounts;
