-- =============================================================
-- 初期設定（オンボーディング）で聞く項目を保存できるようにする
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

alter table public.settings
  add column if not exists account_currency text default 'JPY',        -- 口座の通貨
  add column if not exists lot_size numeric default 100000,            -- 1ロットの通貨量
  -- MT5サーバーの時差(UTCから何時間か)。これまでドバイ(+4)固定だった部分。
  add column if not exists broker_utc_offset numeric default 4,
  add column if not exists main_symbol text,                           -- よく使う通貨ペア
  add column if not exists onboarded_at timestamptz;                   -- 初期設定を終えた日時
