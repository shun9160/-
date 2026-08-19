-- =============================================================
-- 課金（プランとクレジット）
--
-- 3段にする:
--   無料           … 読み返せるのは直近30日ぶん。画像は50枚まで
--   スタンダード   … 月980円。全期間。画像は1,000枚まで
--   クレジット追加 … 画像の枠を買い足す（500枚ぶん）
--
-- いちばん大事なこと:
--   プランの行は、本人には**書けない**。読むだけ。
--   書けるのは Stripe からの通知を受ける Netlify Function だけ。
--   ここを本人に書かせると、開発者ツールから
--   plan を 'pro' にするだけで有料機能が使えてしまう。
--
--   そして「直近30日しか読めない」も、画面ではなくここで止める。
--   画面側の出し分けは飾りで、本当の壁はこの RLS。
--
-- Supabase → SQL Editor に貼り付けて Run してください。
-- 何度実行しても壊れません。
-- =============================================================


-- -------------------------------------------------------------
-- 1) 契約の状態
--
-- 1人1行。Stripe 側の番号もここに控える。
-- 行が無い人は「無料」として扱う（作らなくても動く）。
-- -------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  -- 'free' か 'pro'
  plan                   text not null default 'free' check (plan in ('free', 'pro')),
  -- Stripe 側の状態をそのまま控える（active / past_due / canceled など）
  status                 text not null default 'active',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- ここまで有効。過ぎたら無料に戻る
  current_period_end     timestamptz,
  -- 期末で解約する予定か
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

comment on table public.subscriptions is
  '契約の状態。本人は読むだけ。書けるのは Stripe の通知を受けるサーバーだけ';


-- -------------------------------------------------------------
-- 2) 買い足したクレジット
--
-- 1回の支払いで1行。減らさず積む形にしてある。
-- 「いくら買って、いつ増えたか」が後から全部たどれる。
-- 合計を1つの数で持つと、二重に足したときに元に戻せない。
--
-- stripe_event_id を一意にしてあるので、
-- 同じ通知が2回届いても2回ぶん増えない（Stripe は再送してくる）。
-- -------------------------------------------------------------
create table if not exists public.credit_grants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- 何の枠か。いまは画像だけ。あとで種類が増えても表を分けずに済む
  kind            text not null default 'image',
  -- 増える量（画像なら枚数）
  amount          integer not null check (amount > 0),
  -- 払った額（円）。あとで問い合わせが来たときに突き合わせる
  yen             integer,
  -- 同じ通知で二重に増やさないための鍵
  stripe_event_id text unique,
  created_at      timestamptz not null default now()
);

create index if not exists credit_grants_user_idx
  on public.credit_grants (user_id, kind);


-- -------------------------------------------------------------
-- 3) 権限
--
-- 読むのは本人だけ。書き込みは誰にも許さない。
-- service_role キー（サーバーだけが持つ）は RLS を通らないので、
-- Stripe の通知を受ける Function からは書ける。
-- -------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.credit_grants enable row level security;

drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "read own credits" on public.credit_grants;
create policy "read own credits" on public.credit_grants
  for select to authenticated
  using (user_id = auth.uid());

-- insert / update / delete の policy は作らない。
-- RLS が有効な表は、policy が無い操作は誰にもできない。


-- -------------------------------------------------------------
-- 4) 判定に使う関数
--
-- security definer にしてあるので、RLS を通らずに読める。
-- これが無いと、subscriptions を読む → その policy がまた
-- subscriptions を読む、で堂々巡りになる。
--
-- search_path を固定するのは、同じ名前の表を別スキーマに置いて
-- 判定をすり替える手口を防ぐため（security definer の定石）。
--
-- どれも「自分のこと以外は答えない」ようにしてある。
-- security definer は RLS を通らないので、そのままだと
-- 他人のIDを渡して「あの人は有料か」を調べられてしまう。
--   uid = auth.uid()   … 本人が自分のことを聞いている
--   auth.uid() is null … サーバー（service_role）が聞いている
-- のどちらかのときだけ答える。RLS の中から呼ぶときは
-- 必ず auth.uid() を渡すので、この条件で困ることはない。
-- -------------------------------------------------------------

-- いま有料か。期限切れは無料として扱う
create or replace function public.is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
     where s.user_id = uid
       and (uid = auth.uid() or auth.uid() is null)
       and s.plan = 'pro'
       and s.status in ('active', 'trialing')
       -- 期限が入っていない（作りかけ）ものは有効とみなさない
       and s.current_period_end is not null
       and s.current_period_end > now()
  )
$$;

comment on function public.is_pro is
  '有料プランが有効か。期限切れ・支払い失敗は無料として扱う';

-- 買い足した枠の合計
create or replace function public.credit_total(uid uuid, k text default 'image')
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::int
    from public.credit_grants
   where user_id = uid
     and kind = k
     and (uid = auth.uid() or auth.uid() is null)
$$;

-- 置ける画像の上限（プランのぶん＋買い足したぶん）
create or replace function public.image_limit(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (case when public.is_pro(uid) then 1000 else 50 end) + public.credit_total(uid, 'image')
$$;

-- いま置いてある画像の枚数。
-- 取引の添付も日記のチャートも、置き場所は同じ（trade-images）なので
-- ここを数えれば、実際に使っている容量とずれない
create or replace function public.image_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public, storage
as $$
  select count(*)::int
    from storage.objects
   where bucket_id = 'trade-images'
     and (storage.foldername(name))[1] = uid::text
     and (uid = auth.uid() or auth.uid() is null)
$$;


-- -------------------------------------------------------------
-- 4-b) 画面が読むための1本
--
-- 画面はこれだけを呼ぶ。引数が無いので、他人のことは聞けない。
-- 1回のやり取りで、プラン・期限・枠・使用量がそろう。
-- 別々に問い合わせると、途中の状態（プランだけ新しい）が映る。
-- -------------------------------------------------------------
create or replace function public.my_plan()
returns table (
  plan                 text,
  status               text,
  current_period_end   timestamptz,
  cancel_at_period_end boolean,
  extra_images         integer,
  used_images          integer,
  max_images           integer
)
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    case when public.is_pro(auth.uid()) then 'pro' else 'free' end,
    coalesce(s.status, 'active'),
    s.current_period_end,
    coalesce(s.cancel_at_period_end, false),
    public.credit_total(auth.uid(), 'image'),
    public.image_count(auth.uid()),
    public.image_limit(auth.uid())
  from (select 1) as one
  left join public.subscriptions s on s.user_id = auth.uid()
$$;

comment on function public.my_plan is
  '画面に出すためのプラン一式。自分のぶんしか返さない';


-- -------------------------------------------------------------
-- 5) 直近30日の壁
--
-- 無料プランは、31日より前の記録が「読めなく」なる。消えはしない。
-- 有料にすれば、その場で全部戻ってくる。
--
-- select だけを止めている。書くのはいつでもできる。
-- 書けなくすると、無料の人は今日の記録すら残せなくなり、
-- 「使ってみる」ができないため。
--
-- 更新と削除も using を通るので、読めない日の行は触れない。
-- 見えていないものを消せてしまうほうが危ない。
-- -------------------------------------------------------------

drop policy if exists "own trades" on public.trades;
create policy "own trades" on public.trades
  for all to authenticated
  using (
    user_id = auth.uid()
    and (public.is_pro(auth.uid()) or open_time >= now() - interval '30 days')
  )
  with check (user_id = auth.uid());

drop policy if exists "own day_notes" on public.day_notes;
create policy "own day_notes" on public.day_notes
  for all to authenticated
  using (
    user_id = auth.uid()
    and (public.is_pro(auth.uid()) or day >= (current_date - 30))
  )
  with check (user_id = auth.uid());

-- 取引に貼った画像は、その取引が読めるときだけ読める。
-- 取引が隠れているのに画像だけ見えるのは、ちぐはぐなので
drop policy if exists "own trade_images" on public.trade_images;
create policy "own trade_images" on public.trade_images
  for all to authenticated
  using (
    user_id = auth.uid()
    and (
      public.is_pro(auth.uid())
      or exists (
        select 1 from public.trades t
         where t.id = trade_id
           and t.open_time >= now() - interval '30 days'
      )
    )
  )
  with check (user_id = auth.uid());


-- -------------------------------------------------------------
-- 6) 画像の枚数の上限
--
-- 置き場所（Storage）側で止める。
-- 表の側だけで数えると、日記のチャートは day_notes.photos の中にあって
-- 数に入らず、上限をすり抜ける。
--
-- 読み・更新・消すはこれまでどおり。増やすときだけ数を見る。
-- -------------------------------------------------------------
drop policy if exists "own trade-images insert" on storage.objects;
create policy "own trade-images insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trade-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.image_count(auth.uid()) < public.image_limit(auth.uid())
  );


-- -------------------------------------------------------------
-- 7) 確認
--
-- 流し終わったら、これを実行してください。
-- 自分のぶんの状態が1行で出ます。
-- -------------------------------------------------------------
select
  coalesce((select plan from public.subscriptions where user_id = auth.uid()), 'free') as "プラン",
  public.is_pro(auth.uid())                                                            as "有料か",
  public.image_count(auth.uid())                                                       as "使っている枚数",
  public.image_limit(auth.uid())                                                       as "置ける枚数",
  public.credit_total(auth.uid(), 'image')                                             as "買い足した枚数";
