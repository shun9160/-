import type { EnrichedTrade, SessionKey, Trade } from './types'
import { jstDayKey, sessionOf } from './timezone'

/** 価格差の許容誤差 (TP/SL 到達判定用) */
const HIT_TOLERANCE_RATIO = 0.0005 // 0.05%

/** 生のトレードに RR・Rマルチプル・セッションなどの指標を付与する */
export function enrichTrade(t: Trade): EnrichedTrade {
  const openJst = new Date(t.open_time)
  const closeJst = t.close_time ? new Date(t.close_time) : null
  const netProfit = (t.profit ?? 0) + (t.commission ?? 0) + (t.swap ?? 0)

  const dir = t.side === 'buy' ? 1 : -1

  // リスク幅 (エントリーと SL の距離)
  const riskPrice = t.sl != null ? Math.abs(t.open_price - t.sl) : null

  // 計画リスクリワード
  const rewardPrice = t.tp != null ? Math.abs(t.tp - t.open_price) : null
  const plannedRR =
    riskPrice && riskPrice > 0 && rewardPrice != null ? rewardPrice / riskPrice : null

  // 実現値幅 (方向考慮)
  const resultPrice =
    t.close_price != null ? (t.close_price - t.open_price) * dir : null

  const rMultiple =
    resultPrice != null && riskPrice && riskPrice > 0 ? resultPrice / riskPrice : null

  const capturedRatio =
    resultPrice != null && rewardPrice != null && rewardPrice > 0
      ? resultPrice / rewardPrice
      : null

  // TP/SL 到達判定 (決済価格が TP/SL 近傍か)
  const tol = t.open_price * HIT_TOLERANCE_RATIO
  const tpHit =
    t.tp != null && t.close_price != null && Math.abs(t.close_price - t.tp) <= tol
  const slHit =
    t.sl != null && t.close_price != null && Math.abs(t.close_price - t.sl) <= tol

  return {
    ...t,
    netProfit,
    plannedRR,
    riskPrice,
    resultPrice,
    rMultiple,
    capturedRatio,
    tpHit,
    slHit,
    win: netProfit > 0,
    openJst,
    closeJst,
    jstDay: jstDayKey(t.open_time),
    session: sessionOf(t.open_time),
  }
}

export function enrichAll(trades: Trade[]): EnrichedTrade[] {
  return trades
    .map(enrichTrade)
    .sort((a, b) => a.openJst.getTime() - b.openJst.getTime())
}

// ---------------------------------------------------------------
// 集計
// ---------------------------------------------------------------

export interface Summary {
  count: number
  netTotal: number
  grossTotal: number
  commissionTotal: number
  swapTotal: number
  wins: number
  losses: number
  winRate: number // 0-1
  avgPlannedRR: number | null
  avgRMultiple: number | null
  /** TP が設定されたトレードのうち実際に TP 利確できた割合 */
  tpHitRate: number | null
  /** 平均で TP 目標の何%を取れたか */
  avgCapturedRatio: number | null
  totalVolume: number
  avgVolume: number
  profitFactor: number | null
  bestDay: { day: string; net: number } | null
  worstDay: { day: string; net: number } | null
}

export function summarize(trades: EnrichedTrade[]): Summary {
  const count = trades.length
  const netTotal = sum(trades.map((t) => t.netProfit))
  const grossTotal = sum(trades.map((t) => t.profit))
  const commissionTotal = sum(trades.map((t) => t.commission))
  const swapTotal = sum(trades.map((t) => t.swap))
  const wins = trades.filter((t) => t.win).length
  const losses = trades.filter((t) => t.netProfit < 0).length

  const rrValues = trades.map((t) => t.plannedRR).filter(isNum)
  const rMultiples = trades.map((t) => t.rMultiple).filter(isNum)
  const withTp = trades.filter((t) => t.tp != null)
  const captured = trades.map((t) => t.capturedRatio).filter(isNum)

  const grossWin = sum(trades.filter((t) => t.netProfit > 0).map((t) => t.netProfit))
  const grossLoss = Math.abs(
    sum(trades.filter((t) => t.netProfit < 0).map((t) => t.netProfit)),
  )

  const byDay = groupNetByDay(trades)
  const dayEntries = Object.entries(byDay).map(([day, net]) => ({ day, net }))
  const bestDay = dayEntries.length
    ? dayEntries.reduce((a, b) => (b.net > a.net ? b : a))
    : null
  const worstDay = dayEntries.length
    ? dayEntries.reduce((a, b) => (b.net < a.net ? b : a))
    : null

  return {
    count,
    netTotal,
    grossTotal,
    commissionTotal,
    swapTotal,
    wins,
    losses,
    winRate: count ? wins / count : 0,
    avgPlannedRR: rrValues.length ? avg(rrValues) : null,
    avgRMultiple: rMultiples.length ? avg(rMultiples) : null,
    tpHitRate: withTp.length ? withTp.filter((t) => t.tpHit).length / withTp.length : null,
    avgCapturedRatio: captured.length ? avg(captured) : null,
    totalVolume: sum(trades.map((t) => t.volume)),
    avgVolume: count ? sum(trades.map((t) => t.volume)) / count : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
    bestDay,
    worstDay,
  }
}

export function groupNetByDay(trades: EnrichedTrade[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of trades) {
    out[t.jstDay] = (out[t.jstDay] ?? 0) + t.netProfit
  }
  return out
}

export interface DailyPoint {
  day: string
  net: number
}

/** 日別 PNL (日本時間) を昇順で返す */
export function dailySeries(trades: EnrichedTrade[]): DailyPoint[] {
  const byDay = groupNetByDay(trades)
  return Object.entries(byDay)
    .map(([day, net]) => ({ day, net }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

/** 累積 PNL */
export function cumulativeSeries(trades: EnrichedTrade[]): DailyPoint[] {
  let acc = 0
  return dailySeries(trades).map((p) => {
    acc += p.net
    return { day: p.day, net: acc }
  })
}

export interface SessionStat {
  key: SessionKey
  count: number
  net: number
  winRate: number
}

export function sessionBreakdown(trades: EnrichedTrade[]): SessionStat[] {
  const keys: SessionKey[] = ['tokyo', 'london', 'ny', 'other']
  return keys
    .map((key) => {
      const arr = trades.filter((t) => t.session === key)
      return {
        key,
        count: arr.length,
        net: sum(arr.map((t) => t.netProfit)),
        winRate: arr.length ? arr.filter((t) => t.win).length / arr.length : 0,
      }
    })
    .filter((s) => s.count > 0)
}

export interface HourStat {
  hour: number
  count: number
  net: number
}

/** 日本時間の時間帯別 (0-23時) 集計 */
export function hourBreakdown(trades: EnrichedTrade[]): HourStat[] {
  const byHour: Record<number, { count: number; net: number }> = {}
  for (const t of trades) {
    // openJst は UTC 瞬間。JST = +9h。
    const hh = (t.openJst.getUTCHours() + 9) % 24
    byHour[hh] = byHour[hh] || { count: 0, net: 0 }
    byHour[hh].count += 1
    byHour[hh].net += t.netProfit
  }
  return Object.entries(byHour)
    .map(([h, v]) => ({ hour: +h, count: v.count, net: v.net }))
    .sort((a, b) => a.hour - b.hour)
}

// ---------------------------------------------------------------
// 小物
// ---------------------------------------------------------------
function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}
function avg(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : 0
}
function isNum(x: number | null | undefined): x is number {
  return typeof x === 'number' && !isNaN(x) && isFinite(x)
}
