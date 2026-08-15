import { describe, expect, it } from 'vitest'
import {
  DEMO_ACCOUNTS,
  demoDayEntries,
  demoDayText,
  demoTradeImageCounts,
  demoTradeImages,
  demoTrades,
  isDemoId,
} from '../demo'
import { demoChart, demoChartFromPath, demoChartPath, isDemoChartPath } from '../demoChart'
import { demoEntryDays } from '../demoJournal'
import { isEmpty, plainText } from '../journal'
import { jstDayKey } from '../timezone'

/**
 * サンプル表示のテスト。
 *
 * ここは、ログインしていない人がいちばん最初に見るところ。
 * 空っぽの画面が出ると、何ができるアプリなのか伝わらないまま
 * 閉じられてしまうので、「中身が入っていること」自体を確かめる。
 */

/** 土曜。週末に開いた人でも今日が空にならないことを確かめるために使う */
const SAT = '2026-08-15'
/** 水曜 */
const WED = '2026-08-12'

describe('サンプルのチャート画像', () => {
  it('そのまま <img> に入れられる形で返る', () => {
    const url = demoChart({ seed: 1 })
    expect(url.startsWith('data:image/svg+xml')).toBe(true)
    expect(decodeURIComponent(url)).toContain('<svg')
  })

  it('同じ種からは同じ絵。開くたびに形が変わらない', () => {
    expect(demoChart({ seed: 42 })).toBe(demoChart({ seed: 42 }))
    expect(demoChart({ seed: 42 })).not.toBe(demoChart({ seed: 43 }))
  })

  it('銘柄と時間足が絵の中に入る', () => {
    const svg = decodeURIComponent(demoChart({ seed: 3, symbol: 'USDJPY', timeframe: '1h' }))
    expect(svg).toContain('USDJPY')
    expect(svg).toContain('1h')
  })

  it('入った所・損切り・利確の線は、枠の中に収まる', () => {
    // はみ出すと札だけ画面の外に消えて、どこを狙ったのか読めなくなる
    for (const seed of [1, 5, 9, 103, 141]) {
      for (const side of ['buy', 'sell'] as const) {
        const svg = decodeURIComponent(demoChart({ seed, side, bias: side === 'buy' ? 1 : -1 }))
        expect(svg).toContain('>TP<')
        expect(svg).toContain('>SL<')
        // 札の y は 0〜600 の中
        const ys = [...svg.matchAll(/<rect x="738" y="(-?[\d.]+)"/g)].map((m) => Number(m[1]))
        expect(ys.length).toBeGreaterThan(0)
        for (const y of ys) expect(y).toBeGreaterThanOrEqual(0)
        for (const y of ys) expect(y).toBeLessThanOrEqual(600)
      }
    }
  })

  it('線を消すこともできる', () => {
    expect(decodeURIComponent(demoChart({ seed: 2, levels: false }))).not.toContain('>TP<')
  })

  it('住所からたどると、同じ絵に戻る', () => {
    const spec = { seed: 7, symbol: 'XAUUSD', timeframe: '15m', bias: 1, side: 'buy' as const }
    const path = demoChartPath(spec)
    expect(isDemoChartPath(path)).toBe(true)
    expect(demoChartFromPath(path)).toBe(demoChart(spec))
  })

  it('サンプル以外の住所は、ここでは扱わない', () => {
    expect(demoChartFromPath('abc/def/1.webp')).toBeNull()
    expect(isDemoChartPath('abc/def/1.webp')).toBe(false)
  })
})

describe('サンプルの日記', () => {
  it('今日が必ず入っている。土曜に開いても空にしない', () => {
    for (const today of [SAT, WED]) {
      const e = demoDayEntries(today)[today]
      expect(e).toBeDefined()
      expect(e.title).not.toBe('')
    }
  })

  it('題名・本文・気持ち・学びまで書いてある日がある', () => {
    const all = Object.values(demoDayEntries(SAT))
    expect(all.length).toBeGreaterThanOrEqual(8)
    expect(all.some((e) => e.emotions.length > 0)).toBe(true)
    expect(all.some((e) => e.lesson !== '')).toBe(true)
    expect(all.some((e) => e.good && e.improve && e.nextTime)).toBe(true)
  })

  it('チャートが貼ってある日がある。本文の中にも挟まっている', () => {
    const all = Object.values(demoDayEntries(SAT))
    expect(all.some((e) => e.photos.length >= 2)).toBe(true)
    expect(all.some((e) => e.blocks.some((b) => b.kind === 'image'))).toBe(true)
  })

  it('貼ってあるチャートは、すべて絵に戻せる', () => {
    for (const e of Object.values(demoDayEntries(SAT))) {
      for (const p of e.photos) expect(demoChartFromPath(p.path)).not.toBeNull()
      for (const b of e.blocks) {
        if (b.kind === 'image') expect(demoChartFromPath(b.path)).not.toBeNull()
      }
    }
  })

  it('どの日も空ではない。空だと「書いていない日」の見た目になる', () => {
    for (const e of Object.values(demoDayEntries(SAT))) expect(isEmpty(e)).toBe(false)
  })

  it('印は日ごとに重ならない。並べ替えても取り違えない', () => {
    const ids = Object.values(demoDayEntries(SAT)).flatMap((e) => [
      ...e.photos.map((p) => p.id),
      ...e.blocks.map((b) => b.id),
    ])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('何度組み立てても同じ。開き直すと中身が変わる、が起きない', () => {
    expect(demoDayEntries(SAT)).toEqual(demoDayEntries(SAT))
  })

  it('一覧に出す題名と本文が、日記と食い違わない', () => {
    const { notes, titles } = demoDayText(SAT)
    const entries = demoDayEntries(SAT)
    for (const [day, e] of Object.entries(entries)) {
      expect(titles[day]).toBe(e.title)
      expect(notes[day]).toBe(plainText(e.blocks))
      expect(notes[day].length).toBeGreaterThan(20)
    }
  })

  it('日付は未来にならない', () => {
    for (const day of demoEntryDays(SAT)) expect(day <= SAT).toBe(true)
  })
})

describe('サンプルの取引', () => {
  const trades = demoTrades(SAT)

  it('十分な件数がある。少ないと分析のグラフが立たない', () => {
    expect(trades.length).toBeGreaterThanOrEqual(30)
  })

  it('日記のある日には、必ず取引が入っている', () => {
    const days = new Set(trades.map((t) => jstDayKey(t.open_time)))
    for (const day of demoEntryDays(SAT)) expect(days.has(day)).toBe(true)
  })

  it('保存した時刻から日本時間の日付に戻したとき、置いた日と一致する', () => {
    // ここがずれると、日記とトレードが別の日に散らばる
    for (const t of trades) {
      expect(jstDayKey(t.open_time)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(t.close_time).not.toBeNull()
    }
  })

  it('型が付いている取引と、付いていない取引が混ざっている', () => {
    expect(trades.some((t) => t.setup)).toBe(true)
    expect(trades.some((t) => !t.setup)).toBe(true)
  })

  it('損切りを置き忘れた取引も混ざっている。置けた割合を出す意味が出る', () => {
    expect(trades.some((t) => t.sl == null)).toBe(true)
    expect(trades.some((t) => t.sl != null)).toBe(true)
  })

  it('勝ちと負けの両方がある', () => {
    expect(trades.some((t) => t.profit > 0)).toBe(true)
    expect(trades.some((t) => t.profit < 0)).toBe(true)
  })

  it('2つの口座に分かれている', () => {
    const ids = new Set(trades.map((t) => t.account_id))
    for (const a of DEMO_ACCOUNTS) expect(ids.has(a.id)).toBe(true)
  })

  it('番号は重ならない', () => {
    expect(new Set(trades.map((t) => t.id)).size).toBe(trades.length)
  })

  it('何度作っても同じ。読み込み直すと数字が変わる、が起きない', () => {
    expect(demoTrades(SAT)).toEqual(demoTrades(SAT))
  })
})

describe('取引に貼ってあるサンプルのチャート', () => {
  it('サンプルの取引だけが持つ。本物のIDとはぶつからない', () => {
    expect(isDemoId('demo-5')).toBe(true)
    expect(isDemoId('3f0c1a2e-0000-4000-8000-000000000000')).toBe(false)
    expect(demoTradeImages('3f0c1a2e-0000-4000-8000-000000000000')).toEqual([])
  })

  it('貼ってある取引と、貼っていない取引がある', () => {
    expect(demoTradeImages('demo-5').length).toBe(2)
    expect(demoTradeImages('demo-6').length).toBe(0)
  })

  it('貼ってある絵は、そのまま表示できる形で入っている', () => {
    for (const img of demoTradeImages('demo-10')) {
      expect(img.image.startsWith('data:image/svg+xml')).toBe(true)
      expect(img.caption).toBeTruthy()
    }
  })

  it('枚数を数えるだけのときは、絵を組み立てない', () => {
    const counts = demoTradeImageCounts(['demo-0', 'demo-1', 'demo-5', 'not-demo'])
    expect(counts).toEqual({ 'demo-0': 2, 'demo-5': 2 })
  })
})
