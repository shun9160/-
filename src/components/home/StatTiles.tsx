import type { EnrichedTrade } from '../../lib/types'
import type { Summary } from '../../lib/analytics'
import { streakOf } from '../../lib/analytics'
import { fmtNum, fmtPct } from '../../lib/format'
import Icon from '../Icon'
import type { IconName } from '../Icon'

interface Props {
  trades: EnrichedTrade[]
  sum: Summary
}

/**
 * 主要な4つの数字。
 * それぞれに、時間とともにどう動いてきたかの小さな線を添える。
 */
export default function StatTiles({ trades, sum }: Props) {
  const st = streakOf(trades)
  const ordered = [...trades].sort((a, b) => a.openJst.getTime() - b.openJst.getTime())

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon="target"
        label="勝率"
        value={fmtPct(sum.winRate)}
        spark={rolling(ordered, (w) => w.filter((t) => t.win).length / w.length)}
      />
      <Tile
        icon="scale"
        label="損益比 (RR)"
        value={
          sum.profitFactor == null
            ? '—'
            : sum.profitFactor === Infinity
              ? '∞'
              : fmtNum(sum.profitFactor)
        }
        spark={rolling(ordered, profitFactorOf)}
      />
      <Tile
        icon="book"
        label="取引数"
        value={`${sum.count}`}
        unit="件"
        spark={ordered.map((_, i) => i + 1)}
      />
      <Tile
        icon="flame"
        label="連勝 / 連敗"
        value={st.winStreak > 0 ? `${st.winStreak}` : `${st.lossStreak}`}
        unit={st.winStreak > 0 ? '連勝' : st.lossStreak > 0 ? '連敗' : ''}
        valueClass={st.winStreak > 0 ? 'text-up' : st.lossStreak > 0 ? 'text-down' : undefined}
        hint={`ベスト: ${st.bestWinStreak}連勝`}
      />
    </div>
  )
}

/** 直近10件ずつの窓で値を出し、動きの線を作る */
function rolling(trades: EnrichedTrade[], calc: (window: EnrichedTrade[]) => number): number[] {
  const WIN = 10
  const out: number[] = []
  for (let i = 0; i < trades.length; i++) {
    const w = trades.slice(Math.max(0, i - WIN + 1), i + 1)
    if (w.length < 3) continue
    const v = calc(w)
    out.push(Number.isFinite(v) ? v : 0)
  }
  return out
}

function profitFactorOf(w: EnrichedTrade[]): number {
  const win = w.filter((t) => t.netProfit > 0).reduce((s, t) => s + t.netProfit, 0)
  const loss = Math.abs(w.filter((t) => t.netProfit < 0).reduce((s, t) => s + t.netProfit, 0))
  if (loss === 0) return win > 0 ? 3 : 0
  return win / loss
}

function Tile({
  icon,
  label,
  value,
  unit,
  valueClass,
  spark,
  hint,
}: {
  icon: IconName
  label: string
  value: string
  unit?: string
  valueClass?: string
  spark?: number[]
  hint?: string
}) {
  return (
    <div className="card flex flex-col p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Icon name={icon} size={17} />
      </span>
      <p className="mt-2.5 text-xs text-ink2">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${valueClass ?? 'text-ink'}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-ink3">{unit}</span>}
      </p>
      {spark && spark.length >= 2 ? (
        <Sparkline values={spark} />
      ) : (
        hint && <p className="mt-2 text-[11px] text-ink3">{hint}</p>
      )}
    </div>
  )
}

/** 数字の動きだけを示す小さな線。目盛りは出さない。 */
function Sparkline({ values }: { values: number[] }) {
  const W = 100
  const H = 26
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = values.length > 1 ? W / (values.length - 1) : W
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${(H - ((v - min) / span) * H).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-2.5 h-7 w-full text-brand"
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
