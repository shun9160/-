import { useState } from 'react'
import { useTrades } from './hooks/useTrades'
import { useAccountSwipe } from './hooks/useAccountSwipe'
import { useAuth } from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { getAppConfig, updateAppConfig } from './lib/appConfig'
import { BRAND } from './lib/brand'
import { accountLabel } from './lib/types'
import Logo from './components/Logo'
import Onboarding from './components/Onboarding'
import { BottomNav, NAV_ITEMS, type ScreenKey } from './components/Nav'
import Sidebar from './components/Sidebar'
import { PageHeader } from './components/ui'
import Icon from './components/Icon'
import AuthScreen from './components/AuthScreen'
import AccountPanel from './components/AccountPanel'
import AccountsPanel from './components/AccountsPanel'
import AccountSwitcher from './components/AccountSwitcher'
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

  const {
    trades, allTrades, accounts, accountId, setAccountId, account, writeAccount,
    dayNotes, settings, loading, error, configured, demo, reload,
  } = useTrades(authed)
  const [screen, setScreen] = useState<ScreenKey>('home')
  const [focusDay, setFocusDay] = useState<string | null>(null)
  /** ホームから開く「すべての取引」。タブではなくサブ画面 */
  const [showAllTrades, setShowAllTrades] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  /** 口座の管理画面。タブではなくサブ画面 */
  const [showAccounts, setShowAccounts] = useState(false)
  /** 初期設定を「あとで」にした場合、この画面では出さない */
  const [skipOnboarding, setSkipOnboarding] = useState(false)
  /** 記録できたことを、移った先の画面で知らせる */
  const [flash, setFlash] = useState<string | null>(null)

  // 通貨や時差は口座ごとに違う。見ている口座の内容をアプリ全体に反映する。
  //
  // 反映は「描画のあと」ではなく、この場（子を描く前）で行う。
  // あとに回すと、口座を切り替えた直後の1回だけ前の口座の通貨で
  // 表示されてしまうため。同じ入力なら何度実行しても結果は同じ。
  const configSource = account ?? writeAccount
  if (configSource) {
    updateAppConfig({
      brokerUtcOffset: configSource.broker_utc_offset,
      accountCurrency: configSource.currency,
      lotSize: configSource.lot_size,
    })
  }
  if (settings?.main_symbol) updateAppConfig({ defaultSymbol: settings.main_symbol })

  function go(k: ScreenKey) {
    setFlash(null)
    setScreen(k)
    setShowAllTrades(false)
    setShowAccount(false)
    setShowAccounts(false)
    window.scrollTo({ top: 0 })
  }

  function openAccounts() {
    setShowAccounts(true)
    setShowAllTrades(false)
    setShowAccount(false)
    window.scrollTo({ top: 0 })
  }

  /**
   * 記録が終わったらホームへ移す。
   * 記録した結果（残高・今日の損益・最近の取引）がすぐ目に入る画面。
   */
  function finishAdd(message: string) {
    setScreen('home')
    setShowAllTrades(false)
    setShowAccount(false)
    setShowAccounts(false)
    setFlash(message)
    window.scrollTo({ top: 0 })
  }

  function openDay(day: string) {
    setFocusDay(day)
    setScreen('diary')
    setShowAllTrades(false)
    setShowAccount(false)
    setShowAccounts(false)
    window.scrollTo({ top: 0 })
  }

  // スマホで左右に振って口座を切り替える。並びは切り替えの帯と同じ。
  const swipeOrder = accounts.length > 1 ? [null, ...accounts.map((a) => a.id)] : []
  const swipe = useAccountSwipe(swipeOrder, accountId, setAccountId)

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

  function openAccount() {
    setShowAccount(true)
    setShowAllTrades(false)
    setShowAccounts(false)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        current={screen}
        onChange={go}
        counts={{ home: trades.length }}
        email={userEmail}
        onOpenAccount={openAccount}
        accountActive={showAccount}
      />

      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        {/* 上部バー */}
        <header className="sticky top-0 z-20 border-b border-line bg-page/90 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <span className="md:hidden">
              <Logo size={28} />
            </span>
            <nav aria-label="現在地" className="hidden text-sm text-ink3 md:block">
              {BRAND.name} <span className="mx-1">/</span>
              <span className="font-semibold text-ink">
                {showAccount
                  ? 'アカウント'
                  : showAccounts
                    ? '口座'
                    : showAllTrades
                      ? 'すべての取引'
                      : item.label}
              </span>
            </nav>
            <div className="ml-auto flex items-center gap-2">
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
                  onClick={openAccount}
                  className="btn btn-quiet px-2.5 md:hidden"
                  title="アカウントと連携設定"
                  aria-label="アカウント"
                >
                  <Icon name="info" size={17} />
                </button>
              )}
            </div>
          </div>
        </header>

        <main
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5"
          {...(showAccount || showAccounts ? {} : swipe)}
        >
          {/* 画面タイトル: いま何の画面かを常に明示する */}
          {!showAllTrades && !showAccount && !showAccounts && (
            <PageHeader title={item.label} sub={item.blurb} />
          )}

          {/* 見ている口座 */}
          {!showAccount && !showAccounts && !loading && accounts.length > 0 && (
            <div className="mb-4">
              <AccountSwitcher
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
                onManage={demo ? undefined : openAccounts}
              />
              {accounts.length > 1 && (
                <p className="mt-1.5 text-[11px] text-ink3 md:hidden">
                  画面を左右に振っても口座を切り替えられます
                </p>
              )}
            </div>
          )}

          {demo && <DemoNotice />}
          {flash && !showAllTrades && !showAccount && !showAccounts && (
            <SavedNotice
              message={flash}
              onSeeStats={() => go('stats')}
              onClose={() => setFlash(null)}
            />
          )}
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
          ) : showAccounts ? (
            <>
              <button className="btn btn-ghost mb-3 -ml-2" onClick={() => setShowAccounts(false)}>
                <Icon name="back" size={17} />
                戻る
              </button>
              <PageHeader
                title="口座"
                sub="ブローカーと口座番号ごとに、取引と原資を分けて管理します"
              />
              <AccountsPanel
                accounts={accounts}
                countOf={(id) => allTrades.filter((t) => t.account_id === id).length}
                onChanged={reload}
                readOnly={demo}
              />
            </>
          ) : showAllTrades ? (
            <>
              <button className="btn btn-ghost mb-3 -ml-2" onClick={() => setShowAllTrades(false)}>
                <Icon name="back" size={17} />
                ホームに戻る
              </button>
              <PageHeader title="すべての取引" sub={`${trades.length}件`} />
              <TradesTable
                trades={trades}
                accounts={accounts}
                onChanged={reload}
                readOnly={demo}
              />
            </>
          ) : (
            <>
              {screen === 'home' && (
                <Home
                  trades={trades}
                  account={account}
                  accounts={accounts}
                  onShowAll={() => setShowAllTrades(true)}
                  onAdd={() => go('add')}
                  onChanged={reload}
                  readOnly={demo}
                />
              )}
              {screen === 'calendar' && <CalendarScreen trades={trades} onSelectDay={openDay} />}
              {screen === 'add' && (
                <UploadPanel
                  accountId={writeAccount?.id ?? null}
                  accountName={writeAccount ? accountLabel(writeAccount) : null}
                  onChanged={reload}
                  disabled={!configured}
                  onDone={finishAdd}
                />
              )}
              {screen === 'stats' && <StatsPanel trades={trades} />}
              {screen === 'diary' && (
                <Diary
                  trades={trades}
                  accounts={accounts}
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
      </div>

      <BottomNav current={screen} onChange={go} />
    </div>
  )
}

/** 記録できたことを、移った先のホームで知らせる帯 */
function SavedNotice({
  message,
  onSeeStats,
  onClose,
}: {
  message: string
  onSeeStats: () => void
  onClose: () => void
}) {
  return (
    <div className="mb-4 flex gap-3 rounded-2xl border border-up/25 bg-up-soft px-4 py-3">
      <Icon name="check" size={18} className="mt-0.5 shrink-0 text-up" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-up">{message}</p>
        <p className="mt-0.5 text-ink2">この画面の数字とグラフに反映されています。</p>
        <button className="btn btn-quiet mt-2" onClick={onSeeStats}>
          <Icon name="chart" size={15} />
          分析で詳しく見る
        </button>
      </div>
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="-mr-1 -mt-1 shrink-0 self-start rounded-lg p-1 text-ink3 hover:bg-surface hover:text-ink"
      >
        <Icon name="close" size={16} />
      </button>
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
