import type { TodayCompare } from '../../lib/analytics'
import { currencyLabel } from '../../lib/appConfig'
import { colorOf, fmtMoney, fmtPct } from '../../lib/format'
import Icon from '../Icon'

interface Props {
  today: TodayCompare
  /** 全期間の累計損益 */
  netTotal: number
  onSeeDetail: () => void
}

/** 今日の出来を一言で。数字だけだと良し悪しが分かりにくいので添える。 */
function verdict(t: TodayCompare): { emoji: string; title: string; body: string } {
  if (t.todayCount === 0) {
    return { emoji: '🌱', title: 'まだ取引なし', body: '今日はこれからです' }
  }
  if (t.todayNet > 0 && t.diff >= 0) {
    return { emoji: '🏆', title: '素晴らしい！', body: '今日は良いトレードでした' }
  }
  if (t.todayNet > 0) {
    return { emoji: '👍', title: 'プラスで終了', body: '利益を積み上げられました' }
  }
  if (t.todayNet === 0) {
    return { emoji: '➖', title: '差し引きゼロ', body: '無理に取りにいかない日も大事です' }
  }
  return { emoji: '📝', title: 'マイナスの日', body: '何が起きたか書き残しましょう' }
}

export default function TodayCard({ today, netTotal, onSeeDetail }: Props) {
  const v = verdict(today)
  const up = today.diff > 0

  return (
    <section className="overflow-hidden rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-soft/70 to-surface shadow-card">
      <div className="flex items-start gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="label">今日の損益</p>
          <p className={`mt-1 text-hero font-bold tabular-nums ${colorOf(today.todayNet)}`}>
            {fmtMoney(today.todayNet, { sign: true })}
            <span className="ml-1.5 text-base font-semibold text-ink3">{currencyLabel()}</span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-ink3">昨日比</span>
            <span className={`font-bold tabular-nums ${colorOf(today.diff)}`}>
              {fmtMoney(today.diff, { sign: true })}
              {today.ratio != null && (
                <span className="ml-1 font-semibold">
                  ({today.ratio > 0 ? '+' : ''}
                  {fmtPct(today.ratio)})
                </span>
              )}
            </span>
            {today.diff !== 0 && (
              <span className={colorOf(today.diff)}>
                <Icon name={up ? 'trendUp' : 'trendDown'} size={15} />
              </span>
            )}
          </p>
        </div>

        {/* 今日の出来 */}
        <div className="flex w-28 shrink-0 flex-col items-center justify-center rounded-full bg-surface/90 px-3 py-4 text-center shadow-card">
          <span className="text-xl leading-none" aria-hidden="true">
            {v.emoji}
          </span>
          <span className="mt-1.5 text-xs font-bold text-ink">{v.title}</span>
          <span className="mt-0.5 text-[11px] leading-tight text-ink2">{v.body}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-brand/10 px-5 py-3">
        <p className="text-sm">
          <span className="text-ink3">累計 </span>
          <span className={`font-bold tabular-nums ${colorOf(netTotal)}`}>
            {fmtMoney(netTotal, { sign: true })} {currencyLabel()}
          </span>
        </p>
        <button className="btn btn-ghost px-2 text-brand" onClick={onSeeDetail}>
          詳細を見る
          <Icon name="right" size={15} />
        </button>
      </div>
    </section>
  )
}
