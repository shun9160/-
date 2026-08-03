import { formatInTimeZone } from 'date-fns-tz'
import type { SessionKey } from './types'

// MT5 のスクショはドバイ時間 (UTC+4, 夏時間なし)。
// 元データの壁時計をこのオフセットで UTC 瞬間に正規化する。
export const SOURCE_UTC_OFFSET_HOURS = 4

// 記録・表示は日本時間で行う。
export const JST_TZ = 'Asia/Tokyo'

/**
 * MT5 の日時文字列 ("2026.08.03 16:20:05") を、ソースタイムゾーン(既定=ドバイ)の
 * 壁時計として解釈し、真の瞬間 (Date, 内部は UTC) を返す。
 */
export function parseMt5DateTime(
  raw: string | null | undefined,
  srcOffsetHours = SOURCE_UTC_OFFSET_HOURS,
): Date | null {
  if (!raw) return null
  const m = raw
    .trim()
    .match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const utcMs =
    Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0) - srcOffsetHours * 3600_000
  return new Date(utcMs)
}

/** Date/ISO を日本時間の書式で整形する */
export function fmtJst(value: Date | string | null | undefined, pattern = 'yyyy/MM/dd HH:mm'): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '—'
  return formatInTimeZone(d, JST_TZ, pattern)
}

/** 日本時間の日付キー (YYYY-MM-DD) */
export function jstDayKey(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return formatInTimeZone(d, JST_TZ, 'yyyy-MM-dd')
}

/** 日本時間の時 (0-23) */
export function jstHour(value: Date | string): number {
  const d = typeof value === 'string' ? new Date(value) : value
  return parseInt(formatInTimeZone(d, JST_TZ, 'H'), 10)
}

/** 日本時間の時間帯からマーケットセッションを判定する */
export function sessionOf(value: Date | string): SessionKey {
  const h = jstHour(value)
  if (h >= 7 && h < 15) return 'tokyo'
  if (h >= 15 && h < 21) return 'london'
  // 21:00〜翌6:59 を NY とする
  if (h >= 21 || h < 6) return 'ny'
  return 'other'
}

export const SESSION_LABELS: Record<SessionKey, string> = {
  tokyo: '東京 (07-15時)',
  london: 'ロンドン (15-21時)',
  ny: 'ニューヨーク (21-06時)',
  other: 'その他',
}
