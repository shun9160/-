import Icon, { type IconName } from './Icon'

export type ScreenKey = 'home' | 'calendar' | 'add' | 'stats' | 'diary'

interface Item {
  key: ScreenKey
  label: string
  icon: IconName
  /** タブの役割を一言で（画面上部の説明に使う） */
  blurb: string
}

export const NAV_ITEMS: Item[] = [
  { key: 'home', label: 'ホーム', icon: 'home', blurb: '損益の全体像' },
  { key: 'calendar', label: 'カレンダー', icon: 'calendar', blurb: '日ごとの成績' },
  { key: 'add', label: '記録', icon: 'plus', blurb: '取引を追加' },
  { key: 'stats', label: '分析', icon: 'chart', blurb: '勝ちパターン' },
  { key: 'diary', label: '日記', icon: 'book', blurb: '振り返り' },
]

/**
 * モバイル: 画面下部のタブバー。
 *
 * 濃色の面（night）ひとつ。以前はロゴの紫→青を敷いていたが、
 * 画面の中でいちばん彩度が高くなり、本文よりバーが目立っていた。
 *
 * 画面の下端に接地させている。浮かせた島にすると、そこだけ別の層に
 * 見えて、画面がひとつながりに感じられなくなる。上の角だけ丸めて、
 * 「下から続いてきた面」として収める。
 *
 * 色は3つだけに絞る:
 *   面 = night / 選んでいないもの = 白の55% / 選んだもの = 白
 * ブランドの紫は「記録」の丸ひとつだけに使う。使う場所を1つに絞ると、
 * そこが押してほしいところだと分かる。
 */
export function BottomNav({
  current,
  onChange,
}: {
  current: ScreenKey
  onChange: (k: ScreenKey) => void
}) {
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-30 rounded-t-3xl bg-night md:hidden"
      aria-label="メインメニュー"
    >
      <div className="px-4 pb-2 pt-2">
        <ul className="mx-auto flex max-w-lg items-center justify-between gap-1">
          {NAV_ITEMS.map((it) => {
            const active = current === it.key
            const isAdd = it.key === 'add'
            return (
              <li key={it.key} className="min-w-0">
                <button
                  onClick={() => onChange(it.key)}
                  aria-current={active ? 'page' : undefined}
                  // 名前を出さないときも、読み上げと長押しでは何のボタンか分かるようにする
                  aria-label={it.label}
                  title={it.label}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-xl transition-colors ${
                    active && !isAdd
                      ? 'bg-white/10 px-3.5 text-white'
                      : 'w-11 text-white/55 hover:text-white'
                  }`}
                >
                  {/* 記録はいちばん押してほしい。ブランドの色はここだけに使う */}
                  <span
                    className={
                      isAdd
                        ? 'flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white'
                        : 'flex items-center justify-center'
                    }
                  >
                    <Icon name={it.icon} size={20} strokeWidth={active ? 2.1 : 1.9} />
                  </span>
                  {active && !isAdd && (
                    <span className="truncate text-xs font-bold">{it.label}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

/** デスクトップ: 上部の横並びナビ */
export function TopNav({
  current,
  onChange,
}: {
  current: ScreenKey
  onChange: (k: ScreenKey) => void
}) {
  return (
    <nav className="hidden md:block" aria-label="メインメニュー">
      <ul className="flex gap-1">
        {NAV_ITEMS.map((it) => {
          const active = current === it.key
          return (
            <li key={it.key}>
              <button
                onClick={() => onChange(it.key)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-brand-soft text-brand'
                    : 'text-ink2 hover:bg-sunken hover:text-ink',
                ].join(' ')}
              >
                <Icon name={it.icon} size={18} strokeWidth={active ? 2 : 1.75} />
                {it.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
