import { describe, expect, it } from 'vitest'
import { duplicateIndexes, tradeKey } from '../tradeDedup'

/**
 * 取引番号が読み取れなかった取引の、二重登録さがし。
 *
 * 間違え方が2通りある。
 *  見落とす … 同じ取引が2件入り、勝率も損益もずれる
 *  行きすぎ … 別の取引を「同じ」と言い、記録が理由も無く減る
 * とくに後者は取り返しがつかないので、迷うものは判定しない側に倒す。
 */

const base = {
  symbol: 'USDJPY',
  side: 'buy',
  openTime: '2026-09-04T06:30:12.000Z',
  volume: 0.02,
  closeTime: '2026-09-04T07:02:41.000Z',
  openPrice: 147.212,
  closePrice: 147.44,
  profit: 460,
}

describe('同じ取引かを見分ける鍵', () => {
  it('4つが揃って同じなら、同じ鍵になる', () => {
    expect(tradeKey(base)).toBe(tradeKey({ ...base }))
  })

  it('銘柄の書き方が違っても、同じ鍵になる', () => {
    expect(tradeKey({ ...base, symbol: ' usdjpy ' })).toBe(tradeKey(base))
  })

  it('ロットの書き方が違っても、同じ鍵になる', () => {
    // 読み取りで「0.02」「0.020」「.02」と揺れる
    expect(tradeKey({ ...base, volume: '0.020' })).toBe(tradeKey(base))
    expect(tradeKey({ ...base, volume: '.02' })).toBe(tradeKey(base))
  })

  it('時刻の書き方が違っても、指している時刻が同じなら同じ鍵になる', () => {
    expect(tradeKey({ ...base, openTime: new Date(base.openTime) })).toBe(tradeKey(base))
    expect(tradeKey({ ...base, openTime: '2026-09-04T15:30:12+09:00' })).toBe(tradeKey(base))
  })

  it('どれか1つでも違えば、別の鍵になる', () => {
    const k = tradeKey(base)
    expect(tradeKey({ ...base, symbol: 'EURUSD' })).not.toBe(k)
    expect(tradeKey({ ...base, side: 'sell' })).not.toBe(k)
    expect(tradeKey({ ...base, volume: 0.03 })).not.toBe(k)
    expect(tradeKey({ ...base, openTime: '2026-09-04T06:30:13.000Z' })).not.toBe(k)
    expect(tradeKey({ ...base, closeTime: '2026-09-04T07:02:42.000Z' })).not.toBe(k)
    expect(tradeKey({ ...base, openPrice: 147.213 })).not.toBe(k)
    expect(tradeKey({ ...base, closePrice: 147.45 })).not.toBe(k)
    expect(tradeKey({ ...base, profit: 461 })).not.toBe(k)
  })

  it('値段の書き方が違っても、同じ鍵になる', () => {
    // 「4402.60」と「4402.6」は同じ値段
    expect(tradeKey({ ...base, openPrice: '147.2120', closePrice: '147.4400' })).toBe(
      tradeKey(base),
    )
  })

  it('同じ秒に建てた別の取引を、同じものにしない', () => {
    /*
      MT5 の履歴に実際に並ぶ形。
      銘柄・売買・ロット・時刻はすべて同じで、値段と損益だけが違う。
      ここを見落とすと、2本目を「同じ取引」と言って外してしまう
    */
    const at = {
      symbol: 'XAUUSD.raw',
      side: 'sell',
      volume: 0.05,
      openTime: '2026-09-08T01:42:16.000Z',
      closeTime: '2026-09-08T01:42:16.000Z',
    }
    const a = tradeKey({ ...at, openPrice: 4393.87, closePrice: 4392.23, profit: 1262 })
    const b = tradeKey({ ...at, openPrice: 4393.97, closePrice: 4392.23, profit: 1339 })
    expect(a).not.toBe(b)
  })

  it('同じ秒に3本あっても、それぞれ別のものとして扱う', () => {
    const at = {
      symbol: 'XAUUSD.raw',
      side: 'sell',
      volume: 0.05,
      openTime: '2026-09-08T01:50:26.000Z',
    }
    const keys = [
      tradeKey({ ...at, openPrice: 4393.4, closePrice: 4393.55, profit: -115 }),
      tradeKey({ ...at, openPrice: 4393.55, closePrice: 4393.55, profit: 0 }),
      tradeKey({ ...at, openPrice: 4395.73, closePrice: 4393.55, profit: 1677 }),
    ]
    expect(new Set(keys).size).toBe(3)
    expect(duplicateIndexes(keys, new Set())).toEqual([])
  })

  it('損益0と、損益が読めなかったものを、同じにしない', () => {
    // 分からないものを0とみなすと、中身の違う取引が同じ鍵になる
    expect(tradeKey({ ...base, profit: 0 })).not.toBe(tradeKey({ ...base, profit: null }))
  })

  it('中身が全部同じなら、同じ鍵になる', () => {
    const t = {
      symbol: 'XAUUSD.raw',
      side: 'buy',
      volume: 0.05,
      openTime: '2026-09-08T04:04:31.000Z',
      closeTime: '2026-09-08T05:17:22.000Z',
      openPrice: 4402.6,
      closePrice: 4399.04,
      profit: -2741,
    }
    expect(tradeKey(t)).toBe(tradeKey({ ...t }))
  })

  it('決め手になる4つが読めていなければ、判定しない', () => {
    // ここで無理に鍵を作ると、読み取れなかったもの同士が
    // 「全部おなじ取引」に見えてしまう
    expect(tradeKey({ ...base, symbol: '' })).toBeNull()
    expect(tradeKey({ ...base, side: null })).toBeNull()
    expect(tradeKey({ ...base, openTime: null })).toBeNull()
    expect(tradeKey({ ...base, openTime: 'よみとれない' })).toBeNull()
    expect(tradeKey({ ...base, volume: '' })).toBeNull()
    expect(tradeKey({ ...base, volume: 0 })).toBeNull()
  })
})

describe('重なりそうなものを見つける', () => {
  it('すでに入っている取引と同じものに印を付ける', () => {
    const known = new Set(['a', 'b'])
    expect(duplicateIndexes(['x', 'a', 'y'], known)).toEqual([1])
  })

  it('いま並べたものどうしの重なりも見る', () => {
    // 同じ取引が写った写真を2枚選ぶことがある
    expect(duplicateIndexes(['a', 'b', 'a'], new Set())).toEqual([2])
  })

  it('3つ重なれば、最初の1つだけ残す', () => {
    expect(duplicateIndexes(['a', 'a', 'a'], new Set())).toEqual([1, 2])
  })

  it('判定できないものは、印を付けない', () => {
    // 読み取れなかった取引を「同じ」と言って外すと、書いた記録が入らない
    expect(duplicateIndexes([null, null, null], new Set())).toEqual([])
  })

  it('元の並びは変えない。何番目かだけを返す', () => {
    const keys = ['a', null, 'a', 'b']
    expect(duplicateIndexes(keys, new Set())).toEqual([2])
    expect(keys).toEqual(['a', null, 'a', 'b'])
  })
})
