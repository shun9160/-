import { describe, expect, it } from 'vitest'
import { compareWithYesterday } from '../analytics'
import { makeTrades } from '../diagnosis/__tests__/fixtures'

/**
 * 今日と昨日をくらべるところ。
 *
 * ホームのいちばん上、いちばん大きく出る数字のすぐ隣に出る。
 * ここに意味の通らない数が出ると、その下の数字まで疑われる。
 */

const TODAY = '2026-08-15'
const YESTERDAY = '2026-08-14'

/**
 * その日ぶんの取引。
 * 時刻は UTC の午前なので、日本時間に直しても同じ日のまま。
 * 手数料とスワップは0なので、損益がそのまま純損益になる
 */
function day(dayKey: string, profits: number[]) {
  return makeTrades(profits.map((profit, i) => ({ day: dayKey, hour: i + 1, profit })))
}

describe('今日と昨日をくらべる', () => {
  it('差と割合を出す', () => {
    const t = compareWithYesterday(
      [...day(TODAY, [3000]), ...day(YESTERDAY, [2000])],
      TODAY,
      YESTERDAY,
    )
    expect(t.todayNet).toBe(3000)
    expect(t.yesterdayNet).toBe(2000)
    expect(t.diff).toBe(1000)
    expect(t.ratio).toBeCloseTo(0.5)
  })

  it('昨日が0なら、割合は出さない', () => {
    const t = compareWithYesterday(day(TODAY, [3000]), TODAY, YESTERDAY)
    expect(t.diff).toBe(3000)
    expect(t.ratio).toBeNull()
  })

  it('昨日が行って来いに近い日は、割合を出さない', () => {
    // ここを素直に割ると「+4749%」のような数が出る。
    // 数としては正しくても読む人には何も伝わらず、壊れて見える
    const t = compareWithYesterday(
      [...day(TODAY, [9747]), ...day(YESTERDAY, [201])],
      TODAY,
      YESTERDAY,
    )
    expect(t.diff).toBe(9546)
    expect(t.ratio).toBeNull()
  })

  it('マイナスからの回復でも、桁が変わるほどの差なら出さない', () => {
    const t = compareWithYesterday(
      [...day(TODAY, [50000]), ...day(YESTERDAY, [-300])],
      TODAY,
      YESTERDAY,
    )
    expect(t.ratio).toBeNull()
  })

  it('くらべて意味のある範囲なら、ちゃんと出す', () => {
    const t = compareWithYesterday(
      [...day(TODAY, [12000]), ...day(YESTERDAY, [4000])],
      TODAY,
      YESTERDAY,
    )
    expect(t.ratio).toBeCloseTo(2)
  })

  it('件数は今日のぶんだけ数える', () => {
    const t = compareWithYesterday(
      [...day(TODAY, [100, 200]), ...day(YESTERDAY, [300, 400, 500])],
      TODAY,
      YESTERDAY,
    )
    expect(t.todayCount).toBe(2)
  })
})
