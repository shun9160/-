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

/** モバイル: 画面下部のタブバー */
export function BottomNav({
  current,
  onChange,
}: {
  current: ScreenKey
  onChange: (k: ScreenKey) => void
}) {
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      aria-label="メインメニュー"
    >
      <ul className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map((it) => {
          const active = current === it.key
          const isAdd = it.key === 'add'
          return (
            <li key={it.key} className="flex-1">
              <button
                onClick={() => onChange(it.key)}
                aria-current={active ? 'page' : undefined}
                className="flex w-full flex-col items-center gap-1 py-2.5"
              >
                <span
                  className={[
                    'flex h-8 w-12 items-center justify-center rounded-full transition-colors',
                    isAdd
                      ? 'bg-brand text-white'
                      : active
                        ? 'bg-brand-soft text-brand'
                        : 'text-ink3',
                  ].join(' ')}
                >
                  <Icon name={it.icon} size={20} strokeWidth={isAdd ? 2.25 : active ? 2 : 1.75} />
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    active && !isAdd ? 'text-brand' : isAdd ? 'text-ink2' : 'text-ink3'
                  }`}
                >
                  {it.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
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
