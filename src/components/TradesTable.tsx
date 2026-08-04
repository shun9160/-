import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { deleteTrade, getTradeScreenshot, updateTrade, updateTradeNote } from '../lib/repo'
import { fmtJst, SESSION_LABELS } from '../lib/timezone'
import { colorOf, fmtMoney, fmtNum, fmtPct, fmtRR } from '../lib/format'
import { friendlyError } from '../lib/errors'
import TradeForm from './TradeForm'
import Icon from './Icon'

interface Props {
  trades: EnrichedTrade[]
  onChanged: () => void
  filterDay?: string | null
  readOnly?: boolean
  /** ホームの「最近の取引」用に情報量を絞る */
  compact?: boolean
}

export default function TradesTable({ trades, onChanged, filterDay, readOnly, compact }: Props) {
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editingTrade, setEditingTrade] = useState<string | null>(null)
  const [imgOf, setImgOf] = useState<Record<string, string | null | 'loading'>>({})
  const [err, setErr] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = filterDay ? trades.filter((t) => t.jstDay === filterDay) : trades
    return [...list].sort((a, b) => b.openJst.getTime() - a.openJst.getTime())
  }, [trades, filterDay])

  async function saveNote(id: string) {
    try {
      await updateTradeNote(id, draft)
      setEditingNote(null)
      onChanged()
    } catch (e) {
      setErr(friendlyError(e))
    }
  }

  async function remove(id: string) {
    if (!confirm('この取引を削除します。よろしいですか？')) return
    try {
      await deleteTrade(id)
      onChanged()
    } catch (e) {
      setErr(friendlyError(e))
    }
  }

  async function toggleImage(id: string) {
    if (imgOf[id] !== undefined) {
      setImgOf((m) => {
        const n = { ...m }
        delete n[id]
        return n
      })
      return
    }
    setImgOf((m) => ({ ...m, [id]: 'loading' }))
    try {
      const url = await getTradeScreenshot(id)
      setImgOf((m) => ({ ...m, [id]: url }))
    } catch {
      setImgOf((m) => ({ ...m, [id]: null }))
    }
  }

  if (rows.length === 0) {
    return (
      <div className="card px-6 py-10 text-center text-sm text-ink3">取引がありません</div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {err && (
        <div className="rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
          {err}
        </div>
      )}

      {rows.map((t) => {
        const isEditing = editingTrade === t.id
        return (
          <article key={t.id} className="card overflow-hidden">
            {/* 見出し行 */}
            <div className="flex items-center gap-2.5 px-4 pt-3.5">
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                  t.side === 'buy' ? 'bg-brand-soft text-brand' : 'bg-sunken text-ink2'
                }`}
              >
                {t.side === 'buy' ? '買い' : '売り'}
              </span>
              <span className="truncate text-sm font-bold">{t.symbol}</span>
              <span className="shrink-0 text-xs text-ink3">{fmtNum(t.volume, 2)} lot</span>
              <span
                className={`ml-auto shrink-0 text-base font-bold tabular-nums ${colorOf(t.netProfit)}`}
              >
                {fmtMoney(t.netProfit, { sign: true })}
                <span className="ml-0.5 text-[11px] font-semibold text-ink3">円</span>
              </span>
            </div>

            <p className="px-4 pt-1 text-[11px] text-ink3">
              {fmtJst(t.open_time, 'M月d日 HH:mm')}
              {t.close_time && <> → {fmtJst(t.close_time, 'HH:mm')}</>}
              <span className="mx-1.5">·</span>
              {SESSION_LABELS[t.session].split(' ')[0]}
              {!compact && <span className="ml-1.5 text-ink3">(日本時間)</span>}
            </p>

            {isEditing ? (
              <div className="border-t border-line px-4 py-4">
                <TradeForm
                  mode="edit"
                  trade={t}
                  onSubmit={async (input) => {
                    await updateTrade(t.id, input)
                    setEditingTrade(null)
                    onChanged()
                  }}
                  onCancel={() => setEditingTrade(null)}
                />
              </div>
            ) : (
              <>
                {!compact && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line px-4 pt-3 sm:grid-cols-4">
                    <Cell
                      label="建値 → 決済"
                      value={`${fmtNum(t.open_price)} → ${
                        t.close_price != null ? fmtNum(t.close_price) : '—'
                      }`}
                    />
                    <Cell label="損切り (S/L)" value={t.sl != null ? fmtNum(t.sl) : '未設定'} />
                    <Cell label="利確 (T/P)" value={t.tp != null ? fmtNum(t.tp) : '未設定'} />
                    <Cell label="計画リスクリワード" value={fmtRR(t.plannedRR)} />
                    <Cell
                      label="実際の損益倍率"
                      value={t.rMultiple != null ? `${fmtNum(t.rMultiple)} R` : '—'}
                      cls={t.rMultiple != null ? colorOf(t.rMultiple) : undefined}
                    />
                    <Cell
                      label="狙いの何%"
                      value={fmtPct(t.capturedRatio)}
                      cls={t.capturedRatio != null ? colorOf(t.capturedRatio) : undefined}
                    />
                    <Cell
                      label="終わり方"
                      value={
                        t.tpHit
                          ? '利確ライン'
                          : t.slHit
                            ? '損切りライン'
                            : t.win
                              ? '手動で利確'
                              : '手動で損切り'
                      }
                    />
                    <Cell label="手数料" value={`${fmtMoney(t.commission)} 円`} />
                  </dl>
                )}

                {/* 操作 */}
                {!readOnly && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2.5">
                    <button className="btn btn-quiet" onClick={() => setEditingTrade(t.id)}>
                      <Icon name="pencil" size={16} />
                      編集
                    </button>
                    <button className="btn btn-quiet" onClick={() => toggleImage(t.id)}>
                      <Icon name="camera" size={16} />
                      {imgOf[t.id] !== undefined ? '画像を閉じる' : '画像'}
                    </button>
                    <button
                      className="btn btn-ghost ml-auto"
                      onClick={() => {
                        setEditingNote(t.id)
                        setDraft(t.note ?? '')
                      }}
                    >
                      {t.note ? 'メモを編集' : 'メモを書く'}
                    </button>
                    <button
                      className="btn btn-danger px-2"
                      onClick={() => remove(t.id)}
                      aria-label="削除"
                      title="削除"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                )}

                {/* 添付画像 */}
                {imgOf[t.id] !== undefined && (
                  <div className="border-t border-line px-4 py-3">
                    {imgOf[t.id] === 'loading' ? (
                      <p className="text-xs text-ink3">読み込み中…</p>
                    ) : imgOf[t.id] ? (
                      <img
                        src={imgOf[t.id] as string}
                        alt="この取引のスクリーンショット"
                        className="max-h-80 w-full rounded-xl border border-line object-contain"
                      />
                    ) : (
                      <p className="text-xs text-ink3">画像は登録されていません</p>
                    )}
                  </div>
                )}

                {/* メモ */}
                {editingNote === t.id ? (
                  <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
                    <textarea
                      className="input min-h-[80px] resize-y"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="なぜ入ったか、どう感じたか、次はどうするか"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={() => saveNote(t.id)}>
                        保存
                      </button>
                      <button className="btn btn-ghost" onClick={() => setEditingNote(null)}>
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  t.note && (
                    <p className="whitespace-pre-wrap border-t border-line bg-sunken/60 px-4 py-3 text-sm text-ink2">
                      {t.note}
                    </p>
                  )
                )}
              </>
            )}
          </article>
        )
      })}
    </div>
  )
}

function Cell({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink3">{label}</dt>
      <dd className={`text-sm font-semibold tabular-nums ${cls ?? 'text-ink'}`}>{value}</dd>
    </div>
  )
}
