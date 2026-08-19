import type { Config, Context } from '@netlify/functions'
import { CREDIT_PACK } from '../../src/lib/plan'

/**
 * Stripe からの通知を受けて、プランとクレジットを書き換える。
 *
 * プランの行を書けるのは、この関数だけ。
 * 画面（ログイン中の本人）には書き込みの権限を与えていないので、
 * 開発者ツールから plan を 'pro' にする、はできない。
 *
 * ここで必ずやること:
 *  1) 署名を確かめる。確かめないと、この住所を知っている人が
 *     「支払いました」という嘘の通知を送るだけで有料になる
 *  2) 同じ通知が2回来ても2回ぶん増やさない。Stripe は再送してくる
 *
 * 必要な環境変数（Netlify のサイト設定で登録。VITE_ は付けないこと）:
 *   SUPABASE_URL              … Project URL
 *   SUPABASE_SERVICE_ROLE_KEY … service_role キー
 *   STRIPE_WEBHOOK_SECRET     … whsec_…（Stripe の webhook 設定画面で出る）
 */

/** 署名の有効時間。古い通知の使い回しを防ぐ */
const TOLERANCE_SEC = 60 * 5

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return json({ error: '使い方が違います' }, 405)

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!url || !serviceKey || !secret) return json({ error: 'not configured' }, 503)

  // 署名は「受け取ったそのままの文字」に対して計算されている。
  // 一度 JSON にして戻すと空白が変わって、必ず一致しなくなる
  const raw = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  if (!(await verify(raw, sig, secret))) {
    return json({ error: 'bad signature' }, 400)
  }

  let event: StripeEvent
  try {
    event = JSON.parse(raw) as StripeEvent
  } catch {
    return json({ error: 'bad body' }, 400)
  }

  const rest = `${url.replace(/\/$/, '')}/rest/v1`
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    await handle(event, rest, headers)
  } catch (e) {
    // 500 を返すと Stripe が再送してくれる。取りこぼすより再送のほうがよい
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
  return json({ received: true })
}

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

async function handle(
  event: StripeEvent,
  rest: string,
  headers: Record<string, string>,
): Promise<void> {
  const o = event.data.object

  switch (event.type) {
    // 1回きりの支払い（画像の枠）が終わった
    case 'checkout.session.completed': {
      const meta = (o.metadata ?? {}) as Record<string, string>
      if (o.mode !== 'payment' || meta.kind !== 'credit') return
      const userId = meta.user_id
      if (!userId) return

      // 増やす量はここで決める。通知の中身は当てにしない。
      // 金額や数量を通知から読むと、細工された通知で好きなだけ増やせる
      await post(`${rest}/credit_grants?on_conflict=stripe_event_id`, headers, [
        {
          user_id: userId,
          kind: 'image',
          amount: CREDIT_PACK.images,
          yen: CREDIT_PACK.yen,
          // 同じ通知が2回来ても、ここが重なって2行目は入らない
          stripe_event_id: event.id,
        },
      ])
      return
    }

    // 月額プランの状態が変わった（入った・更新された・解約された）
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const meta = (o.metadata ?? {}) as Record<string, string>
      const customerId = String(o.customer ?? '')
      const userId = meta.user_id || (await userOfCustomer(rest, headers, customerId))
      if (!userId) return

      const status = String(o.status ?? '')
      // 解約された、支払いが止まった、などは無料に戻す。
      // plan と status の両方を見ないと、期限切れの行が残って有料のままになる
      const active = status === 'active' || status === 'trialing'
      await post(`${rest}/subscriptions?on_conflict=user_id`, headers, [
        {
          user_id: userId,
          plan: event.type === 'customer.subscription.deleted' || !active ? 'free' : 'pro',
          status: event.type === 'customer.subscription.deleted' ? 'canceled' : status,
          stripe_customer_id: customerId || null,
          stripe_subscription_id: String(o.id ?? '') || null,
          current_period_end: unixToIso(o.current_period_end),
          cancel_at_period_end: !!o.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
      ])
      return
    }

    default:
      // 知らない通知は黙って受け取る。200 を返さないと Stripe が再送し続ける
      return
  }
}

/** その Stripe のお客様番号が、誰のものか */
async function userOfCustomer(
  rest: string,
  headers: Record<string, string>,
  customerId: string,
): Promise<string | null> {
  if (!customerId) return null
  const res = await fetch(
    `${rest}/subscriptions?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=user_id`,
    { headers },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as { user_id: string }[]
  return rows[0]?.user_id ?? null
}

async function post(
  url: string,
  headers: Record<string, string>,
  rows: unknown[],
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`db ${res.status}: ${await res.text()}`)
}

function unixToIso(v: unknown): string | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null
}

/**
 * Stripe の署名を確かめる。
 *
 * ヘッダは "t=1614556800,v1=abc...,v1=def..." の形。
 * 「t.本文」を秘密鍵で計算した値が、どれかの v1 と一致すればよい。
 * 鍵の入れ替え中は v1 が2つ入るので、1つでも合えば通す。
 */
async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = new Map<string, string[]>()
  for (const kv of header.split(',')) {
    const i = kv.indexOf('=')
    if (i < 0) continue
    const k = kv.slice(0, i).trim()
    const v = kv.slice(i + 1).trim()
    parts.set(k, [...(parts.get(k) ?? []), v])
  }

  const t = parts.get('t')?.[0]
  const v1 = parts.get('v1') ?? []
  if (!t || v1.length === 0) return false

  // 古い通知の使い回しを防ぐ
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t))
  if (!Number.isFinite(age) || age > TOLERANCE_SEC) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`))
  const want = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')

  return v1.some((got) => timingSafeEqual(got, want))
}

/**
 * 文字列の比較。
 * 先頭から順に比べて途中で抜けると、返ってくるまでの時間から
 * 正しい値を1文字ずつ推測できてしまうので、必ず最後まで比べる
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config: Config = {
  path: '/api/stripe-webhook',
}
