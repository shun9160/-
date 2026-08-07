import { useEffect, useState } from 'react'
import { useTrades } from './hooks/useTrades'
import SwipePager from './components/SwipePager'
import { useAuth } from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { getAppConfig, updateAppConfig } from './lib/appConfig'
import { BRAND } from './lib/brand'
import { Wordmark } from './components/Logo'
import Avatar from './components/Avatar'
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
import StatsPanel, { type StatsTabKey } from './components/StatsPanel'
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
  /** 分析のどのタブを開くか。日記から「タイプ詳細を見る」で使う */
  const [statsFocus, setStatsFocus] = useState<{ tab: StatsTabKey; n: number } | null>(null)

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
  const swipeOrder: (string | null)[] =
    accounts.length > 1 ? [null, ...accounts.map((a) => a.id)] : []

  const item = NAV_ITEMS.find((i) => i.key === screen)!
  /** 下のタブに無い画面を開いているとき、その名前 */
  const subScreen = showAccount
    ? 'アカウント'
    : showAccounts
      ? '口座'
      : showAllTrades
        ? 'すべての取引'
        : null

  // ホームは、上部バーからそのままブランドの色の面がつながる作りにする。
  // ただし口座の切り替えやお知らせが間に入るときは、つなげずに普通のカードで出す。
  const onHome = screen === 'home' && subScreen == null

  // 日記だけ、画面全体の下地をロゴの色にする。
  // 下地は body に付ける。main に付けると、指ではじいて画面の端を
  // 越えたとき（iOSのバウンス）に白がのぞいてしまうため。
  const onBrandBg = screen === 'diary' && subScreen == null
  useEffect(() => {
    if (onBrandBg) document.body.dataset.bg = 'brand'
    else delete document.body.dataset.bg
    return () => {
      delete document.body.dataset.bg
    }
  }, [onBrandBg])
  const switcherShown = !showAccount && !showAccounts && !loading && accounts.length > 1
  const heroFlush = onHome && !switcherShown && !demo && flash == null
  /** スマホで、上部バーの裏がロゴ色になっている状態 */
  const darkHeader = heroFlush || onBrandBg

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

      {/* 下のタブバー(92px)とiPhoneのホームバーのぶんだけ、中身の下に余白をとる */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(env(safe-area-inset-bottom,0px)+104px)] md:pb-0">
        {/* 上部バー */}
        <header
          className={`sticky top-0 z-20 border-b px-4 py-3 backdrop-blur ${
            darkHeader
              ? 'border-transparent bg-[#6741FF] md:border-line md:bg-page/75'
              : 'border-line bg-page/75'
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            {/* スマホ。タブの画面は下のバーで場所が分かるので、上には名前を出す。
                下のバーに無い画面（アカウントなど）のときだけ、そこの名前に差し替える。 */}
            <span className="min-w-0 md:hidden">
              {subScreen ? (
                <span className="truncate text-base font-bold text-ink">{subScreen}</span>
              ) : (
                <Wordmark size={24} onDark={darkHeader} />
              )}
            </span>
            <nav aria-label="現在地" className="hidden text-sm text-ink3 md:block">
              {BRAND.name} <span className="mx-1">/</span>
              <span className="font-semibold text-ink">{subScreen ?? item.label}</span>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {/* 自分のところ。押すと基本情報と連携の設定を開く */}
              <button
                onClick={openAccount}
                className={`flex items-center rounded-full p-0.5 transition-colors md:hidden ${
                  showAccount
                    ? 'ring-2 ring-brand'
                    : darkHeader
                      ? 'ring-2 ring-white/40'
                      : 'hover:bg-sunken'
                }`}
                title="アカウントと連携"
                aria-label="アカウントと連携"
              >
                <Avatar email={userEmail} size={30} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
          {/* 見ている口座 */}
          {!showAccount && !showAccounts && !loading && accounts.length > 1 && (
            <div className="mb-4">
              <AccountSwitcher
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
                onManage={demo ? undefined : openAccounts}
                onBrand={onBrandBg}
              />
              <p
                className={`mt-1.5 text-[11px] md:hidden ${
                  onBrandBg ? 'text-white' : 'text-ink3'
                }`}
              >
                画面を左右にスワイプしても口座を切り替えられます
              </p>
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
              <AccountPanel
                email={userEmail}
                onSignOut={signOut}
                onOpenAccounts={demo ? undefined : openAccounts}
                accountCount={accounts.length}
              />
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
            <SwipePager items={swipeOrder} current={accountId} onChange={setAccountId}>
              {screen === 'home' && (
                <Home
                  trades={trades}
                  account={account}
                  accounts={accounts}
                  onShowAll={() => setShowAllTrades(true)}
                  onAdd={() => go('add')}
                  onStats={() => go('stats')}
                  onDiary={() => go('diary')}
                  onOpenDay={openDay}
                  onChanged={reload}
                  readOnly={demo}
                  heroFlush={heroFlush}
                />
              )}
              {screen === 'calendar' && <CalendarScreen trades={trades} onSelectDay={openDay} />}
              {screen === 'add' && (
                <UploadPanel
                  accounts={accounts}
                  selectedAccountId={accountId}
                  onChanged={reload}
                  disabled={!configured}
                  onDone={finishAdd}
                />
              )}
              {screen === 'stats' && (
                <StatsPanel
                  trades={trades}
                  accountId={accountId}
                  focusTab={statsFocus}
                  onDiary={() => go('diary')}
                />
              )}
              {screen === 'diary' && (
                <Diary
                  trades={trades}
                  accounts={accounts}
                  dayNotes={dayNotes}
                  onChanged={reload}
                  focusDay={focusDay}
                  readOnly={demo}
                  onAdd={() => go('add')}
                  onStats={() => {
                    setStatsFocus(null)
                    go('stats')
                  }}
                  onOpenType={() => {
                    setStatsFocus((f) => ({ tab: 'type', n: (f?.n ?? 0) + 1 }))
                    go('stats')
                  }}
                />
              )}
            </SwipePager>
          )}

          <p className={`mt-6 text-center text-xs ${onBrandBg ? 'text-white' : 'text-ink3'}`}>
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
    <div className="mb-4 flex gap-3 rounded-2xl border border-line bg-brand-soft px-4 py-3">
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
