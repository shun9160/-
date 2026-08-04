import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { summarize } from '../lib/analytics'
import { jstDayKey } from '../lib/timezone'
import { colorOf, fmtMoney, fmtPct } from '../lib/format'
import PnlCharts from './PnlCharts'
import TradesTable from './TradesTable'
import Icon from './Icon'

interface Props {
  trades: EnrichedTrade[]
  onShowAll: () => void
  onAdd: () => void
}

type RangeKey = 7 | 30 | 90 | 0

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 7, label: '7日' },
  { key: 30, label: '30日' },
  { key: 90, label: '90日' },
  { key: 0, label: '全期間' },
]

function withinDays(trades: EnrichedTrade[], days: number) {
  if (days <= 0) return trades
  const cutoff = Date.now() - days * 86400_000
  return trades.filter((t) => t.openJst.getTime() >= cutoff)
}

export default function Home({ trades, onShowAll, onAdd }: Props) {
  const [range, setRange] = useState<RangeKey>(30)
  const [chart, setChart] = useState<'cumulative' | 'daily'>('cumulative')

  const ranged = useMemo(() => withinDays(trades, range), [trades, range])
  const sum = useMemo(() => summarize(ranged), [ranged])
  const all = useMemo(() => summarize(trades), [trades])

  const todayKey = jstDayKey(new Date())
  const todayNet = useMemo(
    () => trades.filter((t) => t.jstDay === todayKey).reduce((s, t) => s + t.netProfit, 0),
    [trades, todayKey],
  )

  const recent = useMemo(
    () => [...trades].sort((a, b) => b.openJst.getTime() - a.openJst.getTime()).slice(0, 3),
    [trades],
  )

  if (trades.length === 0) {
    return <EmptyState onAdd={onAdd} />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 合計損益 — この画面の主役 */}
      <section className="card p-5">
        <p className="eyebrow">累計損益（手数料込み）</p>
        <p className={`mt-1 text-hero font-bold tabular-nums ${colorOf(all.netTotal)}`}>
          {fmtMoney(all.netTotal, { sign: true })}
          <span className="ml-1.5 text-base font-semibold text-ink3">円</span>
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <Metric label="今日" value={fmtMoney(todayNet, { sign: true })} cls={colorOf(todayNet)} />
          <Metric label="勝率" value={fmtPct(all.winRate)} />
          <Metric label="取引数" value={`${all.count}件`} />
        </dl>
      </section>

      {/* 推移チャート */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold">損益の推移</h3>
          <div className="flex rounded-xl bg-sunken p-1">
            {(
              [
                ['cumulative', '累積'],
                ['daily', '日別'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setChart(k)}
                className={`seg ${chart === k ? 'seg-on' : 'seg-off'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                range === r.key
                  ? 'bg-brand text-white'
                  : 'border border-line text-ink2 hover:bg-sunken'
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="ml-auto self-center text-sm font-semibold tabular-nums">
            <span className={colorOf(sum.netTotal)}>{fmtMoney(sum.netTotal, { sign: true })}</span>
            <span className="ml-1 text-xs font-medium text-ink3">/ {sum.count}件</span>
          </span>
        </div>

        <div className="mt-4">
          <PnlCharts trades={ranged} kind={chart} />
        </div>
      </section>

      {/* 最近の取引 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-bold">最近の取引</h3>
          <button className="btn btn-ghost -mr-2 text-sm" onClick={onShowAll}>
            すべて見る
            <Icon name="right" size={15} />
          </button>
        </div>
        <TradesTable trades={recent} onChanged={() => {}} readOnly compact />
        <button className="btn btn-quiet mt-3 w-full" onClick={onAdd}>
          <Icon name="plus" size={17} />
          取引を記録する
        </button>
      </section>

      <p className="text-center text-xs text-ink3">
        カレンダーの日付をタップすると、その日の振り返りを書けます
      </p>
    </div>
  )
}

function Metric({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <dt className="text-xs text-ink3">{label}</dt>
      <dd className={`mt-0.5 text-lg font-bold tabular-nums ${cls ?? 'text-ink'}`}>{value}</dd>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Icon name="upload" size={26} />
      </span>
      <h3 className="mt-4 text-lg font-bold">まだ取引がありません</h3>
      <p className="mt-1 max-w-xs text-sm text-ink2">
        MT5のレポートを読み込むか、スクリーンショットから1件ずつ記録できます。
      </p>
      <button className="btn btn-primary mt-5" onClick={onAdd}>
        <Icon name="plus" size={17} />
        最初の取引を記録する
      </button>
    </div>
  )
}
