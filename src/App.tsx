import { useMemo, useState } from 'react'
import { accountLabel } from './lib/types'
import { jstDayKey } from './lib/timezone'
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
import { PageHeader, SearchBox } from './components/ui'
import Icon from './components/Icon'
import AuthScreen from './components/AuthScreen'
import AccountPanel from './components/AccountPanel'
import AccountsPanel from './components/AccountsPanel'
import AccountSwitcher from './components/AccountSwitcher'
import Home from './components/Home'
import CalendarScreen from './components/CalendarScreen'
import StatsPanel, { STATS_TABS, type StatsTabKey } from './components/StatsPanel'
import UploadPanel from './components/UploadPanel'
import TradesTable from './components/TradesTable'
import { TRADE_ORDERS } from './lib/tradeSort'
import { searchTrades } from './lib/tradeSearch'
import type { TradeOrder } from './lib/tradeSort'
import Diary from './components/Diary'
import PricingScreen from './components/PricingScreen'
import InstallHint from './components/InstallHint'
import { usePlan } from './hooks/usePlan'
import { PLANS } from './lib/plan'
import { readEnv, shouldShowInstallHint } from './lib/install'

export default function App() {
  const { session, ready, userEmail, signOut } = useAuth()
  const [previewMode, setPreviewMode] = useState(false)
  const authed = Boolean(session)

  const {
    trades, allTrades, accounts, accountId, setAccountId, account, writeAccount,
    dayNotes, dayTitles, settings, loading, error, configured, demo, reload,
  } = useTrades(authed)
  const { plan, loading: planLoading } = usePlan(authed)
  const [screen, setScreen] = useState<ScreenKey>('home')
  const [focusDay, setFocusDay] = useState<string | null>(null)
  /** ホームから開く「すべての取引」。タブではなくサブ画面 */
  const [showAllTrades, setShowAllTrades] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  /** 口座の管理画面。タブではなくサブ画面 */
  const [showAccounts, setShowAccounts] = useState(false)
  /** 料金のページ。タブではなくサブ画面 */
  const [showPricing, setShowPricing] = useState(false)
  /** 初期設定を「あとで」にした場合、この画面では出さない */
  const [skipOnboarding, setSkipOnboarding] = useState(false)
  /** 記録できたことを、移った先の画面で知らせる */
  const [flash, setFlash] = useState<string | null>(null)
  /** 分析のどのタブを開くか。日記から「タイプ詳細を見る」で使う */
  const [statsFocus, setStatsFocus] = useState<{ tab: StatsTabKey; n: number } | null>(null)
  /** 分析でいま開いているタブ。横に振って移るために持つ */
  const [statsTab, setStatsTab] = useState<StatsTabKey>('summary')
  /** 日記でいま見ている日。横に振って移るために持つ */
  const [diaryDay, setDiaryDay] = useState<string | null>(null)
  /**
   * ホーム画面への置き方を案内するか。
   * 最初に一度だけ決める。描くたびに調べると、閉じた瞬間にまた出てくる
   */
  const [installHint, setInstallHint] = useState(() => shouldShowInstallHint(readEnv()))
  /** 「すべての取引」の並び順と絞り込み */
  const [allOrder, setAllOrder] = useState<TradeOrder>('new')
  const [allQuery, setAllQuery] = useState('')

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
    setShowPricing(false)
    window.scrollTo({ top: 0 })
  }

  function openAccounts() {
    setShowAccounts(true)
    setShowAllTrades(false)
    setShowAccount(false)
    setShowPricing(false)
    window.scrollTo({ top: 0 })
  }

  function openPricing() {
    setShowPricing(true)
    setShowAllTrades(false)
    setShowAccount(false)
    setShowAccounts(false)
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
    setShowPricing(false)
    setFlash(message)
    window.scrollTo({ top: 0 })
  }

  function openDay(day: string) {
    setFocusDay(day)
    setScreen('diary')
    setShowAllTrades(false)
    setShowAccount(false)
    setShowAccounts(false)
    setShowPricing(false)
    window.scrollTo({ top: 0 })
  }



  // 「すべての取引」で探した結果。件数の表示にも使うので、ここで出しておく
  const shownTrades = useMemo(() => {
    const name = new Map(accounts.map((a) => [a.id, accountLabel(a)]))
    return searchTrades(trades, allQuery, (id) => (id ? (name.get(id) ?? null) : null))
  }, [trades, accounts, allQuery])

  const item = NAV_ITEMS.find((i) => i.key === screen)!
  /** 下のタブに無い画面を開いているとき、その名前 */
  const subScreen = showAccount
    ? 'アカウント'
    : showAccounts
      ? '口座'
      : showPricing
        ? '料金'
        : showAllTrades
          ? 'すべての取引'
          : null

  // ホームは、上部バーからそのままブランドの色の面がつながる作りにする。
  // ただし口座の切り替えやお知らせが間に入るときは、つなげずに普通のカードで出す。
  const onHome = screen === 'home' && subScreen == null

  /**
   * スマホで左右に振ったとき、何が動くか。
   *
   * 画面によって「隣」の意味が違う。分析なら隣のタブ、日記なら前後の日、
   * カレンダーなら前後の月（暦のほうで受け取る）、それ以外なら隣の口座。
   * 同じ指の動きに、その画面で一番ほしい移動を割り当てる。
   */
  const swipe: { items: (string | null)[]; current: string | null; go: (v: string | null) => void } =
    screen === 'stats' && subScreen == null
      ? {
          items: STATS_TABS,
          current: statsTab,
          // n を変えるたびに分析側が受け取って切り替える
          go: (v) => setStatsFocus((f) => ({ tab: v as StatsTabKey, n: (f?.n ?? 0) + 1 })),
        }
      : screen === 'diary' && subScreen == null && diaryDay
        ? {
            // 前後1日ぶんだけ用意する。振るたびに、その日を真ん中にして作り直す
            items: [addDays(diaryDay, -1), diaryDay, nextDay(diaryDay)].filter(
              (d): d is string => d != null,
            ),
            current: diaryDay,
            go: (v) => v && setFocusDay(v),
          }
        : screen === 'calendar' && subScreen == null
          ? // 暦は自分で前後の月へ送る。ここで口座に割り当てると、
            // 暦を見ている人が隣の月へ行けなくなる
            { items: [], current: null, go: () => {} }
          : {
              items: accounts.length > 1 ? [null, ...accounts.map((a) => a.id)] : [],
              current: accountId,
              go: setAccountId,
            }
  const switcherShown = !showAccount && !showAccounts && !loading && accounts.length > 1
  // 上のバーからそのまま色の面をつなげられるのは、間に何も挟まらないときだけ
  const heroFlush = onHome && !switcherShown && !demo && !installHint && flash == null

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
    setShowPricing(false)
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
        onSignIn={demo && configured ? () => setPreviewMode(false) : undefined}
      />

      {/* 下のタブバーとiPhoneのホームバーのぶんだけ、中身の下に余白をとる */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(env(safe-area-inset-bottom,0px)+80px)] md:pb-0">
        {/*
          上部バー。
          帯として独立させず、下地(page)と同じ色にして境目の線も引かない。
          線で区切ると、そこで画面が分断されて「上と下は別のもの」に見える。
          ロゴ・口座・自分、の3つだけをこの1行にまとめる。
        */}
        <header
          className={`sticky top-0 z-20 px-4 pb-2 pt-3 ${
            heroFlush ? 'bg-[#6741FF] md:bg-page' : 'bg-page'
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            {/* スマホ。タブの画面は下のバーで場所が分かるので、上には名前を出す。
                下のバーに無い画面（アカウントなど）のときだけ、そこの名前に差し替える。 */}
            {/* 名前は縮めない（読めない字になる）。
                画面の名前のほうは、長ければ後ろを省く */}
            <span className={`min-w-0 md:hidden ${subScreen ? 'overflow-hidden' : 'shrink-0'}`}>
              {subScreen ? (
                <span className="block truncate text-base font-bold text-ink">{subScreen}</span>
              ) : (
                <Wordmark size={21} onDark={heroFlush} />
              )}
            </span>
            <nav aria-label="現在地" className="hidden text-sm text-ink3 md:block">
              {BRAND.name} <span className="mx-1">/</span>
              <span className="font-semibold text-ink">{subScreen ?? item.label}</span>
            </nav>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              {/* 見ている口座。ここに置くと、面をひとつ減らせる */}
              {!showAccount && !showAccounts && !loading && accounts.length > 1 && (
                <span className={`min-w-0 ${heroFlush ? 'hidden md:block' : ''}`}>
                  <AccountSwitcher
                    accounts={accounts}
                    value={accountId}
                    onChange={setAccountId}
                    onManage={demo ? undefined : openAccounts}
                  />
                </span>
              )}

              {/*
                サンプルを見ている人が、いつでも入れるように。

                この画面で唯一の、色を塗ったボタンにしてある。
                サンプルは「見て回るところ」なので、どこを見ていても
                入口が同じ場所にあるほうがいい。
                下のタブや画面の中に混ぜると、そのタブを開いている人にしか
                見えなくなる。

                自分の丸（アバター）は、このときは出さない。
                アカウントがまだ無いので中身が「?」にしかならず、
                意味のない丸のためにボタンの場所を削ることになる。
              */}
              {demo && configured ? (
                <button
                  onClick={() => setPreviewMode(false)}
                  className="shrink-0 whitespace-nowrap rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-bold text-white transition-transform active:scale-95"
                  aria-label="ログイン・新規登録"
                >
                  ログイン
                  <span className="hidden sm:inline"> / 新規登録</span>
                </button>
              ) : (
                /* 自分のところ。押すと基本情報と連携の設定を開く */
                <button
                  onClick={openAccount}
                  className={`flex shrink-0 items-center rounded-full p-0.5 transition-colors md:hidden ${
                    showAccount
                      ? 'ring-2 ring-brand'
                      : heroFlush
                        ? 'ring-2 ring-white/40'
                        : 'hover:bg-sunken'
                  }`}
                  title="アカウントと連携"
                  aria-label="アカウントと連携"
                >
                  <Avatar email={userEmail} size={28} />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-5 pt-1">

          {/* iPhone の Safari で、ホーム画面への置き方を一度だけ案内する */}
          {installHint && <InstallHint onClose={() => setInstallHint(false)} />}

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
                onOpenPricing={demo ? undefined : openPricing}
                planName={PLANS[plan.plan].name}
              />
            </>
          ) : showPricing ? (
            <PricingScreen state={plan} loading={planLoading} onBack={() => setShowPricing(false)} />
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
              <PageHeader
                title="すべての取引"
                sub={
                  allQuery
                    ? `${shownTrades.length}件 / 全${trades.length}件`
                    : `${trades.length}件`
                }
              />
              {/* 件数が多い画面なので、探す・並べ替えるを添える */}
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <SearchBox
                  value={allQuery}
                  onChange={setAllQuery}
                  placeholder="通貨ペア・メモ・口座・日付などで検索"
                  label="取引を検索"
                  className="sm:max-w-sm sm:flex-1"
                />
                <div className="flex items-center justify-end gap-1.5 sm:ml-auto">
                  <label className="shrink-0 text-xs text-ink2" htmlFor="all-order">
                    並び替え
                  </label>
                  <select
                    id="all-order"
                    className="input w-auto px-2 py-1 text-xs"
                    value={allOrder}
                    onChange={(e) => setAllOrder(e.target.value as TradeOrder)}
                  >
                    {TRADE_ORDERS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <TradesTable
                trades={shownTrades}
                accounts={accounts}
                order={allOrder}
                onChanged={reload}
                readOnly={demo}
                emptyText={allQuery ? `「${allQuery}」に当てはまる取引はありません` : undefined}
              />
            </>
          ) : (
            <SwipePager items={swipe.items} current={swipe.current} onChange={swipe.go}>
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
              {screen === 'calendar' && (
                <CalendarScreen
                  trades={trades}
                  dayNotes={dayNotes}
                  dayTitles={dayTitles}
                  onSelectDay={openDay}
                />
              )}
              {screen === 'add' && (
                <UploadPanel
                  allTrades={allTrades}
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
                  onTabChange={setStatsTab}
                />
              )}
              {screen === 'diary' && (
                <Diary
                  trades={trades}
                  accounts={accounts}
                  dayNotes={dayNotes}
                  dayTitles={dayTitles}
                  onChanged={reload}
                  focusDay={focusDay}
                  readOnly={demo}
                  demo={demo}
                  onAdd={() => go('add')}
                  onOpenCalendar={() => go('calendar')}
                  onDayChange={setDiaryDay}
                />
              )}
            </SwipePager>
          )}

          <p className="mt-6 text-center text-xs text-ink3">
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
    // お知らせは面として立てない。カードにすると、いちばん上の
    // いちばん大きな面が「お知らせ」になってしまう。線1本で区切るだけにする
    <div className="mb-3 flex items-start gap-2 border-b border-line pb-3 text-[13px]">
      <Icon name="info" size={16} className="mt-0.5 shrink-0 text-brand" />
      <p className="text-ink2">
        <span className="font-bold text-ink">サンプルデータを表示中</span>
        <span className="ml-1.5">
          ログインしていないため、動きを確認するための仮データです（保存はできません）。
        </span>
      </p>
    </div>
  )
}

/** その日から delta 日ずらした日付（YYYY-MM-DD） */
function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/**
 * 次の日。ただし今日より先へは行かせない。
 * 未来の日を開いても何も無く、戻る手間が増えるだけなので。
 */
function nextDay(day: string): string | null {
  const next = addDays(day, 1)
  return next > jstDayKey(new Date().toISOString()) ? null : next
}
