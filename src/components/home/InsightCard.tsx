import type { EnrichedTrade } from '../../lib/types'
import type { Summary } from '../../lib/analytics'
import { streakOf } from '../../lib/analytics'
import { fmtNum, fmtPct } from '../../lib/format'
import Icon from '../Icon'

interface Props {
  trades: EnrichedTrade[]
  sum: Summary
  onSeeStats: () => void
}

/**
 * 記録から自動で見つけた傾向。
 *
 * 予測はしない。すでに記録された事実だけを、
 * 「良かった点」「気をつける点」に分けて言葉にする。
 */
function findings(trades: EnrichedTrade[], sum: Summary): { good: string[]; care: string[] } {
  const good: string[] = []
  const care: string[] = []
  if (trades.length < 3) return { good, care }

  // 損切りを置いているか
  const noSl = trades.filter((t) => t.sl == null).length
  const slRate = 1 - noSl / trades.length
  if (slRate >= 0.9) good.push('ほとんどの取引で損切りを置けています')
  else if (slRate < 0.6)
    care.push(`損切りを置いていない取引が ${noSl}件あります。先に決めておくと傷が浅くなります`)

  // 損益比
  if (sum.profitFactor != null && sum.profitFactor !== Infinity) {
    if (sum.profitFactor >= 1.5)
      good.push(`損益比が ${fmtNum(sum.profitFactor)} で、勝ちが負けをしっかり上回っています`)
    else if (sum.profitFactor < 1)
      care.push(`損益比が ${fmtNum(sum.profitFactor)} です。負けの1回が大きすぎないか見てみましょう`)
  }

  // 計画どおり終われているか
  if (sum.tpHitRate != null) {
    if (sum.tpHitRate >= 0.5) good.push('決めた利確ラインまで持てている取引が多いです')
    else if (sum.tpHitRate < 0.25 && sum.avgCapturedRatio != null && sum.avgCapturedRatio < 0.5)
      care.push('狙いより手前で利確しがちです。どこで迷ったか書き残すと直しやすくなります')
  }

  // 実際に取れているか
  if (sum.avgRMultiple != null && sum.avgRMultiple > 0)
    good.push(`1回のリスクに対して平均 ${fmtNum(sum.avgRMultiple)}倍 取れています`)

  // 連敗
  const st = streakOf(trades)
  if (st.lossStreak >= 3)
    care.push(`いま ${st.lossStreak}連敗中です。一度手を止めて、記録を読み返すころあいかもしれません`)

  // 勝率
  if (sum.winRate >= 0.6) good.push(`勝率 ${fmtPct(sum.winRate)} を保てています`)

  return { good: good.slice(0, 2), care: care.slice(0, 2) }
}

export default function InsightCard({ trades, sum, onSeeStats }: Props) {
  const { good, care } = findings(trades, sum)
  const enough = trades.length >= 3

  return (
    <section className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-soft/60 to-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white">
          <Icon name="bulb" size={17} />
        </span>
        <h2 className="text-base font-bold">記録からわかること</h2>
        <span className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-ink2">
          自動
        </span>
      </div>

      {!enough ? (
        <p className="mt-3 text-sm text-ink2">
          取引が3件たまると、ここに傾向が出ます。まずは記録を続けてみてください。
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {good.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-ink">
              <span className="mt-0.5 shrink-0 text-up">
                <Icon name="check" size={16} />
              </span>
              {t}
            </li>
          ))}
          {care.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-ink">
              <span className="mt-0.5 shrink-0 text-down">
                <Icon name="info" size={16} />
              </span>
              {t}
            </li>
          ))}
          {good.length === 0 && care.length === 0 && (
            <li className="text-sm text-ink2">いまのところ、特に目立つ偏りはありません。</li>
          )}
        </ul>
      )}

      <button className="btn btn-ghost mt-3 -ml-2 text-brand" onClick={onSeeStats}>
        分析を見る
        <Icon name="right" size={15} />
      </button>
    </section>
  )
}
