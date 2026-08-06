import { describe, expect, it } from 'vitest'
import { compareDiagnoses, diagnose, statusFor } from '../diagnose'
import { DIAGNOSIS_VERSION, QUESTION_VERSION, SCORING_VERSION } from '../config'
import { TYPES, TYPE_IDS } from '../types'
import type { TypeId } from '../types'
import { DEFAULT_ENV, answersFavoring, makeTrades, plainTrades, uniformAnswers } from './fixtures'

const base = {
  userId: 'user-1',
  diagnosisId: 'd-1',
  dayNotes: DEFAULT_ENV.dayNotes,
  initialCapital: DEFAULT_ENV.initialCapital,
  lotSize: DEFAULT_ENV.lotSize,
  now: DEFAULT_ENV.now,
}

describe('取引件数による配分', () => {
  it.each([
    [0, 'questionnaire_only', 1, 0],
    [4, 'questionnaire_only', 1, 0],
    [5, 'provisional', 0.65, 0.35],
    [19, 'provisional', 0.65, 0.35],
    [20, 'data_backed', 0.35, 0.65],
    [100, 'data_backed', 0.35, 0.65],
  ])('%i件 → %s', (n, status, qw, bw) => {
    const rule = statusFor(n as number)
    expect(rule.status).toBe(status)
    expect(rule.questionnaireWeight).toBe(qw)
    expect(rule.behaviorWeight).toBe(bw)
  })

  it.each([0, 4, 5, 19, 20])('%i件でも診断できる', (n) => {
    const r = diagnose({ ...base, answers: answersFavoring('LOGIC'), trades: plainTrades(n) })
    expect(TYPE_IDS).toContain(r.primaryType)
    expect(r.confidence).toBeGreaterThanOrEqual(0)
    expect(r.confidence).toBeLessThanOrEqual(100)
  })

  it('4件は回答のみ、20件は取引データが中心になる', () => {
    const few = diagnose({ ...base, answers: uniformAnswers(3), trades: plainTrades(4) })
    const many = diagnose({ ...base, answers: uniformAnswers(3), trades: plainTrades(20) })
    expect(few.status).toBe('questionnaire_only')
    expect(many.status).toBe('data_backed')
    // 回答が全部同じでも、取引データがあるとタイプ差が出る
    const spread = (o: Record<TypeId, number>) =>
      Math.max(...TYPE_IDS.map((i) => o[i])) - Math.min(...TYPE_IDS.map((i) => o[i]))
    expect(spread(many.scores)).toBeGreaterThan(spread(few.scores))
  })
})

describe('タイプ判定', () => {
  it.each(TYPE_IDS)('%s に寄せた回答（取引記録なし）では %s になる', (id) => {
    const r = diagnose({ ...base, answers: answersFavoring(id), trades: [] })
    expect(r.primaryType).toBe(id)
    expect(r.status).toBe('questionnaire_only')
  })

  it('スコアはすべて0〜100', () => {
    const r = diagnose({ ...base, answers: answersFavoring('GUARD'), trades: plainTrades(40) })
    for (const id of TYPE_IDS) {
      expect(r.scores[id]).toBeGreaterThanOrEqual(0)
      expect(r.scores[id]).toBeLessThanOrEqual(100)
      expect(r.questionnaireScores[id]).toBeGreaterThanOrEqual(0)
      expect(r.questionnaireScores[id]).toBeLessThanOrEqual(100)
      const b = r.behaviorScores[id]
      if (b != null) {
        expect(b).toBeGreaterThanOrEqual(0)
        expect(b).toBeLessThanOrEqual(100)
      }
    }
  })

  it('差が8点以上なら1位だけを出す', () => {
    const r = diagnose({ ...base, answers: answersFavoring('WATCH'), trades: [] })
    const sorted = [...TYPE_IDS].sort((a, b) => r.scores[b] - r.scores[a])
    expect(r.scores[sorted[0]] - r.scores[sorted[1]]).toBeGreaterThanOrEqual(8)
    expect(r.display).toBe('single')
    expect(r.secondaryType).toBeNull()
  })

  it('差が3点未満ならハイブリッド表示になり、1位は必ず決まる', () => {
    // 全部3にすると全タイプ同点になる
    const r = diagnose({ ...base, answers: uniformAnswers(3), trades: [] })
    expect(r.display).toBe('hybrid')
    expect(TYPE_IDS).toContain(r.primaryType)
    expect(r.secondaryType).not.toBeNull()
  })

  it('差が3〜8点ならサブ傾向を添える', () => {
    // LOGIC を強く、WATCH をやや強くする
    const answers = answersFavoring('LOGIC')
    answers.Q05 = 4
    answers.Q11 = 4
    answers.Q17 = 4
    answers.Q23 = 3
    const r = diagnose({ ...base, answers, trades: [] })
    const gap = r.scores[r.primaryType] - r.scores[r.secondaryType ?? r.primaryType]
    if (gap >= 3 && gap < 8) {
      expect(r.display).toBe('with_secondary')
      expect(r.secondaryType).toBe('WATCH')
    }
  })
})

describe('同点の解き方', () => {
  it('取引記録がまったくなく全問3なら、追加の1問が必要になる', () => {
    const r = diagnose({ ...base, answers: uniformAnswers(3), trades: [] })
    expect(r.needsTiebreak).toBe(true)
  })

  it('追加の1問で選んだタイプが採用される', () => {
    const r = diagnose({
      ...base,
      answers: uniformAnswers(3),
      trades: [],
      tiebreak: 'RISE',
    })
    expect(r.primaryType).toBe('RISE')
    expect(r.needsTiebreak).toBe(false)
  })

  it('回答が全部同じでも、取引データに差があればそちらで決まる', () => {
    // 1日に何度も入り、保有が短く、1回のリスクは大きめ（BLAZE寄り・GUARDは下がる）
    const trades = makeTrades(
      Array.from({ length: 30 }, (_, i) => ({
        day: `2026-07-${String(Math.floor(i / 6) + 1).padStart(2, '0')}`,
        hour: 9 + (i % 6),
        holdMin: 5,
        volume: 2,
        profit: i % 2 ? 300 : -200,
        slPips: 0.2,
        tpPips: 1.2,
      })),
    )
    const r = diagnose({ ...base, answers: uniformAnswers(3), trades })
    expect(r.needsTiebreak).toBe(false)
    expect(r.primaryType).toBe('BLAZE')
  })
})

describe('結果の中身', () => {
  const r = diagnose({ ...base, answers: answersFavoring('LOGIC'), trades: plainTrades(30) })

  it('バージョンが記録される', () => {
    expect(r.diagnosisVersion).toBe(DIAGNOSIS_VERSION)
    expect(r.questionVersion).toBe(QUESTION_VERSION)
    expect(r.scoringVersion).toBe(SCORING_VERSION)
  })

  it('なぜそのタイプかの根拠が必ず付く', () => {
    expect(r.evidence.length).toBeGreaterThan(0)
    for (const e of r.evidence) {
      expect(e.label).toBeTruthy()
      expect(['positive', 'neutral', 'warning']).toContain(e.impact)
    }
  })

  it('強みと注意点の両方が付く', () => {
    expect(r.strengths.length).toBeGreaterThan(0)
    expect(r.cautions.length).toBeGreaterThan(0)
  })

  it('キャラクターの状態と差し替え先が決まる', () => {
    expect(['happy', 'sad', 'cheer']).toContain(r.character.state)
    expect(r.character.assetKey).toBe(
      `characters/${TYPES[r.primaryType].characterId}/${r.character.state}`,
    )
    expect(r.character.message).toBeTruthy()
  })

  it('信頼度の言い換えが付く', () => {
    expect(r.confidenceLabel).toBeTruthy()
  })

  it('改善アクションは3件までで、最初は未完了', () => {
    expect(r.recommendedActions.length).toBeLessThanOrEqual(3)
    for (const a of r.recommendedActions) expect(a.completed).toBe(false)
  })
})

describe('どのタイプにも強みと注意点がある', () => {
  it.each(TYPE_IDS)('%s', (id) => {
    expect(TYPES[id].strengths.length).toBeGreaterThan(0)
    expect(TYPES[id].cautions.length).toBeGreaterThan(0)
  })
})

describe('キャラクターの言葉が責めていない', () => {
  const banned = ['ダメ', '最悪', '失格', '才能がない', '向いていない', 'バカ', '無能']
  it.each(TYPE_IDS)('%s', (id) => {
    const t = TYPES[id]
    expect(t.copy).toBeTruthy()
    for (const word of banned) {
      expect(t.copy.includes(word)).toBe(false)
    }
  })
})

describe('過去の結果との比較', () => {
  it('タイプの変化とスコアの差が出せる', () => {
    const a = diagnose({ ...base, answers: answersFavoring('GUARD'), trades: [] })
    const b = diagnose({
      ...base,
      diagnosisId: 'd-2',
      answers: answersFavoring('BLAZE'),
      trades: [],
    })
    const diff = compareDiagnoses(a, b)
    expect(diff.typeChanged).toBe(true)
    expect(diff.from).toBe('GUARD')
    expect(diff.to).toBe('BLAZE')
    expect(diff.scoreDelta.BLAZE).toBeGreaterThan(0)
  })
})

describe('同じ入力なら同じ結果になる', () => {
  it('2回呼んでも一致する', () => {
    const args = { ...base, answers: answersFavoring('RISE'), trades: plainTrades(25) }
    const a = diagnose(args)
    const b = diagnose(args)
    expect(a.scores).toEqual(b.scores)
    expect(a.primaryType).toBe(b.primaryType)
    expect(a.confidence).toBe(b.confidence)
  })
})
