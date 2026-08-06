import type { EnrichedTrade } from '../../lib/types'
import type { Summary } from '../../lib/analytics'
import { avgHoldMinutes, fmtDuration } from '../../lib/analytics'
import { fmtNum, fmtPct } from '../../lib/format'
import Icon from '../Icon'
import type { IconName } from '../Icon'

interface Props {
  trades: EnrichedTrade[]
  sum: Summary
  rangeLabel: string
}

/** 数字の並びだけでは読み取りにくいので、一言そえる */
function hintOf(sum: Summary): string | null {
  if (sum.count < 3) return null
  if (sum.avgPlannedRR != null && sum.avgPlannedRR >= 2)
    return `狙いの損益比が平均 ${fmtNum(sum.avgPlannedRR)} と大きめです。届く前に切っていないか、TPまでの持ち方も見てみましょう。`
  if (sum.profitFactor != null && sum.profitFactor !== Infinity && sum.profitFactor >= 2)
    return '勝ちが負けの2倍以上あります。いまのやり方を崩さないことが一番の近道です。'
  if (sum.tpHitRate != null && sum.tpHitRate < 0.25)
    return '決めた利確ラインまで届く前に終える取引が多めです。どこで不安になったかを残しておくと直しやすくなります。'
  if (sum.avgVolume > 0) return `平均 ${fmtNum(sum.avgVolume, 2)} ロットで一定に保てています。`
  return null
}

/** 自分のやり方を数字で見る */
export default function StyleCard({ trades, sum, rangeLabel }: Props) {
  const hold = avgHoldMinutes(trades)
  const hint = hintOf(sum)

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">あなたの取引スタイル</h2>
        <span className="text-xs text-ink3">{rangeLabel}</span>
      </div>

      <dl className="flex flex-col gap-2">
        <Row icon="wallet" label="平均ロット" value={fmtNum(sum.avgVolume, 2)} />
        <Row
          icon="scale"
          label="平均RR（狙いの損益比）"
          value={sum.avgPlannedRR != null ? fmtNum(sum.avgPlannedRR) : '—'}
        />
        <Row icon="clock" label="平均保有時間" value={fmtDuration(hold)} />
        <Row
          icon="target"
          label="勝ちトレード割合 (TP到達)"
          value={sum.tpHitRate != null ? fmtPct(sum.tpHitRate) : '—'}
        />
      </dl>

      {hint && (
        <div className="mt-4 flex gap-2.5 rounded-xl bg-brand-soft/60 p-3.5">
          <span className="mt-0.5 shrink-0 text-brand">
            <Icon name="bulb" size={16} />
          </span>
          <div className="text-sm">
            <p className="font-semibold text-ink">ヒント</p>
            <p className="mt-0.5 text-ink2">{hint}</p>
          </div>
        </div>
      )}
    </section>
  )
}

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon name={icon} size={16} />
      </span>
      <dt className="min-w-0 flex-1 truncate text-sm text-ink2">{label}</dt>
      <dd className="shrink-0 text-lg font-bold tabular-nums text-ink">{value}</dd>
    </div>
  )
}
