import type { Config, Context } from '@netlify/functions'

/**
 * MT5のEAなど、外部から取引を受け取る窓口。
 *
 * 連携コード（ingest_tokens）だけで本人を特定し、その人のデータとして保存する。
 * Supabaseのキーを外部プログラムに持たせないための仕組み。
 *
 * 必要な環境変数（Netlifyのサイト設定で登録）:
 *   SUPABASE_URL              … Project URL
 *   SUPABASE_SERVICE_ROLE_KEY … service_role キー（絶対に画面に出さない）
 */

const MAX_ROWS = 500

interface IncomingTrade {
  ticket?: string | null
  symbol?: string
  side?: string
  volume?: number
  open_price?: number
  close_price?: number | null
  sl?: number | null
  tp?: number | null
  open_time?: string
  close_time?: string | null
  commission?: number
  swap?: number
  profit?: number
  currency?: string
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))
  if (req.method !== 'POST') return cors(json({ error: 'POSTしてください' }, 405))

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return cors(json({ error: 'サーバー側の設定が未完了です' }, 500))
  }

  // --- 連携コードを取り出す -----------------------------------------
  const token = readToken(req)
  if (!token) return cors(json({ error: '連携コードがありません' }, 401))

  // --- 本文を読む ---------------------------------------------------
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return cors(json({ error: '本文がJSONではありません' }, 400))
  }

  const rows: IncomingTrade[] = Array.isArray(body)
    ? body
    : Array.isArray((body as { trades?: unknown }).trades)
      ? ((body as { trades: IncomingTrade[] }).trades)
      : []

  if (rows.length === 0) return cors(json({ error: '取引が入っていません' }, 400))
  if (rows.length > MAX_ROWS)
    return cors(json({ error: `一度に送れるのは${MAX_ROWS}件までです` }, 413))

  const rest = `${url.replace(/\/$/, '')}/rest/v1`
  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  // --- 連携コードから利用者を特定する -------------------------------
  const tokenRes = await fetch(
    `${rest}/ingest_tokens?token=eq.${encodeURIComponent(token)}&select=user_id`,
    { headers: adminHeaders },
  )
  if (!tokenRes.ok) {
    return cors(json({ error: '連携コードを確認できませんでした' }, 502))
  }
  const found = (await tokenRes.json()) as { user_id: string }[]
  if (found.length === 0) {
    return cors(json({ error: '連携コードが正しくありません' }, 401))
  }
  const userId = found[0].user_id

  // --- 送られてきた口座を特定する（無ければ作る） --------------------
  // EA は MT5 の口座番号とブローカー名を送ってくる。
  // どの口座の取引かを取り違えないよう、口座番号で照合する。
  const meta = (body as { account?: { login?: unknown; broker?: unknown; currency?: unknown } })
    .account
  const login = meta?.login != null && String(meta.login).trim() !== ''
    ? String(meta.login).trim()
    : null
  const broker = meta?.broker != null && String(meta.broker).trim() !== ''
    ? String(meta.broker).trim()
    : null

  let accountId: string | null = null
  try {
    accountId = await findOrCreateAccount(rest, adminHeaders, userId, login, broker, meta?.currency)
  } catch {
    // 口座を決められなくても取引は取りこぼさない（あとから口座を割り当てられる）
    accountId = null
  }

  // --- 中身を整えて保存する -----------------------------------------
  const clean: Record<string, unknown>[] = []
  const skipped: string[] = []

  for (const r of rows) {
    const side = String(r.side ?? '').toLowerCase()
    if (!r.symbol || (side !== 'buy' && side !== 'sell') || !r.open_time) {
      skipped.push(String(r.ticket ?? '(番号なし)'))
      continue
    }
    if (!Number.isFinite(Number(r.volume)) || Number(r.volume) <= 0) {
      skipped.push(String(r.ticket ?? '(番号なし)'))
      continue
    }
    clean.push({
      user_id: userId,
      account_id: accountId,
      ticket: r.ticket ? String(r.ticket) : null,
      symbol: String(r.symbol),
      side,
      volume: Number(r.volume),
      open_price: Number(r.open_price ?? 0),
      close_price: numOrNull(r.close_price),
      sl: numOrNull(r.sl),
      tp: numOrNull(r.tp),
      open_time: r.open_time,
      close_time: r.close_time ?? null,
      commission: Number(r.commission ?? 0),
      swap: Number(r.swap ?? 0),
      profit: Number(r.profit ?? 0),
      currency: r.currency ? String(r.currency) : 'JPY',
      source: 'mt5',
    })
  }

  if (clean.length === 0) {
    return cors(json({ error: '保存できる取引がありませんでした', skipped }, 400))
  }

  // 取り込み済みは上書きしない（アプリで書いたメモや画像を守るため）
  // ブローカーが違えば同じ取引番号がありうるので、口座も含めて判定する。
  const saveRes = await fetch(`${rest}/trades?on_conflict=user_id,account_id,ticket`, {
    method: 'POST',
    headers: {
      ...adminHeaders,
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify(clean),
  })

  if (!saveRes.ok) {
    const detail = await saveRes.text()
    return cors(json({ error: '保存に失敗しました', detail }, 502))
  }
  const saved = (await saveRes.json()) as unknown[]

  // 最終受信日時を記録（失敗しても本処理は成功扱い）
  void fetch(`${rest}/ingest_tokens?token=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  }).catch(() => {})

  return cors(
    json({
      ok: true,
      received: rows.length,
      inserted: saved.length,
      duplicates: clean.length - saved.length,
      skipped,
    }),
  )
}

/**
 * 口座番号から口座を探し、まだ無ければ作る。
 * 番号が送られてこなかったときは、その人の既定の口座を使う。
 */
async function findOrCreateAccount(
  rest: string,
  headers: Record<string, string>,
  userId: string,
  login: string | null,
  broker: string | null,
  currency: unknown,
): Promise<string | null> {
  const q = (s: string) => encodeURIComponent(s)

  if (login) {
    const res = await fetch(
      `${rest}/accounts?user_id=eq.${q(userId)}&login=eq.${q(login)}&select=id&limit=1`,
      { headers },
    )
    if (res.ok) {
      const hit = (await res.json()) as { id: string }[]
      if (hit.length) return hit[0].id
    }

    // 初めて見る口座番号。取引の行き先として作っておく。
    const made = await fetch(`${rest}/accounts`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        login,
        broker,
        currency: currency ? String(currency) : 'JPY',
      }),
    })
    if (made.ok) {
      const rows = (await made.json()) as { id: string }[]
      if (rows.length) return rows[0].id
    }
    return null
  }

  // 番号が無いときは既定の口座へ
  const res = await fetch(
    `${rest}/accounts?user_id=eq.${q(userId)}&is_default=is.true&select=id&limit=1`,
    { headers },
  )
  if (!res.ok) return null
  const hit = (await res.json()) as { id: string }[]
  return hit.length ? hit[0].id : null
}

/** ヘッダー or 本文から連携コードを読む */
function readToken(req: Request): string | null {
  const auth = req.headers.get('authorization')
  if (auth && /^bearer /i.test(auth)) return auth.slice(7).trim()
  const direct = req.headers.get('x-ingest-token')
  if (direct) return direct.trim()
  const fromQuery = new URL(req.url).searchParams.get('token')
  return fromQuery ? fromQuery.trim() : null
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? n : null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cors(res: Response) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Headers', 'authorization,content-type,x-ingest-token')
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS')
  return res
}

export const config: Config = {
  path: '/api/ingest',
}
