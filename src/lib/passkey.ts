import { supabase } from './supabase'

/**
 * パスキー（顔認証・指紋・PIN）まわり。
 *
 * Supabase では試験的機能のため、SDKの型に含まれていない。
 * ここで一箇所にまとめ、呼び出し側は型を意識しないで済むようにする。
 */

interface PasskeyApi {
  registerPasskey?: (opts?: { friendlyName?: string }) => Promise<{ error: unknown }>
  signInWithPasskey?: () => Promise<{ error: unknown }>
  passkey?: {
    list: () => Promise<{ data: unknown; error: unknown }>
    delete: (args: { id: string }) => Promise<{ error: unknown }>
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

/** 今ログイン中のアカウントにパスキーを登録する */
export async function registerPasskey(friendlyName?: string): Promise<void> {
  const a = api()
  if (!a.registerPasskey) throw new Error('この環境ではパスキーを利用できません')
  const { error } = await a.registerPasskey(friendlyName ? { friendlyName } : undefined)
  if (error) throw error
}

export interface PasskeyItem {
  id: string
  friendly_name?: string | null
  created_at?: string
}

/** 登録済みのパスキー一覧 */
export async function listPasskeys(): Promise<PasskeyItem[]> {
  const a = api()
  if (!a.passkey?.list) return []
  const { data, error } = await a.passkey.list()
  if (error) throw error
  const rows = (data as { passkeys?: PasskeyItem[] } | PasskeyItem[] | null) ?? []
  return Array.isArray(rows) ? rows : (rows.passkeys ?? [])
}

/** パスキーを削除する */
export async function deletePasskey(id: string): Promise<void> {
  const a = api()
  if (!a.passkey?.delete) throw new Error('この環境ではパスキーを利用できません')
  const { error } = await a.passkey.delete({ id })
  if (error) throw error
}

/** ブラウザが返す WebAuthn のエラーを、日本語の案内にする */
export function passkeyErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/NotAllowedError|not allowed|abort/i.test(msg))
    return 'キャンセルされました。もう一度お試しください'
  if (/InvalidStateError|already registered/i.test(msg))
    return 'この端末のパスキーはすでに登録済みです'
  if (/NotSupportedError|not supported/i.test(msg))
    return 'この端末ではパスキーを利用できません'
  if (/SecurityError/i.test(msg))
    return 'このURLではパスキーを利用できません（サイトの設定をご確認ください）'
  if (/no.*credential|not found/i.test(msg))
    return 'この端末に登録されたパスキーが見つかりません。パスワードでログインしてください'
  return msg
}
