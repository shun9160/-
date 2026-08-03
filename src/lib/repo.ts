import { supabase } from './supabase'
import type { DayNote, Trade, TradeInput } from './types'

const NO_CLIENT = 'Supabase が未設定です (.env / Netlify の環境変数を確認してください)'

export async function fetchTrades(): Promise<Trade[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('open_time', { ascending: true })
  if (error) throw error
  return (data ?? []) as Trade[]
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
