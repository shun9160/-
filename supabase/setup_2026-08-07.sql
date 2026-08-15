-- =============================================================
-- FX BOOK セットアップ SQL（2026-08-07 ぶんをまとめたもの）
--
-- 次の2つを、この順番で1つにまとめてあります。
--   1) 2026-08-07_setups.sql   トレードに「型」の名前を付けられるようにする
--   2) 2026-08-07_journal.sql  日記を「記事」として書けるようにする
--
-- Supabase → SQL Editor に貼り付けて Run してください。
-- 何度実行しても壊れません（すでに済んでいる部分は飛ばされます）。
-- 今ある取引や日記が消えることはありません。
--
-- ※ 画像の置き場所（Storage）まわりは 2026-08-07_storage_images.sql と
--    2026-08-07_image_nullable.sql に分かれていて、そちらは実行済みです。
--    まだなら先にそちらを流してください。
--
-- ※ 2026-08-07_drop_image_columns.sql はここに入れていません。
--    あれは「古い画像の列を消す」もので、消すと元に戻せません。
--    まだ移せていない画像が残っているうちは流さないでください。
-- =============================================================


-- =============================================================
-- 1) トレードに「型（セットアップ）」の名前を付けられるようにする
--
-- 「押し目買い」「ブレイク狙い」など、自分の型に名前を付けると、
-- 同じ型のトレードとチャートが集まる。貼った画像が
-- 「その取引の添付物」で終わらず、自分の勝ちパターン集になる。
--
-- 別の表は作らず、trades に1列だけ足す。名前を変えるときは
-- その名前の行をまとめて書き換えればよく、表を分けるより扱いが簡単。
-- =============================================================

alter table public.trades
  add column if not exists setup text;

comment on column public.trades.setup is
  '自分の型の名前。「押し目買い」など。未入力は null';

-- 型ごとに集めるときに使う。自分のぶんだけを引くので user_id と組にする
create index if not exists trades_user_setup_idx
  on public.trades (user_id, setup)
  where setup is not null;


-- =============================================================
-- 2) 日記を「記事」として書けるようにする
--
-- これまでは1日ぶんに「note」という文章がひとつあるだけだった。
-- 題名も、そのときの気持ちも、振り返りも、学びも、
-- ぜんぶ同じ1つの箱に混ざっていた。
--
-- 書く場所を分けると、あとから読み返すときに効く。
--  - 題名 …… 一覧で「どんな日だったか」がひと目で分かる
--  - 気持ち … 焦っていた日だけを並べて見られる
--  - 学び …… ここだけを集めれば、自分のルール集になる
--
-- note（今までの文章）は消さない。すでに書いたものは、
-- 開いたときに本文へ引き継ぐ。また note は今後も
-- 「本文の文字だけを写したもの」として書き続ける。
-- 一覧の下書きや診断がこの列を見ているため。
-- =============================================================

alter table public.day_notes
  -- 記事の題名。「焦ってエントリーしてしまった日」など
  add column if not exists title text,
  -- いちばん上に並べるチャート。取引の添付とは別に、自分で貼る
  add column if not exists photos jsonb,
  -- 本文。文章と画像が順番に並んだもの（下に形を書いてある）
  add column if not exists body_blocks jsonb,
  -- そのとき何を感じていたか。複数選べる
  add column if not exists emotions text[],
  -- なぜそう感じたか
  add column if not exists emotion_why text,
  -- 振り返りの3つの問い
  add column if not exists good text,
  add column if not exists improve text,
  add column if not exists next_time text,
  -- 今日の学び。あとから探せるよう、ここだけ独立させる
  add column if not exists lesson text;

comment on column public.day_notes.body_blocks is
  '本文。[{"id":"...","kind":"text","text":"..."},{"id":"...","kind":"image","path":"<Storageの置き場所>","caption":"..."}] の並び';

comment on column public.day_notes.photos is
  'その日のチャート。[{"id":"...","path":"<Storageの置き場所>","caption":"..."}] の並び';

comment on column public.day_notes.lesson is
  '今日の学び。ここだけ独立して持ち、あとから集めて読み返せるようにする';

-- 学びを書いた日だけを、新しい順に引くための索引
create index if not exists day_notes_user_lesson_idx
  on public.day_notes (user_id, day desc)
  where lesson is not null and lesson <> '';

-- 気持ちで絞り込むための索引（配列は GIN）
create index if not exists day_notes_emotions_idx
  on public.day_notes using gin (emotions);


-- =============================================================
-- 確認用
--
-- ぜんぶ流し終わったら、これを実行してください。
-- 10行すべてが「ある」になっていれば完了です。
-- =============================================================
-- select t.tbl || '.' || t.col as 列,
--        case when c.column_name is null then '× ない' else '○ ある' end as 状態
--   from (values
--          ('trades','setup'),
--          ('day_notes','title'),
--          ('day_notes','photos'),
--          ('day_notes','body_blocks'),
--          ('day_notes','emotions'),
--          ('day_notes','emotion_why'),
--          ('day_notes','good'),
--          ('day_notes','improve'),
--          ('day_notes','next_time'),
--          ('day_notes','lesson')
--        ) as t(tbl, col)
--   left join information_schema.columns c
--          on c.table_schema = 'public'
--         and c.table_name   = t.tbl
--         and c.column_name  = t.col
--  order by 1;
