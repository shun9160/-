import { supabase } from './supabase'

/**
 * パスキー（顔認証・指紋・PIN）まわり。
 *
 * Supabase では試験的機能の扱いで、SDKの公開型に含まれていないため
 * ここで一箇所にまとめ、呼び出し側は型を意識しないで済むようにする。
 */

export interface PasskeyItem {
  id: string
  friendly_name?: string | null
  created_at?: string
  last_used_at?: string
}

interface PasskeyApi {
  registerPasskey?: () => Promise<{ error: unknown }>
  signInWithPasskey?: () => Promise<{ error: unknown }>
  passkey?: {
    list: () => Promise<{ data: PasskeyItem[] | null; error: unknown }>
    update: (p: { passkeyId: string; friendlyName: string }) => Promise<{ error: unknown }>
    delete: (p: { passkeyId: string }) => Promise<{ error: unknown }>
  }
}

function api(): PasskeyApi {
  if (!supabase) throw new Error('Supabase が未設定です')
  return supabase.auth as unknown as PasskeyApi
}

/** この環境でパスキーが使えるか（SDKの対応 + 端末の対応） */
export function passkeySupported(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.PublicKeyCredential === 'undefined') return false
  if (!supabase) return false
  const a = supabase.auth as unknown as PasskeyApi
  return typeof a.signInWithPasskey === 'function'
}

/** パスキーでログインする */
export async function signInWithPasskey(): Promise<void> {
  const a = api()
  if (!a.signInWithPasskey) throw new Error('この環境ではパスキーを利用できません')
  const { error } = await a.signInWithPasskey()
  if (error) throw error
}

/**
 * 今ログイン中のアカウントにパスキーを登録する。
 * 名前は登録後に付ける（登録の呼び出しは名前を受け取らないため）。
 */
export async function registerPasskey(friendlyName?: string): Promise<void> {
  const a = api()
  if (!a.registerPasskey) throw new Error('この環境ではパスキーを利用できません')
  const { error } = await a.registerPasskey()
  if (error) throw error

  if (friendlyName && a.passkey) {
    try {
      const { data } = await a.passkey.list()
      const newest = (data ?? [])
        .slice()
        .sort((x, y) => (y.created_at ?? '').localeCompare(x.created_at ?? ''))[0]
      if (newest) await a.passkey.update({ passkeyId: newest.id, friendlyName })
    } catch {
      // 名前を付けられなくても登録自体は成功しているので何もしない
    }
  }
}

/** 登録済みのパスキー一覧 */
export async function listPasskeys(): Promise<PasskeyItem[]> {
  const a = api()
  if (!a.passkey?.list) return []
  const { data, error } = await a.passkey.list()
  if (error) throw error
  return data ?? []
}

/** パスキーを削除する */
export async function deletePasskey(passkeyId: string): Promise<void> {
  const a = api()
  if (!a.passkey?.delete) throw new Error('この環境ではパスキーを利用できません')
  const { error } = await a.passkey.delete({ passkeyId })
  if (error) throw error
}

/** WebAuthn やサーバーのエラーを、次の一手が分かる日本語にする */
export function passkeyErrorMessage(e: unknown): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e)

  // サーバー側で機能が有効になっていない
  if (/experimental and disabled/i.test(msg))
    return 'アプリ側の設定が反映されていません。ページを再読み込みしてください。'
  if (/not enabled|disabled|unsupported|404|501|feature/i.test(msg) && /passkey|webauthn/i.test(msg))
    return (
      'Supabase側でパスキーが有効になっていません。\n' +
      'Supabase → Authentication → Passkeys で有効化し、' +
      'サイトのURLを許可リストに追加してください。'
    )

  // 端末・ブラウザ側
  if (/NotAllowedError|not allowed|abort|timed out/i.test(msg))
    return 'キャンセルされたか、時間切れになりました。もう一度お試しください。'
  if (/InvalidStateError|already registered|already exists/i.test(msg))
    return 'この端末のパスキーはすでに登録済みです。'
  if (/NotSupportedError|does not support|not supported/i.test(msg))
    return 'この端末・ブラウザではパスキーを利用できません。パスワードでログインしてください。'
  if (/SecurityError|origin|rpId|relying party/i.test(msg))
    return (
      'このURLではパスキーを使えません。\n' +
      'Supabase → Authentication → Passkeys の許可URL（origin）に、' +
      '今開いているサイトのURLが登録されているかご確認ください。'
    )
  if (/no.*credential|not found|no passkey/i.test(msg))
    return (
      'この端末に登録されたパスキーがありません。\n' +
      'まずパスワードでログインし、アカウント画面で「この端末のパスキーを登録」を押してください。'
    )
  if (/session missing|not authenticated/i.test(msg))
    return 'ログインが必要です。パスワードでログインしてからお試しください。'

  return msg
}
