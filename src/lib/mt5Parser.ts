import type { Side, TradeInput } from './types'
import { parseMt5DateTime } from './timezone'

/**
 * MT5 のエクスポートを TradeInput[] に変換するパーサー群。
 *
 * 対応:
 *  - PC 版 MT5 の「口座履歴 → レポート → HTML」 (Positions テーブル: S/L・T/P 含む)
 *  - 汎用 CSV (ヘッダ名で列を自動マッピング)
 */

const num = (s: string | null | undefined): number => {
  if (s == null) return 0
  // "2 044.50", "1,234.5", 全角スペース, 通貨記号などを除去
  const cleaned = s
    .replace(/[\s 　]/g, '')
    .replace(/,/g, '')
    .replace(/[^0-9.\-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

const numOrNull = (s: string | null | undefined): number | null => {
  if (s == null) return null
  const t = s.trim()
  if (t === '' || t === '-' || t === '—') return null
  const n = num(t)
  return n === 0 && !/0/.test(t) ? null : n
}

const sideOf = (s: string): Side | null => {
  const v = s.trim().toLowerCase()
  if (v.startsWith('buy')) return 'buy'
  if (v.startsWith('sell')) return 'sell'
  return null
}

// ---------------------------------------------------------------
// HTML レポート (Positions テーブル)
// ---------------------------------------------------------------
// MT5 の HTML レポートは Positions セクションに以下の列を持つ:
//   Time | Position | Symbol | Type | Volume | Price | S/L | T/P |
//   Time | Price | Commission | Swap | Profit
// バージョン差に強いよう、行内セル数と型(buy/sell)・日時パターンで判定する。
export function parseMt5Html(html: string): TradeInput[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const rows = Array.from(doc.querySelectorAll('tr'))
  const out: TradeInput[] = []

  for (const tr of rows) {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) =>
      (td.textContent ?? '').trim(),
    )
    if (cells.length < 13) continue

    const openTime = parseMt5DateTime(cells[0])
    const side = sideOf(cells[3])
    // Positions 行の条件: 先頭が日時, 4列目が buy/sell, 5列目(volume)が数値
    if (!openTime || !side) continue
    const volume = num(cells[4])
    if (!(volume > 0)) continue

    const symbol = cells[2]
    if (!symbol) continue

    const closeTime = parseMt5DateTime(cells[8])

    out.push({
      ticket: cells[1] || null,
      symbol,
      side,
      volume,
      open_price: num(cells[5]),
      sl: numOrNull(cells[6]),
      tp: numOrNull(cells[7]),
      close_time: closeTime ? closeTime.toISOString() : null,
      close_price: numOrNull(cells[9]),
      commission: num(cells[10]),
      swap: num(cells[11]),
      profit: num(cells[12]),
      open_time: openTime.toISOString(),
      currency: 'JPY',
      note: null,
      source: 'html',
    })
  }
  return dedupe(out)
}

// ---------------------------------------------------------------
// CSV パーサー
// ---------------------------------------------------------------
// ヘッダ名を柔軟にマッピングする。区切りは , / ; / tab を自動判定。
const HEADER_MAP: Record<string, keyof TradeInput | 'open_time' | 'close_time'> = {}
const alias = (keys: string[], field: keyof TradeInput) =>
  keys.forEach((k) => (HEADER_MAP[k] = field))

alias(['ticket', 'position', 'order', 'deal', 'ポジション', '注文番号'], 'ticket')
alias(['symbol', 'シンボル', '銘柄', 'pair'], 'symbol')
alias(['type', 'side', 'direction', '売買', '種別'], 'side')
alias(['volume', 'lots', 'lot', 'size', 'ロット', '数量'], 'volume')
alias(['openprice', 'open_price', 'entry', 'price_open', '始値', '約定価格'], 'open_price')
alias(['closeprice', 'close_price', 'exit', 'price_close', '決済価格', '終値'], 'close_price')
alias(['sl', 's/l', 'stoploss', 'stop_loss', '損切', 'ストップ'], 'sl')
alias(['tp', 't/p', 'takeprofit', 'take_profit', '利確', 'ターゲット'], 'tp')
alias(['opentime', 'open_time', 'time_open', 'openingtime', '開始時刻', 'エントリー時刻'], 'open_time')
alias(['closetime', 'close_time', 'time_close', 'closingtime', '決済時刻', 'クローズ時刻'], 'close_time')
alias(['commission', '手数料'], 'commission')
alias(['swap', 'スワップ'], 'swap')
alias(['profit', 'pnl', 'pl', '損益', '利益'], 'profit')
alias(['currency', '通貨'], 'currency')

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s._-]/g, '')
}

function detectDelimiter(line: string): string {
  const counts = [
    [',', (line.match(/,/g) || []).length],
    ['\t', (line.match(/\t/g) || []).length],
    [';', (line.match(/;/g) || []).length],
  ] as [string, number][]
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQ = !inQ
    } else if (c === delim && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export function parseCsv(text: string): TradeInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []
  const delim = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delim).map(normHeader)
  const fields = headers.map((h) => HEADER_MAP[h])

  const out: TradeInput[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delim)
    const raw: Record<string, string> = {}
    fields.forEach((f, idx) => {
      if (f) raw[f] = cols[idx] ?? ''
    })
    const side = sideOf(raw.side ?? '')
    const openTime = parseMt5DateTime(raw.open_time)
    if (!side || !openTime || !raw.symbol) continue

    const closeTime = parseMt5DateTime(raw.close_time)
    out.push({
      ticket: raw.ticket || null,
      symbol: raw.symbol,
      side,
      volume: num(raw.volume),
      open_price: num(raw.open_price),
      close_price: numOrNull(raw.close_price),
      sl: numOrNull(raw.sl),
      tp: numOrNull(raw.tp),
      open_time: openTime.toISOString(),
      close_time: closeTime ? closeTime.toISOString() : null,
      commission: num(raw.commission),
      swap: num(raw.swap),
      profit: num(raw.profit),
      currency: raw.currency || 'JPY',
      note: null,
      source: 'csv',
    })
  }
  return dedupe(out)
}

/** 拡張子/内容から自動判定して取り込む */
export function parseAuto(filename: string, content: string): TradeInput[] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm') || /<table|<\/tr>/i.test(content)) {
    const viaHtml = parseMt5Html(content)
    if (viaHtml.length) return viaHtml
  }
  return parseCsv(content)
}

function dedupe(rows: TradeInput[]): TradeInput[] {
  const seen = new Set<string>()
  const out: TradeInput[] = []
  for (const r of rows) {
    const key = r.ticket || `${r.symbol}|${r.open_time}|${r.side}|${r.volume}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}
