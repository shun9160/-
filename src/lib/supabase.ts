import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 環境変数が設定されているか */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Supabase クライアント。未設定時は null（UI 側で設定案内を表示する）。
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null
