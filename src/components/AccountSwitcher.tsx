import { useEffect, useMemo, useRef, useState } from 'react'
import type { Account } from '../lib/types'
import type { AccountFilter } from '../hooks/useTrades'
import BrokerMark from './BrokerMark'
import Icon from './Icon'

interface Props {
  accounts: Account[]
  value: AccountFilter
  onChange: (id: AccountFilter) => void
  /** 口座の管理画面を開く */
  onManage?: () => void
}

const NO_BROKER = 'その他'

/**
 * 背景をうっすら透かす見た目。
 * 真っ白のカードだと、いちばん上に置いたときに主役より目立ってしまうため。
 * 文字はそのまま黒なので、読みやすさは落ちない。
 */
const GLASS =
  'border border-white/60 bg-white/45 backdrop-blur-sm hover:bg-white/65'

/** 口座を会社ごとにまとめる。並びは登録した順のまま。 */
function groupByBroker(accounts: Account[]) {
  const groups: { broker: string; accounts: Account[] }[] = []
  for (const a of accounts) {
    const key = a.broker?.trim() || NO_BROKER
    const hit = groups.find((g) => g.broker === key)
    if (hit) hit.accounts.push(a)
    else groups.push({ broker: key, accounts: [a] })
  }
  return groups
}

/** 会社の中での呼び名。表示名があればそれ、無ければ口座番号 */
function accountTitle(a: Account): string {
  return a.nickname ?? a.login ?? '番号なしの口座'
}

/**
 * 見ている口座を切り替えるプルダウン。
 * 会社を押すとその会社の口座が開き、口座を押すと切り替わる。
 */
export default function AccountSwitcher({ accounts, value, onChange, onManage }: Props) {
  const [open, setOpen] = useState(false)
  /** 開いている会社 */
  const [openBroker, setOpenBroker] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => groupByBroker(accounts), [accounts])
  const selected = accounts.find((a) => a.id === value) ?? null

  // 開いたら、いま見ている口座の会社を開いておく
  useEffect(() => {
    if (open) setOpenBroker(selected ? selected.broker?.trim() || NO_BROKER : null)
  }, [open, selected])

  // Esc と、外側を押したときに閉じる
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('touchstart', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('touchstart', onDown)
    }
  }, [open])

  if (accounts.length === 0) {
    return onManage ? (
      <button className="btn btn-quiet" onClick={onManage}>
        <Icon name="plus" size={16} />
        口座を登録する
      </button>
    ) : null
  }

  function pick(id: AccountFilter) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-1.5">
      <div ref={boxRef} className="relative min-w-0 flex-1 sm:max-w-xs">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${GLASS}`}
        >
          {selected ? (
            <BrokerMark broker={selected.broker} size={30} />
          ) : (
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Icon name="wallet" size={16} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold leading-tight text-ink">
              {selected ? (selected.broker ?? NO_BROKER) : 'すべての口座'}
            </span>
            {/* 背景を透かしたぶん薄い灰色だと読みにくくなるので、1段濃い色にする */}
            <span className="block truncate text-[11px] leading-tight text-ink2">
              {selected ? (
                <span className="tabular-nums">{accountTitle(selected)}</span>
              ) : (
                `${accounts.length}口座をまとめて表示`
              )}
            </span>
          </span>
          <Icon
            name="down"
            size={16}
            className={`shrink-0 text-ink3 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 right-0 z-40 mt-1.5 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-card"
          >
            <Row
              selected={value === null}
              onClick={() => pick(null)}
              icon={
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon name="wallet" size={16} />
                </span>
              }
              title="すべての口座"
              sub={`${accounts.length}口座をまとめて表示`}
            />

            <div className="my-1 border-t border-line" />

            {groups.map((g) => {
              // 口座が1つしかない会社は、押した時点で決まったほうが早い
              const only = g.accounts.length === 1 ? g.accounts[0] : null
              const expanded = openBroker === g.broker
              const holdsSelected = g.accounts.some((a) => a.id === value)
              return (
                <div key={g.broker}>
                  <Row
                    selected={Boolean(only && only.id === value)}
                    onClick={() =>
                      only ? pick(only.id) : setOpenBroker(expanded ? null : g.broker)
                    }
                    icon={<BrokerMark broker={g.broker} size={32} />}
                    title={g.broker}
                    sub={only ? accountTitle(only) : `${g.accounts.length}口座`}
                    marker={
                      only ? undefined : (
                        <Icon
                          name="down"
                          size={15}
                          className={`text-ink3 ${expanded ? 'rotate-180' : ''}`}
                        />
                      )
                    }
                    emphasise={holdsSelected && !only}
                  />

                  {!only && expanded && (
                    <div className="mb-1 ml-4 border-l border-line pl-2">
                      {g.accounts.map((a) => (
                        <Row
                          key={a.id}
                          selected={a.id === value}
                          onClick={() => pick(a.id)}
                          title={accountTitle(a)}
                          sub={a.nickname && a.login ? `口座番号 ${a.login}` : undefined}
                          tabular
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {onManage && (
        <button
          className={`btn shrink-0 px-2.5 text-ink ${GLASS}`}
          onClick={onManage}
          aria-label="口座を管理"
          title="口座を管理"
        >
          <Icon name="pencil" size={16} />
        </button>
      )}
    </div>
  )
}

function Row({
  selected,
  onClick,
  icon,
  title,
  sub,
  marker,
  emphasise,
  tabular,
}: {
  selected: boolean
  onClick: () => void
  icon?: React.ReactNode
  title: string
  sub?: string
  marker?: React.ReactNode
  /** 選択中の口座を含む会社。どこに入っているかの手がかりとして少し目立たせる */
  emphasise?: boolean
  tabular?: boolean
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
        selected ? 'bg-brand-soft' : emphasise ? 'bg-sunken/60 hover:bg-sunken' : 'hover:bg-sunken'
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold leading-tight ${
            selected ? 'text-brand' : 'text-ink'
          } ${tabular ? 'tabular-nums' : ''}`}
        >
          {title}
        </span>
        {sub && <span className="block truncate text-[11px] leading-tight text-ink3">{sub}</span>}
      </span>
      {selected ? <Icon name="check" size={16} className="shrink-0 text-brand" /> : marker}
    </button>
  )
}
