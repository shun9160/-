import Logo from './Logo'
import Avatar from './Avatar'
import Icon from './Icon'
import { NAV_ITEMS, type ScreenKey } from './Nav'

interface Props {
  current: ScreenKey
  onChange: (k: ScreenKey) => void
  /** 各画面に添える件数 */
  counts?: Partial<Record<ScreenKey, number>>
  email: string | null
  onOpenAccount: () => void
  accountActive?: boolean
  /**
   * サンプルを見ている人を、ログインへ送る。
   * 渡されたときは、いちばん下を「アカウント」ではなくこちらに差し替える。
   * まだアカウントが無い人にアカウントの設定を開かせても、
   * 「ログイン中 —」と出るだけで行き止まりになる
   */
  onSignIn?: () => void
}

/** デスクトップの左サイドバー。モバイルでは下タブ(BottomNav)を使う */
export default function Sidebar({
  current,
  onChange,
  counts,
  email,
  onOpenAccount,
  accountActive,
  onSignIn,
}: Props) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="px-5 py-5">
        <Logo size={28} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="メインメニュー">
        <Group label="記録と振り返り">
          {NAV_ITEMS.filter((i) => i.key !== 'stats').map((it) => (
            <Item
              key={it.key}
              active={current === it.key && !accountActive}
              icon={it.icon}
              label={it.label}
              count={counts?.[it.key]}
              onClick={() => onChange(it.key)}
            />
          ))}
        </Group>

        <Group label="分析">
          {NAV_ITEMS.filter((i) => i.key === 'stats').map((it) => (
            <Item
              key={it.key}
              active={current === it.key && !accountActive}
              icon={it.icon}
              label={it.label}
              onClick={() => onChange(it.key)}
            />
          ))}
        </Group>
      </nav>

      {/* 自分の情報。押すと基本情報と連携の設定を開く */}
      <div className="border-t border-line p-3">
        {onSignIn ? (
          /*
            色は塗らない。塗ったボタンは上のバーに1つだけにしておく。
            同じ画面に同じ色のボタンが2つあると、どちらを押せばいいのか
            考えさせることになる。ここは「いまサンプルを見ている」ことを
            伝えるのが主で、入口は添えるだけでいい
          */
          <>
            {/* いま何を見ているかの説明。読ませたい文なので ink3 では薄すぎる
                （白の上で 2.73。ink2 なら 5.29 出る） */}
            <p className="px-1 pb-2 text-[12px] leading-relaxed text-ink2">
              サンプルを表示中です。ログインすると、自分の記録を残せます。
            </p>
            <button
              onClick={onSignIn}
              // ロゴの紫そのままだと、薄い紫の上で 4.49 しか出ない。
              // 同じ色みのまま一段だけ暗くしてある（6.25）
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-soft px-3 py-2 text-[13px] font-bold text-[#5433E0] transition-colors hover:bg-brand hover:text-white"
            >
              ログイン / 新規登録
              <Icon name="right" size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={onOpenAccount}
            aria-current={accountActive ? 'page' : undefined}
            title="アカウントと連携"
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
              accountActive ? 'bg-brand-soft' : 'hover:bg-sunken'
            }`}
          >
            <Avatar email={email} size={32} />
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-xs font-semibold ${
                  accountActive ? 'text-brand' : 'text-ink'
                }`}
              >
                {email ?? 'サンプル表示'}
              </span>
              <span className="block truncate text-[11px] text-ink3">アカウントと連携</span>
            </span>
            <Icon
              name="right"
              size={15}
              className={accountActive ? 'shrink-0 text-brand' : 'shrink-0 text-ink3'}
            />
          </button>
        )}
      </div>
    </aside>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink3">
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  )
}

function Item({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <li>
      <button
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
          active ? 'bg-brand-soft text-brand' : 'text-ink2 hover:bg-sunken hover:text-ink'
        }`}
      >
        <Icon name={icon} size={17} strokeWidth={active ? 2 : 1.75} />
        <span className="flex-1 text-left">{label}</span>
        {count != null && count > 0 && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
              active ? 'bg-brand text-white' : 'bg-sunken text-ink2'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    </li>
  )
}
