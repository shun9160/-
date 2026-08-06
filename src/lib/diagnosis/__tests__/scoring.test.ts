import { describe, expect, it } from 'vitest'
import {
  clamp,
  combineIndicators,
  consistencyScore,
  inverseScale,
  normalizedEntropy,
  ratioScore,
  scale,
} from '../scoring'

describe('scale', () => {
  it('下限以下は0、上限以上は100', () => {
    expect(scale(0, 1, 6)).toBe(0)
    expect(scale(1, 1, 6)).toBe(0)
    expect(scale(6, 1, 6)).toBe(100)
    expect(scale(99, 1, 6)).toBe(100)
  })

  it('あいだは線形', () => {
    expect(scale(3.5, 1, 6)).toBeCloseTo(50, 6)
  })

  it('数値でないときは0、無限大は上限扱い', () => {
    expect(scale(NaN, 0, 10)).toBe(0)
    expect(scale(Infinity, 0, 10)).toBe(100)
    expect(scale(-Infinity, 0, 10)).toBe(0)
  })

  it('low > high なら逆向きの尺度になる', () => {
    expect(scale(0, 10, 0)).toBe(100)
    expect(scale(10, 10, 0)).toBe(0)
  })
})

describe('inverseScale', () => {
  it('小さいほど高得点', () => {
    expect(inverseScale(1, 1, 6)).toBe(100)
    expect(inverseScale(6, 1, 6)).toBe(0)
  })
})

describe('ratioScore', () => {
  it('0〜1を0〜100にする', () => {
    expect(ratioScore(0)).toBe(0)
    expect(ratioScore(0.5)).toBe(50)
    expect(ratioScore(1)).toBe(100)
  })
  it('範囲外はクランプ', () => {
    expect(ratioScore(-1)).toBe(0)
    expect(ratioScore(3)).toBe(100)
  })
})

describe('normalizedEntropy', () => {
  it('1種類だけなら0', () => {
    expect(normalizedEntropy([10])).toBe(0)
    expect(normalizedEntropy([])).toBe(0)
  })
  it('均等に散らばっていれば100', () => {
    expect(normalizedEntropy([5, 5, 5, 5])).toBeCloseTo(100, 6)
  })
  it('偏っていれば下がる', () => {
    expect(normalizedEntropy([100, 1])).toBeLessThan(20)
  })
  it('0〜100に収まる', () => {
    for (const v of [[1, 2, 3], [1, 1], [50, 1, 1, 1]]) {
      const s = normalizedEntropy(v)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })
})

describe('consistencyScore', () => {
  it('全部同じなら100', () => {
    expect(consistencyScore([5, 5, 5])).toBe(100)
  })
  it('ばらつくほど下がる', () => {
    const a = consistencyScore([10, 11, 9]) as number
    const b = consistencyScore([1, 20, 50]) as number
    expect(a).toBeGreaterThan(b)
  })
  it('件数不足やゼロ平均は判定しない（0点にしない）', () => {
    expect(consistencyScore([5])).toBeNull()
    expect(consistencyScore([])).toBeNull()
    expect(consistencyScore([-5, 5])).toBeNull()
  })
})

describe('combineIndicators', () => {
  const ind = (key: string, weight: number, score: number | null) => ({
    key,
    label: key,
    weight,
    score,
    value: null,
  })

  it('欠けた指標を0点にせず、残りで割り直す', () => {
    const c = combineIndicators([ind('a', 0.5, 80), ind('b', 0.3, 40), ind('c', 0.2, null)])
    expect(c.available).toBeCloseTo(0.8, 6)
    expect(c.score).toBeCloseTo((80 * 0.5 + 40 * 0.3) / 0.8, 6)
  })

  it('取れたウェイトが半分に満たなければ使わない', () => {
    const c = combineIndicators([ind('a', 0.4, 90), ind('b', 0.6, null)])
    expect(c.score).toBeNull()
    expect(c.available).toBeCloseTo(0.4, 6)
  })

  it('ちょうど50%は使う', () => {
    const c = combineIndicators([ind('a', 0.5, 70), ind('b', 0.5, null)])
    expect(c.score).toBe(70)
  })
})

describe('clamp', () => {
  it('0〜100に収める', () => {
    expect(clamp(-5)).toBe(0)
    expect(clamp(150)).toBe(100)
    expect(clamp(NaN)).toBe(0)
  })
})
