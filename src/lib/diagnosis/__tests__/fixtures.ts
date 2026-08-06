/**
 * テスト用のサンプルデータ。
 *
 * タイプごとに「いかにもそのタイプらしい取引記録」を用意して、
 * 採点が意図通りに動いているかを見る。
 */

import { enrichAll } from '../../analytics'
import type { Side, Trade } from '../../types'
import { QUESTIONS } from '../questions'
import type { Answers, TypeId } from '../types'

let seq = 0

export interface TradeSpec {
  /** 'YYYY-MM-DD' (UTC基準で組み立てる) */
  day: string
  hour?: number
  minute?: number
  symbol?: string
  side?: Side
  volume?: number
  open?: number
  /** 損益。手数料とスワップは0にしてある */
  profit: number
  /** 損切り幅（価格）。null なら損切りなし */
  slPips?: number | null
  /** 利確幅（価格）。null なら利確なし */
  tpPips?: number | null
  holdMin?: number
  note?: string | null
}

export function makeTrade(s: TradeSpec): Trade {
  seq += 1
  const open = s.open ?? 100
  const side: Side = s.side ?? 'buy'
  const dir = side === 'buy' ? 1 : -1
  const sl = s.slPips == null ? null : open - dir * s.slPips
  const tp = s.tpPips == null ? null : open + dir * s.tpPips
  const openMs = Date.parse(
    `${s.day}T${String(s.hour ?? 9).padStart(2, '0')}:${String(s.minute ?? 0).padStart(2, '0')}:00Z`,
  )
  const holdMin = s.holdMin ?? 60
  return {
    id: `t${seq}`,
    account_id: 'acc',
    ticket: String(1000 + seq),
    symbol: s.symbol ?? 'USDJPY',
    side,
    volume: s.volume ?? 0.1,
    open_price: open,
    close_price: open + dir * (s.profit >= 0 ? 0.5 : -0.5),
    sl,
    tp,
    open_time: new Date(openMs).toISOString(),
    close_time: new Date(openMs + holdMin * 60000).toISOString(),
    commission: 0,
    swap: 0,
    profit: s.profit,
    currency: 'JPY',
    note: s.note ?? null,
    source: 'test',
  }
}

export function makeTrades(specs: TradeSpec[]) {
  return enrichAll(specs.map(makeTrade))
}

/** n件の、ごく普通の取引 */
export function plainTrades(n: number, base = '2026-07-01') {
  const start = Date.parse(`${base}T00:00:00Z`)
  return makeTrades(
    Array.from({ length: n }, (_, i) => ({
      day: new Date(start + i * 86400000).toISOString().slice(0, 10),
      hour: 9,
      profit: i % 2 === 0 ? 1000 : -800,
      slPips: 0.5,
      tpPips: 1,
    })),
  )
}

// ---------------------------------------------------------------
// アンケートの回答
// ---------------------------------------------------------------

/** 全部同じ数字で答える */
export function uniformAnswers(value: number): Answers {
  const a: Answers = {}
  for (const q of QUESTIONS) a[q.id] = value
  return a
}

/**
 * 指定タイプだけが高くなる回答。
 * 対象タイプは「そのタイプに近い方」、それ以外は「遠い方」に振る。
 */
export function answersFavoring(type: TypeId): Answers {
  const a: Answers = {}
  for (const q of QUESTIONS) {
    const near = q.reverse ? 1 : 5
    const far = q.reverse ? 5 : 1
    a[q.id] = q.type === type ? near : far
  }
  return a
}

export const NO_NOTES: Record<string, string | null> = {}

export const DEFAULT_ENV = {
  dayNotes: NO_NOTES,
  initialCapital: 1_000_000,
  lotSize: 100_000,
  now: new Date('2026-08-06T00:00:00Z'),
}
