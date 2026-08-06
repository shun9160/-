import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '../questions'
import { scoreAnswer, scoreQuestionnaire } from '../questionnaire'
import { TYPE_IDS } from '../types'
import { answersFavoring, uniformAnswers } from './fixtures'

describe('質問データ', () => {
  it('24問あり、各タイプにちょうど4問ずつ割り当てられている', () => {
    expect(QUESTIONS).toHaveLength(24)
    for (const id of TYPE_IDS) {
      expect(QUESTIONS.filter((q) => q.type === id)).toHaveLength(4)
    }
  })

  it('IDが重複していない', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length)
  })

  it('各タイプに逆転質問が1問ある', () => {
    for (const id of TYPE_IDS) {
      expect(QUESTIONS.filter((q) => q.type === id && q.reverse)).toHaveLength(1)
    }
  })
})

describe('1問ぶんの採点', () => {
  it('直接採点', () => {
    expect(scoreAnswer(1, false)).toBe(0)
    expect(scoreAnswer(3, false)).toBe(50)
    expect(scoreAnswer(5, false)).toBe(100)
  })

  it('逆転採点', () => {
    expect(scoreAnswer(1, true)).toBe(100)
    expect(scoreAnswer(3, true)).toBe(50)
    expect(scoreAnswer(5, true)).toBe(0)
  })

  it('範囲外や未回答は採点しない', () => {
    expect(scoreAnswer(0, false)).toBeNull()
    expect(scoreAnswer(6, false)).toBeNull()
    expect(scoreAnswer(NaN, false)).toBeNull()
    expect(scoreAnswer(undefined as unknown as number, false)).toBeNull()
  })
})

describe('アンケート全体', () => {
  it('すべて1: 直接3問=0点、逆転1問=100点 → 各タイプ25点', () => {
    const r = scoreQuestionnaire(uniformAnswers(1))
    for (const id of TYPE_IDS) expect(r.scores[id]).toBeCloseTo(25, 6)
    expect(r.answered).toBe(24)
  })

  it('すべて3: 各タイプ50点で全部並ぶ', () => {
    const r = scoreQuestionnaire(uniformAnswers(3))
    for (const id of TYPE_IDS) expect(r.scores[id]).toBeCloseTo(50, 6)
    expect(r.consistency).toBeCloseTo(100, 6)
  })

  it('すべて5: 各タイプ75点', () => {
    const r = scoreQuestionnaire(uniformAnswers(5))
    for (const id of TYPE_IDS) expect(r.scores[id]).toBeCloseTo(75, 6)
  })

  it.each(TYPE_IDS)('%s に寄せた回答では %s が単独1位になる', (id) => {
    const r = scoreQuestionnaire(answersFavoring(id))
    expect(r.scores[id]).toBe(100)
    for (const other of TYPE_IDS) {
      if (other !== id) expect(r.scores[other]).toBeLessThan(r.scores[id])
    }
  })

  it('未回答のタイプは0点ではなく中立の50点', () => {
    const only = { Q01: 5 }
    const r = scoreQuestionnaire(only)
    expect(r.answered).toBe(1)
    expect(r.scores.LOGIC).toBe(50)
  })

  it('スコアは常に0〜100に収まる', () => {
    for (const v of [1, 2, 3, 4, 5]) {
      const r = scoreQuestionnaire(uniformAnswers(v))
      for (const id of TYPE_IDS) {
        expect(r.scores[id]).toBeGreaterThanOrEqual(0)
        expect(r.scores[id]).toBeLessThanOrEqual(100)
      }
    }
  })
})
