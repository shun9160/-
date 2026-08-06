import type { TodayCompare } from '../../lib/analytics'
import { currencyLabel } from '../../lib/appConfig'
import { fmtMoney, fmtPct } from '../../lib/format'
import Icon from '../Icon'

interface Props {
  today: TodayCompare
  /** 全期間の累計損益 */
  netTotal: number
  /**
   * 画面のいちばん上にあるか。
   * 上に何も無いときだけ、上部バーとつなげて画面いっぱいに広げる。
   */
  flush?: boolean
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

/**
 * 今日の結果。ブランドの色（紫→青）を敷いた見出しの面。
 *
 * 色の上では緑と赤が読みにくいので、損益の向きは
 * 符号（＋/−）と「利益／損失」の言葉と矢印で示す。色だけに頼らない。
 */
export default function TodayCard({ today, netTotal, flush, onSeeDetail }: Props) {
  const v = verdict(today)
  const up = today.diff > 0
  const plus = today.todayNet > 0
  const minus = today.todayNet < 0

  return (
    <section
      className={[
        'overflow-hidden bg-gradient-to-br from-[#6741FF] to-[#3B5BFF] text-white',
        flush
          ? '-mx-4 -mt-5 rounded-b-[28px] px-5 pb-5 pt-6 sm:mx-0 sm:mt-0 sm:rounded-2xl sm:pt-5 sm:shadow-raised'
          : 'rounded-2xl px-5 py-5 shadow-raised',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/90">今日の損益</p>
          <p className="mt-1 text-hero font-bold tabular-nums">
            {fmtMoney(today.todayNet, { sign: true })}
            <span className="ml-1.5 text-base font-semibold text-white/90">{currencyLabel()}</span>
          </p>
        </div>

        {/* 今日の出来 */}
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
          <span className="text-base leading-none" aria-hidden="true">
            {v.emoji}
          </span>
          <span className="text-xs font-bold">{v.title}</span>
        </span>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {(plus || minus) && (
          <span className="flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-bold">
            <Icon name={plus ? 'trendUp' : 'trendDown'} size={13} />
            {plus ? '利益' : '損失'}
          </span>
        )}
        <span className="text-white/90">昨日比</span>
        <span className="font-bold tabular-nums">
          {fmtMoney(today.diff, { sign: true })}
          {today.ratio != null && (
            <span className="ml-1 font-semibold">
              ({today.ratio > 0 ? '+' : ''}
              {fmtPct(today.ratio)})
            </span>
          )}
        </span>
        {today.diff !== 0 && <Icon name={up ? 'trendUp' : 'trendDown'} size={15} />}
      </p>

      <p className="mt-1 text-xs text-white/90">{v.body}</p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/25 pt-3">
        <p className="text-sm">
          <span className="text-white/90">累計 </span>
          <span className="font-bold tabular-nums">
            {fmtMoney(netTotal, { sign: true })} {currencyLabel()}
          </span>
        </p>
        <button
          className="flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1.5 text-sm font-semibold transition-colors hover:bg-white/30"
          onClick={onSeeDetail}
        >
          詳細を見る
          <Icon name="right" size={15} />
        </button>
      </div>
    </section>
  )
}
