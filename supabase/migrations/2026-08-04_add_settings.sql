-- 原資（元本）を保存する設定テーブル。
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。

create table if not exists public.settings (
  id                 smallint primary key default 1,
  initial_capital    numeric default 0,      -- 原資（円）
  capital_note       text,                   -- 入金日などのメモ
  capital_screenshot text,                   -- 証拠のスクショ (縮小した data URL)
  updated_at         timestamptz default now(),
  constraint settings_singleton check (id = 1)
);

alter table public.settings enable row level security;

drop policy if exists "anon full access settings" on public.settings;
create policy "anon full access settings" on public.settings
  for all to anon using (true) with check (true);
