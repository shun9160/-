-- =============================================================
-- トレードに「型（セットアップ）」の名前を付けられるようにする
--
-- 「押し目買い」「ブレイク狙い」など、自分の型に名前を付けると、
-- 同じ型のトレードとチャートが集まってアルバムになる。
-- 貼った画像が「その取引の添付物」で終わらず、
-- 自分の勝ちパターン集として意味を持つようになる。
--
-- 別の表は作らず、trades に1列だけ足す。
-- 名前を変えるときは、その名前の行をまとめて書き換えればよく、
-- 表を分けるより扱いが簡単なため。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

alter table public.trades
  add column if not exists setup text;

comment on column public.trades.setup is
  '自分の型の名前。「押し目買い」など。未入力は null';

-- 型ごとに集めるときに使う。自分のぶんだけを引くので user_id と組にする
create index if not exists trades_user_setup_idx
  on public.trades (user_id, setup)
  where setup is not null;

-- -------------------------------------------------------------
-- 確認用
-- -------------------------------------------------------------
-- select setup, count(*) from public.trades
--  where setup is not null group by setup order by count(*) desc;
