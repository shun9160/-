/**
 * 取引記録からの採点。
 *
 * 仕様書の指標のうち、このアプリがまだ持っていないもの
 * （戦略タグ、セットアップタグ、エントリー機会の実行率、チェックリスト）は
 * score を null にして、残りのウェイトで割り直す。
 * 「記録していないだけ」で低いタイプにならないようにするため、
 * 欠けた指標を0点として扱うことは絶対にしない。
 */

import type { EnrichedTrade } from '../types'
import { BEHAVIOR_WEIGHTS, THRESHOLDS } from './config'
import {
  clamp,
  combineIndicators,
  consistencyScore,
  inverseScale,
  mean,
  normalizedEntropy,
  ratioScore,
  scale,
} from './scoring'
import type { Indicator } from './scoring'
import { TYPE_IDS } from './types'
import type { PartialScoreMap, TypeId } from './types'

export interface BehaviorInput {
  /** 時系列の昇順 */
  trades: EnrichedTrade[]
  /** 日付(YYYY-MM-DD) -> その日のメモ */
  dayNotes: Record<string, string | null>
  /** 口座の原資。0 なら資金比率を使う指標は判定不能にする */
  initialCapital: number
  /** 1ロットの通貨量 */
  lotSize: number
  now: Date
}

const MIN_SAMPLE = 3

function hasNote(t: EnrichedTrade, dayNotes: Record<string, string | null>): boolean {
  if (t.note && t.note.trim() !== '') return true
  const d = dayNotes[t.jstDay]
  return Boolean(d && d.trim() !== '')
}

function ratio(hit: number, total: number): number | null {
  if (total <= 0) return null
  return hit / total
}

function profitFactor(list: EnrichedTrade[]): number | null {
  const gain = list.filter((t) => t.netProfit > 0).reduce((a, t) => a + t.netProfit, 0)
  const loss = Math.abs(list.filter((t) => t.netProfit < 0).reduce((a, t) => a + t.netProfit, 0))
  if (loss === 0) return gain > 0 ? Infinity : null
  return gain / loss
}

/** 損益の積み上げから、いちばん深く沈んだ額を出す */
function maxDrawdown(list: EnrichedTrade[]): number {
  let equity = 0
  let peak = 0
  let worst = 0
  for (const t of list) {
    equity += t.netProfit
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > worst) worst = dd
  }
  return worst
}

function countBy<T>(list: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of list) {
    const k = key(item)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

// ---------------------------------------------------------------
// 指標
// ---------------------------------------------------------------

export interface TradeMetrics {
  count: number
  activeDays: number
  tradesPerDay: number | null
  avgHoldMinutes: number | null
  avgPlannedRR: number | null
  slRate: number | null
  slTpRate: number | null
  journalRate: number | null
  lossJournalRate: number | null
  riskConsistency: number | null
  avgRiskPct: number | null
  drawdownPct: number | null
  maxDrawdown: number
  netTotal: number
  lossWithinPlanRate: number | null
  sessionEntropy: number | null
  symbolEntropy: number | null
  multiContextProfit: number | null
  winRate: number | null
  revengeRate: number | null
  afterLossDiscipline: number | null
  recoveryFactor: number | null
  improvementTrend: number | null
  improvedMetrics: string[]
  worsenedMetrics: string[]
  /** 最終取引からの日数 */
  daysSinceLast: number | null
  /** 最初と最後の取引の間隔(日) */
  spanDays: number
}

export function tradeMetrics(input: BehaviorInput): TradeMetrics {
  const { trades, dayNotes, initialCapital, lotSize, now } = input
  const n = trades.length

  const days = new Set(trades.map((t) => t.jstDay))
  const activeDays = days.size

  const holds = trades
    .filter((t) => t.closeJst)
    .map((t) => (t.closeJst!.getTime() - t.openJst.getTime()) / 60000)
    .filter((m) => m >= 0)

  const rrs = trades.map((t) => t.plannedRR).filter((v): v is number => v != null && v > 0)

  const withSl = trades.filter((t) => t.sl != null).length
  const withSlTp = trades.filter((t) => t.sl != null && t.tp != null).length

  const journaled = trades.filter((t) => hasNote(t, dayNotes)).length
  const losers = trades.filter((t) => t.netProfit < 0)
  const lossJournaled = losers.filter((t) => hasNote(t, dayNotes)).length

  // 1取引あたりの想定損失（通貨量）。倍率は共通なので一貫性の判定では相殺される。
  const riskUnits = trades
    .filter((t) => t.riskPrice != null && t.riskPrice > 0)
    .map((t) => (t.riskPrice as number) * t.volume)

  const riskPcts =
    initialCapital > 0 ? riskUnits.map((u) => ((u * lotSize) / initialCapital) * 100) : []

  const dd = maxDrawdown(trades)
  const netTotal = trades.reduce((a, t) => a + t.netProfit, 0)

  const plannedLossChecked = losers.filter((t) => t.riskPrice != null && t.riskPrice > 0)
  const withinPlan = plannedLossChecked.filter(
    (t) =>
      Math.abs(t.netProfit) <=
      (t.riskPrice as number) * t.volume * lotSize * THRESHOLDS.lossOverrun,
  ).length

  const sessionCounts = Object.values(countBy(trades, (t) => t.session))
  const symbolCounts = countBy(trades, (t) => t.symbol)

  // 「手法が多い」だけでなく、複数の場面で利益を出せているかを見る
  const bigEnough = Object.entries(symbolCounts).filter(
    ([, c]) => c >= THRESHOLDS.minTradesPerBucket,
  )
  const multiContextProfit =
    bigEnough.length >= 2
      ? bigEnough.filter(
          ([sym]) =>
            trades.filter((t) => t.symbol === sym).reduce((a, t) => a + t.netProfit, 0) > 0,
        ).length / bigEnough.length
      : null

  // 損失を確定した直後の入り直し
  let afterLoss = 0
  let revenge = 0
  let disciplined = 0
  for (let i = 1; i < n; i++) {
    const prevLoss = [...trades.slice(0, i)]
      .reverse()
      .find((p) => p.closeJst && p.closeJst.getTime() <= trades[i].openJst.getTime())
    if (!prevLoss || prevLoss.netProfit >= 0) continue
    afterLoss += 1
    const gapMin = (trades[i].openJst.getTime() - prevLoss.closeJst!.getTime()) / 60000
    if (gapMin <= THRESHOLDS.revengeMinutes) revenge += 1
    // 損失のあとも、損切りを置いて、ロットを増やさずに入れたか
    if (trades[i].sl != null && trades[i].volume <= prevLoss.volume * 1.5) disciplined += 1
  }

  const wins = trades.filter((t) => t.win).length

  const rf =
    dd > 0 ? netTotal / dd : netTotal > 0 ? THRESHOLDS.recoveryFactor.high : n > 0 ? 0 : null

  const trend = improvement(trades, now)

  const last = trades[n - 1]
  const first = trades[0]

  return {
    count: n,
    activeDays,
    tradesPerDay: activeDays > 0 ? n / activeDays : null,
    avgHoldMinutes: holds.length >= MIN_SAMPLE ? mean(holds) : null,
    avgPlannedRR: rrs.length >= MIN_SAMPLE ? mean(rrs) : null,
    slRate: ratio(withSl, n),
    slTpRate: ratio(withSlTp, n),
    journalRate: ratio(journaled, n),
    lossJournalRate: losers.length >= MIN_SAMPLE ? ratio(lossJournaled, losers.length) : null,
    riskConsistency: riskUnits.length >= MIN_SAMPLE ? consistencyScore(riskUnits) : null,
    avgRiskPct: riskPcts.length >= MIN_SAMPLE ? mean(riskPcts) : null,
    drawdownPct: initialCapital > 0 && n >= MIN_SAMPLE ? (dd / initialCapital) * 100 : null,
    maxDrawdown: dd,
    netTotal,
    lossWithinPlanRate:
      plannedLossChecked.length >= MIN_SAMPLE
        ? ratio(withinPlan, plannedLossChecked.length)
        : null,
    sessionEntropy: n >= MIN_SAMPLE ? normalizedEntropy(sessionCounts) : null,
    symbolEntropy: n >= MIN_SAMPLE ? normalizedEntropy(Object.values(symbolCounts)) : null,
    multiContextProfit,
    winRate: n >= MIN_SAMPLE ? wins / n : null,
    revengeRate: afterLoss >= MIN_SAMPLE ? revenge / afterLoss : null,
    afterLossDiscipline: afterLoss >= MIN_SAMPLE ? disciplined / afterLoss : null,
    recoveryFactor: rf,
    improvementTrend: trend.score,
    improvedMetrics: trend.improved,
    worsenedMetrics: trend.worsened,
    daysSinceLast: last ? (now.getTime() - last.openJst.getTime()) / 86400000 : null,
    spanDays:
      first && last ? (last.openJst.getTime() - first.openJst.getTime()) / 86400000 : 0,
  }
}

/**
 * 直近30日と、その前の30日を比べる。
 * どちらかの期間の取引が足りないときは判定しない（0点にはしない）。
 */
function improvement(
  trades: EnrichedTrade[],
  now: Date,
): { score: number | null; improved: string[]; worsened: string[] } {
  const w = THRESHOLDS.trendWindowDays * 86400000
  const t1 = now.getTime() - w
  const t0 = now.getTime() - w * 2
  const recent = trades.filter((t) => t.openJst.getTime() >= t1)
  const before = trades.filter((t) => {
    const ms = t.openJst.getTime()
    return ms >= t0 && ms < t1
  })
  if (recent.length < MIN_SAMPLE || before.length < MIN_SAMPLE) {
    return { score: null, improved: [], worsened: [] }
  }

  const improved: string[] = []
  const worsened: string[] = []
  const compare = (label: string, a: number | null, b: number | null, higherIsBetter: boolean) => {
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return
    if (a === b) return
    const better = higherIsBetter ? a > b : a < b
    ;(better ? improved : worsened).push(label)
  }

  const net = (l: EnrichedTrade[]) => l.reduce((x, t) => x + t.netProfit, 0)
  const adherence = (l: EnrichedTrade[]) => l.filter((t) => t.sl != null).length / l.length
  const expectancy = (l: EnrichedTrade[]) => net(l) / l.length

  compare('純損益', net(recent), net(before), true)
  compare('プロフィットファクター', finite(profitFactor(recent)), finite(profitFactor(before)), true)
  compare('最大ドローダウン', maxDrawdown(recent), maxDrawdown(before), false)
  compare('損切りを置いた割合', adherence(recent), adherence(before), true)
  compare('1取引あたりの期待値', expectancy(recent), expectancy(before), true)

  const judged = improved.length + worsened.length
  if (judged === 0) return { score: null, improved, worsened }
  return { score: clamp((improved.length / judged) * 100), improved, worsened }
}

function finite(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return v
}

// ---------------------------------------------------------------
// タイプごとのスコア
// ---------------------------------------------------------------

export interface BehaviorResult {
  scores: PartialScoreMap
  indicators: Record<TypeId, Indicator[]>
  /** 取れた指標のウェイト合計 */
  available: Record<TypeId, number>
  metrics: TradeMetrics
}

const pct = (v: number | null) => (v == null ? null : `${Math.round(v * 100)}%`)

export function scoreBehavior(input: BehaviorInput): BehaviorResult {
  const m = tradeMetrics(input)
  const w = BEHAVIOR_WEIGHTS
  const T = THRESHOLDS

  const byType: Record<TypeId, Indicator[]> = {
    BLAZE: [
      ind('tradesPerDay', '1日あたりの取引数', w.BLAZE.tradesPerDay,
        m.tradesPerDay == null ? null : scale(m.tradesPerDay, T.tradesPerDay.low, T.tradesPerDay.high),
        m.tradesPerDay == null ? null : `${m.tradesPerDay.toFixed(1)}件/日`),
      ind('shortHold', '保有時間の短さ', w.BLAZE.shortHold,
        m.avgHoldMinutes == null ? null : inverseScale(m.avgHoldMinutes, T.holdMinutes.low, T.holdMinutes.high),
        m.avgHoldMinutes == null ? null : `平均${Math.round(m.avgHoldMinutes)}分`),
      ind('plannedRR', '狙っている利益幅（計画RR）', w.BLAZE.plannedRR,
        m.avgPlannedRR == null ? null : scale(m.avgPlannedRR, T.plannedRR.low, T.plannedRR.high),
        m.avgPlannedRR == null ? null : `平均${m.avgPlannedRR.toFixed(2)}`),
      ind('momentumTagRate', '勢いを狙った取引の割合', w.BLAZE.momentumTagRate, null, null),
      ind('executionRate', '見つけた機会に対する実行率', w.BLAZE.executionRate, null, null),
    ],
    LOGIC: [
      ind('slTpRate', '損切りと利確を先に決めた割合', w.LOGIC.slTpRate,
        m.slTpRate == null ? null : ratioScore(m.slTpRate), pct(m.slTpRate)),
      ind('journalRate', '取引の記録を残した割合', w.LOGIC.journalRate,
        m.journalRate == null ? null : ratioScore(m.journalRate), pct(m.journalRate)),
      ind('riskConsistency', '1取引あたりのリスク幅のそろい方', w.LOGIC.riskConsistency,
        m.riskConsistency, m.riskConsistency == null ? null : `${Math.round(m.riskConsistency)}点`),
      ind('setupTagConsistency', '手法タグの一貫性', w.LOGIC.setupTagConsistency, null, null),
    ],
    GUARD: [
      ind('slRate', '損切りを置いた割合', w.GUARD.slRate,
        m.slRate == null ? null : ratioScore(m.slRate), pct(m.slRate)),
      ind('lowRiskPct', '1取引あたりのリスクの小ささ', w.GUARD.lowRiskPct,
        m.avgRiskPct == null ? null : inverseScale(m.avgRiskPct, T.riskPct.low, T.riskPct.high),
        m.avgRiskPct == null ? null : `平均${m.avgRiskPct.toFixed(2)}%`),
      ind('lowDrawdown', '資金の落ち込みの小ささ', w.GUARD.lowDrawdown,
        m.drawdownPct == null ? null : inverseScale(m.drawdownPct, T.drawdownPct.low, T.drawdownPct.high),
        m.drawdownPct == null ? null : `最大${m.drawdownPct.toFixed(1)}%`),
      ind('lossWithinPlan', '決めた損切り幅の中で終えた割合', w.GUARD.lossWithinPlan,
        m.lossWithinPlanRate == null ? null : ratioScore(m.lossWithinPlanRate), pct(m.lossWithinPlanRate)),
    ],
    SHIFT: [
      ind('strategyEntropy', '使っている戦略の幅', w.SHIFT.strategyEntropy, null, null),
      ind('sessionEntropy', '取引する時間帯の幅', w.SHIFT.sessionEntropy,
        m.sessionEntropy, m.sessionEntropy == null ? null : `${Math.round(m.sessionEntropy)}点`),
      ind('symbolEntropy', '扱っている銘柄の幅', w.SHIFT.symbolEntropy,
        m.symbolEntropy, m.symbolEntropy == null ? null : `${Math.round(m.symbolEntropy)}点`),
      ind('multiContextProfit', '複数の銘柄で利益を出せている割合', w.SHIFT.multiContextProfit,
        m.multiContextProfit == null ? null : ratioScore(m.multiContextProfit), pct(m.multiContextProfit)),
    ],
    WATCH: [
      ind('fewTradesPerDay', '1日あたりの取引数の少なさ', w.WATCH.fewTradesPerDay,
        m.tradesPerDay == null ? null : inverseScale(m.tradesPerDay, T.tradesPerDay.low, T.tradesPerDay.high),
        m.tradesPerDay == null ? null : `${m.tradesPerDay.toFixed(1)}件/日`),
      ind('winRate', '勝率', w.WATCH.winRate,
        m.winRate == null ? null : ratioScore(m.winRate), pct(m.winRate)),
      ind('slTpRate', '損切りと利確を先に決めた割合', w.WATCH.slTpRate,
        m.slTpRate == null ? null : ratioScore(m.slTpRate), pct(m.slTpRate)),
      ind('noRevenge', '損切り直後に入り直していない割合', w.WATCH.noRevenge,
        m.revengeRate == null ? null : ratioScore(1 - m.revengeRate),
        m.revengeRate == null ? null : pct(1 - m.revengeRate)),
      ind('planNoteRate', '事前計画・チェックリストの記入率', w.WATCH.planNoteRate, null, null),
    ],
    RISE: [
      ind('recoveryFactor', '落ち込みからの回復力', w.RISE.recoveryFactor,
        m.recoveryFactor == null ? null : scale(m.recoveryFactor, T.recoveryFactor.low, T.recoveryFactor.high),
        m.recoveryFactor == null ? null : m.recoveryFactor.toFixed(2)),
      ind('afterLossDiscipline', '負けたあとも決めた通りに入れた割合', w.RISE.afterLossDiscipline,
        m.afterLossDiscipline == null ? null : ratioScore(m.afterLossDiscipline), pct(m.afterLossDiscipline)),
      ind('lossJournalRate', '負けた取引の記録率', w.RISE.lossJournalRate,
        m.lossJournalRate == null ? null : ratioScore(m.lossJournalRate), pct(m.lossJournalRate)),
      ind('improvementTrend', '直近30日の改善傾向', w.RISE.improvementTrend,
        m.improvementTrend, m.improvementTrend == null ? null : `${Math.round(m.improvementTrend)}点`),
    ],
  }

  const scores = {} as PartialScoreMap
  const available = {} as Record<TypeId, number>
  for (const id of TYPE_IDS) {
    const c = combineIndicators(byType[id])
    scores[id] = c.score
    available[id] = c.available
  }

  return { scores, indicators: byType, available, metrics: m }
}

function ind(
  key: string,
  label: string,
  weight: number,
  score: number | null,
  value: string | number | null,
): Indicator {
  return { key, label, weight, score, value }
}
