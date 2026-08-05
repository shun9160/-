-- =============================================================
-- 日記（その日の振り返り）の重複判定に使う索引を作る
--
-- 「同じ日の振り返りは1件だけ」という索引が無いと、保存時に
-- 42P10 エラーになり、書いた内容が消えてしまう。
--
-- ※ アプリ側にも索引が無いときの回避策を入れてあるので、
--    これを実行しなくても保存はできる。実行すると速く・確実になる。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

-- 1) 利用者の列が無ければ足す（古い構成むけ）
alter table public.day_notes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.day_notes alter column user_id set default auth.uid();
update public.day_notes set user_id = auth.uid() where user_id is null;

-- 2) 同じ (利用者, 日付) が重複していると索引を作れないので、
--    いちばん新しい1件だけ残す
delete from public.day_notes a
using public.day_notes b
where a.day = b.day
  and a.user_id is not distinct from b.user_id
  and a.ctid <> b.ctid
  and (coalesce(a.updated_at, 'epoch'::timestamptz), a.ctid::text)
    < (coalesce(b.updated_at, 'epoch'::timestamptz), b.ctid::text);

-- 3) 一意索引を作る
create index if not exists day_notes_user_idx on public.day_notes (user_id);
create unique index if not exists day_notes_user_day_uidx
  on public.day_notes (user_id, day);
