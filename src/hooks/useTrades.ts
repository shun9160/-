import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DayNote, EnrichedTrade, Settings } from '../lib/types'
import { enrichAll } from '../lib/analytics'
import { demoTrades } from '../lib/demo'
import { friendlyError } from '../lib/errors'
import { fetchDayNotes, fetchSettings, fetchTrades } from '../lib/repo'
import { isSupabaseConfigured } from '../lib/supabase'

interface State {
  trades: EnrichedTrade[]
  dayNotes: Record<string, string>
  /** 原資などの設定。未登録・未作成なら null */
  settings: Settings | null
  loading: boolean
  error: string | null
  configured: boolean
  /** Supabase 未設定でデモデータを表示中か (編集は無効) */
  demo: boolean
  reload: () => Promise<void>
}

/** デモ表示用の原資 */
const DEMO_SETTINGS: Settings = {
  user_id: 'demo',
  initial_capital: 100000,
  capital_note: 'サンプルの原資',
  account_currency: 'JPY',
  lot_size: 100000,
  broker_utc_offset: 4,
  main_symbol: 'XAUUSD',
  onboarded_at: '2026-08-01T00:00:00Z',
}

/**
 * @param authed ログイン済みか。未ログイン時はサンプルデータを表示する。
 */
export function useTrades(authed: boolean): State {
  const [rawTrades, setRawTrades] = useState<EnrichedTrade[]>([])
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const live = isSupabaseConfigured && authed

  const reload = useCallback(async () => {
    if (!live) {
      // デモモード: 仮データで UI を表示
      setRawTrades(enrichAll(demoTrades()))
      setDayNotes({})
      setSettings(DEMO_SETTINGS)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [trades, notes] = await Promise.all([fetchTrades(), fetchDayNotes()])
      setRawTrades(enrichAll(trades))
      const map: Record<string, string> = {}
      ;(notes as DayNote[]).forEach((n) => {
        if (n.note) map[n.day] = n.note
      })
      setDayNotes(map)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }

    // 設定テーブルは後から追加したもの。未作成でも本体が止まらないよう個別に扱う。
    try {
      setSettings(await fetchSettings())
    } catch {
      setSettings(null)
    }
  }, [live])

  useEffect(() => {
    void reload()
  }, [reload])

  return useMemo(
    () => ({
      trades: rawTrades,
      dayNotes,
      settings,
      loading,
      error,
      configured: isSupabaseConfigured,
      demo: !live,
      reload,
    }),
    [rawTrades, dayNotes, settings, loading, error, live, reload],
  )
}
