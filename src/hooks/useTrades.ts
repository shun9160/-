import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DayNote, EnrichedTrade } from '../lib/types'
import { enrichAll } from '../lib/analytics'
import { demoTrades } from '../lib/demo'
import { friendlyError } from '../lib/errors'
import { fetchDayNotes, fetchTrades } from '../lib/repo'
import { isSupabaseConfigured } from '../lib/supabase'

interface State {
  trades: EnrichedTrade[]
  dayNotes: Record<string, string>
  loading: boolean
  error: string | null
  configured: boolean
  /** Supabase 未設定でデモデータを表示中か (編集は無効) */
  demo: boolean
  reload: () => Promise<void>
}

export function useTrades(): State {
  const [rawTrades, setRawTrades] = useState<EnrichedTrade[]>([])
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      // デモモード: 仮データで UI を表示
      setRawTrades(enrichAll(demoTrades()))
      setDayNotes({})
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
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return useMemo(
    () => ({
      trades: rawTrades,
      dayNotes,
      loading,
      error,
      configured: isSupabaseConfigured,
      demo: !isSupabaseConfigured,
      reload,
    }),
    [rawTrades, dayNotes, loading, error, reload],
  )
}
