import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { deleteTrade, getTradeScreenshot, updateTrade, updateTradeNote } from '../lib/repo'
import { fmtJst, SESSION_LABELS } from '../lib/timezone'
import { colorOf, fmtMoney, fmtNum, fmtPct, fmtRR } from '../lib/format'
import TradeForm from './TradeForm'

interface Props {
  trades: EnrichedTrade[]
  onChanged: () => void
  filterDay?: string | null
  readOnly?: boolean
}

export default function TradesTable({ trades, onChanged, filterDay, readOnly }: Props) {
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editingTrade, setEditingTrade] = useState<string | null>(null)
  const [imgOf, setImgOf] = useState<Record<string, string | null | 'loading'>>({})

  const rows = useMemo(() => {
    const list = filterDay ? trades.filter((t) => t.jstDay === filterDay) : trades
    return [...list].sort((a, b) => b.openJst.getTime() - a.openJst.getTime())
  }, [trades, filterDay])

  async function saveNote(id: string) {
    await updateTradeNote(id, draft)
    setEditingNote(null)
    onChanged()
  }

  async function remove(id: string) {
    if (!confirm('この取引を削除しますか？')) return
    await deleteTrade(id)
    onChanged()
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
    return <div className="card p-8 text-center text-sm text-gray-500">取引がありません</div>
  }

  return (
    <div className="space-y-2">
      {rows.map((t) => {
        const isEditing = editingTrade === t.id
        return (
          <div key={t.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    t.side === 'buy' ? 'bg-accent/20 text-accent' : 'bg-down/20 text-down'
                  }`}
                >
                  {t.side.toUpperCase()}
                </span>
                <span className="font-semibold">{t.symbol}</span>
                <span className="text-sm text-gray-400">{fmtNum(t.volume, 2)} lot</span>
                {t.ticket && <span className="text-xs text-gray-600">#{t.ticket}</span>}
              </div>
              <div className={`text-lg font-bold ${colorOf(t.netProfit)}`}>
                {fmtMoney(t.netProfit, { sign: true })}
                <span className="ml-1 text-xs font-normal text-gray-500">{t.currency}</span>
              </div>
            </div>

            {isEditing ? (
              <div className="mt-4 border-t border-border pt-4">
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
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                  <Cell
                    label="建値 → 決済"
                    value={`${fmtNum(t.open_price)} → ${t.close_price != null ? fmtNum(t.close_price) : '—'}`}
                  />
                  <Cell label="S/L" value={t.sl != null ? fmtNum(t.sl) : '—'} />
                  <Cell label="T/P" value={t.tp != null ? fmtNum(t.tp) : '—'} />
                  <Cell label="計画RR" value={fmtRR(t.plannedRR)} />
                  <Cell
                    label="実現R"
                    value={t.rMultiple != null ? `${fmtNum(t.rMultiple)} R` : '—'}
                    cls={t.rMultiple != null ? colorOf(t.rMultiple) : ''}
                  />
                  <Cell
                    label="TP獲得率"
                    value={fmtPct(t.capturedRatio)}
                    cls={t.capturedRatio != null ? colorOf(t.capturedRatio) : ''}
                  />
                  <Cell label="時間帯 (JST)" value={SESSION_LABELS[t.session].split(' ')[0]} />
                  <Cell
                    label="決済結果"
                    value={t.tpHit ? 'TP利確' : t.slHit ? 'SL損切' : t.win ? '手仕舞い(利)' : '手仕舞い(損)'}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                  <span>
                    エントリー {fmtJst(t.open_time, 'yyyy/MM/dd HH:mm:ss')}
                    {t.close_time && <> ／ 決済 {fmtJst(t.close_time, 'yyyy/MM/dd HH:mm:ss')}</>}
                    <span className="ml-1 text-gray-700">(日本時間)</span>
                  </span>
                  {!readOnly && (
                    <>
                      <button
                        className="text-accent hover:underline"
                        onClick={() => setEditingTrade(t.id)}
                      >
                        ✏️ 編集
                      </button>
                      <button
                        className="text-gray-400 hover:text-gray-200"
                        onClick={() => toggleImage(t.id)}
                      >
                        📷 画像
                      </button>
                    </>
                  )}
                </div>

                {/* 添付画像 */}
                {imgOf[t.id] !== undefined && (
                  <div className="mt-2">
                    {imgOf[t.id] === 'loading' ? (
                      <span className="text-xs text-gray-500">読込中…</span>
                    ) : imgOf[t.id] ? (
                      <img
                        src={imgOf[t.id] as string}
                        alt="スクショ"
                        className="max-h-80 w-full rounded-lg border border-border object-contain"
                      />
                    ) : (
                      <span className="text-xs text-gray-600">この取引に画像はありません</span>
                    )}
                  </div>
                )}

                {/* メモ */}
                <div className="mt-3 border-t border-border pt-3">
                  {readOnly ? (
                    t.note ? (
                      <span className="whitespace-pre-wrap text-sm text-gray-300">📝 {t.note}</span>
                    ) : (
                      <span className="text-sm text-gray-600">メモなし</span>
                    )
                  ) : editingNote === t.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        className="min-h-[70px] rounded-lg border border-border bg-panel-2 p-2 text-sm outline-none focus:border-accent"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="根拠・反省・感情など…"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          className="btn bg-accent text-white hover:bg-blue-500"
                          onClick={() => saveNote(t.id)}
                        >
                          保存
                        </button>
                        <button
                          className="btn bg-panel-2 text-gray-300"
                          onClick={() => setEditingNote(null)}
                        >
                          キャンセル
                        </button>
                        <button
                          className="btn ml-auto text-down hover:bg-down/10"
                          onClick={() => remove(t.id)}
                        >
                          取引を削除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="w-full text-left text-sm text-gray-300 hover:text-white"
                      onClick={() => {
                        setEditingNote(t.id)
                        setDraft(t.note ?? '')
                      }}
                    >
                      {t.note ? (
                        <span className="whitespace-pre-wrap">📝 {t.note}</span>
                      ) : (
                        <span className="text-gray-600">＋ トレードメモを追加</span>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Cell({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className={`font-medium tabular-nums ${cls ?? 'text-gray-200'}`}>{value}</div>
    </div>
  )
}
