import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Account, DayNote, EnrichedTrade, Settings } from '../lib/types'
import { enrichAll } from '../lib/analytics'
import { demoTrades } from '../lib/demo'
import { friendlyError } from '../lib/errors'
import { fetchAccounts, fetchDayNotes, fetchSettings, fetchTrades } from '../lib/repo'
import { isSupabaseConfigured } from '../lib/supabase'

/** 口座の選び方。null は「すべての口座」 */
export type AccountFilter = string | null

interface State {
  /** 選んだ口座にしぼった取引 */
  trades: EnrichedTrade[]
  /** 口座にかかわらず全部の取引 */
  allTrades: EnrichedTrade[]
  accounts: Account[]
  /** 選択中の口座。null なら「すべて」 */
  accountId: AccountFilter
  setAccountId: (id: AccountFilter) => void
  /** 選択中の口座の中身。「すべて」のときは null */
  account: Account | null
  /** 記録先にする口座（選択中、無ければ既定、無ければ先頭） */
  writeAccount: Account | null
  dayNotes: Record<string, string>
  /** 日ごとの題名。一覧に「どんな日だったか」を出すのに使う */
  dayTitles: Record<string, string>
  /** 利用者ごとの設定（初期設定を終えたかなど）。未作成なら null */
  settings: Settings | null
  loading: boolean
  error: string | null
  configured: boolean
  /** Supabase 未設定でデモデータを表示中か (編集は無効) */
  demo: boolean
  reload: () => Promise<void>
}

/** デモ表示用の口座 */
const DEMO_ACCOUNT: Account = {
  id: 'demo-account',
  broker: 'サンプル証券',
  login: '12345678',
  nickname: null,
  currency: 'JPY',
  lot_size: 100000,
  broker_utc_offset: 4,
  initial_capital: 100000,
  capital_note: 'サンプルの原資',
  is_default: true,
}

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

// 「まだ読めていない」ときに返す中身。毎回同じ実体を返して再描画を増やさない。
const NO_TRADES: EnrichedTrade[] = []
const NO_NOTES: Record<string, string> = {}
const NO_ACCOUNTS: Account[] = []

/**
 * @param authed ログイン済みか。未ログイン時はサンプルデータを表示する。
 */
export function useTrades(authed: boolean): State {
  const [rawTrades, setRawTrades] = useState<EnrichedTrade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<AccountFilter>(null)
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({})
  const [dayTitles, setDayTitles] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /**
   * いま持っているデータが、ログイン済み(true)・未ログイン(false)
   * どちらのものか。null はまだ何も読んでいない。
   */
  const [loadedFor, setLoadedFor] = useState<boolean | null>(null)

  const live = isSupabaseConfigured && authed

  const reload = useCallback(async () => {
    if (!live) {
      // デモモード: 仮データで UI を表示
      setRawTrades(enrichAll(demoTrades().map((t) => ({ ...t, account_id: DEMO_ACCOUNT.id }))))
      setAccounts([DEMO_ACCOUNT])
      setDayNotes({})
      setDayTitles({})
      setSettings(DEMO_SETTINGS)
      setLoadedFor(false)
      setBusy(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const [trades, notes] = await Promise.all([fetchTrades(), fetchDayNotes()])
      setRawTrades(enrichAll(trades))
      const map: Record<string, string> = {}
      const titles: Record<string, string> = {}
      ;(notes as DayNote[]).forEach((n) => {
        if (n.note) map[n.day] = n.note
        if (n.title) titles[n.day] = n.title
      })
      setDayNotes(map)
      setDayTitles(titles)
    } catch (e) {
      setError(friendlyError(e))
    }

    // 口座テーブルは後から追加したもの。未作成でも本体が止まらないよう個別に扱う。
    try {
      setAccounts(await fetchAccounts())
    } catch {
      setAccounts([])
    }

    // 設定テーブルも同様。
    try {
      setSettings(await fetchSettings())
    } catch {
      setSettings(null)
    }

    // 取引と口座がそろってから見せる。片方だけ先に出すと数字がちらつく。
    setLoadedFor(true)
    setBusy(false)
  }, [live])

  useEffect(() => {
    void reload()
  }, [reload])

  /**
   * ログイン状態が変わった直後は、まだ前の状態のデータを持っている。
   * そのまま出すと、リロードのたびに他人事のような数字が一瞬映る。
   * 読み直しが終わるまでは「読み込み中」として何も見せない。
   */
  const stale = loadedFor !== live

  // 消された口座を選んだままにしない
  useEffect(() => {
    if (accountId && !accounts.some((a) => a.id === accountId)) setAccountId(null)
  }, [accounts, accountId])

  const visibleAccounts = stale ? NO_ACCOUNTS : accounts
  const allTrades = stale ? NO_TRADES : rawTrades

  const account = useMemo(
    () => visibleAccounts.find((a) => a.id === accountId) ?? null,
    [visibleAccounts, accountId],
  )

  const trades = useMemo(
    () => (accountId ? allTrades.filter((t) => t.account_id === accountId) : allTrades),
    [allTrades, accountId],
  )

  /** 記録先。選んでいればそれ、「すべて」なら既定の口座 */
  const writeAccount = useMemo(
    () => account ?? visibleAccounts.find((a) => a.is_default) ?? visibleAccounts[0] ?? null,
    [account, visibleAccounts],
  )

  return useMemo(
    () => ({
      trades,
      allTrades,
      accounts: visibleAccounts,
      accountId,
      setAccountId,
      account,
      writeAccount,
      dayNotes: stale ? NO_NOTES : dayNotes,
      dayTitles: stale ? NO_NOTES : dayTitles,
      settings: stale ? null : settings,
      loading: busy || stale,
      error,
      configured: isSupabaseConfigured,
      demo: !live,
      reload,
    }),
    [
      trades, allTrades, visibleAccounts, accountId, account, writeAccount,
      dayNotes, dayTitles, settings, busy, stale, error, live, reload,
    ],
  )
}
