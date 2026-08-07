-- =============================================================
-- 日記を「記事」として書けるようにする
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
-- note（今までの文章）は消さない。
-- すでに書いたものは、開いたときに本文へ引き継ぐ。
-- また note は今後も「本文の文字だけを写したもの」として
-- 書き続ける。一覧の下書きや診断がこの列を見ているため。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

alter table public.day_notes
  -- 記事の題名。「焦ってエントリーしてしまった日」など
  add column if not exists title text,
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

comment on column public.day_notes.lesson is
  '今日の学び。ここだけ独立して持ち、あとから集めて読み返せるようにする';

-- 学びを書いた日だけを、新しい順に引くための索引
create index if not exists day_notes_user_lesson_idx
  on public.day_notes (user_id, day desc)
  where lesson is not null and lesson <> '';

-- 気持ちで絞り込むための索引（配列は GIN）
create index if not exists day_notes_emotions_idx
  on public.day_notes using gin (emotions);

-- -------------------------------------------------------------
-- 確認用
-- -------------------------------------------------------------
-- select day, title, emotions, lesson from public.day_notes
--  order by day desc limit 20;
