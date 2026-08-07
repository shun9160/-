import { describe, expect, it } from 'vitest'
import { goodTrades, knownSetups, NO_SETUP, setupStats } from '../setups'
import type { EnrichedTrade } from '../types'

function t(over: Partial<EnrichedTrade>): EnrichedTrade {
  return {
    id: Math.random().toString(36).slice(2),
    setup: null,
    netProfit: 100,
    sl: null,
    tp: null,
    plannedRR: null,
    rMultiple: null,
    tpHit: false,
    slHit: false,
    note: null,
    jstDay: '2026-08-06',
    ...over,
  } as unknown as EnrichedTrade
}

describe('setupStats', () => {
  it('型ごとにまとめ、件数の多い順に並べる', () => {
    const s = setupStats([
      t({ setup: '押し目買い', netProfit: 100 }),
      t({ setup: '押し目買い', netProfit: -50 }),
      t({ setup: 'ブレイク狙い', netProfit: 300 }),
    ])
    expect(s.map((x) => x.name)).toEqual(['押し目買い', 'ブレイク狙い'])
    expect(s[0]).toMatchObject({ count: 2, wins: 1, losses: 1, winRate: 0.5, net: 50 })
  })

  it('型を決めていない取引は、まとめて「型なし」にする', () => {
    const s = setupStats([t({}), t({ setup: '   ' })])
    expect(s).toHaveLength(1)
    expect(s[0].name).toBe(NO_SETUP)
    expect(s[0].count).toBe(2)
  })

  it('損切りを置けた割合と、狙いの損益比の平均を出す', () => {
    const s = setupStats([
      t({ setup: 'A', sl: 100, plannedRR: 2 }),
      t({ setup: 'A', sl: null, plannedRR: 4 }),
    ])
    expect(s[0].slRate).toBe(0.5)
    expect(s[0].avgPlannedRR).toBe(3)
  })

  it('狙いの損益比が1つも無ければ null', () => {
    expect(setupStats([t({ setup: 'A' })])[0].avgPlannedRR).toBeNull()
  })

  it('いちばん良かった取引と悪かった取引を持つ', () => {
    const s = setupStats([
      t({ setup: 'A', netProfit: -200 }),
      t({ setup: 'A', netProfit: 500 }),
      t({ setup: 'A', netProfit: 10 }),
    ])
    expect(s[0].best?.netProfit).toBe(500)
    expect(s[0].worst?.netProfit).toBe(-200)
  })

  it('候補には「型なし」を出さない', () => {
    expect(knownSetups([t({ setup: 'A' }), t({})])).toEqual(['A'])
  })

  it('空でも落ちない', () => {
    expect(setupStats([])).toEqual([])
  })
})

describe('goodTrades', () => {
  it('理由が1つしか無いものは選ばない', () => {
    expect(goodTrades([t({ sl: 100 })])).toEqual([])
  })

  it('決めた通りにやれた取引を選ぶ', () => {
    const g = goodTrades([t({ sl: 100, tpHit: true, netProfit: 300 })])
    expect(g).toHaveLength(1)
    expect(g[0].reasons).toContain('損切りを置いてから入れた')
    expect(g[0].reasons).toContain('決めた利確ラインまで持てた')
  })

  it('負けでも、決めた幅で切れていれば選ぶ', () => {
    const g = goodTrades([t({ sl: 100, slHit: true, netProfit: -200 })])
    expect(g).toHaveLength(1)
    expect(g[0].reasons).toContain('負けたが、決めた幅で切れた')
  })

  it('大きく勝っただけの雑な取引より、守れた取引を上に置く', () => {
    const 雑 = t({ id: '雑', netProfit: 100000, sl: null })
    const 守れた = t({ id: '守れた', netProfit: 500, sl: 100, tpHit: true, plannedRR: 3 })
    const g = goodTrades([雑, 守れた])
    expect(g[0].trade.id).toBe('守れた')
  })

  it('出す件数を絞れる', () => {
    const many = Array.from({ length: 10 }, () => t({ sl: 100, tpHit: true }))
    expect(goodTrades(many, 3)).toHaveLength(3)
  })
})
