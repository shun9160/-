import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EnrichedTrade } from '../lib/types'
import { cumulativeSeries, dailySeries } from '../lib/analytics'
import { fmtMoney } from '../lib/format'

type ChartKind = 'daily' | 'cumulative' | 'equity'

interface Props {
  trades: EnrichedTrade[]
  kind: ChartKind
  /** equity 用の開始残高 */
  startBalance?: number
}

const axisTick = { fill: '#8b98a5', fontSize: 11 }

function shortDay(day: string) {
  return day.slice(5) // MM-DD
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const v = payload[0].value as number
  return (
    <div className="rounded-lg border border-border bg-panel px-3 py-2 text-xs shadow-lg">
      <div className="text-gray-400">{label}</div>
      <div className={v >= 0 ? 'text-up' : 'text-down'}>{fmtMoney(v, { sign: true })}</div>
    </div>
  )
}

export default function PnlCharts({ trades, kind, startBalance = 0 }: Props) {
  const daily = useMemo(() => dailySeries(trades), [trades])
  const cumulative = useMemo(() => cumulativeSeries(trades), [trades])
  const equity = useMemo(
    () => cumulative.map((p) => ({ day: p.day, net: p.net + startBalance })),
    [cumulative, startBalance],
  )

  if (trades.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        データがありません
      </div>
    )
  }

  if (kind === 'daily') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={daily.map((d) => ({ ...d, label: shortDay(d.day) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c2530" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
          <Bar dataKey="net" radius={[3, 3, 0, 0]}>
            {daily.map((d, i) => (
              <Cell key={i} fill={d.net >= 0 ? '#16c784' : '#ea3943'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (kind === 'cumulative') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={cumulative.map((d) => ({ ...d, label: shortDay(d.day) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c2530" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="net"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // equity
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={equity.map((d) => ({ ...d, label: shortDay(d.day) }))}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16c784" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#16c784" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c2530" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} domain={['auto', 'auto']} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="net"
          stroke="#16c784"
          strokeWidth={2}
          fill="url(#eq)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
