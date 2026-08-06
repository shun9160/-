import type { Account } from '../lib/types'
import { accountLabel } from '../lib/types'
import type { AccountFilter } from '../hooks/useTrades'
import Icon from './Icon'

interface Props {
  accounts: Account[]
  value: AccountFilter
  onChange: (id: AccountFilter) => void
  /** 口座の管理画面を開く */
  onManage?: () => void
}

/**
 * 見ている口座を切り替える帯。
 * 口座が1つしかないうちは切り替える意味がないので、口座名だけ静かに出す。
 */
export default function AccountSwitcher({ accounts, value, onChange, onManage }: Props) {
  if (accounts.length === 0) {
    return onManage ? (
      <button className="btn btn-quiet" onClick={onManage}>
        <Icon name="plus" size={16} />
        口座を登録する
      </button>
    ) : null
  }

  if (accounts.length === 1) {
    const a = accounts[0]
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-ink">{accountLabel(a)}</span>
        {a.login && a.nickname && <span className="text-ink3">{a.login}</span>}
        {onManage && (
          <button className="btn btn-ghost px-2 py-1" onClick={onManage}>
            <Icon name="plus" size={15} />
            口座を追加
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
      <Chip on={value === null} onClick={() => onChange(null)}>
        すべて
      </Chip>
      {accounts.map((a) => (
        <Chip key={a.id} on={value === a.id} onClick={() => onChange(a.id)}>
          {accountLabel(a)}
        </Chip>
      ))}
      {onManage && (
        <button
          className="btn btn-ghost shrink-0 px-2 py-1"
          onClick={onManage}
          aria-label="口座を管理"
          title="口座を管理"
        >
          <Icon name="pencil" size={15} />
        </button>
      )}
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
        on
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-line bg-surface text-ink2 hover:bg-sunken'
      }`}
    >
      {children}
    </button>
  )
}
