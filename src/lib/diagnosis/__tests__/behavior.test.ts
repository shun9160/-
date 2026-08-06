import { describe, expect, it } from 'vitest'
import { scoreBehavior } from '../behavior'
import { BEHAVIOR_WEIGHTS } from '../config'
import { TYPE_IDS } from '../types'
import { DEFAULT_ENV, makeTrades, plainTrades } from './fixtures'

const env = DEFAULT_ENV

function run(trades: ReturnType<typeof plainTrades>, over: Partial<typeof env> = {}) {
  return scoreBehavior({ trades, ...env, ...over })
}

describe('取引データ採点', () => {
  it('取引0件ならどのタイプも判定しない（0点にはしない）', () => {
    const b = run([])
    for (const id of TYPE_IDS) {
      expect(b.scores[id]).toBeNull()
    }
  })

  it('このアプリが持っていない指標は null のまま残す', () => {
    const b = run(plainTrades(30))
    const missing = ['momentumTagRate', 'executionRate', 'setupTagConsistency', 'strategyEntropy', 'planNoteRate']
    const all = TYPE_IDS.flatMap((id) => b.indicators[id])
    for (const key of missing) {
      const found = all.filter((i) => i.key === key)
      expect(found.length).toBeGreaterThan(0)
      for (const i of found) expect(i.score).toBeNull()
    }
  })

  it('取れた指標のウェイト合計が仕様のウェイトと一致する', () => {
    const b = run(plainTrades(30))
    for (const id of TYPE_IDS) {
      const total = Object.values(BEHAVIOR_WEIGHTS[id]).reduce((a, v) => a + v, 0)
      expect(total).toBeCloseTo(1, 6)
      expect(b.available[id]).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('スコアは0〜100に収まる', () => {
    for (const n of [0, 4, 5, 19, 20, 60]) {
      const b = run(plainTrades(n))
      for (const id of TYPE_IDS) {
        const s = b.scores[id]
        if (s == null) continue
        expect(s).toBeGreaterThanOrEqual(0)
        expect(s).toBeLessThanOrEqual(100)
      }
    }
  })

  it('損切りも利確も置いていない記録では GUARD の材料が減る', () => {
    const withPlan = makeTrades(
      Array.from({ length: 20 }, (_, i) => ({
        day: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
        profit: i % 2 ? 500 : -400,
        slPips: 0.5,
        tpPips: 1,
      })),
    )
    const withoutPlan = makeTrades(
      Array.from({ length: 20 }, (_, i) => ({
        day: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
        profit: i % 2 ? 500 : -400,
        slPips: null,
        tpPips: null,
      })),
    )
    const a = run(withPlan)
    const b = run(withoutPlan)
    expect(a.available.GUARD).toBeGreaterThan(b.available.GUARD)
    expect(a.scores.GUARD as number).toBeGreaterThan(b.scores.GUARD as number)
  })

  it('LOGICらしい記録（損切り・利確・メモあり・リスク一定）は LOGIC が高くなる', () => {
    const trades = makeTrades(
      Array.from({ length: 24 }, (_, i) => ({
        day: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
        profit: i % 3 ? 600 : -400,
        slPips: 0.5,
        tpPips: 1,
        volume: 0.1,
        note: '計画通り',
      })),
    )
    const b = run(trades)
    expect(b.scores.LOGIC as number).toBeGreaterThan(70)
  })

  it('1日に何度も入り、保有が短い記録は BLAZE が高くなる', () => {
    const trades = makeTrades(
      Array.from({ length: 30 }, (_, i) => ({
        day: `2026-07-${String(Math.floor(i / 6) + 1).padStart(2, '0')}`,
        hour: 9 + (i % 6),
        holdMin: 5,
        profit: i % 2 ? 300 : -200,
        slPips: 0.2,
        tpPips: 1.2,
      })),
    )
    const b = run(trades)
    expect(b.scores.BLAZE as number).toBeGreaterThan(70)
  })

  it('1日1件・勝率高め・損切り直後の入り直しなしなら WATCH が高くなる', () => {
    const trades = makeTrades(
      Array.from({ length: 24 }, (_, i) => ({
        day: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
        profit: i % 5 === 0 ? -400 : 900,
        slPips: 0.5,
        tpPips: 1,
        holdMin: 240,
      })),
    )
    const b = run(trades)
    expect(b.scores.WATCH as number).toBeGreaterThan(70)
  })

  it('銘柄も時間帯もばらけ、複数銘柄で利益が出ていれば SHIFT が高くなる', () => {
    const symbols = ['USDJPY', 'EURUSD', 'XAUUSD', 'GBPJPY']
    const trades = makeTrades(
      Array.from({ length: 32 }, (_, i) => ({
        day: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
        hour: [1, 9, 15, 22][i % 4],
        symbol: symbols[i % 4],
        profit: i % 4 === 3 ? -300 : 700,
        slPips: 0.5,
        tpPips: 1,
      })),
    )
    const b = run(trades)
    expect(b.scores.SHIFT as number).toBeGreaterThan(60)
  })

  it('原資が分からないときは資金比率の指標を使わない', () => {
    const b = run(plainTrades(20), { initialCapital: 0 })
    const guard = b.indicators.GUARD
    expect(guard.find((i) => i.key === 'lowRiskPct')?.score).toBeNull()
    expect(guard.find((i) => i.key === 'lowDrawdown')?.score).toBeNull()
  })

  it('件数が少ないうちは、標本が足りない指標を判定しない', () => {
    const b = run(plainTrades(2))
    expect(b.metrics.avgHoldMinutes).toBeNull()
    expect(b.metrics.winRate).toBeNull()
  })
})

describe('改善傾向', () => {
  it('両期間の取引が足りなければ判定しない', () => {
    const b = run(plainTrades(4, '2026-08-01'))
    expect(b.metrics.improvementTrend).toBeNull()
  })

  it('直近が良くなっていれば高くなる', () => {
    const before = Array.from({ length: 8 }, (_, i) => ({
      day: new Date(Date.parse('2026-06-20T00:00:00Z') + i * 86400000).toISOString().slice(0, 10),
      profit: -500,
      slPips: null,
    }))
    const recent = Array.from({ length: 8 }, (_, i) => ({
      day: new Date(Date.parse('2026-07-25T00:00:00Z') + i * 86400000).toISOString().slice(0, 10),
      profit: 800,
      slPips: 0.5,
    }))
    const b = run(makeTrades([...before, ...recent]))
    expect(b.metrics.improvementTrend as number).toBeGreaterThanOrEqual(60)
    expect(b.metrics.improvedMetrics.length).toBeGreaterThan(0)
  })
})
