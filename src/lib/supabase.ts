import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 環境変数が設定されているか */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Supabase クライアント。未設定時は null（UI 側で設定案内を表示する）。
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // パスキー（顔認証・指紋・PIN）を使うための指定。
        // Supabase側では試験的機能の扱いのため、明示的に有効化する必要がある。
        experimental: { passkey: true },
      },
    } as never)
  : null

/** この端末がパスキーに対応しているか */
export function canUsePasskey(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    Boolean(supabase)
  )
}
