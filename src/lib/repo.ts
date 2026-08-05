import { supabase } from './supabase'
import type { DayNote, Settings, Trade, TradeInput } from './types'

const NO_CLIENT = 'Supabase が未設定です (.env / Netlify の環境変数を確認してください)'
const NO_USER = 'ログインが必要です'

/** 重複判定に使える索引が無いときのエラーか */
function isMissingConflictTarget(e: unknown): boolean {
  const o = e as { code?: string; message?: string }
  return (
    o?.code === '42P10' ||
    /no unique or exclusion constraint matching the ON CONFLICT/i.test(o?.message ?? '')
  )
}

/** ログイン中の利用者ID。データは利用者ごとに分かれている。 */
async function requireUserId(): Promise<string> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const id = data.user?.id
  if (!id) throw new Error(NO_USER)
  return id
}

// 一覧取得では重い screenshot 列を除外して転送量を抑える。
const LIST_COLUMNS =
  'id,ticket,symbol,side,volume,open_price,close_price,sl,tp,open_time,close_time,commission,swap,profit,currency,note,source,created_at'

export async function fetchTrades(): Promise<Trade[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('trades')
    .select(LIST_COLUMNS)
    .order('open_time', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Trade[]
}

/** 個別トレードの添付スクショ (data URL) を取得。無ければ null。 */
export async function getTradeScreenshot(id: string): Promise<string | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('trades')
    .select('screenshot')
    .eq('id', id)
    .single()
  if (error) throw error
  return (data?.screenshot as string | null) ?? null
}

/** 既存トレードの項目を更新する。patch に含めたキーだけ更新。 */
export async function updateTrade(
  id: string,
  patch: Partial<TradeInput>,
): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('trades').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * 取引を挿入。ticket があるものは upsert (重複取込を防止)。
 * ticket が無いものは insert。返り値は挿入/更新件数。
 */
export async function insertTrades(rows: TradeInput[]): Promise<number> {
  if (!supabase) throw new Error(NO_CLIENT)
  if (rows.length === 0) return 0

  const userId = await requireUserId()
  const owned = rows.map((r) => ({ ...r, user_id: userId }))

  const withTicket = owned.filter((r) => r.ticket)
  const withoutTicket = owned.filter((r) => !r.ticket)
  let affected = 0

  if (withTicket.length) {
    const { data, error } = await supabase
      .from('trades')
      .upsert(withTicket, { onConflict: 'user_id,ticket' })
      .select('id')

    if (error) {
      // 重複判定用の索引が無い環境でも保存できるようにする。
      // 既に入っている取引番号を調べ、まだ無いものだけ登録する。
      if (isMissingConflictTarget(error)) {
        const tickets = withTicket.map((r) => r.ticket as string)
        const { data: existing, error: readErr } = await supabase
          .from('trades')
          .select('ticket')
          .eq('user_id', userId)
          .in('ticket', tickets)
        if (readErr) throw readErr

        const already = new Set((existing ?? []).map((r) => (r as { ticket: string }).ticket))
        const fresh = withTicket.filter((r) => !already.has(r.ticket as string))
        if (fresh.length) {
          const { data: added, error: insErr } = await supabase
            .from('trades')
            .insert(fresh)
            .select('id')
          if (insErr) throw insErr
          affected += added?.length ?? 0
        }
      } else {
        throw error
      }
    } else {
      affected += data?.length ?? 0
    }
  }
  if (withoutTicket.length) {
    const { data, error } = await supabase
      .from('trades')
      .insert(withoutTicket)
      .select('id')
    if (error) throw error
    affected += data?.length ?? 0
  }
  return affected
}

export async function updateTradeNote(id: string, note: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('trades').update({ note }).eq('id', id)
  if (error) throw error
}

export async function deleteTrade(id: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllTrades(): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { error } = await supabase.from('trades').delete().eq('user_id', userId)
  if (error) throw error
}

export async function fetchDayNotes(): Promise<DayNote[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase.from('day_notes').select('*')
  if (error) throw error
  return (data ?? []) as DayNote[]
}

export async function upsertDayNote(day: string, note: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { error } = await supabase
    .from('day_notes')
    .upsert(
      { user_id: userId, day, note, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day' },
    )
  if (error) throw error
}

// ---------------------------------------------------------------
// 設定（原資）
// ---------------------------------------------------------------

/** 設定を取得。未登録なら null。重いスクショ列は含めない。 */
export async function fetchSettings(): Promise<Settings | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('settings')
    .select(
      'user_id,initial_capital,capital_note,account_currency,lot_size,broker_utc_offset,main_symbol,onboarded_at,updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as Settings | null) ?? null
}

/** 初期設定（オンボーディング）の内容を保存する */
export async function saveOnboarding(values: {
  initial_capital: number
  account_currency: string
  lot_size: number
  broker_utc_offset: number
  main_symbol: string | null
}): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { error } = await supabase.from('settings').upsert(
    {
      user_id: userId,
      ...values,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

/** 原資のスクショ (data URL) を取得。無ければ null。 */
export async function getCapitalScreenshot(): Promise<string | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('settings')
    .select('capital_screenshot')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.capital_screenshot as string | null) ?? null
}

/** 原資を保存。screenshot は undefined なら据え置き、null なら削除。 */
export async function saveCapital(patch: {
  initial_capital: number
  capital_note: string | null
  capital_screenshot?: string | null
}): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const row: Record<string, unknown> = {
    user_id: userId,
    initial_capital: patch.initial_capital,
    capital_note: patch.capital_note,
    updated_at: new Date().toISOString(),
  }
  if (patch.capital_screenshot !== undefined) {
    row.capital_screenshot = patch.capital_screenshot
  }
  const { error } = await supabase.from('settings').upsert(row, { onConflict: 'user_id' })
  if (error) throw error
}

// ---------------------------------------------------------------
// 連携コード（MT5のEAなどから書き込むための鍵）
// ---------------------------------------------------------------

export interface IngestToken {
  token: string
  label: string | null
  created_at: string
  last_used_at: string | null
}

export async function fetchIngestTokens(): Promise<IngestToken[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('ingest_tokens')
    .select('token,label,created_at,last_used_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as IngestToken[]
}

/** 連携コードを新しく発行する */
export async function createIngestToken(label = 'MT5'): Promise<IngestToken> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const token = generateToken()
  const { data, error } = await supabase
    .from('ingest_tokens')
    .insert({ token, user_id: userId, label })
    .select('token,label,created_at,last_used_at')
    .single()
  if (error) throw error
  return data as IngestToken
}

export async function deleteIngestToken(token: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('ingest_tokens').delete().eq('token', token)
  if (error) throw error
}

/** 読み間違えにくい文字だけで連携コードを作る */
function generateToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // I,O,0,1 は除外
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 5 === 0) out += '-'
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out // 例: ABCDE-FGHJK-LMNPQ-RSTUV
}
