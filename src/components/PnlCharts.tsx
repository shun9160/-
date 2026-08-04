import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EnrichedTrade } from '../lib/types'
import { cumulativeSeries, dailySeries } from '../lib/analytics'
import { CHART, fmtMoney } from '../lib/format'

interface Props {
  trades: EnrichedTrade[]
  kind: 'daily' | 'cumulative'
}

const axisTick = { fill: CHART.axis, fontSize: 11 }

function label(day: string) {
  const [, m, d] = day.split('-')
  return `${Number(m)}/${Number(d)}`
}

function compact(n: number) {
  const a = Math.abs(n)
  if (a >= 10000) return `${Math.round(n / 1000)}k`
  return String(Math.round(n))
}

/** ホバー時の値表示。符号を必ず出し、色だけに頼らない */
function ChartTooltip({ active, payload, label: l }: any) {
  if (!active || !payload?.length) return null
  const v = payload[0].value as number
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-raised">
      <p className="text-xs text-ink3">{l}</p>
      <p className={`text-sm font-bold tabular-nums ${v > 0 ? 'text-up' : v < 0 ? 'text-down' : ''}`}>
        {fmtMoney(v, { sign: true })} 円
      </p>
    </div>
  )
}

export default function PnlCharts({ trades, kind }: Props) {
  const daily = useMemo(
    () => dailySeries(trades).map((d) => ({ ...d, label: label(d.day) })),
    [trades],
  )
  const cumulative = useMemo(
    () => cumulativeSeries(trades).map((d) => ({ ...d, label: label(d.day) })),
    [trades],
  )

  if (trades.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl bg-sunken text-sm text-ink3">
        この期間の取引はありません
      </div>
    )
  }

  if (kind === 'daily') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={18} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={compact}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(109,74,255,0.06)' }} />
          <ReferenceLine y={0} stroke={CHART.axis} strokeWidth={1} />
          {/* 利益と損失は上下の向き＋色の二重符号。値は符号つきで表示される */}
          <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={26}>
            {daily.map((d, i) => (
              <Cell key={i} fill={d.net >= 0 ? CHART.up : CHART.down} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={cumulative} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.brand} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={compact}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.brand, strokeWidth: 1 }} />
        <ReferenceLine y={0} stroke={CHART.axis} strokeWidth={1} />
        <Area
          type="monotone"
          dataKey="net"
          stroke={CHART.brand}
          strokeWidth={2}
          fill="url(#cumFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
