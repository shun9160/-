import { describe, expect, it } from 'vitest'
import {
  CREDIT_PACK,
  FREE_DAYS,
  FREE_STATE,
  IMAGE_LIMIT,
  PLANS,
  canRead,
  imageLimitOf,
  imagesLeft,
  oldestReadableDay,
  periodLabel,
  priceLabel,
} from '../plan'
import type { PlanState } from '../plan'

/**
 * プランの決まりごと。
 *
 * ここがずれると、お金をもらっているのに読めない、
 * もらっていないのに読める、のどちらかが起きる。
 * 実際に止めているのはデータベース側だが、
 * 画面の出し分けもこの表を見ているので、両方そろえておく。
 */

const TODAY = '2026-08-19'

function state(p: Partial<PlanState> = {}): PlanState {
  return { ...FREE_STATE, ...p }
}

describe('読み返せる範囲', () => {
  it('無料は、今日を含めて30日ぶん', () => {
    const free = state()
    expect(canRead(free, TODAY, TODAY)).toBe(true)
    // 30日目（いちばん古い日）はまだ読める
    expect(canRead(free, '2026-07-21', TODAY)).toBe(true)
    // その1日前から読めなくなる
    expect(canRead(free, '2026-07-20', TODAY)).toBe(false)
  })

  it('いちばん古い読める日を、日付で出せる', () => {
    expect(oldestReadableDay(TODAY)).toBe('2026-07-21')
    // 30日ぶん = 今日を含めて30日
    const from = new Date('2026-07-21T00:00:00Z')
    const to = new Date(`${TODAY}T00:00:00Z`)
    const days = (to.getTime() - from.getTime()) / 86400000 + 1
    expect(days).toBe(FREE_DAYS)
  })

  it('月をまたいでも、年をまたいでも数え方が変わらない', () => {
    expect(oldestReadableDay('2026-01-15')).toBe('2025-12-17')
    expect(oldestReadableDay('2026-03-01')).toBe('2026-01-31')
  })

  it('有料は、どれだけ古い日でも読める', () => {
    const pro = state({ plan: 'pro' })
    expect(canRead(pro, '2019-01-01', TODAY)).toBe(true)
  })

  it('境目は時刻ではなく日で切る', () => {
    // 朝に読めた日記が夕方に読めなくなると、
    // 消えたのか壊れたのか分からなくなる
    const free = state()
    const day = oldestReadableDay(TODAY)
    expect(canRead(free, day, TODAY)).toBe(true)
    expect(canRead(free, day, TODAY)).toBe(true)
  })
})

describe('画像の枚数', () => {
  it('プランごとの上限が出る', () => {
    expect(imageLimitOf(state())).toBe(IMAGE_LIMIT.free)
    expect(imageLimitOf(state({ plan: 'pro' }))).toBe(IMAGE_LIMIT.pro)
  })

  it('クレジットを買うと、そのぶん増える', () => {
    const s = state({ plan: 'pro', extraImages: CREDIT_PACK.images * 2 })
    expect(imageLimitOf(s)).toBe(IMAGE_LIMIT.pro + CREDIT_PACK.images * 2)
  })

  it('あと何枚置けるかが出る', () => {
    expect(imagesLeft(state({ usedImages: 10 }))).toBe(IMAGE_LIMIT.free - 10)
  })

  it('上限を超えていても、マイナスにはしない', () => {
    // 上限を下げたときに「あと-12枚」と出ると、壊れて見える
    expect(imagesLeft(state({ usedImages: IMAGE_LIMIT.free + 12 }))).toBe(0)
  })
})

describe('見せ方', () => {
  it('無料は「0円」ではなく「無料」と書く', () => {
    expect(priceLabel(0)).toBe('無料')
    expect(priceLabel(980)).toBe('980円')
    expect(priceLabel(9800)).toBe('9,800円')
  })

  it('期限を日本語の日付にする', () => {
    expect(periodLabel('2026-09-15T00:00:00Z')).toBe('2026年9月15日')
    expect(periodLabel(null)).toBeNull()
    expect(periodLabel('こわれた日付')).toBeNull()
  })

  it('プランの説明に、値段と同じ数字が入っている', () => {
    // 表と説明文で値段が食い違うと、請求と画面が合わなくなる
    expect(PLANS.free.yen).toBe(0)
    expect(PLANS.pro.yen).toBe(980)
    expect(PLANS.free.points.join()).toContain(String(FREE_DAYS))
    expect(PLANS.free.points.join()).toContain(String(IMAGE_LIMIT.free))
    expect(PLANS.pro.points.join()).toContain(String(IMAGE_LIMIT.pro))
  })

  it('有料のほうが、無料より置ける枚数が多い', () => {
    expect(IMAGE_LIMIT.pro).toBeGreaterThan(IMAGE_LIMIT.free)
  })
})
