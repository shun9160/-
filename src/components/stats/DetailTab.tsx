import type { EnrichedTrade } from '../../lib/types'
import type { Summary } from '../../lib/analytics'
import { avgHoldMinutes, fmtDuration } from '../../lib/analytics'
import { colorOf, fmtNum, fmtPct, fmtRR } from '../../lib/format'
import { Empty, Ring } from './parts'

interface Props {
  trades: EnrichedTrade[]
  sum: Summary
  rangeLabel: string
}

/** 一つひとつの数字を、意味つきで並べる */
export default function DetailTab({ trades, sum, rangeLabel }: Props) {
  if (trades.length === 0) return <Empty text="取引がありません" />

  const days = new Set(trades.map((t) => t.jstDay)).size
  const hold = avgHoldMinutes(trades)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-base font-bold">詳細指標</h2>
        <span className="text-xs text-ink3">{rangeLabel}</span>
      </div>

      <Item
        label="計画リスクリワード"
        value={fmtRR(sum.avgPlannedRR)}
        note="狙った利益 ÷ 許容損失"
      />
      <Item
        label="実際の損益倍率"
        value={sum.avgRMultiple != null ? `${fmtNum(sum.avgRMultiple)} R` : '—'}
        valueClass={sum.avgRMultiple != null ? colorOf(sum.avgRMultiple) : undefined}
        note="1回のリスクの何倍取れたか"
      />
      <Item
        label="TPまで届いた割合"
        value={sum.tpHitRate != null ? fmtPct(sum.tpHitRate) : '—'}
        note="計画通り利確できた率"
        ratio={sum.tpHitRate ?? undefined}
      />
      <Item
        label="狙いの何%取れたか"
        value={sum.avgCapturedRatio != null ? fmtPct(sum.avgCapturedRatio) : '—'}
        note="TPまでの値幅に対する実績"
        ratio={sum.avgCapturedRatio ?? undefined}
      />
      <Item label="平均保有時間" value={fmtDuration(hold)} note="決済まで記録がある取引の平均" />
      <Item
        label="取引回数"
        value={`${sum.count} 件`}
        note={`${days}日で、1日あたり平均 ${fmtNum(sum.count / Math.max(1, days), 1)}件`}
      />
      <Item
        label="手数料・スワップ"
        value={fmtNum(sum.commissionTotal + sum.swapTotal, 0)}
        valueClass={colorOf(sum.commissionTotal + sum.swapTotal)}
        note="純損益からすでに引いています"
      />
    </div>
  )
}

function Item({
  label,
  value,
  note,
  valueClass,
  ratio,
}: {
  label: string
  value: string
  note: string
  valueClass?: string
  ratio?: number
}) {
  return (
    <section className="card flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink2">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold tabular-nums ${valueClass ?? 'text-ink'}`}>
          {value}
        </p>
        <p className="mt-0.5 text-[11px] text-ink3">{note}</p>
      </div>
      {ratio != null && <Ring ratio={ratio} size={52} />}
    </section>
  )
}
