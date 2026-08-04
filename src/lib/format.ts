/** 数値整形ユーティリティ */

/**
 * 金額。損益は色だけで判断させないため、既定で符号を必ず付ける。
 * (色覚多様性への配慮 — 赤緑が判別しづらい人にも正負が伝わる)
 */
export function fmtMoney(n: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(n).toLocaleString('ja-JP', {
    maximumFractionDigits: 2,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  })
  if (opts.sign) {
    const s = n > 0 ? '+' : n < 0 ? '−' : '±'
    return `${s}${abs}`
  }
  return n < 0 ? `−${abs}` : abs
}

/** マイナス記号を全角相当の U+2212 に揃える（金額表示と見た目を統一） */
const minus = (s: string) => s.replace(/^-/, '−')

export function fmtPct(ratio: number | null, digits = 1): string {
  if (ratio == null || !isFinite(ratio)) return '—'
  return minus(`${(ratio * 100).toFixed(digits)}%`)
}

export function fmtNum(n: number | null, digits = 2): string {
  if (n == null || !isFinite(n)) return '—'
  return minus(n.toFixed(digits))
}

export function fmtRR(n: number | null): string {
  if (n == null || !isFinite(n)) return '—'
  return `1 : ${n.toFixed(2)}`
}

/** 損益に応じた文字色 */
export function colorOf(n: number): string {
  return n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-ink3'
}

/** チャート用の色 (tailwind の up/down と揃える) */
export const CHART = {
  brand: '#6D4AFF',
  up: '#16A34A',
  down: '#B42318',
  grid: '#EDEDF3',
  axis: '#9C9BAA',
} as const
