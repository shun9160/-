/**
 * Supabase のエラーは Error インスタンスではなくプレーンオブジェクト
 * ({ message, details, hint, code }) で返るため、そのまま String() すると
 * "[object Object]" になってしまう。人が読める文言に整形する。
 */
export function errText(e: unknown): string {
  if (e == null) return '不明なエラー'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message

  if (typeof e === 'object') {
    const o = e as Record<string, unknown>
    const parts = [o.message, o.details, o.hint]
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    const code = typeof o.code === 'string' ? ` (${o.code})` : ''
    if (parts.length) return parts.join(' / ') + code

    try {
      return JSON.stringify(e)
    } catch {
      return '不明なエラー'
    }
  }
  return String(e)
}

/**
 * よくあるエラーに、次の一手が分かる補足を添える。
 */
export function friendlyError(e: unknown): string {
  const raw = errText(e)
  if (/screenshot/i.test(raw) && /column|schema cache/i.test(raw)) {
    return `${raw}\n\n→ スクショ保存用の列がまだありません。Supabase の SQL Editor で次を実行してください:\nalter table public.trades add column if not exists screenshot text;`
  }
  if (/user_id/i.test(raw) && /column|schema cache|does not exist/i.test(raw)) {
    return `${raw}\n\n→ 利用者ごとにデータを分ける列がまだありません。Supabase の SQL Editor で supabase/migrations/2026-08-05_multi_user.sql を実行してください。`
  }
  if (
    /accounts|account_id/i.test(raw) &&
    /relation|column|does not exist|schema cache/i.test(raw)
  ) {
    return `${raw}\n\n→ 口座の表がまだありません。Supabase の SQL Editor で supabase/migrations/2026-08-06_accounts.sql を実行してください。`
  }
  if (/trade_images/i.test(raw) && /relation|does not exist|schema cache/i.test(raw)) {
    return `${raw}\n\n→ チャート画像を保存する表がまだありません。Supabase の SQL Editor で supabase/migrations/2026-08-06_trade_images.sql を実行してください。`
  }
  if (/day_notes/i.test(raw) && /relation|does not exist|schema cache/i.test(raw)) {
    return `${raw}\n\n→ 日記を保存する表がまだありません。Supabase の SQL Editor で supabase/schema.sql を実行してください。`
  }
  if (/column "id"/i.test(raw) && /settings/i.test(raw)) {
    return `${raw}\n\n→ settings テーブルに古い id 列が残っています。Supabase の SQL Editor で supabase/migrations/2026-08-05_fix_settings.sql を実行してください。`
  }
  if (
    /(account_currency|lot_size|broker_utc_offset|onboarded_at|main_symbol)/i.test(raw) &&
    /column|schema cache/i.test(raw)
  ) {
    return `${raw}\n\n→ 初期設定用の列がまだありません。Supabase の SQL Editor で supabase/migrations/2026-08-05_fix_settings.sql を実行してください。`
  }
  if (/settings/i.test(raw) && /relation|table|schema cache|does not exist/i.test(raw)) {
    return `${raw}\n\n→ 原資を保存する表がまだありません。Supabase の SQL Editor で supabase/migrations/2026-08-05_fix_settings.sql を実行してください。`
  }
  if (/Failed to fetch|NetworkError/i.test(raw)) {
    return `${raw}\n\n→ ネットワークかSupabaseの設定(URL/キー)をご確認ください。`
  }
  return raw
}
