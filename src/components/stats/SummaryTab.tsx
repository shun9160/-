import type { EnrichedTrade } from '../../lib/types'
import type { Summary } from '../../lib/analytics'
import { dailyStats, scoreOf, streakOf } from '../../lib/analytics'
import { currencyLabel } from '../../lib/appConfig'
import { colorOf, fmtMoney, fmtNum, fmtPct } from '../../lib/format'
import Icon from '../Icon'
import { Bar, Empty, Metric, Ring } from './parts'

interface Props {
  trades: EnrichedTrade[]
  sum: Summary
  rangeLabel: string
  onSeeDetail: () => void
}

/** 全体をひと目で */
export default function SummaryTab({ trades, sum, rangeLabel, onSeeDetail }: Props) {
  if (trades.length === 0) return <Empty text="取引がありません" />

  const score = scoreOf(trades, sum)
  const st = streakOf(trades)
  const d = dailyStats(trades)

  return (
    <div className="flex flex-col gap-4">
      {/* 総合スコア */}
      <section className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-soft/70 to-surface p-5 shadow-card">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="label">記録のつけ方スコア</p>
            <p className="mt-1 flex items-end gap-1 text-brand">
              <span className="text-5xl font-bold leading-none tabular-nums">{score.total}</span>
              <span className="pb-1 text-sm font-semibold text-ink3">/100</span>
            </p>
            <span className="mt-2 flex gap-0.5" aria-label={`5段階中 ${score.stars}`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={i <= score.stars ? 'text-amber' : 'text-line'}>
                  <Icon name="star" size={15} strokeWidth={0} className="fill-current" />
                </span>
              ))}
            </span>
          </div>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
            <Icon name="target" size={26} />
          </span>
        </div>

        {/* 点だけ出すと理由が分からないので、必ず内訳を見せる */}
        <ul className="mt-4 flex flex-col gap-2">
          {score.parts.map((p) => (
            <li key={p.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-ink2">{p.label}</span>
                <span className="shrink-0 tabular-nums text-ink3">
                  <span className="font-bold text-ink">{p.got}</span> / {p.max}
                </span>
              </div>
              <div className="mt-1">
                <Bar ratio={p.max ? p.got / p.max : 0} />
              </div>
              <p className="mt-0.5 text-[11px] text-ink3">{p.note}</p>
            </li>
          ))}
        </ul>

        <button className="btn btn-ghost mt-3 -ml-2 text-brand" onClick={onSeeDetail}>
          詳しい数字を見る
          <Icon name="right" size={15} />
        </button>
      </section>

      {/* 主要パフォーマンス */}
      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 className="text-base font-bold">主要パフォーマンス</h2>
          <span className="text-xs text-ink3">{rangeLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="純損益"
            value={fmtMoney(sum.netTotal, { sign: true })}
            unit={currencyLabel()}
            valueClass={colorOf(sum.netTotal)}
            note="手数料・スワップ込み"
          />
          <Metric label="勝率" value={fmtPct(sum.winRate)} note={`${sum.wins}勝 ${sum.losses}敗`}>
            <div className="mt-2 flex justify-center">
              <Ring ratio={sum.winRate} />
            </div>
          </Metric>
          <Metric
            label="損益比 (RR)"
            value={
              sum.profitFactor == null
                ? '—'
                : sum.profitFactor === Infinity
                  ? '∞'
                  : fmtNum(sum.profitFactor)
            }
            note="勝ち合計 ÷ 負け合計"
          />
          <Metric
            label="平均ロット"
            value={fmtNum(sum.avgVolume, 2)}
            note={`合計 ${fmtNum(sum.totalVolume, 2)}`}
          />
        </div>
      </div>

      {/* ハイライト */}
      <section className="card p-4">
        <h2 className="mb-2 text-base font-bold">ハイライト</h2>
        <ul className="flex flex-col">
          <Line icon="flame" label="最大連勝" value={`${st.bestWinStreak} 連勝`} />
          <Line
            icon="trendDown"
            label="最大ドローダウン"
            value={d.maxDrawdown != null ? fmtMoney(d.maxDrawdown) : '—'}
            cls={d.maxDrawdown != null && d.maxDrawdown < 0 ? 'text-down' : undefined}
          />
          <Line
            icon="trendUp"
            label="ベストトレード"
            value={d.bestDayNet != null ? fmtMoney(d.bestDayNet, { sign: true }) : '—'}
            cls={d.bestDayNet != null ? colorOf(d.bestDayNet) : undefined}
          />
        </ul>
      </section>
    </div>
  )
}

function Line({
  icon,
  label,
  value,
  cls,
}: {
  icon: 'flame' | 'trendDown' | 'trendUp'
  label: string
  value: string
  cls?: string
}) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon name={icon} size={16} />
      </span>
      <span className="flex-1 text-sm text-ink2">{label}</span>
      <span className={`text-base font-bold tabular-nums ${cls ?? 'text-ink'}`}>{value}</span>
    </li>
  )
}
