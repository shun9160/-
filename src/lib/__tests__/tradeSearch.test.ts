import { describe, expect, it } from 'vitest'
import { searchTerms, searchTrades } from '../tradeSearch'
import type { EnrichedTrade } from '../types'

/** 検索に関係する項目だけ持つ、最小の取引 */
function t(over: Partial<EnrichedTrade> & { symbol: string }): EnrichedTrade {
  // 8月6日 13:37 (JST) = 04:37 UTC。東京セッションに入る時刻
  const open = new Date(Date.UTC(2026, 7, 6, 4, 37, 0))
  return {
    id: over.symbol + (over.note ?? ''),
    side: 'buy',
    note: null,
    ticket: null,
    account_id: null,
    tpHit: false,
    slHit: false,
    win: true,
    netProfit: 2104,
    session: 'tokyo',
    openJst: open,
    open_time: open.toISOString(),
    ...over,
  } as unknown as EnrichedTrade
}

const LIST: EnrichedTrade[] = [
  t({ symbol: 'XAUUSD.raw', note: '押し目で入った', netProfit: 2104 }),
  t({ symbol: 'USDJPY', side: 'sell', note: '指標前に手仕舞い', netProfit: -1761, win: false }),
  t({ symbol: 'EURUSD', note: null, netProfit: 500, tpHit: true, account_id: 'a2' }),
]

const names = (list: EnrichedTrade[]) => list.map((x) => x.symbol)
const find = (q: string, byId?: (id?: string | null) => string | null) =>
  names(searchTrades(LIST, q, byId))

describe('searchTerms', () => {
  it('空・空白だけなら語なし', () => {
    expect(searchTerms('')).toEqual([])
    expect(searchTerms('   ')).toEqual([])
  })
  it('全角空白でも区切る', () => {
    expect(searchTerms('usd　買い')).toEqual(['usd', '買い'])
  })
})

describe('searchTrades', () => {
  it('入力が空なら、元の配列をそのまま返す', () => {
    expect(searchTrades(LIST, '')).toBe(LIST)
    expect(searchTrades(LIST, '  ')).toBe(LIST)
  })

  it('通貨ペアで探せる。大文字小文字は問わない', () => {
    expect(find('xauusd')).toEqual(['XAUUSD.raw'])
    expect(find('USD')).toEqual(['XAUUSD.raw', 'USDJPY', 'EURUSD'])
  })

  it('全角で打っても当たる', () => {
    expect(find('ＸＡＵ')).toEqual(['XAUUSD.raw'])
  })

  it('メモの中身で探せる', () => {
    expect(find('押し目')).toEqual(['XAUUSD.raw'])
    expect(find('指標')).toEqual(['USDJPY'])
  })

  it('売買で探せる', () => {
    expect(find('売り')).toEqual(['USDJPY'])
    expect(find('買い')).toEqual(['XAUUSD.raw', 'EURUSD'])
  })

  it('終わり方で探せる', () => {
    expect(find('利確ライン')).toEqual(['EURUSD'])
    expect(find('手動で利確')).toEqual(['XAUUSD.raw'])
  })

  it('日付で探せる。書き方はいくつか受ける', () => {
    expect(find('8/6')).toHaveLength(3)
    expect(find('8月6日')).toHaveLength(3)
    expect(find('2026-08-06')).toHaveLength(3)
    expect(find('8/7')).toEqual([])
  })

  it('金額で探せる', () => {
    expect(find('2104')).toEqual(['XAUUSD.raw'])
  })

  it('口座名で探せる', () => {
    const byId = (id?: string | null) => (id === 'a2' ? 'Exness 12345678' : null)
    expect(find('exness', byId)).toEqual(['EURUSD'])
  })

  it('空白で区切ると「どちらも含む」で絞る', () => {
    expect(find('usd 売り')).toEqual(['USDJPY'])
    expect(find('usd 売り 指標')).toEqual(['USDJPY'])
    expect(find('usd 売り 押し目')).toEqual([])
  })

  it('当たらなければ空', () => {
    expect(find('みつからない語')).toEqual([])
  })

  it('メモが無い取引でも落ちない', () => {
    expect(() => searchTrades([t({ symbol: 'GBPUSD', note: null })], 'gbp')).not.toThrow()
  })
})
