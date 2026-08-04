-- =============================================================
-- ログイン認証とデータ分離
--
-- これを実行すると、データが「ログインした人ごと」に分かれます。
-- Supabase → SQL Editor に貼って Run してください（1回だけ）。
--
-- ★実行の前に：先にアプリでアカウント登録を済ませてください。
--   最後の「既存データの引き継ぎ」で、そのアカウントに紐づけます。
-- =============================================================

-- 1) 利用者の列を足す ------------------------------------------
alter table public.trades
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.day_notes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.settings
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 新しい行には自動でログイン中の利用者が入るようにする
alter table public.trades     alter column user_id set default auth.uid();
alter table public.day_notes  alter column user_id set default auth.uid();
alter table public.settings   alter column user_id set default auth.uid();

create index if not exists trades_user_idx    on public.trades (user_id);
create index if not exists day_notes_user_idx on public.day_notes (user_id);

-- 2) 同じ取引番号でも「別の人なら別データ」にする ----------------
-- 以前は ticket 単体で重複禁止だったが、利用者ごとに分ける
alter table public.trades drop constraint if exists trades_ticket_key;
create unique index if not exists trades_user_ticket_uidx
  on public.trades (user_id, ticket) where ticket is not null;

-- 3) 日記は「利用者 × 日付」で1件にする -------------------------
alter table public.day_notes drop constraint if exists day_notes_pkey;
alter table public.day_notes add column if not exists id uuid default gen_random_uuid();
update public.day_notes set id = gen_random_uuid() where id is null;
alter table public.day_notes alter column id set not null;
alter table public.day_notes add primary key (id);
create unique index if not exists day_notes_user_day_uidx
  on public.day_notes (user_id, day);

-- 4) 設定(原資)は利用者ごとに1行 --------------------------------
alter table public.settings drop constraint if exists settings_singleton;
alter table public.settings drop constraint if exists settings_pkey;
alter table public.settings alter column id drop default;
-- 既存の1行を残したまま、利用者ごとの一意制約に切り替える
create unique index if not exists settings_user_uidx on public.settings (user_id);

-- 5) アクセス制限を「自分の行だけ」に張り替える ------------------
alter table public.trades    enable row level security;
alter table public.day_notes enable row level security;
alter table public.settings  enable row level security;

drop policy if exists "anon full access trades"     on public.trades;
drop policy if exists "anon full access day_notes"  on public.day_notes;
drop policy if exists "anon full access settings"   on public.settings;

drop policy if exists "own trades" on public.trades;
create policy "own trades" on public.trades
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own day_notes" on public.day_notes;
create policy "own day_notes" on public.day_notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 6) 連携コード（MT5のEAなど、外部から書き込むための鍵） ---------
create table if not exists public.ingest_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text,
  created_at  timestamptz default now(),
  last_used_at timestamptz
);
create index if not exists ingest_tokens_user_idx on public.ingest_tokens (user_id);

alter table public.ingest_tokens enable row level security;

-- 本人だけが自分のコードを読める（作成・削除も本人のみ）
drop policy if exists "own tokens" on public.ingest_tokens;
create policy "own tokens" on public.ingest_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================================
-- 7) 既存データの引き継ぎ
--
-- これまでに貯めた取引・日記・原資を、あなたのアカウントに紐づけます。
-- ★アプリでアカウント登録を済ませてから実行してください。
-- （利用者が1人だけの前提。最初に登録されたアカウントに割り当てます）
-- =============================================================
do $$
declare
  me uuid;
begin
  select id into me from auth.users order by created_at asc limit 1;

  if me is null then
    raise notice '登録済みのアカウントが見つかりません。先にアプリで登録してから、この部分だけ再実行してください。';
  else
    update public.trades    set user_id = me where user_id is null;
    update public.day_notes set user_id = me where user_id is null;
    update public.settings  set user_id = me where user_id is null;
    raise notice '既存データを % に引き継ぎました。', me;
  end if;
end $$;
