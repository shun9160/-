import { useEffect, useMemo, useState } from 'react'
import type { Account, EnrichedTrade } from '../lib/types'
import { accountLabel } from '../lib/types'
import {
  deleteTrade,
  fetchTradeImageCounts,
  getTradeScreenshot,
  updateTrade,
  updateTradeNote,
} from '../lib/repo'
import { fmtJst, SESSION_LABELS } from '../lib/timezone'
import { currencyLabel } from '../lib/appConfig'
import { colorOf, fmtMoney, fmtNum, fmtPct, fmtRR } from '../lib/format'
import { sortTrades } from '../lib/tradeSort'
import { knownSetups } from '../lib/setups'
import type { TradeOrder } from '../lib/tradeSort'
import { friendlyError } from '../lib/errors'
import TradeForm from './TradeForm'
import ChartImages from './ChartImages'
import Icon from './Icon'
import ImageViewer from './ImageViewer'
import { Pill, type PillTone } from './ui'

/** 終わり方を、色と文字の両方で示す */
function outcome(t: EnrichedTrade): { tone: PillTone; label: string } {
  if (t.tpHit) return { tone: 'up', label: '利確ライン' }
  if (t.slHit) return { tone: 'down', label: '損切りライン' }
  return t.win ? { tone: 'up', label: '手動で利確' } : { tone: 'down', label: '手動で損切り' }
}

interface Props {
  trades: EnrichedTrade[]
  onChanged: () => void
  filterDay?: string | null
  readOnly?: boolean
  /** ホームの「最近の取引」用に情報量を絞る */
  compact?: boolean
  /** どの口座の取引かを出すために使う */
  accounts?: Account[]
  order?: TradeOrder
  /** 1件も無いときの言葉。絞り込みの結果が0件のときに差し替える */
  emptyText?: string
}

export default function TradesTable({
  trades, onChanged, filterDay, readOnly, compact, accounts, order = 'new', emptyText,
}: Props) {
  // 口座が2つ以上あるときだけ、どの口座の取引かを出す
  const accountOf = useMemo(() => {
    const m = new Map((accounts ?? []).map((a) => [a.id, a]))
    return (id?: string | null) => (id ? (m.get(id) ?? null) : null)
  }, [accounts])
  const showAccount = (accounts?.length ?? 0) > 1
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editingTrade, setEditingTrade] = useState<string | null>(null)
  const [imgOf, setImgOf] = useState<Record<string, string | null | 'loading'>>({})
  /** チャートを開いている取引 */
  const [chartOf, setChartOf] = useState<Record<string, true>>({})
  /** 取引ごとのチャート枚数。開かなくてもバッジに出す */
  const [chartCounts, setChartCounts] = useState<Record<string, number>>({})
  const [err, setErr] = useState<string | null>(null)
  /** 画面いっぱいで見ている画像 */
  const [viewer, setViewer] = useState<string | null>(null)

  // 何枚貼ってあるかだけ先に読む（画像そのものは開いたときに読む）
  useEffect(() => {
    if (readOnly) return
    let alive = true
    fetchTradeImageCounts()
      .then((c) => alive && setChartCounts(c))
      .catch(() => {
        /* 表が未作成でも一覧は普通に使えるようにする */
      })
    return () => {
      alive = false
    }
  }, [readOnly])

  // 一度使った型は、次から押すだけで付けられるようにする
  const setups = useMemo(() => knownSetups(trades), [trades])

  const rows = useMemo(() => {
    const list = filterDay ? trades.filter((t) => t.jstDay === filterDay) : trades
    return sortTrades(list, order)
  }, [trades, filterDay, order])

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

  function toggleChart(id: string) {
    setChartOf((m) => {
      const n = { ...m }
      if (n[id]) delete n[id]
      else n[id] = true
      return n
    })
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
      <div className="card px-6 py-10 text-center text-sm text-ink3">{emptyText ?? '取引がありません'}</div>
    )
  }

  // 一覧を見るだけの場面（ホームの「最近の取引」）は、表で一覧性を優先する
  if (compact) {
    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {['銘柄', '売買', 'ロット', '日時 (JST)', '終わり方', '損益'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink3 ${
                      i === 5 ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const o = outcome(t)
                return (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-sunken/60">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{t.symbol}</td>
                    <td className="px-4 py-3">
                      <Pill tone={t.side === 'buy' ? 'brand' : 'neutral'}>
                        {t.side === 'buy' ? '買い' : '売り'}
                      </Pill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink2">
                      {fmtNum(t.volume, 2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink2">
                      {fmtJst(t.open_time, 'M/d HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={o.tone}>{o.label}</Pill>
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${colorOf(
                        t.netProfit,
                      )}`}
                    >
                      {fmtMoney(t.netProfit, { sign: true })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
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
              {t.setup && (
                <span className="shrink-0 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand">
                  {t.setup}
                </span>
              )}
              <span className="shrink-0 text-xs text-ink3">{fmtNum(t.volume, 2)} lot</span>
              <span
                className={`ml-auto shrink-0 text-base font-bold tabular-nums ${colorOf(t.netProfit)}`}
              >
                {fmtMoney(t.netProfit, { sign: true })}
                <span className="ml-0.5 text-[11px] font-semibold text-ink3">{currencyLabel()}</span>
              </span>
            </div>

            <p className="px-4 pt-1 text-[11px] text-ink3">
              {fmtJst(t.open_time, 'M月d日 HH:mm')}
              {t.close_time && <> → {fmtJst(t.close_time, 'HH:mm')}</>}
              <span className="mx-1.5">·</span>
              {SESSION_LABELS[t.session].split(' ')[0]}
              <span className="ml-1.5">(日本時間)</span>
            </p>

            {showAccount && accountOf(t.account_id) && (
              <p className="px-4 pt-1 text-[11px] text-ink3">
                <span className="rounded-md bg-sunken px-1.5 py-0.5 font-semibold text-ink2">
                  {accountLabel(accountOf(t.account_id)!)}
                </span>
                {accountOf(t.account_id)!.login && accountOf(t.account_id)!.nickname && (
                  <span className="ml-1.5">口座番号 {accountOf(t.account_id)!.login}</span>
                )}
              </p>
            )}

            {isEditing ? (
              <div className="border-t border-line px-4 py-4">
                <TradeForm
                  knownSetups={setups}
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
                {(
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
                    <div>
                      <dt className="text-[11px] text-ink3">終わり方</dt>
                      <dd className="mt-0.5">
                        <Pill tone={outcome(t).tone}>{outcome(t).label}</Pill>
                      </dd>
                    </div>
                    <Cell
                      label="手数料"
                      value={`${fmtMoney(t.commission)} ${currencyLabel()}`}
                    />
                  </dl>
                )}

                {/* 操作 */}
                {!readOnly && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2.5">
                    <button className="btn btn-quiet" onClick={() => setEditingTrade(t.id)}>
                      <Icon name="pencil" size={16} />
                      編集
                    </button>
                    <button className="btn btn-quiet" onClick={() => toggleChart(t.id)}>
                      <Icon name="chart" size={16} />
                      {chartOf[t.id] ? 'チャートを閉じる' : 'チャート'}
                      {!chartOf[t.id] && chartCounts[t.id] > 0 && (
                        <span className="rounded-full bg-brand-soft px-1.5 text-[11px] font-bold text-brand">
                          {chartCounts[t.id]}
                        </span>
                      )}
                    </button>
                    <button className="btn btn-quiet" onClick={() => toggleImage(t.id)}>
                      <Icon name="camera" size={16} />
                      {imgOf[t.id] !== undefined ? 'スクショを閉じる' : 'スクショ'}
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

                {/* チャート画像 */}
                {chartOf[t.id] && (
                  <ChartImages
                    tradeId={t.id}
                    readOnly={readOnly}
                    onCountChange={(n) => setChartCounts((c) => ({ ...c, [t.id]: n }))}
                  />
                )}

                {/* 取込元のスクショ */}
                {imgOf[t.id] !== undefined && (
                  <div className="border-t border-line px-4 py-3">
                    {imgOf[t.id] === 'loading' ? (
                      <p className="text-xs text-ink3">読み込み中…</p>
                    ) : imgOf[t.id] ? (
                      // 中に大きく置くと、下の内容が押し下がって読みにくい。
                      // ここは小さく出し、押したら画面いっぱいで見る
                      <button
                        type="button"
                        onClick={() => setViewer(imgOf[t.id] as string)}
                        className="group relative block w-full overflow-hidden rounded-xl border border-line"
                        aria-label="スクリーンショットを大きく見る"
                      >
                        <img
                          src={imgOf[t.id] as string}
                          alt="この取引のスクリーンショット"
                          className="max-h-44 w-full bg-sunken object-contain"
                        />
                        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-lg bg-ink/70 px-2 py-1 text-[11px] font-semibold text-white">
                          <Icon name="search" size={12} />
                          大きく見る
                        </span>
                      </button>
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

      {viewer && (
        <ImageViewer
          src={viewer}
          alt="この取引のスクリーンショット"
          onClose={() => setViewer(null)}
        />
      )}
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
