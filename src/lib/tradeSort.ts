import type { EnrichedTrade } from './types'

/** 取引一覧の並び順 */
export type TradeOrder = 'new' | 'old' | 'profit' | 'loss' | 'symbol' | 'symbolDesc'

export const TRADE_ORDERS: { value: TradeOrder; label: string }[] = [
  { value: 'new', label: '新しい順' },
  { value: 'old', label: '古い順' },
  { value: 'profit', label: '損益が大きい順' },
  { value: 'loss', label: '損益が小さい順' },
  { value: 'symbol', label: '通貨ペア順 (A→Z)' },
  { value: 'symbolDesc', label: '通貨ペア順 (Z→A)' },
]

const byTimeAsc = (a: EnrichedTrade, b: EnrichedTrade) =>
  a.openJst.getTime() - b.openJst.getTime()

/**
 * 通貨ペアでまとめる。
 * 同じペアの中は新しい順にする。順番を決めきらないと、
 * 並べ替えるたびに同じ銘柄の中で行が入れ替わって見比べられない。
 */
const bySymbol = (a: EnrichedTrade, b: EnrichedTrade, dir: 1 | -1) => {
  const s = a.symbol.localeCompare(b.symbol, 'en')
  return s !== 0 ? s * dir : byTimeAsc(b, a)
}

/** 元の配列は変えずに、並べ替えた新しい配列を返す */
export function sortTrades(trades: EnrichedTrade[], order: TradeOrder): EnrichedTrade[] {
  const list = [...trades]
  switch (order) {
    case 'old':
      return list.sort(byTimeAsc)
    case 'profit':
      return list.sort((a, b) => b.netProfit - a.netProfit)
    case 'loss':
      return list.sort((a, b) => a.netProfit - b.netProfit)
    case 'symbol':
      return list.sort((a, b) => bySymbol(a, b, 1))
    case 'symbolDesc':
      return list.sort((a, b) => bySymbol(a, b, -1))
    default:
      return list.sort((a, b) => byTimeAsc(b, a))
  }
}
