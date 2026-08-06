import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TodayCompare } from '../../lib/analytics'
import type { EnrichedTrade } from '../../lib/types'
import { gradeTrade } from '../../lib/analytics'
import { currencyLabel } from '../../lib/appConfig'
import { fmtMoney, fmtNum, fmtPct } from '../../lib/format'
import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'

interface Props {
  today: TodayCompare
  /** 今日の取引。裏面に並べる */
  todayTrades: EnrichedTrade[]
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
 * 押すとカードがめくれて、裏に今日の取引が並ぶ。
 * 画面を移動せずに中身を確かめられるようにするため。
 *
 * 色の上では緑と赤が読みにくいので、損益の向きは
 * 符号（＋/−）と「利益／損失」の言葉と矢印で示す。色だけに頼らない。
 */
export default function TodayCard({
  today,
  todayTrades,
  netTotal,
  flush,
  onSeeDetail,
}: Props) {
  const v = verdict(today)
  const [flipped, setFlipped] = useState(false)

  // めくると裏のほうが背が高い。高さも一緒に変えて、下の内容が飛ばないようにする。
  const frontRef = useRef<HTMLButtonElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()

  const measure = () => {
    const el = flipped ? backRef.current : frontRef.current
    if (el) setHeight(el.offsetHeight)
  }

  useLayoutEffect(measure, [flipped, todayTrades, today])

  // 文字の大きさや画面幅が変わったときにも合わせ直す
  useEffect(() => {
    const ro = new ResizeObserver(measure)
    if (frontRef.current) ro.observe(frontRef.current)
    if (backRef.current) ro.observe(backRef.current)
    return () => ro.disconnect()
    // measure は flipped だけを見ている
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped])

  const face =
    'absolute inset-x-0 top-0 overflow-hidden bg-gradient-to-br from-[#6741FF] to-[#3B5BFF] text-white ' +
    (flush
      ? 'rounded-b-[28px] sm:rounded-2xl sm:shadow-raised'
      : 'rounded-2xl shadow-raised')
  const pad = flush ? 'px-5 pb-5 pt-6 sm:pt-5' : 'px-5 py-5'

  return (
    <div
      className={flush ? '-mx-4 -mt-5 sm:mx-0 sm:mt-0' : ''}
      style={{ perspective: '1400px' }}
    >
      <div
        className="relative transition-[height] duration-500 ease-out"
        style={{ height }}
      >
        <div
          className="absolute inset-0 transition-transform duration-500 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* 表 */}
          <button
            ref={frontRef}
            type="button"
            onClick={() => setFlipped(true)}
            aria-expanded={flipped}
            aria-label="今日の取引の内訳を見る"
            className={`${face} ${pad} w-full text-left`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              pointerEvents: flipped ? 'none' : 'auto',
            }}
          >
            <Front today={today} verdict={v} netTotal={netTotal} count={todayTrades.length} />
          </button>

          {/* 裏 */}
          <div
            ref={backRef}
            aria-hidden={!flipped}
            className={`${face} ${pad}`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              pointerEvents: flipped ? 'auto' : 'none',
            }}
          >
            <Back
              trades={todayTrades}
              net={today.todayNet}
              onClose={() => setFlipped(false)}
              onSeeDetail={onSeeDetail}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------

function Front({
  today,
  verdict: v,
  netTotal,
  count,
}: {
  today: TodayCompare
  verdict: { emoji: string; title: string; body: string }
  netTotal: number
  count: number
}) {
  const up = today.diff > 0
  const plus = today.todayNet > 0
  const minus = today.todayNet < 0

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/90">今日の損益</p>
          <p className="mt-1 text-hero font-bold tabular-nums">
            {fmtMoney(today.todayNet, { sign: true })}
            <span className="ml-1.5 text-base font-semibold text-white/90">{currencyLabel()}</span>
          </p>
        </div>

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
        {/* 押せることが分かるように、印を出す。更新ボタンと間違えないよう矢印にする */}
        <span className="flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1.5 text-sm font-semibold">
          内訳{count > 0 && ` ${count}件`}
          <Icon name="right" size={15} />
        </span>
      </div>
    </>
  )
}

function Back({
  trades,
  net,
  onClose,
  onSeeDetail,
}: {
  trades: EnrichedTrade[]
  net: number
  onClose: () => void
  onSeeDetail: () => void
}) {
  const rows = [...trades].sort((a, b) => b.openJst.getTime() - a.openJst.getTime())

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/90">今日の内訳</p>
          <p className="text-lg font-bold tabular-nums">
            {rows.length}件
            <span className="ml-2 text-base">
              {fmtMoney(net, { sign: true })}
              <span className="ml-0.5 text-xs font-semibold text-white/90">{currencyLabel()}</span>
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1.5 text-sm font-semibold transition-colors hover:bg-white/30"
        >
          <Icon name="close" size={15} />
          とじる
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/35 px-4 py-6 text-center text-sm text-white/90">
          今日はまだ取引がありません
        </p>
      ) : (
        // 件数が多い日でもカードが伸びきらないよう、ここだけスクロールさせる
        <ul className="-mx-1 mt-3 max-h-[min(44vh,286px)] overflow-y-auto px-1">
          {rows.map((t) => {
            const g = gradeTrade(t)
            return (
              <li
                key={t.id}
                className="mb-1.5 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 last:mb-0"
              >
                <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-white/90">
                  {fmtJst(t.open_time, 'HH:mm')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{t.symbol}</span>
                    <span className="shrink-0 text-[11px] text-white/90">
                      {t.side === 'buy' ? '買い' : '売り'} {fmtNum(t.volume, 2)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-white/90">
                    <Stars n={g.stars} />
                    <span className="truncate">
                      {t.tpHit
                        ? '利確ライン'
                        : t.slHit
                          ? '損切りライン'
                          : t.win
                            ? '手動で利確'
                            : '手動で損切り'}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-bold tabular-nums">
                  {fmtMoney(t.netProfit, { sign: true })}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 border-t border-white/25 pt-3">
        <button
          type="button"
          onClick={onSeeDetail}
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/20 py-2 text-sm font-semibold transition-colors hover:bg-white/30"
        >
          日記でくわしく見る
          <Icon name="right" size={15} />
        </button>
      </div>
    </>
  )
}

/** 5段階の評価。色の上でも分かるよう、白の濃さで表す */
function Stars({ n }: { n: number }) {
  return (
    <span className="flex shrink-0 gap-px" aria-label={`評価 5段階中 ${n}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? 'text-white' : 'text-white/30'}>
          <Icon name="star" size={9} strokeWidth={0} className="fill-current" />
        </span>
      ))}
    </span>
  )
}
