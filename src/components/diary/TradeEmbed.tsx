import { useMemo, useState } from 'react'
import type { Account, EnrichedTrade } from '../../lib/types'
import { updateTrade } from '../../lib/repo'
import { colorOf, fmtMoney, fmtNum, fmtRR } from '../../lib/format'
import { fmtJst } from '../../lib/timezone'
import { currencyLabel } from '../../lib/appConfig'
import { knownSetups } from '../../lib/setups'
import TradeForm from '../TradeForm'
import Icon from '../Icon'

/**
 * その日のトレードを、日記の中に差し込む。
 *
 * ここは人が書くところではない。取り込んだ履歴から勝手に出る。
 * だから入力欄はひとつも置かない。
 *
 * 表にはしない。列を横に並べると読むものではなく「確認するもの」に
 * なってしまい、日記の流れが切れる。時刻・銘柄・結果だけを縦に並べ、
 * 細かい数字は押したときだけ出す。
 */

interface Props {
  trades: EnrichedTrade[]
  accounts?: Account[]
  readOnly?: boolean
  onChanged: () => void
  /** 取引がまだ無い日に「記録する」へ案内する */
  onAdd?: () => void
  /** 見出し。日記では「今日のトレード」、カレンダーでは「この日のトレード」 */
  title?: string
  /**
   * 上の区切り線を引かない。
   * すぐ上の面の縁が、すでに境目になっている場所で使う
   */
  bare?: boolean
}

export default function TradeEmbed({
  trades,
  accounts,
  readOnly,
  onChanged,
  onAdd,
  title = '今日のトレード',
  bare,
}: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const setups = useMemo(() => knownSetups(trades), [trades])

  const rows = useMemo(
    () => [...trades].sort((a, b) => a.openJst.getTime() - b.openJst.getTime()),
    [trades],
  )

  const sum = useMemo(() => {
    const net = rows.reduce((s, t) => s + t.netProfit, 0)
    const wins = rows.filter((t) => t.netProfit > 0).length
    const losses = rows.filter((t) => t.netProfit < 0).length
    const rr = rows.map((t) => t.plannedRR).filter((r): r is number => r != null)
    return {
      net,
      wins,
      losses,
      winRate: rows.length ? wins / rows.length : 0,
      avgRR: rr.length ? rr.reduce((s, r) => s + r, 0) / rr.length : null,
    }
  }, [rows])

  if (rows.length === 0) {
    return (
      <section className={bare ? 'mt-6' : 'mt-10'}>
        {!bare && <Rule />}
        <h2 className={`text-lg font-bold ${bare ? '' : 'mt-6'}`}>{title}</h2>
        <p className="mt-2 text-[15px] leading-[1.9] text-ink3">
          まだ取引が入っていません。
          <br />
          履歴を取り込むと、ここに自動で並びます。
        </p>
        {!readOnly && onAdd && (
          <button className="btn btn-primary mt-3" onClick={onAdd}>
            <Icon name="plus" size={16} />
            履歴を取り込む
          </button>
        )}
      </section>
    )
  }

  return (
    <section className={bare ? 'mt-6' : 'mt-10'}>
      {!bare && <Rule />}

      <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${bare ? '' : 'mt-6'}`}>
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-[13px] text-ink3">{rows.length} trades</span>
        <span className={`ml-auto text-xl font-bold tabular-nums ${colorOf(sum.net)}`}>
          {fmtMoney(sum.net, { sign: true })}
          <span className="ml-0.5 text-[11px] font-semibold text-ink3">{currencyLabel()}</span>
        </span>
      </div>

      {/* まとめ。ここも書かせない。ぜんぶ取り込んだ履歴から出している */}
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl bg-brand-soft/70 px-4 py-3">
        <Stat label="勝ち" value={`${sum.wins}`} />
        <Stat label="負け" value={`${sum.losses}`} />
        <Stat label="勝率" value={`${Math.round(sum.winRate * 100)}%`} />
        <Stat label="平均RR" value={sum.avgRR != null ? fmtNum(sum.avgRR, 2) : '—'} />
      </dl>

      <ul className="mt-2">
        {rows.map((t) => {
          const isOpen = open === t.id
          return (
            <li key={t.id} className="border-b border-line/80 last:border-0">
              <button
                type="button"
                onClick={() => {
                  setOpen(isOpen ? null : t.id)
                  setEditing(null)
                }}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 py-3.5 text-left transition-colors hover:bg-brand-soft/40"
              >
                <span className="w-11 shrink-0 pt-0.5 text-[12px] font-bold tabular-nums text-ink3">
                  {fmtJst(t.open_time, 'HH:mm')}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[15px] font-bold">{t.symbol}</span>
                    <span
                      className={`text-[12px] font-bold ${
                        t.side === 'buy' ? 'text-brand' : 'text-ink2'
                      }`}
                    >
                      {t.side === 'buy' ? 'BUY' : 'SELL'}
                    </span>
                    <span className="text-[12px] text-ink3">· {fmtNum(t.volume, 2)} lot</span>
                    {t.setup && (
                      <span className="rounded-md bg-brand-soft px-1.5 text-[11px] font-semibold text-brand">
                        {t.setup}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] tabular-nums text-ink3">
                    {fmtNum(t.open_price)}
                    {t.close_price != null && <> → {fmtNum(t.close_price)}</>}
                  </span>
                </span>

                <span
                  className={`shrink-0 whitespace-nowrap pt-0.5 text-[15px] font-bold tabular-nums ${colorOf(
                    t.netProfit,
                  )}`}
                >
                  {fmtMoney(t.netProfit, { sign: true })}
                </span>
              </button>

              {isOpen && (
                <div className="pb-4 pl-14">
                  {editing === t.id ? (
                    <div className="rounded-2xl border border-line bg-surface p-4">
                      <TradeForm
                        knownSetups={setups}
                        mode="edit"
                        trade={t}
                        onSubmit={async (input) => {
                          await updateTrade(t.id, input)
                          setEditing(null)
                          onChanged()
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3">
                        <Detail label="Entry" value={fmtNum(t.open_price)} />
                        <Detail
                          label="Exit"
                          value={t.close_price != null ? fmtNum(t.close_price) : '—'}
                        />
                        <Detail label="Lot" value={fmtNum(t.volume, 2)} />
                        <Detail label="SL" value={t.sl != null ? fmtNum(t.sl) : '未設定'} />
                        <Detail label="TP" value={t.tp != null ? fmtNum(t.tp) : '未設定'} />
                        <Detail label="RR" value={fmtRR(t.plannedRR)} />
                      </dl>

                      <p className="mt-3 text-[12px] tabular-nums text-ink3">
                        {fmtJst(t.open_time, 'HH:mm')}
                        {t.close_time && <> → {fmtJst(t.close_time, 'HH:mm')}</>}
                        {accounts && accounts.length > 1 && t.account_id && (
                          <span className="ml-2">
                            {accounts.find((a) => a.id === t.account_id)?.nickname ?? ''}
                          </span>
                        )}
                      </p>

                      {t.note && (
                        <p className="mt-2 whitespace-pre-wrap border-l-2 border-line pl-3 text-[14px] leading-relaxed text-ink2">
                          {t.note}
                        </p>
                      )}

                      {!readOnly && (
                        <button
                          type="button"
                          className="mt-3 text-[12px] font-semibold text-brand hover:underline"
                          onClick={() => setEditing(t.id)}
                        >
                          この取引を直す
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink3">{label}</dt>
      <dd className="text-[15px] font-bold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink3">{label}</dt>
      <dd className="text-[14px] font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/** 記事の中の区切り。線1本だけにして、囲まない */
export function Rule() {
  return <hr className="border-0 border-t border-line" />
}
