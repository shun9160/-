/**
 * 総合判定。
 *
 * アンケートと取引データを、取引件数に応じた配分で合わせる。
 * 純粋関数（now も引数で受け取る）なので、同じ入力なら必ず同じ結果になる。
 */

import type { EnrichedTrade } from '../types'
import {
  CONFIDENCE_LABELS,
  CONFIDENCE_SCALES,
  CONFIDENCE_WEIGHTS,
  DIAGNOSIS_VERSION,
  DISPLAY_GAP,
  QUESTION_VERSION,
  SCORING_VERSION,
  STATUS_RULES,
  THRESHOLDS,
} from './config'
import { scoreBehavior } from './behavior'
import type { BehaviorResult } from './behavior'
import { scoreQuestionnaire } from './questionnaire'
import { clamp, scale } from './scoring'
import type { Indicator } from './scoring'
import { ACTION_TEMPLATES, CHARACTER_MESSAGES } from './messages'
import { TYPES, TYPE_IDS, emptyScores } from './types'
import type {
  Answers,
  CharacterState,
  DiagnosisResult,
  DiagnosisStatus,
  Evidence,
  PartialScoreMap,
  RecommendedAction,
  ScoreMap,
  TypeId,
} from './types'

export interface DiagnoseInput {
  userId: string
  diagnosisId: string
  answers: Answers
  /** 時系列の昇順 */
  trades: EnrichedTrade[]
  dayNotes: Record<string, string | null>
  initialCapital: number
  lotSize: number
  now: Date
  /** 同点が解けなかったときに、利用者が選んだタイプ */
  tiebreak?: TypeId | null
  createdAt?: string
}

/** 「守れているか」を測る指標。タイプに関係なく低ければ注意点として出す */
const DISCIPLINE_KEYS = new Set([
  'slRate',
  'slTpRate',
  'journalRate',
  'lossJournalRate',
  'riskConsistency',
  'noRevenge',
  'lossWithinPlan',
  'lowDrawdown',
  'afterLossDiscipline',
])

export function statusFor(tradeCount: number) {
  return STATUS_RULES.find((r) => tradeCount >= r.minTrades) ?? STATUS_RULES[STATUS_RULES.length - 1]
}

export function confidenceLabel(confidence: number): string {
  return (CONFIDENCE_LABELS.find((c) => confidence >= c.min) ?? CONFIDENCE_LABELS[CONFIDENCE_LABELS.length - 1]).label
}

export function diagnose(input: DiagnoseInput): DiagnosisResult {
  const q = scoreQuestionnaire(input.answers)
  const b = scoreBehavior({
    trades: input.trades,
    dayNotes: input.dayNotes,
    initialCapital: input.initialCapital,
    lotSize: input.lotSize,
    now: input.now,
  })

  const rule = statusFor(input.trades.length)
  const status: DiagnosisStatus = rule.status

  // --- 合成 ---------------------------------------------------------
  const scores = emptyScores()
  for (const id of TYPE_IDS) {
    const bs = b.scores[id]
    if (rule.behaviorWeight === 0 || bs == null) {
      // 取引データが使えないタイプは、アンケートだけで見る
      scores[id] = clamp(q.scores[id])
    } else {
      scores[id] = clamp(q.scores[id] * rule.questionnaireWeight + bs * rule.behaviorWeight)
    }
  }

  // --- 順位づけ -----------------------------------------------------
  const ranked = [...TYPE_IDS].sort((x, y) => scores[y] - scores[x])
  const top = scores[ranked[0]]
  const tied = ranked.filter((id) => Math.abs(scores[id] - top) < 1e-9)

  let primaryType: TypeId
  let needsTiebreak = false
  if (tied.length === 1) {
    primaryType = tied[0]
  } else {
    const picked = breakTie(tied, b, q.consistencyByType, input)
    primaryType = picked.type
    needsTiebreak = picked.unresolved
  }

  const rest = ranked.filter((id) => id !== primaryType)
  const secondaryCandidate = rest.sort((x, y) => scores[y] - scores[x])[0] ?? null
  const gap = secondaryCandidate ? scores[primaryType] - scores[secondaryCandidate] : 100

  let display: DiagnosisResult['display'] = 'single'
  let secondaryType: TypeId | null = null
  if (gap < DISPLAY_GAP.sub) {
    display = 'hybrid'
    secondaryType = secondaryCandidate
  } else if (gap < DISPLAY_GAP.strong) {
    display = 'with_secondary'
    secondaryType = secondaryCandidate
  }

  // --- 信頼度 -------------------------------------------------------
  const confidence = computeConfidence({
    answered: q.answered,
    total: q.total,
    consistency: q.consistency,
    behavior: b,
    gap,
  })

  // --- 根拠 ---------------------------------------------------------
  const evidence = buildEvidence(primaryType, b, q.scores[primaryType], status)

  // --- 改善アクション -----------------------------------------------
  const recommendedActions = buildActions(b, input.trades.length)

  // --- キャラクター ---------------------------------------------------
  const state = pickCharacterState(b, input.trades)
  const def = TYPES[primaryType]

  const nowIso = input.now.toISOString()
  return {
    diagnosisId: input.diagnosisId,
    diagnosisVersion: DIAGNOSIS_VERSION,
    questionVersion: QUESTION_VERSION,
    scoringVersion: SCORING_VERSION,
    userId: input.userId,
    status,
    primaryType,
    secondaryType,
    display,
    scores,
    questionnaireScores: q.scores,
    behaviorScores: b.scores as PartialScoreMap,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidence,
    strengths: def.strengths,
    cautions: def.cautions,
    recommendedActions,
    character: {
      characterId: def.characterId,
      state,
      message: CHARACTER_MESSAGES[primaryType][state],
      assetKey: `characters/${def.characterId}/${state}`,
    },
    needsTiebreak,
    createdAt: input.createdAt ?? nowIso,
    updatedAt: nowIso,
  }
}

// ---------------------------------------------------------------
// 同点の解き方
//
// タイプIDの並び順で機械的に決めない。
// ---------------------------------------------------------------

function breakTie(
  tied: TypeId[],
  b: BehaviorResult,
  consistencyByType: Record<TypeId, number>,
  input: DiagnoseInput,
): { type: TypeId; unresolved: boolean } {
  // 0. 利用者が追加の1問で選んでいれば、それに従う
  if (input.tiebreak && tied.includes(input.tiebreak)) {
    return { type: input.tiebreak, unresolved: false }
  }

  // 1. 取引データスコアが高い方
  const byBehavior = pickBest(tied, (id) => b.scores[id])
  if (byBehavior) return { type: byBehavior, unresolved: false }

  // 2. アンケートの回答一貫性が高い方
  const byConsistency = pickBest(tied, (id) => consistencyByType[id])
  if (byConsistency) return { type: byConsistency, unresolved: false }

  // 3. 直近30日の取引だけで採点し直して、より合っている方
  const since = input.now.getTime() - THRESHOLDS.trendWindowDays * 86400000
  const recent = input.trades.filter((t) => t.openJst.getTime() >= since)
  if (recent.length > 0) {
    const rb = scoreBehavior({
      trades: recent,
      dayNotes: input.dayNotes,
      initialCapital: input.initialCapital,
      lotSize: input.lotSize,
      now: input.now,
    })
    const byRecent = pickBest(tied, (id) => rb.scores[id])
    if (byRecent) return { type: byRecent, unresolved: false }
  }

  // 4. それでも決まらないので、追加の1問を出す。
  //    表示のために暫定の1つは決めるが、確定ではないことを needsTiebreak で示す。
  return { type: tied[0], unresolved: true }
}

/** 最大値が1つだけなら、それを返す。並んでいたら null */
function pickBest(ids: TypeId[], value: (id: TypeId) => number | null | undefined): TypeId | null {
  const scored = ids
    .map((id) => ({ id, v: value(id) }))
    .filter((x): x is { id: TypeId; v: number } => typeof x.v === 'number' && Number.isFinite(x.v))
  if (scored.length === 0) return null
  const best = Math.max(...scored.map((x) => x.v))
  const winners = scored.filter((x) => Math.abs(x.v - best) < 1e-9)
  return winners.length === 1 ? winners[0].id : null
}

// ---------------------------------------------------------------
// 信頼度
// ---------------------------------------------------------------

function computeConfidence(args: {
  answered: number
  total: number
  consistency: number
  behavior: BehaviorResult
  gap: number
}): number {
  const { answered, total, consistency, behavior, gap } = args
  const m = behavior.metrics
  const W = CONFIDENCE_WEIGHTS
  const S = CONFIDENCE_SCALES

  const coverageValues = TYPE_IDS.map((id) => behavior.available[id])
  const coverage = coverageValues.reduce((a, v) => a + v, 0) / coverageValues.length

  const freshness =
    m.daysSinceLast == null ? 0 : 1 - scale(m.daysSinceLast, 0, S.staleDays) / 100

  const parts =
    (total > 0 ? answered / total : 0) * W.answered +
    (consistency / 100) * W.consistency +
    (scale(m.count, 0, S.tradeCountFull) / 100) * W.tradeCount +
    (scale(m.spanDays, 0, S.spanDaysFull) / 100) * W.span +
    coverage * W.coverage +
    (scale(gap, 0, S.gapFull) / 100) * W.gap +
    freshness * W.freshness

  return Math.round(clamp(parts * 100))
}

// ---------------------------------------------------------------
// 根拠
// ---------------------------------------------------------------

function buildEvidence(
  primary: TypeId,
  b: BehaviorResult,
  questionnaireScore: number,
  status: DiagnosisStatus,
): Evidence[] {
  const out: Evidence[] = []

  const usable = b.indicators[primary].filter((i) => i.score != null)
  const sorted = [...usable].sort(
    (x, y) => (y.score as number) * y.weight - (x.score as number) * x.weight,
  )
  for (const i of sorted.slice(0, 4)) {
    out.push({
      key: i.key,
      label: i.label,
      value: i.value ?? '—',
      impactType: 'behavior',
      impact: (i.score as number) >= 60 ? 'positive' : 'neutral',
    })
  }

  out.push({
    key: 'questionnaire',
    label: `アンケートの${TYPES[primary].category}に関する回答`,
    value: `${Math.round(questionnaireScore)}点`,
    impactType: 'questionnaire',
    impact: questionnaireScore >= 60 ? 'positive' : 'neutral',
  })

  // タイプに関係なく、守り方が弱いところは注意点として並べる
  const seen = new Set<string>()
  for (const id of TYPE_IDS) {
    for (const i of b.indicators[id]) {
      if (!DISCIPLINE_KEYS.has(i.key) || i.score == null || seen.has(i.key)) continue
      if (i.score >= 40) continue
      seen.add(i.key)
      out.push({
        key: i.key,
        label: i.label,
        value: i.value ?? '—',
        impactType: 'discipline',
        impact: 'warning',
      })
    }
  }

  if (status === 'questionnaire_only') {
    out.push({
      key: 'few-trades',
      label: '取引の記録',
      value: `${b.metrics.count}件`,
      impactType: 'coverage',
      impact: 'neutral',
    })
  }

  return out.slice(0, 8)
}

// ---------------------------------------------------------------
// 改善アクション
// ---------------------------------------------------------------

function buildActions(b: BehaviorResult, tradeCount: number): RecommendedAction[] {
  const lowest = new Map<string, Indicator>()
  for (const id of TYPE_IDS) {
    for (const i of b.indicators[id]) {
      if (i.score == null) continue
      const prev = lowest.get(i.key)
      if (!prev || (prev.score as number) > i.score) lowest.set(i.key, i)
    }
  }

  const picked: RecommendedAction[] = []
  for (const t of ACTION_TEMPLATES) {
    if (t.when === 'coverage') {
      if (tradeCount < 20) picked.push(toAction(t))
      continue
    }
    const i = lowest.get(t.when)
    if (i && (i.score as number) < 60) picked.push(toAction(t))
  }

  picked.sort((x, y) => x.priority - y.priority)
  return picked.slice(0, 3)
}

function toAction(t: (typeof ACTION_TEMPLATES)[number]): RecommendedAction {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    completed: false,
  }
}

// ---------------------------------------------------------------
// キャラクターの状態
//
// 責めない・煽らない。sad は「守れた面」を見せるための状態にする。
// ---------------------------------------------------------------

export function pickCharacterState(b: BehaviorResult, trades: EnrichedTrade[]): CharacterState {
  const m = b.metrics
  if (trades.length === 0) return 'cheer'

  const recent = trades.slice(-10)
  const recentNet = recent.reduce((a, t) => a + t.netProfit, 0)

  let streak = 0
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].netProfit < 0) streak += 1
    else break
  }

  const deepDrawdown = m.drawdownPct != null && m.drawdownPct >= 20
  if (streak >= 3 || (recentNet < 0 && deepDrawdown)) return 'sad'

  const disciplined = m.slRate != null && m.slRate >= 0.7
  const improving = m.improvementTrend != null && m.improvementTrend >= 60
  if (recentNet > 0 && (disciplined || improving)) return 'happy'

  return 'cheer'
}

/** 過去の結果との比較。履歴画面で使う */
export interface DiagnosisDiff {
  typeChanged: boolean
  from: TypeId
  to: TypeId
  scoreDelta: ScoreMap
  confidenceDelta: number
}

export function compareDiagnoses(prev: DiagnosisResult, next: DiagnosisResult): DiagnosisDiff {
  const scoreDelta = emptyScores()
  for (const id of TYPE_IDS) scoreDelta[id] = Math.round(next.scores[id] - prev.scores[id])
  return {
    typeChanged: prev.primaryType !== next.primaryType,
    from: prev.primaryType,
    to: next.primaryType,
    scoreDelta,
    confidenceDelta: next.confidence - prev.confidence,
  }
}
