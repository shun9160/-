import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { symbolBreakdown, winLossCompare } from '../../lib/analytics'
import { colorOf, fmtMoney, fmtNum, fmtPct } from '../../lib/format'
import { Bar, Empty, Head } from './parts'
import { SegmentedControl } from '../ui'

type SortKey = 'count' | 'net'

/** どんな取引をしているか */
export default function PatternTab({ trades }: { trades: EnrichedTrade[] }) {
  const [by, setBy] = useState<'symbol' | 'exit'>('symbol')
  const [sort, setSort] = useState<SortKey>('count')

  const symbols = useMemo(() => {
    const base = symbolBreakdown(trades)
    return sort === 'net' ? [...base].sort((a, b) => b.net - a.net) : base
  }, [trades, sort])

  const wl = useMemo(() => winLossCompare(trades), [trades])

  if (trades.length === 0) return <Empty text="取引がありません" />

  // 終わり方の内訳
  const exits = [
    { label: '利確ライン', n: trades.filter((t) => t.tpHit).length, tone: 'up' as const },
    { label: '手動で利確', n: trades.filter((t) => !t.tpHit && t.win).length, tone: 'up' as const },
    { label: '損切りライン', n: trades.filter((t) => t.slHit).length, tone: 'down' as const },
    {
      label: '手動で損切り',
      n: trades.filter((t) => !t.slHit && !t.win).length,
      tone: 'down' as const,
    },
  ].filter((e) => e.n > 0)

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">取引の傾向</h2>
          <SegmentedControl
            size="sm"
            value={by}
            onChange={setBy}
            options={[
              { value: 'symbol', label: '銘柄' },
              { value: 'exit', label: '終わり方' },
            ]}
          />
        </div>

        {by === 'symbol' ? (
          <>
            <label className="mb-2 flex items-center justify-end gap-1.5 text-xs text-ink2">
              並び替え
              <select
                className="input w-auto px-2 py-1 text-xs"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="count">件数が多い順</option>
                <option value="net">損益が大きい順</option>
              </select>
            </label>
            <ul className="flex flex-col gap-3">
              {symbols.map((s) => (
                <li key={s.symbol}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{s.symbol}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink2">
                      {s.count}件 ・ {fmtPct(s.share)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar ratio={s.share} tone={s.net >= 0 ? 'up' : 'down'} />
                  </div>
                  <p className={`mt-1 text-xs font-bold tabular-nums ${colorOf(s.net)}`}>
                    {fmtMoney(s.net, { sign: true })}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="flex flex-col gap-3">
            {exits.map((e) => (
              <li key={e.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{e.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink2">
                    {e.n}件 ・ {fmtPct(e.n / trades.length)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar ratio={e.n / trades.length} tone={e.tone} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 勝ちと負けをくらべる */}
      <section className="card p-4">
        <Head title="勝ちトレード vs 負けトレード" />
        <div className="grid grid-cols-2 gap-3">
          <Side
            title="勝ちトレード"
            tone="up"
            count={wl.winCount}
            avg={wl.avgWin}
            max={wl.maxWin}
            avgLabel="平均利益"
            maxLabel="最大利益"
          />
          <Side
            title="負けトレード"
            tone="down"
            count={wl.lossCount}
            avg={wl.avgLoss}
            max={wl.maxLoss}
            avgLabel="平均損失"
            maxLabel="最大損失"
          />
        </div>
        {wl.avgWin != null && wl.avgLoss != null && (
          <p className="mt-3 rounded-xl bg-sunken px-3 py-2.5 text-xs text-ink2">
            勝ち1回の平均は、負け1回の平均の{' '}
            <span className="font-bold text-ink">
              {fmtNum(Math.abs(wl.avgWin / wl.avgLoss))}倍
            </span>
            です。
          </p>
        )}
      </section>
    </div>
  )
}

function Side({
  title,
  tone,
  count,
  avg,
  max,
  avgLabel,
  maxLabel,
}: {
  title: string
  tone: 'up' | 'down'
  count: number
  avg: number | null
  max: number | null
  avgLabel: string
  maxLabel: string
}) {
  const c = tone === 'up' ? 'text-up' : 'text-down'
  return (
    <div className="rounded-xl border border-line p-3">
      <p className={`text-sm font-bold ${c}`}>{title}</p>
      <p className="mt-0.5 text-xs text-ink3">{count}件</p>
      <dl className="mt-2.5 flex flex-col gap-2">
        <div>
          <dt className="text-[11px] text-ink3">{avgLabel}</dt>
          <dd className={`text-base font-bold tabular-nums ${c}`}>
            {avg != null ? fmtMoney(avg, { sign: true }) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink3">{maxLabel}</dt>
          <dd className={`text-base font-bold tabular-nums ${c}`}>
            {max != null ? fmtMoney(max, { sign: true }) : '—'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
