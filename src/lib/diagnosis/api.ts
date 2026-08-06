/**
 * 診断APIの本体。
 *
 * Netlify Function から呼ばれる。DBアクセスと時計は deps で受け取るので、
 * ここ自体はテストしやすい純粋な入出力になっている。
 *
 * 大事な決め事:
 *  - スコアはクライアントから受け取らない。回答と取引データを見てここで採点する。
 *  - 認証されていない、または他人のIDを指定した要求には結果を返さない。
 *  - 過去の診断は書き換えない。毎回新しい行として積む。
 */

import type { Trade } from '../types'
import { enrichAll } from '../analytics'
import { diagnose } from './diagnose'
import { publicQuestions } from './questions'
import { ANSWER_LABELS, QUESTIONS_PER_STEP } from './questions'
import { DISCLAIMER, INTRO, SCORING_NOTE } from './messages'
import { RECHECK } from './config'
import { TYPES } from './types'
import type { Answers, DiagnosisResult, TypeId } from './types'

export interface StoredDiagnosis {
  id: string
  userId: string
  accountId: string | null
  tradeCount: number
  answers: Answers
  result: DiagnosisResult
  createdAt: string
}

export interface ActionRecord {
  diagnosisId: string
  actionId: string
  completed: boolean
}

export interface DiagnosisApiDeps {
  /** アクセストークンから利用者IDを取り出す。無効なら null */
  getUserId(token: string | null): Promise<string | null>
  loadTrades(userId: string, accountId: string | null): Promise<Trade[]>
  loadDayNotes(userId: string): Promise<Record<string, string | null>>
  loadAccount(
    userId: string,
    accountId: string | null,
  ): Promise<{ initialCapital: number; lotSize: number }>
  insertDiagnosis(row: StoredDiagnosis): Promise<void>
  latestDiagnosis(userId: string): Promise<StoredDiagnosis | null>
  listDiagnoses(userId: string, limit: number): Promise<StoredDiagnosis[]>
  getDiagnosis(userId: string, id: string): Promise<StoredDiagnosis | null>
  listActions(userId: string, diagnosisIds: string[]): Promise<ActionRecord[]>
  setActionCompleted(
    userId: string,
    diagnosisId: string,
    actionId: string,
    completed: boolean,
  ): Promise<void>
  now(): Date
  newId(): string
}

const BASE = '/api/trader-diagnosis'

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

/** /api/trader-diagnosis/... の後ろの部分を配列で返す */
export function routeOf(url: string): string[] {
  const path = new URL(url).pathname.replace(/\/+$/, '')
  const i = path.indexOf(BASE)
  const rest = i >= 0 ? path.slice(i + BASE.length) : ''
  return rest.split('/').filter(Boolean)
}

export async function handleDiagnosisRequest(
  req: Request,
  deps: DiagnosisApiDeps,
): Promise<Response> {
  const parts = routeOf(req.url)
  const method = req.method.toUpperCase()

  if (method === 'OPTIONS') return new Response(null, { status: 204 })

  // 質問だけは、採点情報を含まないので認証前に返してよい
  if (method === 'GET' && parts[0] === 'questions') {
    return json({
      ...publicQuestions(),
      answerLabels: ANSWER_LABELS,
      perStep: QUESTIONS_PER_STEP,
      intro: INTRO,
      disclaimer: DISCLAIMER,
      note: SCORING_NOTE,
    })
  }

  // ここから先は必ず本人確認する
  const userId = await deps.getUserId(bearer(req))
  if (!userId) return json({ error: 'ログインが必要です' }, 401)

  if (method === 'POST' && (parts[0] === 'calculate' || parts[0] === 'recalculate')) {
    return calculate(req, deps, userId, parts[0] === 'recalculate')
  }

  if (method === 'GET' && parts[0] === 'latest') {
    const row = await deps.latestDiagnosis(userId)
    if (!row) return json({ diagnosis: null, recheck: null })
    const withActions = await applyActions(deps, userId, [row])
    return json({
      diagnosis: withActions[0].result,
      createdAt: row.createdAt,
      recheck: await recheckHint(deps, userId, row),
    })
  }

  if (method === 'GET' && parts[0] === 'history') {
    const rows = await deps.listDiagnoses(userId, 20)
    const withActions = await applyActions(deps, userId, rows)
    return json({
      history: withActions.map((r) => ({
        diagnosisId: r.id,
        createdAt: r.createdAt,
        primaryType: r.result.primaryType,
        secondaryType: r.result.secondaryType,
        status: r.result.status,
        confidence: r.result.confidence,
        scores: r.result.scores,
        diagnosisVersion: r.result.diagnosisVersion,
        completedActions: r.result.recommendedActions.filter((a) => a.completed).length,
      })),
    })
  }

  // POST /:id/actions/:actionId/complete
  if (method === 'POST' && parts.length === 4 && parts[1] === 'actions' && parts[3] === 'complete') {
    const row = await deps.getDiagnosis(userId, parts[0])
    if (!row) return json({ error: '見つかりません' }, 404)
    const known = row.result.recommendedActions.some((a) => a.id === parts[2])
    if (!known) return json({ error: 'その改善アクションはありません' }, 404)
    let completed = true
    try {
      const body = (await req.json()) as { completed?: boolean }
      if (typeof body?.completed === 'boolean') completed = body.completed
    } catch {
      // 本文なしなら「完了にする」
    }
    await deps.setActionCompleted(userId, row.id, parts[2], completed)
    const [withActions] = await applyActions(deps, userId, [row])
    return json({ diagnosis: withActions.result })
  }

  if (method === 'GET' && parts.length === 1) {
    const row = await deps.getDiagnosis(userId, parts[0])
    if (!row) return json({ error: '見つかりません' }, 404)
    const [withActions] = await applyActions(deps, userId, [row])
    return json({ diagnosis: withActions.result, createdAt: row.createdAt })
  }

  return json({ error: 'そのURLはありません' }, 404)
}

// ---------------------------------------------------------------

async function calculate(
  req: Request,
  deps: DiagnosisApiDeps,
  userId: string,
  reuseAnswers: boolean,
): Promise<Response> {
  let body: { answers?: unknown; tiebreak?: unknown; accountId?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    if (!reuseAnswers) return json({ error: '本文がJSONではありません' }, 400)
  }

  let answers = sanitizeAnswers(body.answers)
  if (reuseAnswers && Object.keys(answers).length === 0) {
    const prev = await deps.latestDiagnosis(userId)
    if (!prev) return json({ error: '前回の回答がありません' }, 400)
    answers = prev.answers
  }
  if (Object.keys(answers).length === 0) {
    return json({ error: '回答がありません' }, 400)
  }

  const accountId = typeof body.accountId === 'string' ? body.accountId : null
  const tiebreak = isTypeId(body.tiebreak) ? body.tiebreak : null

  const [raw, dayNotes, account] = await Promise.all([
    deps.loadTrades(userId, accountId),
    deps.loadDayNotes(userId),
    deps.loadAccount(userId, accountId),
  ])
  const trades = enrichAll(raw)

  const now = deps.now()
  const id = deps.newId()
  const result = diagnose({
    userId,
    diagnosisId: id,
    answers,
    trades,
    dayNotes,
    initialCapital: account.initialCapital,
    lotSize: account.lotSize,
    now,
    tiebreak,
  })

  const row: StoredDiagnosis = {
    id,
    userId,
    accountId,
    tradeCount: trades.length,
    answers,
    result,
    createdAt: now.toISOString(),
  }
  await deps.insertDiagnosis(row)

  return json({ diagnosis: result, createdAt: row.createdAt })
}

/** 1〜5以外は落とす。クライアントからスコアそのものは一切受け取らない */
export function sanitizeAnswers(input: unknown): Answers {
  const out: Answers = {}
  if (!input || typeof input !== 'object') return out
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) continue
    const r = Math.round(n)
    if (r < 1 || r > 5) continue
    out[k] = r
  }
  return out
}

function isTypeId(v: unknown): v is TypeId {
  return typeof v === 'string' && v in TYPES
}

/** 完了済みの改善アクションを、保存済みの結果に重ねる */
async function applyActions(
  deps: DiagnosisApiDeps,
  userId: string,
  rows: StoredDiagnosis[],
): Promise<StoredDiagnosis[]> {
  if (rows.length === 0) return rows
  const marks = await deps.listActions(
    userId,
    rows.map((r) => r.id),
  )
  const done = new Set(marks.filter((m) => m.completed).map((m) => `${m.diagnosisId}:${m.actionId}`))
  return rows.map((r) => ({
    ...r,
    result: {
      ...r.result,
      recommendedActions: r.result.recommendedActions.map((a) => ({
        ...a,
        completed: done.has(`${r.id}:${a.id}`),
      })),
    },
  }))
}

/** 再診断をすすめるかどうか */
export async function recheckHint(
  deps: DiagnosisApiDeps,
  userId: string,
  prev: StoredDiagnosis,
): Promise<{ suggested: boolean; reasons: string[] }> {
  const reasons: string[] = []
  const trades = await deps.loadTrades(userId, prev.accountId)
  if (trades.length - prev.tradeCount >= RECHECK.newTrades) {
    reasons.push(`前回の診断から取引が${trades.length - prev.tradeCount}件増えました`)
  }
  const days = (deps.now().getTime() - Date.parse(prev.createdAt)) / 86400000
  if (days >= RECHECK.days) {
    reasons.push(`前回の診断から${Math.floor(days)}日たちました`)
  }
  if (prev.result.status === 'questionnaire_only' && trades.length >= 5) {
    reasons.push('取引データを使って診断し直せるようになりました')
  }
  return { suggested: reasons.length > 0, reasons }
}
