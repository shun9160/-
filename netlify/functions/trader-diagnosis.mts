import type { Config, Context } from '@netlify/functions'
import { handleDiagnosisRequest } from '../../src/lib/diagnosis/api'
import type { ActionRecord, DiagnosisApiDeps, StoredDiagnosis } from '../../src/lib/diagnosis/api'
import type { Trade } from '../../src/lib/types'

/**
 * トレーダータイプ診断の窓口。
 *
 * 採点は必ずここ（サーバー側）で行う。画面から点数を送っても採用しない。
 * 本人確認はログイン中のアクセストークンで行い、他人の診断は返さない。
 *
 * 必要な環境変数（Netlify のサイト設定で登録）:
 *   SUPABASE_URL              … Project URL
 *   SUPABASE_SERVICE_ROLE_KEY … service_role キー（絶対に画面に出さない）
 *   SUPABASE_ANON_KEY         … anon キー（省略可。トークン確認に使う）
 */

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return cors(json({ error: 'サーバー側の設定が未完了です' }, 500))
  }
  const anonKey = process.env.SUPABASE_ANON_KEY ?? serviceKey

  const rest = `${url.replace(/\/$/, '')}/rest/v1`
  const auth = `${url.replace(/\/$/, '')}/auth/v1`
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  const deps: DiagnosisApiDeps = {
    async getUserId(token) {
      if (!token) return null
      const res = await fetch(`${auth}/user`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null
      const user = (await res.json()) as { id?: string }
      return user?.id ?? null
    },

    async loadTrades(userId, accountId) {
      const cols =
        'id,account_id,ticket,symbol,side,volume,open_price,close_price,sl,tp,open_time,close_time,commission,swap,profit,currency,note,source,created_at'
      const scope = accountId ? `&account_id=eq.${q(accountId)}` : ''
      const res = await fetch(
        `${rest}/trades?user_id=eq.${q(userId)}${scope}&select=${cols}&order=open_time.asc&limit=5000`,
        { headers },
      )
      if (!res.ok) return []
      return (await res.json()) as Trade[]
    },

    async loadDayNotes(userId) {
      const res = await fetch(
        `${rest}/day_notes?user_id=eq.${q(userId)}&select=day,note&limit=2000`,
        { headers },
      )
      if (!res.ok) return {}
      const rows = (await res.json()) as { day: string; note: string | null }[]
      const out: Record<string, string | null> = {}
      for (const r of rows) out[r.day] = r.note
      return out
    },

    async loadAccount(userId, accountId) {
      const scope = accountId
        ? `&id=eq.${q(accountId)}`
        : '&is_default=is.true'
      const res = await fetch(
        `${rest}/accounts?user_id=eq.${q(userId)}${scope}&select=initial_capital,lot_size&limit=1`,
        { headers },
      )
      const fallback = { initialCapital: 0, lotSize: 100000 }
      if (!res.ok) return fallback
      const rows = (await res.json()) as { initial_capital: number; lot_size: number }[]
      if (rows.length === 0) {
        // 口座が1つも登録されていないときは settings を見る
        const s = await fetch(
          `${rest}/settings?user_id=eq.${q(userId)}&select=initial_capital,lot_size&limit=1`,
          { headers },
        )
        if (!s.ok) return fallback
        const srows = (await s.json()) as { initial_capital: number; lot_size: number }[]
        if (srows.length === 0) return fallback
        return {
          initialCapital: Number(srows[0].initial_capital) || 0,
          lotSize: Number(srows[0].lot_size) || 100000,
        }
      }
      return {
        initialCapital: Number(rows[0].initial_capital) || 0,
        lotSize: Number(rows[0].lot_size) || 100000,
      }
    },

    async insertDiagnosis(row) {
      const res = await fetch(`${rest}/trader_diagnoses`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify([toRow(row)]),
      })
      if (!res.ok) throw new Error(await res.text())
    },

    async latestDiagnosis(userId) {
      const rows = await selectDiagnoses(`user_id=eq.${q(userId)}&order=created_at.desc&limit=1`)
      return rows[0] ?? null
    },

    async listDiagnoses(userId, limit) {
      return selectDiagnoses(`user_id=eq.${q(userId)}&order=created_at.desc&limit=${limit}`)
    },

    async getDiagnosis(userId, id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null
      const rows = await selectDiagnoses(`user_id=eq.${q(userId)}&id=eq.${q(id)}&limit=1`)
      return rows[0] ?? null
    },

    async listActions(userId, ids) {
      if (ids.length === 0) return []
      const list = ids.map((i) => `"${i}"`).join(',')
      const res = await fetch(
        `${rest}/trader_diagnosis_actions?user_id=eq.${q(userId)}&diagnosis_id=in.(${encodeURIComponent(list)})&select=diagnosis_id,action_id,completed`,
        { headers },
      )
      if (!res.ok) return []
      const rows = (await res.json()) as {
        diagnosis_id: string
        action_id: string
        completed: boolean
      }[]
      return rows.map(
        (r): ActionRecord => ({
          diagnosisId: r.diagnosis_id,
          actionId: r.action_id,
          completed: r.completed,
        }),
      )
    },

    async setActionCompleted(userId, diagnosisId, actionId, completed) {
      await fetch(`${rest}/trader_diagnosis_actions?on_conflict=diagnosis_id,action_id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([
          {
            user_id: userId,
            diagnosis_id: diagnosisId,
            action_id: actionId,
            completed,
            completed_at: new Date().toISOString(),
          },
        ]),
      })
    },

    now: () => new Date(),
    newId: () => crypto.randomUUID(),
  }

  async function selectDiagnoses(query: string): Promise<StoredDiagnosis[]> {
    const res = await fetch(
      `${rest}/trader_diagnoses?${query}&select=id,user_id,account_id,trade_count,answers,result,created_at`,
      { headers },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as {
      id: string
      user_id: string
      account_id: string | null
      trade_count: number
      answers: Record<string, number>
      result: StoredDiagnosis['result']
      created_at: string
    }[]
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      accountId: r.account_id,
      tradeCount: r.trade_count,
      answers: r.answers,
      result: r.result,
      createdAt: r.created_at,
    }))
  }

  try {
    return cors(await handleDiagnosisRequest(req, deps))
  } catch (e) {
    return cors(json({ error: (e as Error).message ?? '処理できませんでした' }, 500))
  }
}

function toRow(row: StoredDiagnosis) {
  const r = row.result
  return {
    id: row.id,
    user_id: row.userId,
    account_id: row.accountId,
    diagnosis_version: r.diagnosisVersion,
    question_version: r.questionVersion,
    scoring_version: r.scoringVersion,
    status: r.status,
    primary_type: r.primaryType,
    secondary_type: r.secondaryType,
    confidence: r.confidence,
    trade_count: row.tradeCount,
    scores: r.scores,
    result: r,
    answers: row.answers,
    created_at: row.createdAt,
  }
}

/** PostgREST のフィルタに埋める値を安全にする */
function q(v: string): string {
  return encodeURIComponent(v)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cors(res: Response) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Headers', 'authorization,content-type')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  return res
}

export const config: Config = {
  path: ['/api/trader-diagnosis', '/api/trader-diagnosis/*'],
}
