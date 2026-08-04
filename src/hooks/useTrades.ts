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
  id: 1,
  initial_capital: 100000,
  capital_note: 'サンプルの原資',
}

export function useTrades(): State {
  const [rawTrades, setRawTrades] = useState<EnrichedTrade[]>([])
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
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
  }, [])

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
      demo: !isSupabaseConfigured,
      reload,
    }),
    [rawTrades, dayNotes, settings, loading, error, reload],
  )
}
