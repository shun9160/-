import { useEffect, useState } from 'react'
import { useTrades } from './hooks/useTrades'
import { useAuth } from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { getAppConfig, updateAppConfig } from './lib/appConfig'
import Logo from './components/Logo'
import Onboarding from './components/Onboarding'
import { BottomNav, NAV_ITEMS, TopNav, type ScreenKey } from './components/Nav'
import Icon from './components/Icon'
import AuthScreen from './components/AuthScreen'
import AccountPanel from './components/AccountPanel'
import Home from './components/Home'
import CalendarScreen from './components/CalendarScreen'
import StatsPanel from './components/StatsPanel'
import UploadPanel from './components/UploadPanel'
import TradesTable from './components/TradesTable'
import Diary from './components/Diary'

export default function App() {
  const { session, ready, userEmail, signOut } = useAuth()
  const [previewMode, setPreviewMode] = useState(false)
  const authed = Boolean(session)

  const { trades, dayNotes, settings, loading, error, configured, demo, reload } =
    useTrades(authed)
  const [screen, setScreen] = useState<ScreenKey>('home')
  const [focusDay, setFocusDay] = useState<string | null>(null)
  /** ホームから開く「すべての取引」。タブではなくサブ画面 */
  const [showAllTrades, setShowAllTrades] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  /** 初期設定を「あとで」にした場合、この画面では出さない */
  const [skipOnboarding, setSkipOnboarding] = useState(false)

  // 初期設定の内容をアプリ全体に反映する
  useEffect(() => {
    if (!settings) return
    updateAppConfig({
      brokerUtcOffset: settings.broker_utc_offset,
      accountCurrency: settings.account_currency,
      lotSize: settings.lot_size,
      defaultSymbol: settings.main_symbol ?? undefined,
    })
  }, [settings])

  function go(k: ScreenKey) {
    setScreen(k)
    setShowAllTrades(false)
    setShowAccount(false)
    window.scrollTo({ top: 0 })
  }

  function openDay(day: string) {
    setFocusDay(day)
    setScreen('diary')
    setShowAllTrades(false)
    setShowAccount(false)
    window.scrollTo({ top: 0 })
  }

  const item = NAV_ITEMS.find((i) => i.key === screen)!

  // 認証状態の確認中
  if (!ready) {
    return <div className="py-32 text-center text-sm text-ink3">読み込み中…</div>
  }

  // 未ログイン。Supabase未設定のときはサンプル閲覧だけ許す。
  if (isSupabaseConfigured && !authed && !previewMode) {
    return <AuthScreen onSkip={() => setPreviewMode(true)} />
  }

  // ログイン直後で初期設定がまだのとき
  if (authed && !loading && !skipOnboarding && settings?.onboarded_at == null) {
    return (
      <Onboarding
        onDone={() => {
          setSkipOnboarding(true)
          void reload()
        }}
      />
    )
  }

  return (
    <div className="min-h-full pb-24 md:pb-10">
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 border-b border-line bg-page/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Logo size={30} />
          <div className="ml-auto flex items-center gap-2">
            <TopNav current={screen} onChange={go} />
            <button
              onClick={() => reload()}
              className="btn btn-quiet px-2.5"
              title="最新の状態に更新"
              aria-label="更新"
            >
              <Icon name="refresh" size={17} />
            </button>
            {authed && (
              <button
                onClick={() => {
                  setShowAccount(true)
                  setShowAllTrades(false)
                  window.scrollTo({ top: 0 })
                }}
                className="btn btn-quiet px-2.5"
                title="アカウントと連携設定"
                aria-label="アカウント"
              >
                <Icon name="info" size={17} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {/* 画面タイトル: いま何の画面かを常に明示する */}
        {!showAllTrades && !showAccount && (
          <div className="mb-4 flex items-baseline gap-2">
            <h2 className="text-xl font-bold tracking-tight">{item.label}</h2>
            <span className="text-sm text-ink3">{item.blurb}</span>
          </div>
        )}

        {demo && <DemoNotice />}
        {error && (
          <div className="mb-4 rounded-2xl border border-down/25 bg-down-soft px-4 py-3 text-sm text-down">
            読み込みエラー: {error}
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-sm text-ink3">読み込み中…</div>
        ) : showAccount ? (
          <>
            <button className="btn btn-ghost mb-3 -ml-2" onClick={() => setShowAccount(false)}>
              <Icon name="back" size={17} />
              戻る
            </button>
            <AccountPanel email={userEmail} onSignOut={signOut} />
          </>
        ) : showAllTrades ? (
          <>
            <button className="btn btn-ghost mb-3 -ml-2" onClick={() => setShowAllTrades(false)}>
              <Icon name="back" size={17} />
              ホームに戻る
            </button>
            <h2 className="mb-3 text-xl font-bold tracking-tight">
              すべての取引
              <span className="ml-2 text-sm font-medium text-ink3">{trades.length}件</span>
            </h2>
            <TradesTable trades={trades} onChanged={reload} readOnly={demo} />
          </>
        ) : (
          <>
            {screen === 'home' && (
              <Home
                trades={trades}
                settings={settings}
                onShowAll={() => setShowAllTrades(true)}
                onAdd={() => go('add')}
                onChanged={reload}
                readOnly={demo}
              />
            )}
            {screen === 'calendar' && (
              <CalendarScreen trades={trades} onSelectDay={openDay} />
            )}
            {screen === 'add' && (
              <UploadPanel onChanged={reload} disabled={!configured} onDone={() => go('home')} />
            )}
            {screen === 'stats' && <StatsPanel trades={trades} />}
            {screen === 'diary' && (
              <Diary
                trades={trades}
                dayNotes={dayNotes}
                onChanged={reload}
                focusDay={focusDay}
                readOnly={demo}
              />
            )}
          </>
        )}

        <p className="mt-10 text-center text-xs text-ink3">
          MT5の時刻（UTC{getAppConfig().brokerUtcOffset >= 0 ? '+' : ''}
          {getAppConfig().brokerUtcOffset}）を日本時間に変換して記録しています
        </p>
      </main>

      <BottomNav current={screen} onChange={go} />
    </div>
  )
}

function DemoNotice() {
  return (
    <div className="mb-4 flex gap-3 rounded-2xl border border-line bg-brand-soft/60 px-4 py-3">
      <Icon name="info" size={18} className="mt-0.5 shrink-0 text-brand" />
      <div className="text-sm">
        <p className="font-semibold text-ink">サンプルデータを表示中</p>
        <p className="mt-0.5 text-ink2">
          ログインしていないため、動きを確認するための仮データです（保存はできません）。
        </p>
      </div>
    </div>
  )
}
