import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { summarize } from '../../lib/analytics'
import { colorOf, fmtMoney, fmtNum, fmtPct } from '../../lib/format'
import { currencyLabel } from '../../lib/appConfig'

type RangeKey = 'day' | '7' | '30' | '0'

const RANGES: { value: RangeKey; label: string }[] = [
  { value: 'day', label: 'この日' },
  { value: '7', label: '7日' },
  { value: '30', label: '30日' },
  { value: '0', label: '全期間' },
]

interface Props {
  /** 表示中の口座の全取引 */
  trades: EnrichedTrade[]
  /** いま選んでいる日 */
  day: string
}

/** 損益の積み上がりを1枚で見せる */
export default function PerformanceCard({ trades, day }: Props) {
  const [range, setRange] = useState<RangeKey>('30')

  const rows = useMemo(() => {
    if (range === 'day') return trades.filter((t) => t.jstDay === day)
    if (range === '0') return trades
    const days = Number(range)
    const end = Date.parse(`${day}T23:59:59+09:00`)
    const start = end - days * 86400000
    return trades.filter((t) => {
      const ms = t.openJst.getTime()
      return ms >= start && ms <= end
    })
  }, [trades, range, day])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.openJst.getTime() - b.openJst.getTime()),
    [rows],
  )
  const curve = useMemo(() => {
    let acc = 0
    return sorted.map((t) => (acc += t.netProfit))
  }, [sorted])

  const sum = summarize(rows)

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">損益の推移</h3>
        <select
          className="input w-auto px-2 py-1 text-xs"
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          aria-label="期間"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-[11px] text-ink3">総損益</p>
      <p className={`text-2xl font-bold tabular-nums ${colorOf(sum.netTotal)}`}>
        {fmtMoney(sum.netTotal, { sign: true })}
        <span className="ml-1 text-xs font-semibold text-ink3">{currencyLabel()}</span>
      </p>

      <div className="mt-2">
        {curve.length >= 2 ? (
          <AreaCurve values={curve} />
        ) : (
          <p className="py-6 text-center text-xs text-ink3">
            この期間の取引は{curve.length}件です
          </p>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <Mini label="トレード数" value={String(sum.count)} unit="件" />
        <Mini label="勝率" value={fmtPct(sum.winRate)} />
        <Mini
          label="平均RR"
          value={sum.avgPlannedRR != null ? fmtNum(sum.avgPlannedRR, 2) : '—'}
        />
      </div>
    </section>
  )
}

function Mini({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg bg-sunken px-2.5 py-2">
      <p className="truncate text-[10px] text-ink3">{label}</p>
      <p className="truncate text-sm font-bold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-semibold text-ink3">{unit}</span>}
      </p>
    </div>
  )
}

/** 積み上がりを面で見せる。0円の線も引いて、プラスかマイナスかが分かるようにする */
function AreaCurve({ values }: { values: number[] }) {
  const W = 300
  const H = 92
  const up = values[values.length - 1] >= 0
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - ((v - min) / span) * H

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const zero = y(0)
  const stroke = up ? '#16A34A' : '#B42318'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-24 w-full"
      role="img"
      aria-label={`損益の推移 ${values.length}件`}
    >
      <defs>
        <linearGradient id={`pnl-${up ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#pnl-${up ? 'up' : 'down'})`} />
      <line x1="0" y1={zero} x2={W} y2={zero} stroke="#E9E9F0" strokeWidth="1" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
