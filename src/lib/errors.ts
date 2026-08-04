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
  if (/Failed to fetch|NetworkError/i.test(raw)) {
    return `${raw}\n\n→ ネットワークかSupabaseの設定(URL/キー)をご確認ください。`
  }
  return raw
}
