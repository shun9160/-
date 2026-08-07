import { describe, expect, it } from 'vitest'
import { sortTrades } from '../tradeSort'
import type { EnrichedTrade } from '../types'

/** 並べ替えに関係する項目だけ持つ、最小の取引 */
function t(symbol: string, hour: number, netProfit: number): EnrichedTrade {
  const open = new Date(Date.UTC(2026, 7, 7, hour, 0, 0))
  return {
    id: `${symbol}-${hour}`,
    symbol,
    netProfit,
    openJst: open,
    open_time: open.toISOString(),
  } as unknown as EnrichedTrade
}

const SAMPLE = [
  t('USDJPY', 9, 500),
  t('EURUSD', 10, -200),
  t('XAUUSD', 8, 1500),
  t('EURUSD', 14, 300),
  t('USDJPY', 12, -50),
]

const symbols = (list: EnrichedTrade[]) => list.map((x) => x.symbol)
const ids = (list: EnrichedTrade[]) => list.map((x) => x.id)

describe('sortTrades', () => {
  it('元の配列を変えない', () => {
    const before = ids(SAMPLE)
    sortTrades(SAMPLE, 'symbol')
    expect(ids(SAMPLE)).toEqual(before)
  })

  it('通貨ペア順 (A→Z)', () => {
    expect(symbols(sortTrades(SAMPLE, 'symbol'))).toEqual([
      'EURUSD',
      'EURUSD',
      'USDJPY',
      'USDJPY',
      'XAUUSD',
    ])
  })

  it('通貨ペア順 (Z→A)', () => {
    expect(symbols(sortTrades(SAMPLE, 'symbolDesc'))).toEqual([
      'XAUUSD',
      'USDJPY',
      'USDJPY',
      'EURUSD',
      'EURUSD',
    ])
  })

  it('同じ通貨ペアの中は新しい順。どちら向きでも同じ', () => {
    expect(ids(sortTrades(SAMPLE, 'symbol')).slice(0, 2)).toEqual(['EURUSD-14', 'EURUSD-10'])
    expect(ids(sortTrades(SAMPLE, 'symbolDesc')).slice(1, 3)).toEqual(['USDJPY-12', 'USDJPY-9'])
  })

  it('通貨ペアが1種類でも、時刻の並びが崩れない', () => {
    const one = [t('USDJPY', 9, 1), t('USDJPY', 15, 2), t('USDJPY', 11, 3)]
    expect(ids(sortTrades(one, 'symbol'))).toEqual(['USDJPY-15', 'USDJPY-11', 'USDJPY-9'])
  })

  it('新しい順・古い順', () => {
    expect(ids(sortTrades(SAMPLE, 'new'))[0]).toBe('EURUSD-14')
    expect(ids(sortTrades(SAMPLE, 'old'))[0]).toBe('XAUUSD-8')
  })

  it('損益の大きい順・小さい順', () => {
    expect(sortTrades(SAMPLE, 'profit').map((x) => x.netProfit)).toEqual([1500, 500, 300, -50, -200])
    expect(sortTrades(SAMPLE, 'loss').map((x) => x.netProfit)).toEqual([-200, -50, 300, 500, 1500])
  })

  it('空でも落ちない', () => {
    expect(sortTrades([], 'symbol')).toEqual([])
  })
})
