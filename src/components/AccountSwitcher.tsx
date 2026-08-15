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
 * 押せる小さな札。ヘッダーの中に並ぶので、面としては主張させない。
 * 以前は画面いっぱいの白いカードだったが、それだと
 * 「口座を選ぶ」という脇役の操作が、いちばん大きな面になってしまう。
 */
const CHIP =
  'border border-line bg-surface hover:bg-sunken'

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
    // min-w-0 を切らさないこと。ここで切れると、狭い画面で
    // 口座の名前が縮まず、隣にあるボタンを画面の外へ押し出す
    <div className="flex min-w-0 items-center">
      <div ref={boxRef} className="relative min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          // 100% を上限に入れておくこと。これが無いと、狭い画面で
          // 親が縮んでもこの札だけ中身の幅のまま残り、
          // 中の truncate が効かずに隣のボタンの上へはみ出して描かれる
          className={`flex h-9 max-w-[min(15rem,100%)] items-center gap-2 rounded-full px-2.5 pr-2 text-left transition-colors ${CHIP}`}
        >
          {selected ? (
            <BrokerMark broker={selected.broker} size={22} />
          ) : (
            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
              <Icon name="wallet" size={13} />
            </span>
          )}
          <span className="min-w-0 truncate text-[13px] font-bold leading-none text-ink">
            {selected ? accountTitle(selected) : 'すべての口座'}
          </span>
          <Icon
            name="down"
            size={15}
            className={`shrink-0 text-ink3 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute right-0 z-40 mt-1.5 max-h-[70vh] w-[17rem] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-raised"
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

            {/* 口座を足す・直すのはここから。
                外に鉛筆のボタンを出していたが、押すと何ができるのか
                分かりにくかったので、開いた中にまとめた。 */}
            {onManage && (
              <>
                <div className="my-1 border-t border-line" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onManage()
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-sunken"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Icon name="plus" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight text-ink">
                      口座を追加・編集
                    </span>
                    <span className="block truncate text-[11px] leading-tight text-ink2">
                      ブローカーや口座番号、原資を設定する
                    </span>
                  </span>
                  <Icon name="right" size={15} className="shrink-0 text-ink3" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
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
