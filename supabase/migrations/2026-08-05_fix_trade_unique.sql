-- =============================================================
-- 取引の重複判定に使う索引を作り直す
--
-- 以前は「ticket が空でない行だけ」という条件付きの索引にしていた。
-- 条件付きの索引は重複時の上書き(ON CONFLICT)に使えないため、
-- 保存時に 42P10 エラーになっていた。条件を外して作り直す。
--
-- ticket が空の行は、Postgres では互いに別物として扱われるので、
-- 条件を外しても手入力の取引をいくつでも登録できる。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

-- 1) 古い制約・索引を外す
alter table public.trades drop constraint if exists trades_ticket_key;
drop index if exists public.trades_user_ticket_uidx;

-- 2) 同じ (利用者, ticket) の重複が残っていると索引を作れないので、
--    先に登録された1件だけ残す
delete from public.trades a
using public.trades b
where a.ticket is not null
  and a.ticket = b.ticket
  and a.user_id is not distinct from b.user_id
  and a.created_at > b.created_at;

-- 3) 条件なしの一意索引を作る
create unique index if not exists trades_user_ticket_uidx
  on public.trades (user_id, ticket);
