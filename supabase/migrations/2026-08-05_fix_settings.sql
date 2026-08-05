-- =============================================================
-- settings テーブルの修正 ＋ 初期設定で使う列の追加
--
-- 以前の移行SQLで、使わなくなった id 列を「必須」のまま残してしまい、
-- 原資や初期設定を保存できない状態になっていた。それを直す。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

-- 1) 初期設定で聞く項目の列を足す
alter table public.settings
  add column if not exists account_currency  text default 'JPY',
  add column if not exists lot_size          numeric default 100000,
  add column if not exists broker_utc_offset numeric default 4,
  add column if not exists main_symbol       text,
  add column if not exists onboarded_at      timestamptz;

-- 2) user_id が空の行があれば、最初に登録したアカウントに紐づける
do $$
declare me uuid;
begin
  select id into me from auth.users order by created_at asc limit 1;
  if me is not null then
    update public.settings set user_id = me where user_id is null;
  end if;
end $$;

-- 3) 使わなくなった id 列を外す（保存できなかった原因）
alter table public.settings drop column if exists id;

-- 4) 利用者ごとに1行であることを保証する
delete from public.settings where user_id is null;
alter table public.settings alter column user_id set not null;
create unique index if not exists settings_user_uidx on public.settings (user_id);
