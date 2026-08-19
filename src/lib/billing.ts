import { supabase } from './supabase'

/**
 * 支払い画面への入口。
 *
 * ここでやるのは「行き先のURLをサーバーに作ってもらう」だけ。
 * 値段も、何を買うかも、サーバー側で決める。
 *
 * 画面から金額を送ると、開発者ツールで 980 を 1 に書き換えて
 * 送られたときに、そのまま1円で決済が通ってしまう。
 * だからここが送るのは「どれを買うか」の合言葉だけにしてある。
 */

export type CheckoutKind =
  /** 月額プランに入る */
  | 'pro'
  /** 画像の枠を買い足す（1回きり） */
  | 'credit'
  /** 支払い方法の変更・解約（Stripe の管理画面へ） */
  | 'portal'

const ENDPOINT = '/api/checkout'

export async function startCheckout(kind: CheckoutKind, returnUrl: string): Promise<string> {
  if (!supabase) throw new Error('Supabaseに接続できていません')

  // 本人確認はアクセストークンで行う。利用者IDは送らない。
  // 送らせると、他人のIDを書いて他人のプランを買える（あるいは付け替えられる）
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('ログインが切れています。入り直してください')

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ kind, returnUrl }),
  })

  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? '支払い画面をひらけませんでした')
  }
  return body.url
}
