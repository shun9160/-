import type { Config, Context } from '@netlify/functions'

/**
 * 支払い画面への入口を作る。
 *
 * 画面からは「どれを買うか」の合言葉しか受け取らない。
 * 値段も商品も、ここ（サーバー）で決める。
 * 金額を画面から受け取ると、書き換えて送られたときに
 * そのままの額で決済が通ってしまう。
 *
 * 誰が買うかは、Supabase のアクセストークンから決める。
 * 画面から利用者IDを受け取ってはいけない。他人のIDを書けば、
 * 他人のプランを買える（あるいは自分の支払いを他人に付けられる）。
 *
 * 必要な環境変数（Netlify のサイト設定で登録。VITE_ は付けないこと）:
 *   SUPABASE_URL              … Project URL
 *   SUPABASE_SERVICE_ROLE_KEY … service_role キー（絶対に画面に出さない）
 *   SUPABASE_ANON_KEY         … anon キー（省略可。トークン確認に使う）
 *   STRIPE_SECRET_KEY         … sk_live_… / sk_test_…
 *   STRIPE_PRICE_PRO          … 月額プランの price_…（継続課金）
 *   STRIPE_PRICE_CREDIT       … 画像の枠の price_…（1回きり）
 */

type Kind = 'pro' | 'credit' | 'portal'

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))
  if (req.method !== 'POST') return cors(json({ error: '使い方が違います' }, 405))

  const env = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
    stripeKey: process.env.STRIPE_SECRET_KEY,
    pricePro: process.env.STRIPE_PRICE_PRO,
    priceCredit: process.env.STRIPE_PRICE_CREDIT,
  }
  if (!env.supabaseUrl || !env.serviceKey || !env.stripeKey) {
    return cors(json({ error: 'お支払いの準備がまだ整っていません' }, 503))
  }

  let body: { kind?: string; returnUrl?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return cors(json({ error: '受け取れませんでした' }, 400))
  }

  const kind = body.kind as Kind
  if (kind !== 'pro' && kind !== 'credit' && kind !== 'portal') {
    return cors(json({ error: '何を買うのかが分かりません' }, 400))
  }

  // 戻り先。外のサイトへ飛ばされないよう、必ず自分のところに限る
  const origin = new URL(req.url).origin
  const returnUrl = safeReturn(body.returnUrl, origin)

  // 本人確認
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const user = await getUser(env.supabaseUrl, env.anonKey ?? env.serviceKey, token)
  if (!user) return cors(json({ error: 'ログインが切れています。入り直してください' }, 401))

  const stripe = stripeClient(env.stripeKey)
  const rest = `${env.supabaseUrl.replace(/\/$/, '')}/rest/v1`
  const dbHeaders = {
    apikey: env.serviceKey,
    Authorization: `Bearer ${env.serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    // Stripe 側のお客様番号。無ければ作って控える。
    // 作り直すと、同じ人が2人ぶんに分かれて履歴が追えなくなる
    let customerId = await loadCustomerId(rest, dbHeaders, user.id)
    if (!customerId) {
      const customer = await stripe('/v1/customers', {
        email: user.email ?? '',
        'metadata[user_id]': user.id,
      })
      customerId = customer.id as string
      await saveCustomerId(rest, dbHeaders, user.id, customerId)
    }

    if (kind === 'portal') {
      const portal = await stripe('/v1/billing_portal/sessions', {
        customer: customerId,
        return_url: returnUrl,
      })
      return cors(json({ url: portal.url }))
    }

    const price = kind === 'pro' ? env.pricePro : env.priceCredit
    if (!price) return cors(json({ error: 'この商品の準備がまだ整っていません' }, 503))

    const session = await stripe('/v1/checkout/sessions', {
      mode: kind === 'pro' ? 'subscription' : 'payment',
      customer: customerId,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}paid=1`,
      cancel_url: returnUrl,
      // 誰の・何の支払いかを Stripe 側にも残す。
      // 通知（webhook）を受けたとき、これを見て誰の枠を増やすか決める
      'metadata[user_id]': user.id,
      'metadata[kind]': kind,
      ...(kind === 'pro'
        ? { 'subscription_data[metadata][user_id]': user.id }
        : { 'payment_intent_data[metadata][user_id]': user.id }),
    })
    return cors(json({ url: session.url }))
  } catch (e) {
    return cors(json({ error: message(e) }, 502))
  }
}

/** アクセストークンから、その人を確かめる */
async function getUser(
  supabaseUrl: string,
  key: string,
  token: string,
): Promise<{ id: string; email?: string } | null> {
  if (!token) return null
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const u = (await res.json()) as { id?: string; email?: string }
  return u?.id ? { id: u.id, email: u.email } : null
}

async function loadCustomerId(
  rest: string,
  headers: Record<string, string>,
  userId: string,
): Promise<string | null> {
  const res = await fetch(
    `${rest}/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=stripe_customer_id`,
    { headers },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as { stripe_customer_id: string | null }[]
  return rows[0]?.stripe_customer_id ?? null
}

async function saveCustomerId(
  rest: string,
  headers: Record<string, string>,
  userId: string,
  customerId: string,
): Promise<void> {
  await fetch(`${rest}/subscriptions?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ user_id: userId, stripe_customer_id: customerId }]),
  })
}

/** Stripe を叩く小さな道具。SDK を足さずに済ませている */
function stripeClient(secret: string) {
  return async (path: string, form: Record<string, string>) => {
    const res = await fetch(`https://api.stripe.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
    })
    const data = (await res.json()) as Record<string, unknown> & {
      error?: { message?: string }
    }
    if (!res.ok) throw new Error(data.error?.message ?? 'Stripe でエラーが起きました')
    return data
  }
}

/**
 * 戻り先を、自分のサイトの中だけに限る。
 * ここを素通りさせると、支払いのあとに知らない場所へ飛ばせてしまう
 */
function safeReturn(raw: string | undefined, origin: string): string {
  if (!raw) return origin
  try {
    const u = new URL(raw, origin)
    return u.origin === origin ? u.toString() : origin
  } catch {
    return origin
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'お支払いの準備に失敗しました'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cors(res: Response) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Headers', 'authorization,content-type')
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS')
  return res
}

export const config: Config = {
  path: '/api/checkout',
}
