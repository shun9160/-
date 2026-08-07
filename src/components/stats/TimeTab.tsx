import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { heatmap, hourBreakdown, sessionBreakdown } from '../../lib/analytics'
import { SESSION_LABELS } from '../../lib/timezone'
import { colorOf, fmtMoney, fmtPct } from '../../lib/format'
import { useReveal } from '../../lib/useInView'
import { Bar, Empty, Head, Money } from './parts'
import { SegmentedControl } from '../ui'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
type SortKey = 'net' | 'count' | 'hour'

/** いつ勝てているのかを見る */
export default function TimeTab({ trades }: { trades: EnrichedTrade[] }) {
  const [view, setView] = useState<'session' | 'heat' | 'hour'>('session')

  if (trades.length === 0) return <Empty text="取引がありません" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink3">日本時間で集計しています</p>
        <SegmentedControl
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'session', label: 'サマリー' },
            { value: 'heat', label: 'ヒートマップ' },
            { value: 'hour', label: '時間別' },
          ]}
        />
      </div>

      {view === 'session' && <Sessions trades={trades} />}
      {view === 'heat' && <Heat trades={trades} />}
      {view === 'hour' && <Hours trades={trades} />}
    </div>
  )
}

function Sessions({ trades }: { trades: EnrichedTrade[] }) {
  const rows = sessionBreakdown(trades).filter((s) => s.count > 0)
  if (rows.length === 0) return <Empty text="集計できる取引がありません" />
  return (
    <div className="flex flex-col gap-3">
      {rows.map((s) => (
        <section key={s.key} className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold">{SESSION_LABELS[s.key]}</h3>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                s.net >= 0 ? 'bg-up-soft text-up' : 'bg-down-soft text-down'
              }`}
            >
              {s.net >= 0 ? '勝ち越し' : '負け越し'}
            </span>
          </div>
          <p className="mt-1.5 text-2xl">
            <Money value={s.net} />
          </p>
          <p className="mt-1 text-xs text-ink2">
            {s.count}件 ・ 勝率 {fmtPct(s.winRate)}
          </p>
          <div className="mt-2.5">
            <Bar ratio={s.winRate} tone={s.net >= 0 ? 'up' : 'down'} />
          </div>
        </section>
      ))}
    </div>
  )
}

function Heat({ trades }: { trades: EnrichedTrade[] }) {
  const cells = useMemo(() => heatmap(trades), [trades])
  const peak = Math.max(1, ...cells.map((c) => Math.abs(c.net)))
  const at = (w: number, h: number) => cells.find((c) => c.weekday === w && c.hour === h)

  return (
    <section className="card p-4">
      <Head title="曜日 × 時間" sub="濃いほど金額が大きい" />
      <div className="overflow-x-auto">
        <table className="min-w-[440px] border-separate border-spacing-[2px]">
          <tbody>
            {WEEKDAYS.map((w, wi) => (
              <tr key={w}>
                <th className="w-6 pr-1 text-right text-[11px] font-semibold text-ink2">{w}</th>
                {Array.from({ length: 24 }, (_, h) => {
                  const c = at(wi, h)
                  const v = c?.net ?? 0
                  const strength = c ? Math.min(1, Math.abs(v) / peak) : 0
                  const bg = !c
                    ? 'transparent'
                    : v >= 0
                      ? `rgba(22,163,74,${0.12 + strength * 0.7})`
                      : `rgba(180,35,24,${0.12 + strength * 0.7})`
                  return (
                    <td key={h}>
                      <span
                        title={
                          c
                            ? `${w}曜 ${h}時 ・ ${c.count}件 ・ ${fmtMoney(v, { sign: true })}`
                            : `${w}曜 ${h}時 ・ 取引なし`
                        }
                        style={{ background: bg }}
                        className={`block h-5 w-4 rounded-[3px] ${c ? '' : 'border border-line'}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td />
              {Array.from({ length: 24 }, (_, h) => (
                <td key={h} className="pt-1 text-center text-[9px] text-ink3">
                  {h % 3 === 0 ? h : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-ink3">
        緑はプラス、赤はマイナス。升目にふれると件数と金額が出ます。
      </p>
    </section>
  )
}

function Hours({ trades }: { trades: EnrichedTrade[] }) {
  const [sort, setSort] = useState<SortKey>('net')
  const rows = useMemo(() => {
    const base = hourBreakdown(trades)
    if (sort === 'net') return [...base].sort((a, b) => b.net - a.net)
    if (sort === 'count') return [...base].sort((a, b) => b.count - a.count)
    return [...base].sort((a, b) => a.hour - b.hour)
  }, [trades, sort])

  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.net)))

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">何時に勝てているか</h2>
        <label className="flex items-center gap-1.5 text-xs text-ink2">
          並び替え
          <select
            className="input w-auto px-2 py-1 text-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="net">損益が大きい順</option>
            <option value="count">件数が多い順</option>
            <option value="hour">時刻順</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink3">集計できる取引がありません</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.hour} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink2">
                {r.hour}時
              </span>
              <HourBar
                pct={Math.max(3, (Math.abs(r.net) / peak) * 100)}
                up={r.net >= 0}
              />
              <span className="w-24 shrink-0 text-right">
                <span className={`block text-xs font-bold tabular-nums ${colorOf(r.net)}`}>
                  {fmtMoney(r.net, { sign: true })}
                </span>
                <span className="block text-[10px] text-ink3">{r.count}件</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 時間帯ごとの帯。画面に入ってから左へ伸びる */
function HourBar({ pct, up }: { pct: number; up: boolean }) {
  const [ref, w] = useReveal<HTMLSpanElement>(pct)
  return (
    <span ref={ref} className="relative h-6 flex-1 overflow-hidden rounded-md bg-sunken">
      <span
        className={`rise absolute inset-y-0 left-0 rounded-md ${up ? 'bg-up/70' : 'bg-down/70'}`}
        style={{ width: `${w}%` }}
      />
    </span>
  )
}
