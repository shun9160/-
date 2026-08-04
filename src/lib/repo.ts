import { supabase } from './supabase'
import type { DayNote, Settings, Trade, TradeInput } from './types'

const NO_CLIENT = 'Supabase が未設定です (.env / Netlify の環境変数を確認してください)'

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

  const withTicket = rows.filter((r) => r.ticket)
  const withoutTicket = rows.filter((r) => !r.ticket)
  let affected = 0

  if (withTicket.length) {
    const { data, error } = await supabase
      .from('trades')
      .upsert(withTicket, { onConflict: 'ticket' })
      .select('id')
    if (error) throw error
    affected += data?.length ?? 0
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
  const { error } = await supabase.from('trades').delete().neq('id', '')
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
  const { error } = await supabase
    .from('day_notes')
    .upsert({ day, note, updated_at: new Date().toISOString() }, { onConflict: 'day' })
  if (error) throw error
}

// ---------------------------------------------------------------
// 設定（原資）
// ---------------------------------------------------------------

/** 設定を取得。未登録なら null。重いスクショ列は含めない。 */
export async function fetchSettings(): Promise<Settings | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('settings')
    .select('id,initial_capital,capital_note,updated_at')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return (data as Settings | null) ?? null
}

/** 原資のスクショ (data URL) を取得。無ければ null。 */
export async function getCapitalScreenshot(): Promise<string | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('settings')
    .select('capital_screenshot')
    .eq('id', 1)
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
  const row: Record<string, unknown> = {
    id: 1,
    initial_capital: patch.initial_capital,
    capital_note: patch.capital_note,
    updated_at: new Date().toISOString(),
  }
  if (patch.capital_screenshot !== undefined) {
    row.capital_screenshot = patch.capital_screenshot
  }
  const { error } = await supabase.from('settings').upsert(row, { onConflict: 'id' })
  if (error) throw error
}
