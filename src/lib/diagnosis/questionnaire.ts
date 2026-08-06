/**
 * アンケートの採点。
 *
 * 純粋関数。回答（質問ID -> 1〜5）を渡すとタイプごとの0〜100が返る。
 */

import { QUESTIONS } from './questions'
import { TYPE_IDS, emptyScores } from './types'
import type { Answers, ScoreMap, TypeId } from './types'
import { clamp } from './scoring'

/** 未回答のときに使う中立値。0点にはしない */
const NEUTRAL = 50

/** 1問ぶんの点数 */
export function scoreAnswer(answer: number, reverse: boolean): number | null {
  if (!Number.isFinite(answer)) return null
  const a = Math.round(answer)
  if (a < 1 || a > 5) return null
  return reverse ? ((5 - a) / 4) * 100 : ((a - 1) / 4) * 100
}

export interface QuestionnaireResult {
  scores: ScoreMap
  /** タイプごとの各設問の点数（一貫性の判定に使う） */
  perType: Record<TypeId, number[]>
  /** 有効な回答数 */
  answered: number
  total: number
  /** 回答のぶれの少なさ 0〜100 */
  consistency: number
  /** タイプごとの回答のぶれの少なさ */
  consistencyByType: Record<TypeId, number>
}

export function scoreQuestionnaire(answers: Answers): QuestionnaireResult {
  const perType = {} as Record<TypeId, number[]>
  for (const id of TYPE_IDS) perType[id] = []

  let answered = 0
  for (const q of QUESTIONS) {
    const s = scoreAnswer(answers[q.id], q.reverse)
    if (s == null) continue
    answered += 1
    perType[q.type].push(s)
  }

  const scores = emptyScores()
  const consistencyByType = {} as Record<TypeId, number>
  const spreads: number[] = []

  for (const id of TYPE_IDS) {
    const list = perType[id]
    if (list.length === 0) {
      scores[id] = NEUTRAL
      consistencyByType[id] = 0
      continue
    }
    const avg = list.reduce((a, b) => a + b, 0) / list.length
    scores[id] = clamp(avg)
    if (list.length < 2) {
      consistencyByType[id] = 0
      continue
    }
    const sd = Math.sqrt(list.reduce((a, v) => a + (v - avg) ** 2, 0) / list.length)
    // 0点と100点が半々のとき sd は50。これを一貫性0とする。
    const c = clamp(100 - (sd / 50) * 100)
    consistencyByType[id] = c
    spreads.push(c)
  }

  const consistency = spreads.length ? clamp(spreads.reduce((a, b) => a + b, 0) / spreads.length) : 0

  return {
    scores,
    perType,
    answered,
    total: QUESTIONS.length,
    consistency,
    consistencyByType,
  }
}
