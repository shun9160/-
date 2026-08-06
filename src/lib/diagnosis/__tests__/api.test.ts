import { describe, expect, it } from 'vitest'
import { handleDiagnosisRequest, routeOf, sanitizeAnswers } from '../api'
import type { DiagnosisApiDeps, StoredDiagnosis } from '../api'
import type { Trade } from '../../types'
import { makeTrade } from './fixtures'
import { answersFavoring } from './fixtures'

const BASE = 'https://example.test/api/trader-diagnosis'

function fakeDeps(over: Partial<DiagnosisApiDeps> = {}) {
  const store: StoredDiagnosis[] = []
  const actions: { diagnosisId: string; actionId: string; completed: boolean }[] = []
  let n = 0
  const trades: Trade[] = Array.from({ length: 30 }, (_, i) =>
    makeTrade({
      day: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
      profit: i % 3 ? 500 : -400,
      slPips: 0.5,
      tpPips: 1,
    }),
  )

  const deps: DiagnosisApiDeps = {
    async getUserId(token) {
      // token がそのまま利用者ID代わり。'bad' は無効。
      if (!token || token === 'bad') return null
      return token
    },
    async loadTrades() {
      return trades
    },
    async loadDayNotes() {
      return {}
    },
    async loadAccount() {
      return { initialCapital: 1_000_000, lotSize: 100_000 }
    },
    async insertDiagnosis(row) {
      store.push(row)
    },
    async latestDiagnosis(userId) {
      const mine = store.filter((r) => r.userId === userId)
      return mine.length ? mine[mine.length - 1] : null
    },
    async listDiagnoses(userId, limit) {
      return store.filter((r) => r.userId === userId).slice(-limit).reverse()
    },
    async getDiagnosis(userId, id) {
      return store.find((r) => r.userId === userId && r.id === id) ?? null
    },
    async listActions(_userId, ids) {
      return actions.filter((a) => ids.includes(a.diagnosisId))
    },
    async setActionCompleted(_userId, diagnosisId, actionId, completed) {
      const hit = actions.find((a) => a.diagnosisId === diagnosisId && a.actionId === actionId)
      if (hit) hit.completed = completed
      else actions.push({ diagnosisId, actionId, completed })
    },
    now: () => new Date('2026-08-06T00:00:00Z'),
    newId: () => `d-${++n}`,
    ...over,
  }
  return { deps, store, actions }
}

function post(path: string, body: unknown, token: string | null) {
  return new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  })
}

function get(path: string, token: string | null) {
  return new Request(`${BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

describe('URLの読み取り', () => {
  it('末尾の部分を配列にする', () => {
    expect(routeOf(`${BASE}/latest`)).toEqual(['latest'])
    expect(routeOf(`${BASE}/d-1/actions/set-sl/complete`)).toEqual([
      'd-1',
      'actions',
      'set-sl',
      'complete',
    ])
    expect(routeOf(`${BASE}`)).toEqual([])
  })
})

describe('回答の受け取り', () => {
  it('1〜5以外は捨てる', () => {
    expect(sanitizeAnswers({ Q01: 5, Q02: 0, Q03: 9, Q04: 'x', Q05: '3' })).toEqual({
      Q01: 5,
      Q05: 3,
    })
  })
  it('スコアや型を送りつけられても無視する', () => {
    expect(sanitizeAnswers({ scores: { BLAZE: 100 } })).toEqual({})
    expect(sanitizeAnswers(null)).toEqual({})
  })
})

describe('認証', () => {
  it('未ログインでは診断できない', async () => {
    const { deps } = fakeDeps()
    const res = await handleDiagnosisRequest(
      post('/calculate', { answers: answersFavoring('LOGIC') }, null),
      deps,
    )
    expect(res.status).toBe(401)
  })

  it('無効なトークンでは取得できない', async () => {
    const { deps } = fakeDeps()
    expect((await handleDiagnosisRequest(get('/latest', 'bad'), deps)).status).toBe(401)
    expect((await handleDiagnosisRequest(get('/history', null), deps)).status).toBe(401)
  })

  it('他人の診断IDを指定しても取れない', async () => {
    const { deps } = fakeDeps()
    await handleDiagnosisRequest(
      post('/calculate', { answers: answersFavoring('LOGIC') }, 'alice'),
      deps,
    )
    const mine = await (await handleDiagnosisRequest(get('/latest', 'alice'), deps)).json()
    const id = mine.diagnosis.diagnosisId

    const res = await handleDiagnosisRequest(get(`/${id}`, 'bob'), deps)
    expect(res.status).toBe(404)

    const own = await handleDiagnosisRequest(get(`/${id}`, 'alice'), deps)
    expect(own.status).toBe(200)
  })

  it('質問はログイン前でも取れるが、タイプとの対応は含まない', async () => {
    const { deps } = fakeDeps()
    const res = await handleDiagnosisRequest(get('/questions', null), deps)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toHaveLength(24)
    for (const q of body.questions) {
      expect(Object.keys(q).sort()).toEqual(['id', 'text'])
    }
    expect(JSON.stringify(body)).not.toContain('BLAZE')
  })
})

describe('診断の保存', () => {
  it('過去の結果を上書きせず、履歴として積む', async () => {
    const { deps, store } = fakeDeps()
    await handleDiagnosisRequest(post('/calculate', { answers: answersFavoring('LOGIC') }, 'u1'), deps)
    await handleDiagnosisRequest(post('/calculate', { answers: answersFavoring('BLAZE') }, 'u1'), deps)

    expect(store).toHaveLength(2)
    expect(store[0].id).not.toBe(store[1].id)
    // 1回目の回答内容も結果も、2回目の診断で書き換わっていない
    expect(store[0].result.questionnaireScores.LOGIC).toBe(100)
    expect(store[1].result.questionnaireScores.BLAZE).toBe(100)
    expect(store[0].result.diagnosisId).toBe(store[0].id)

    const hist = await (await handleDiagnosisRequest(get('/history', 'u1'), deps)).json()
    expect(hist.history).toHaveLength(2)
  })

  it('バージョンが保存される', async () => {
    const { deps, store } = fakeDeps()
    await handleDiagnosisRequest(post('/calculate', { answers: answersFavoring('RISE') }, 'u1'), deps)
    expect(store[0].result.diagnosisVersion).toBeTruthy()
    expect(store[0].result.scoringVersion).toBeTruthy()
    expect(store[0].result.questionVersion).toBeTruthy()
  })

  it('回答がなければ断る', async () => {
    const { deps } = fakeDeps()
    const res = await handleDiagnosisRequest(post('/calculate', {}, 'u1'), deps)
    expect(res.status).toBe(400)
  })

  it('再診断は前回の回答を使い回す', async () => {
    const { deps, store } = fakeDeps()
    await handleDiagnosisRequest(post('/calculate', { answers: answersFavoring('GUARD') }, 'u1'), deps)
    const res = await handleDiagnosisRequest(post('/recalculate', {}, 'u1'), deps)
    expect(res.status).toBe(200)
    expect(store).toHaveLength(2)
    expect(store[1].answers).toEqual(store[0].answers)
  })
})

describe('改善アクション', () => {
  it('完了にすると結果に反映される（診断そのものは書き換えない）', async () => {
    const { deps, store } = fakeDeps()
    const created = await (
      await handleDiagnosisRequest(post('/calculate', { answers: answersFavoring('BLAZE') }, 'u1'), deps)
    ).json()
    const id = created.diagnosis.diagnosisId
    const action = created.diagnosis.recommendedActions[0]
    if (!action) return

    const res = await handleDiagnosisRequest(
      post(`/${id}/actions/${action.id}/complete`, { completed: true }, 'u1'),
      deps,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.diagnosis.recommendedActions.find((a: { id: string }) => a.id === action.id).completed).toBe(true)
    // 保存済みの行は書き換わっていない
    expect(store[0].result.recommendedActions[0].completed).toBe(false)
  })

  it('知らないアクションIDは断る', async () => {
    const { deps } = fakeDeps()
    const created = await (
      await handleDiagnosisRequest(post('/calculate', { answers: answersFavoring('BLAZE') }, 'u1'), deps)
    ).json()
    const res = await handleDiagnosisRequest(
      post(`/${created.diagnosis.diagnosisId}/actions/nope/complete`, {}, 'u1'),
      deps,
    )
    expect(res.status).toBe(404)
  })
})
