/** 数値整形ユーティリティ */

export function fmtMoney(n: number, opts: { sign?: boolean } = {}): string {
  const s = Math.abs(n).toLocaleString('ja-JP', {
    maximumFractionDigits: 2,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  })
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  if (opts.sign) return `${sign}${s}`
  return n < 0 ? `-${s}` : s
}

export function fmtPct(ratio: number | null, digits = 1): string {
  if (ratio == null || !isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(digits)}%`
}

export function fmtNum(n: number | null, digits = 2): string {
  if (n == null || !isFinite(n)) return '—'
  return n.toFixed(digits)
}

export function fmtRR(n: number | null): string {
  if (n == null || !isFinite(n)) return '—'
  return `1 : ${n.toFixed(2)}`
}

export function colorOf(n: number): string {
  return n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-gray-400'
}
