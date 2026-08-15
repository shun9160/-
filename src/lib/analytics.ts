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

/**
 * 直近N日と、その1つ前の同じ長さの期間を比べる。
 * 「前の期間から何%」を出すために使う。
 */
export interface PeriodCompare {
  current: EnrichedTrade[]
  previous: EnrichedTrade[]
  /** 増減率。前の期間が0なら比較できないので null */
  ratioOf: (pick: (t: EnrichedTrade[]) => number) => number | null
}

export function comparePeriods(
  trades: EnrichedTrade[],
  days: number,
  now = Date.now(),
): PeriodCompare {
  if (days <= 0) {
    return { current: trades, previous: [], ratioOf: () => null }
  }
  const span = days * 86400_000
  const from = now - span
  const prevFrom = from - span

  const current = trades.filter((t) => t.openJst.getTime() >= from)
  const previous = trades.filter(
    (t) => t.openJst.getTime() >= prevFrom && t.openJst.getTime() < from,
  )

  return {
    current,
    previous,
    ratioOf: (pick) => {
      const a = pick(current)
      const b = pick(previous)
      if (!isFinite(a) || !isFinite(b) || b === 0) return null
      return (a - b) / Math.abs(b)
    },
  }
}

/** 純損益の合計 */
export function netOf(trades: EnrichedTrade[]): number {
  return trades.reduce((s, t) => s + t.netProfit, 0)
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

// ---------------------------------------------------------------
// ホーム画面で使う、もう少し踏み込んだ数字
// ---------------------------------------------------------------

/** 連勝・連敗の様子 */
export interface StreakInfo {
  /** いま何連勝か（負けが続いていれば 0） */
  winStreak: number
  /** いま何連敗か（勝ちが続いていれば 0） */
  lossStreak: number
  /** これまでの最高連勝 */
  bestWinStreak: number
}

export function streakOf(trades: EnrichedTrade[]): StreakInfo {
  const sorted = [...trades].sort((a, b) => a.openJst.getTime() - b.openJst.getTime())
  let best = 0
  let run = 0
  for (const t of sorted) {
    run = t.win ? run + 1 : 0
    if (run > best) best = run
  }
  // いまの連続。うしろから同じ結果が続くあいだ数える
  let winStreak = 0
  let lossStreak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].win) {
      if (lossStreak > 0) break
      winStreak++
    } else {
      if (winStreak > 0) break
      lossStreak++
    }
  }
  return { winStreak, lossStreak, bestWinStreak: best }
}

/** 日ごとの成績から分かること */
export interface DailyStats {
  /** いちばん勝った日の額 */
  bestDayNet: number | null
  /** 資産のいちばん大きな落ち込み（累積の山からの下げ幅、マイナスで表す） */
  maxDrawdown: number | null
  /** 取引した日1日あたりの平均損益 */
  avgDailyNet: number | null
}

export function dailyStats(trades: EnrichedTrade[]): DailyStats {
  const days = dailySeries(trades)
  if (days.length === 0) return { bestDayNet: null, maxDrawdown: null, avgDailyNet: null }

  let peak = 0
  let cum = 0
  let maxDd = 0
  for (const d of days) {
    cum += d.net
    if (cum > peak) peak = cum
    const dd = cum - peak
    if (dd < maxDd) maxDd = dd
  }
  return {
    bestDayNet: Math.max(...days.map((d) => d.net)),
    maxDrawdown: maxDd,
    avgDailyNet: days.reduce((s, d) => s + d.net, 0) / days.length,
  }
}

/** 決済までの平均の長さ（分）。決済時刻がある取引だけで見る */
export function avgHoldMinutes(trades: EnrichedTrade[]): number | null {
  const held = trades
    .filter((t) => t.closeJst)
    .map((t) => (t.closeJst!.getTime() - t.openJst.getTime()) / 60000)
    .filter((m) => m >= 0)
  if (held.length === 0) return null
  return held.reduce((s, m) => s + m, 0) / held.length
}

/** 「2時間18分」のように読める形にする */
export function fmtDuration(minutes: number | null): string {
  if (minutes == null) return '—'
  const m = Math.round(minutes)
  if (m < 60) return `${m}分`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h}時間` : `${h}時間 ${rest}分`
}

/** 今日と昨日をくらべる */
export interface TodayCompare {
  todayNet: number
  yesterdayNet: number
  diff: number
  /** 昨日に対する増減の割合。くらべても意味が出ないときは null */
  ratio: number | null
  todayCount: number
}

/**
 * 「何%」を出していい上限。
 *
 * 昨日がほぼ行って来いだった日は、割り算の分母が小さすぎて
 * 「+4749%」のような数が出る。数としては正しいが、読む人には
 * 何も伝わらないし、壊れているようにしか見えない。
 * 何倍もの差になった時点で、%より円の差のほうが分かりやすい。
 */
const RATIO_LIMIT = 10

export function compareWithYesterday(
  trades: EnrichedTrade[],
  todayKey: string,
  yesterdayKey: string,
): TodayCompare {
  const today = trades.filter((t) => t.jstDay === todayKey)
  const yest = trades.filter((t) => t.jstDay === yesterdayKey)
  const todayNet = netOf(today)
  const yesterdayNet = netOf(yest)
  const ratio = yesterdayNet === 0 ? null : (todayNet - yesterdayNet) / Math.abs(yesterdayNet)
  return {
    todayNet,
    yesterdayNet,
    diff: todayNet - yesterdayNet,
    ratio: ratio == null || Math.abs(ratio) >= RATIO_LIMIT ? null : ratio,
    todayCount: today.length,
  }
}

/**
 * 1件の取引を5段階で評価する。
 *
 * 予想ではなく、記録された事実だけから決めている:
 *  ・損切りを置いていたか（置いていないと大きな負けにつながる）
 *  ・決めた通りに終われたか（TP/SL に届いたか、途中でやめたか）
 *  ・損益比の計画と結果
 * 「当たったから偉い」ではなく「決めた通りにやれたか」を見る。
 */
export interface TradeGrade {
  /** 1〜5 */
  stars: number
  /** なぜその評価か */
  reason: string
}

export function gradeTrade(t: EnrichedTrade): TradeGrade {
  // 損切りを置いていない取引は、勝っていても運任せなので上限を作る
  if (t.sl == null) {
    return t.win
      ? { stars: 3, reason: '損切りを置かずに勝った取引です' }
      : { stars: 1, reason: '損切りを置かずに負けた取引です' }
  }

  if (t.tpHit) return { stars: 5, reason: '決めた利確ラインまで持てました' }
  if (t.slHit) return { stars: 3, reason: '決めた損切りで止められました' }

  if (t.win) {
    // 狙いのどれくらいを取れたか
    const c = t.capturedRatio
    if (c != null && c >= 0.7) return { stars: 5, reason: '狙いのほとんどを取れました' }
    if (c != null && c >= 0.4) return { stars: 4, reason: '狙いの半分ほどを取れました' }
    return { stars: 4, reason: '計画どおりに利確できました' }
  }

  // 負け。損切りより手前で切れていれば傷は浅い
  const r = t.rMultiple
  if (r != null && r > -1) return { stars: 3, reason: '損切りより手前で止められました' }
  return { stars: 2, reason: '決めた損切りより深く負けています' }
}

// ---------------------------------------------------------------
// 分析ページで使う集計
// ---------------------------------------------------------------

/** 曜日 × 時間の升目。曜日は月曜=0 */
export interface HeatCell {
  weekday: number
  hour: number
  count: number
  net: number
}

export function heatmap(trades: EnrichedTrade[]): HeatCell[] {
  const m = new Map<string, HeatCell>()
  for (const t of trades) {
    const jst = new Date(t.openJst.getTime() + 9 * 3600_000)
    const weekday = (jst.getUTCDay() + 6) % 7 // 月曜始まり
    const hour = jst.getUTCHours()
    const k = `${weekday}-${hour}`
    const cur = m.get(k) ?? { weekday, hour, count: 0, net: 0 }
    cur.count++
    cur.net += t.netProfit
    m.set(k, cur)
  }
  return [...m.values()]
}

/** 銘柄ごとの内訳 */
export interface SymbolStat {
  symbol: string
  count: number
  net: number
  share: number
}

export function symbolBreakdown(trades: EnrichedTrade[]): SymbolStat[] {
  const m = new Map<string, { count: number; net: number }>()
  for (const t of trades) {
    const cur = m.get(t.symbol) ?? { count: 0, net: 0 }
    cur.count++
    cur.net += t.netProfit
    m.set(t.symbol, cur)
  }
  const total = trades.length || 1
  return [...m.entries()]
    .map(([symbol, v]) => ({ symbol, ...v, share: v.count / total }))
    .sort((a, b) => b.count - a.count)
}

/** 勝ちと負けを並べてくらべる */
export interface WinLossCompare {
  winCount: number
  lossCount: number
  avgWin: number | null
  avgLoss: number | null
  maxWin: number | null
  maxLoss: number | null
}

export function winLossCompare(trades: EnrichedTrade[]): WinLossCompare {
  const wins = trades.filter((t) => t.netProfit > 0).map((t) => t.netProfit)
  const losses = trades.filter((t) => t.netProfit < 0).map((t) => t.netProfit)
  return {
    winCount: wins.length,
    lossCount: losses.length,
    avgWin: wins.length ? avg(wins) : null,
    avgLoss: losses.length ? avg(losses) : null,
    maxWin: wins.length ? Math.max(...wins) : null,
    maxLoss: losses.length ? Math.min(...losses) : null,
  }
}

/**
 * 記録の付け方と成績から、100点満点のめやすを出す。
 *
 * 当てにいくための点ではなく「続けられる形になっているか」を見る。
 * どう配点したかを内訳で必ず見せる（点だけ出すと理由が分からないため）。
 */
export interface ScorePart {
  label: string
  /** 得点 */
  got: number
  /** 満点 */
  max: number
  note: string
}

export interface ScoreResult {
  total: number
  parts: ScorePart[]
  /** 5段階の星 */
  stars: number
}

export function scoreOf(trades: EnrichedTrade[], sum: Summary): ScoreResult {
  const parts: ScorePart[] = []

  // 1) 損切りを置けているか（守りの土台）
  const withSl = trades.filter((t) => t.sl != null).length
  const slRate = trades.length ? withSl / trades.length : 0
  parts.push({
    label: '損切りを置けているか',
    got: Math.round(slRate * 30),
    max: 30,
    note: `${withSl}/${trades.length}件で設定`,
  })

  // 2) 勝ちが負けを上回っているか
  const pf = sum.profitFactor
  const pfScore = pf == null ? 0 : pf === Infinity ? 25 : Math.min(25, Math.round((pf / 2) * 25))
  parts.push({
    label: '勝ちと負けの大きさ',
    got: pfScore,
    max: 25,
    note: pf == null ? 'まだ判定できません' : pf === Infinity ? '負けなし' : `損益比 ${fmt2(pf)}`,
  })

  // 3) 決めた通りに終われているか
  const tp = sum.tpHitRate
  const tpScore = tp == null ? 0 : Math.min(25, Math.round(tp * 40))
  parts.push({
    label: '決めた通りに終われたか',
    got: tpScore,
    max: 25,
    note: tp == null ? 'TPの記録がありません' : `TP到達 ${Math.round(tp * 100)}%`,
  })

  // 4) 記録が続いているか
  const daysWith = new Set(trades.map((t) => t.jstDay)).size
  const keepScore = Math.min(20, daysWith * 2)
  parts.push({
    label: '記録が続いているか',
    got: keepScore,
    max: 20,
    note: `${daysWith}日ぶん`,
  })

  const total = parts.reduce((s, p) => s + p.got, 0)
  return { total, parts, stars: Math.max(1, Math.min(5, Math.round(total / 20))) }
}

function fmt2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** 次にやることの候補。記録から見つかったものだけを出す。 */
export interface ActionItem {
  key: string
  title: string
  why: string
}

export function suggestActions(trades: EnrichedTrade[], sum: Summary): ActionItem[] {
  const out: ActionItem[] = []
  if (trades.length < 3) return out

  const noSl = trades.filter((t) => t.sl == null)
  if (noSl.length > 0) {
    out.push({
      key: 'sl',
      title: '損切りを必ず置く',
      why: `${noSl.length}件が損切りなしです。1回の負けが大きくなりやすい状態です`,
    })
  }

  // いちばん負けている時間帯
  const hours = hourBreakdown(trades).filter((h) => h.count >= 2)
  const worst = hours.slice().sort((a, b) => a.net - b.net)[0]
  if (worst && worst.net < 0) {
    out.push({
      key: 'hour',
      title: `${worst.hour}時台の取引を見直す`,
      why: `この時間帯は ${worst.count}件で合計 ${Math.round(worst.net).toLocaleString('ja-JP')} です`,
    })
  }

  if (sum.tpHitRate != null && sum.tpHitRate < 0.3 && sum.avgCapturedRatio != null) {
    out.push({
      key: 'tp',
      title: '利確を決めた位置まで待つ',
      why: `狙いの ${Math.round(sum.avgCapturedRatio * 100)}% で終えています`,
    })
  }

  if (sum.avgPlannedRR != null && sum.avgPlannedRR < 1.2) {
    out.push({
      key: 'rr',
      title: '損益比の大きい形をねらう',
      why: `いまの狙いは平均 ${fmt2(sum.avgPlannedRR)} です`,
    })
  }

  const st = streakOf(trades)
  if (st.lossStreak >= 3) {
    out.push({
      key: 'streak',
      title: '一度、間を置く',
      why: `${st.lossStreak}連敗中です。記録を読み返してから再開しましょう`,
    })
  }
  return out
}
