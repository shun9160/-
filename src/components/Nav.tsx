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
 * 画面の端から浮かせた、ロゴの色（紫→青）の細長い島。
 * いま見ているところだけが白い丸に変わって名前が出る。
 * 5つぶんの名前を常に並べると窮屈なので、名前は選んだところだけに絞る。
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
      className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-page via-page/85 to-transparent md:hidden"
      aria-label="メインメニュー"
    >
      <div className="px-4 pb-3 pt-6">
        <ul className="mx-auto flex max-w-lg items-center justify-between gap-1 rounded-full bg-gradient-to-r from-[#6741FF] to-[#3B5BFF] p-1.5 shadow-raised">
          {NAV_ITEMS.map((it) => {
            const active = current === it.key
            return (
              <li key={it.key} className="min-w-0">
                <button
                  onClick={() => onChange(it.key)}
                  aria-current={active ? 'page' : undefined}
                  // 名前を出さないときも、読み上げと長押しでは何のボタンか分かるようにする
                  aria-label={it.label}
                  title={it.label}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-full transition-colors ${
                    active ? 'bg-surface px-3.5 text-brand' : 'w-11 text-white'
                  }`}
                >
                  {/* 記録はいちばん押してほしいので、選んでいなくても丸で少し目立たせる */}
                  <span
                    className={
                      !active && it.key === 'add'
                        ? 'flex h-8 w-8 items-center justify-center rounded-full bg-white/25'
                        : 'flex items-center justify-center'
                    }
                  >
                    <Icon name={it.icon} size={20} strokeWidth={active ? 2.1 : 1.9} />
                  </span>
                  {active && <span className="truncate text-xs font-bold">{it.label}</span>}
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
