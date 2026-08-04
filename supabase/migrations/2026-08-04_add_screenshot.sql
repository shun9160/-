-- 既存DB向けマイグレーション: trades にスクショ添付列を追加
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
alter table public.trades add column if not exists screenshot text;
