-- =============================================================
-- 日記を保存できるようにする（これ1枚で完結します）
--
-- 「day_notes という表がありません」と言われた人向け。
-- 表がある場合も無い場合も、そのまま流せます。
--   1) 表が無ければ作る
--   2) 権限（自分のぶんだけ読み書きできる設定）を入れ直す
--   3) 記事として書くための列を足す
--   4) トレードの「型」の列も足す
--   5) 最後に、入ったかどうかを表で出す
--
-- Supabase → SQL Editor に貼り付けて Run してください。
-- 何度実行しても壊れません。今ある日記や取引が消えることもありません。
-- =============================================================


-- -------------------------------------------------------------
-- 1) 日記の表。無ければ作る
-- -------------------------------------------------------------
create table if not exists public.day_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day        date not null,          -- 日本時間ベースの日付
  note       text,
  updated_at timestamptz default now()
);

create index if not exists day_notes_user_idx
  on public.day_notes (user_id);

-- 1人につき1日1行。これが無いと、同じ日の行が増えていく
create unique index if not exists day_notes_user_day_uidx
  on public.day_notes (user_id, day);


-- -------------------------------------------------------------
-- 2) 権限。自分のぶんだけ読み書きできるようにする
--
-- これを入れ忘れると、書き込みが黙って0件で終わる。
-- 画面には「保存できませんでした」しか出ず、原因が分からなくなる
-- -------------------------------------------------------------
alter table public.day_notes enable row level security;

drop policy if exists "own day_notes" on public.day_notes;
create policy "own day_notes" on public.day_notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- -------------------------------------------------------------
-- 3) 記事として書くための列
-- -------------------------------------------------------------
alter table public.day_notes
  add column if not exists title       text,   -- 題名
  add column if not exists photos      jsonb,  -- いちばん上に並べるチャート
  add column if not exists body_blocks jsonb,  -- 本文（文章と画像の並び）
  add column if not exists emotions    text[], -- そのときの気持ち（複数）
  add column if not exists emotion_why text,   -- なぜそう感じたか
  add column if not exists good        text,   -- 今日いちばん良かった判断
  add column if not exists improve     text,   -- 改善するとしたら
  add column if not exists next_time   text,   -- もう一度同じ相場が来たら
  add column if not exists lesson      text;   -- 今日の学び

-- 学びを書いた日だけを、新しい順に引くための索引
create index if not exists day_notes_user_lesson_idx
  on public.day_notes (user_id, day desc)
  where lesson is not null and lesson <> '';

-- 気持ちで絞り込むための索引（配列は GIN）
create index if not exists day_notes_emotions_idx
  on public.day_notes using gin (emotions);


-- -------------------------------------------------------------
-- 4) トレードの「型」（押し目買い など）
-- -------------------------------------------------------------
alter table public.trades
  add column if not exists setup text;

create index if not exists trades_user_setup_idx
  on public.trades (user_id, setup)
  where setup is not null;


-- -------------------------------------------------------------
-- 5) 入ったかの確認。ここまで流すと、下に表が出ます
--    11行すべてが「○ ある」なら完了です
-- -------------------------------------------------------------
select t.tbl || '.' || t.col as "列",
       case when c.column_name is null then '× ない' else '○ ある' end as "状態"
  from (values
         ('trades',    'setup'),
         ('day_notes', 'title'),
         ('day_notes', 'photos'),
         ('day_notes', 'body_blocks'),
         ('day_notes', 'emotions'),
         ('day_notes', 'emotion_why'),
         ('day_notes', 'good'),
         ('day_notes', 'improve'),
         ('day_notes', 'next_time'),
         ('day_notes', 'lesson'),
         ('day_notes', 'note')
       ) as t(tbl, col)
  left join information_schema.columns c
         on c.table_schema = 'public'
        and c.table_name   = t.tbl
        and c.column_name  = t.col
 order by 1;
