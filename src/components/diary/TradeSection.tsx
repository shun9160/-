import { useMemo, useState } from 'react'
import type { Account, EnrichedTrade } from '../../lib/types'
import { accountLabel } from '../../lib/types'
import TradesTable from '../TradesTable'
import { TRADE_ORDERS } from '../../lib/tradeSort'
import type { TradeOrder } from '../../lib/tradeSort'
import { colorOf, fmtMoney } from '../../lib/format'
import Icon from '../Icon'

interface Props {
  trades: EnrichedTrade[]
  accounts?: Account[]
  readOnly?: boolean
  onChanged: () => void
  onAdd?: () => void
}

/** その日の取引。絞り込みと並び替えを添えて出す */
export default function TradeSection({
  trades,
  accounts,
  readOnly,
  onChanged,
  onAdd,
}: Props) {
  const [account, setAccount] = useState<string>('all')
  const [order, setOrder] = useState<TradeOrder>('new')

  const rows = useMemo(
    () => (account === 'all' ? trades : trades.filter((t) => t.account_id === account)),
    [trades, account],
  )
  const net = useMemo(() => rows.reduce((s, t) => s + t.netProfit, 0), [rows])

  // この日に取引のある口座だけを選べるようにする
  const usable = useMemo(() => {
    const ids = new Set(trades.map((t) => t.account_id).filter(Boolean) as string[])
    return (accounts ?? []).filter((a) => ids.has(a.id))
  }, [accounts, trades])

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-soft text-brand">
            <Icon name="book" size={13} />
          </span>
          トレードの履歴
        </h2>
        <span className="text-xs text-ink3">
          {rows.length}件
          <span className="mx-1">·</span>
          <span className={`font-bold tabular-nums ${colorOf(net)}`}>
            {fmtMoney(net, { sign: true })}
          </span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          {usable.length > 1 && (
            <select
              className="input w-auto max-w-[10rem] px-2 py-1 text-xs"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              aria-label="口座"
            >
              <option value="all">すべての口座</option>
              {usable.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </select>
          )}
          {rows.length > 1 && (
            <select
              className="input w-auto px-2 py-1 text-xs"
              value={order}
              onChange={(e) => setOrder(e.target.value as TradeOrder)}
              aria-label="並び替え"
            >
              {TRADE_ORDERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <TradesTable
        trades={rows}
        accounts={accounts}
        order={order}
        onChanged={onChanged}
        readOnly={readOnly}
        timeline
      />

      {!readOnly && onAdd && (
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/40 bg-brand-soft py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
          onClick={onAdd}
        >
          <Icon name="plus" size={16} />
          トレードを記録する
        </button>
      )}
    </section>
  )
}
