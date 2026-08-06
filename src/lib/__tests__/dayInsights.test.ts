import { describe, expect, it } from 'vitest'
import { dayInsights } from '../dayInsights'
import { makeTrades } from '../diagnosis/__tests__/fixtures'

const DAY = '2026-08-06'

describe('その日からわかること', () => {
  it('取引がなければ何も出さない', () => {
    expect(dayInsights([])).toEqual([])
  })

  it('損切りを置いていない取引があれば注意として出す', () => {
    const trades = makeTrades([
      { day: DAY, hour: 1, profit: 500, slPips: null },
      { day: DAY, hour: 2, profit: -300, slPips: null },
    ])
    const items = dayInsights(trades, 'メモあり')
    const sl = items.find((i) => i.key === 'sl-missing')
    expect(sl?.tone).toBe('warn')
    expect(sl?.text).toContain('2件')
  })

  it('全部に損切りを置いていれば良い点として出す', () => {
    const trades = makeTrades([
      { day: DAY, hour: 1, profit: 500, slPips: 0.5 },
      { day: DAY, hour: 2, profit: -300, slPips: 0.5 },
    ])
    const items = dayInsights(trades, 'メモあり')
    expect(items.some((i) => i.key === 'sl-all' && i.tone === 'good')).toBe(true)
    expect(items.some((i) => i.key === 'sl-missing')).toBe(false)
  })

  it('損切り直後に入り直していれば注意として出す', () => {
    const trades = makeTrades([
      { day: DAY, hour: 1, minute: 0, holdMin: 10, profit: -400, slPips: 0.5 },
      { day: DAY, hour: 1, minute: 15, holdMin: 10, profit: 200, slPips: 0.5 },
    ])
    const items = dayInsights(trades, 'メモあり')
    expect(items.some((i) => i.key === 'reentry' && i.tone === 'warn')).toBe(true)
  })

  it('振り返りが空なら書くようすすめる', () => {
    const trades = makeTrades([{ day: DAY, hour: 1, profit: 500, slPips: 0.5 }])
    expect(dayInsights(trades, '').some((i) => i.key === 'note')).toBe(true)
    expect(dayInsights(trades, 'あり').some((i) => i.key === 'note')).toBe(false)
  })

  it('出しすぎない（4件まで）', () => {
    const trades = makeTrades(
      Array.from({ length: 8 }, (_, i) => ({
        day: DAY,
        hour: i,
        profit: i % 2 ? 900 : -300,
        slPips: 0.5,
        tpPips: 1.5,
      })),
    )
    expect(dayInsights(trades, '').length).toBeLessThanOrEqual(4)
  })

  it('負け越した日でも、責めずに守れた面を添える', () => {
    const trades = makeTrades([
      { day: DAY, hour: 1, profit: -400, slPips: 0.5 },
      { day: DAY, hour: 5, profit: -300, slPips: 0.5 },
    ])
    const items = dayInsights(trades, 'あり')
    expect(items.some((i) => i.key === 'contained')).toBe(true)
    for (const i of items) {
      for (const w of ['ダメ', '失格', '下手', '向いていない']) {
        expect(i.text.includes(w)).toBe(false)
      }
    }
  })
})
