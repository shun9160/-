-- =============================================================
-- トレーダータイプ診断の保存先を作る
--
-- 診断は「そのときの結果」を残していくもの。
-- 過去の結果は書き換えず、毎回あたらしい行として積む。
-- そのため、あとから変わる「改善アクションの完了」だけは別の表に分けてある。
--
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
-- =============================================================

-- 診断の履歴 -------------------------------------------------
create table if not exists public.trader_diagnoses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- どの口座の記録で診断したか。すべての口座なら null
  account_id        uuid references public.accounts(id) on delete set null,

  -- 採点に使った版。あとから採点方法を変えても、当時の結果を読み解けるようにする
  diagnosis_version text not null,
  question_version  text not null,
  scoring_version   text not null,

  status            text not null,   -- questionnaire_only / provisional / data_backed
  primary_type      text not null,   -- BLAZE / LOGIC / GUARD / SHIFT / WATCH / RISE
  secondary_type    text,
  confidence        int  not null,
  trade_count       int  not null default 0,

  -- 一覧や比較で使うぶんだけ取り出しておく
  scores            jsonb not null,
  -- 結果まるごと（根拠・強み・注意点・キャラクターなど）
  result            jsonb not null,
  -- そのときの回答。再診断で使い回す
  answers           jsonb not null,

  created_at        timestamptz not null default now()
);

create index if not exists trader_diagnoses_user_idx
  on public.trader_diagnoses (user_id, created_at desc);

alter table public.trader_diagnoses enable row level security;

-- 自分の診断だけ見える。
-- 書き込みはサーバー側（service_role）が行うので、ここでは読み取りだけ許す。
-- これにより、点数を作って直接書き込むことはできない。
drop policy if exists "read own trader_diagnoses" on public.trader_diagnoses;
create policy "read own trader_diagnoses" on public.trader_diagnoses
  for select
  using (auth.uid() = user_id);

-- 履歴は書き換えない。更新と削除をDB側で止める。
create or replace function public.trader_diagnoses_no_update()
returns trigger
language plpgsql
as $$
begin
  raise exception '診断の履歴は変更できません';
end;
$$;

drop trigger if exists trader_diagnoses_immutable on public.trader_diagnoses;
create trigger trader_diagnoses_immutable
  before update on public.trader_diagnoses
  for each row execute function public.trader_diagnoses_no_update();


-- 改善アクションの完了 ---------------------------------------
create table if not exists public.trader_diagnosis_actions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  diagnosis_id uuid not null references public.trader_diagnoses(id) on delete cascade,
  -- 診断結果の recommendedActions[].id
  action_id    text not null,
  completed    boolean not null default true,
  completed_at timestamptz default now()
);

-- 同じ診断の同じアクションは1行だけ
create unique index if not exists trader_diagnosis_actions_uniq
  on public.trader_diagnosis_actions (diagnosis_id, action_id);

create index if not exists trader_diagnosis_actions_user_idx
  on public.trader_diagnosis_actions (user_id);

alter table public.trader_diagnosis_actions enable row level security;

drop policy if exists "own trader_diagnosis_actions" on public.trader_diagnosis_actions;
create policy "own trader_diagnosis_actions" on public.trader_diagnosis_actions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
