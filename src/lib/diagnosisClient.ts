/**
 * 診断APIの呼び出し。
 *
 * 採点はサーバー側でやるので、ここは「回答を送る」「結果を受け取る」だけ。
 * 点数をこちらで作って送ることはしない。
 */

import { supabase } from './supabase'
import type { Answers, DiagnosisResult, TypeId } from './diagnosis/types'

const BASE = '/api/trader-diagnosis'

const OFFLINE =
  '診断の窓口につながりませんでした。公開中のサイト（Netlify）でお試しください。'

export interface QuestionsPayload {
  version: string
  perStep: number
  questions: { id: string; text: string }[]
  answerLabels: { value: number; label: string }[]
  intro: { title: string; lead: string; dataUse: string[] }
  disclaimer: string
  note: string
}

export interface HistoryEntry {
  diagnosisId: string
  createdAt: string
  primaryType: TypeId
  secondaryType: TypeId | null
  status: DiagnosisResult['status']
  confidence: number
  scores: Record<TypeId, number>
  diagnosisVersion: string
  completedActions: number
}

export interface LatestPayload {
  diagnosis: DiagnosisResult | null
  createdAt?: string
  recheck: { suggested: boolean; reasons: string[] } | null
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken()
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new Error(OFFLINE)
  }

  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    // 開発サーバーだと index.html が返ってくる
    throw new Error(OFFLINE)
  }
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error ?? '処理できませんでした')
  }
  return body as T
}

export function fetchQuestions(): Promise<QuestionsPayload> {
  return call<QuestionsPayload>('/questions')
}

export function fetchLatest(): Promise<LatestPayload> {
  return call<LatestPayload>('/latest')
}

export function fetchHistory(): Promise<{ history: HistoryEntry[] }> {
  return call<{ history: HistoryEntry[] }>('/history')
}

export function fetchDiagnosis(id: string): Promise<{ diagnosis: DiagnosisResult }> {
  return call<{ diagnosis: DiagnosisResult }>(`/${id}`)
}

export function calculate(
  answers: Answers,
  opts: { accountId?: string | null; tiebreak?: TypeId | null } = {},
): Promise<{ diagnosis: DiagnosisResult; createdAt: string }> {
  return call('/calculate', {
    method: 'POST',
    body: JSON.stringify({
      answers,
      accountId: opts.accountId ?? null,
      tiebreak: opts.tiebreak ?? null,
    }),
  })
}

export function recalculate(
  accountId?: string | null,
): Promise<{ diagnosis: DiagnosisResult; createdAt: string }> {
  return call('/recalculate', {
    method: 'POST',
    body: JSON.stringify({ accountId: accountId ?? null }),
  })
}

export function completeAction(
  diagnosisId: string,
  actionId: string,
  completed: boolean,
): Promise<{ diagnosis: DiagnosisResult }> {
  return call(`/${diagnosisId}/actions/${encodeURIComponent(actionId)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ completed }),
  })
}
