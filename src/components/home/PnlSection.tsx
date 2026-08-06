import { useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { dailyStats } from '../../lib/analytics'
import { currencyLabel } from '../../lib/appConfig'
import { colorOf, fmtMoney } from '../../lib/format'
import PnlCharts from '../PnlCharts'
import { SegmentedControl } from '../ui'

interface Props {
  trades: EnrichedTrade[]
  netTotal: number
  rangeLabel: string
}

/** 損益の推移と、そこから読み取れる3つの数字 */
export default function PnlSection({ trades, netTotal, rangeLabel }: Props) {
  const [kind, setKind] = useState<'cumulative' | 'daily'>('cumulative')
  const d = dailyStats(trades)

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">損益の推移</h2>
          <p className="text-xs text-ink3">{rangeLabel}</p>
        </div>
        <SegmentedControl
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'cumulative', label: '累積' },
            { value: 'daily', label: '日別' },
          ]}
        />
      </div>

      <p className={`mt-3 text-2xl font-bold tabular-nums ${colorOf(netTotal)}`}>
        {fmtMoney(netTotal, { sign: true })}
        <span className="ml-1 text-sm font-semibold text-ink3">{currencyLabel()}</span>
      </p>

      <div className="mt-3">
        <PnlCharts trades={trades} kind={kind} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
        <Cell
          label="最高利益"
          value={d.bestDayNet != null ? fmtMoney(d.bestDayNet, { sign: true }) : '—'}
          cls={d.bestDayNet != null ? colorOf(d.bestDayNet) : undefined}
        />
        <Cell
          label="最大ドローダウン"
          value={d.maxDrawdown != null ? fmtMoney(d.maxDrawdown) : '—'}
          cls={d.maxDrawdown != null && d.maxDrawdown < 0 ? 'text-down' : undefined}
        />
        <Cell
          label="平均日次利益"
          value={d.avgDailyNet != null ? fmtMoney(d.avgDailyNet, { sign: true }) : '—'}
          cls={d.avgDailyNet != null ? colorOf(d.avgDailyNet) : undefined}
        />
      </dl>
    </section>
  )
}

function Cell({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl bg-sunken px-3 py-2.5 text-center">
      <dt className="text-[11px] text-ink3">{label}</dt>
      <dd className={`mt-0.5 text-sm font-bold tabular-nums ${cls ?? 'text-ink'}`}>{value}</dd>
    </div>
  )
}
