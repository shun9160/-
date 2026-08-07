import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TodayCompare } from '../../lib/analytics'
import type { EnrichedTrade } from '../../lib/types'
import { gradeTrade } from '../../lib/analytics'
import { currencyLabel } from '../../lib/appConfig'
import { fmtMoney, fmtNum, fmtPct } from '../../lib/format'
import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'
import type { IconName } from '../Icon'
import AnimatedMoney from '../AnimatedMoney'

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
function verdict(t: TodayCompare): { title: string; body: string; icon: IconName } {
  if (t.todayCount === 0) {
    return { title: 'まだ取引なし', body: '今日はこれからです', icon: 'plus' }
  }
  if (t.todayNet > 0 && t.diff >= 0) {
    return { title: '素晴らしい', body: '今日は良いトレードでした', icon: 'check' }
  }
  if (t.todayNet > 0) {
    return { title: 'プラスで終了', body: '利益を積み上げられました', icon: 'check' }
  }
  if (t.todayNet === 0) {
    return { title: '差し引きゼロ', body: '無理に取りにいかない日も大事です', icon: 'info' }
  }
  return { title: 'マイナスの日', body: '何が起きたか書き残しましょう', icon: 'pencil' }
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

  // すりガラスの面。色は変えず、少しだけ向こうが透ける濃さにしている。
  // 透かしただけでは平らな板に見えるので、ふち・つや・影で厚みを出す。
  const face =
    'absolute inset-x-0 top-0 overflow-hidden border border-white/25 ' +
    // 色は変えずに、少しだけ向こうを透かす。
    // ここは #6741FF/94 のような書き方をしないこと。Tailwind が
    // 「色を直接書いた場合の透明度」を落としてしまい、色が消える。
    'bg-gradient-to-br from-[rgba(103,65,255,0.93)] to-[rgba(59,91,255,0.90)] text-white ' +
    (flush ? 'rounded-b-[28px] sm:rounded-2xl' : 'rounded-2xl')
  const pad = flush ? 'px-5 pb-5 pt-6 sm:pt-5' : 'px-5 py-5'

  // 外の影で浮かせ、内側の細い線でガラスの厚みを出す。
  // 上は光が当たって白く、下はわずかに沈む。
  const lift = {
    boxShadow:
      '0 18px 38px -16px rgba(64, 48, 214, 0.55),' +
      '0 8px 18px -10px rgba(64, 48, 214, 0.38),' +
      'inset 0 1px 0 rgba(255, 255, 255, 0.4),' +
      'inset 0 -1px 0 rgba(24, 20, 80, 0.18)',
  }

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
              ...lift,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              pointerEvents: flipped ? 'none' : 'auto',
            }}
          >
            <Glass />
            {/* つやより手前に文字を置く。でないと左上の文字が白っぽくかすむ */}
            <div className="relative">
              <Front today={today} verdict={v} netTotal={netTotal} count={todayTrades.length} />
            </div>
          </button>

          {/* 裏。どこを押しても表に戻す（一覧をなぞって動かす場合は押した扱いにならない） */}
          <div
            ref={backRef}
            aria-hidden={!flipped}
            onClick={() => setFlipped(false)}
            className={`${face} ${pad} cursor-pointer`}
            style={{
              ...lift,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              pointerEvents: flipped ? 'auto' : 'none',
            }}
          >
            <Glass />
            <div className="relative">
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
    </div>
  )
}

// ---------------------------------------------------------------

/**
 * ガラスらしさを作る層。
 *
 * ただ半透明にしただけでは、うしろが白い紙なので「薄い紫の板」にしか
 * 見えない。そこで、板の中に色の光をにじませ、その上に斜めのつやを重ねる。
 * にじみと、うっすら透けた下地と、つやの三枚で厚みが出る。
 *
 * backdrop-filter（うしろをぼかす）は使っていない。
 * このカードは裏返る作りで、iPhone の Safari では
 * backface-visibility と組み合わせるとぼかす場所がずれるため。
 */
function Glass() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 板の中でにじむ光。ここを明るくしすぎると色があせて、
          白い文字も読みにくくなる。控えめに。 */}
      <span className="absolute -left-16 -top-24 h-56 w-56 rounded-full bg-[#A78BFA] opacity-30 blur-3xl" />
      <span className="absolute -right-12 top-1/4 h-52 w-52 rounded-full bg-[#3B82F6] opacity-28 blur-3xl" />
      {/* 影。光だけでは平らに見える。暗い側があってはじめて厚みが出る */}
      <span className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#241275] opacity-45 blur-3xl" />
      <span className="absolute -right-16 -bottom-20 h-48 w-48 rounded-full bg-[#1B1060] opacity-35 blur-3xl" />
      {/* 左上から差す、斜めのつや */}
      <span className="absolute inset-0 bg-gradient-to-br from-white/12 via-white/0 to-white/0" />
      {/* 上のふちの光。ガラスの切り口に見せる */}
      <span className="absolute inset-x-0 top-0 h-px bg-white/45" />
    </span>
  )
}

function Front({
  today,
  verdict: v,
  netTotal,
  count,
}: {
  today: TodayCompare
  verdict: { title: string; body: string; icon: IconName }
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
          <p className="mt-1 text-hero font-bold">
            {/* 紫の面の上なので、緑・赤は付けずに白のまま動かす */}
            <AnimatedMoney value={today.todayNet} colored={false} />
            <span className="ml-1.5 text-base font-semibold text-white/90">{currencyLabel()}</span>
          </p>
        </div>

        {/* 今日の出来。白い輪の中の印で示す。言葉は読み上げと吹き出しに残す */}
        <span
          title={v.title}
          aria-label={v.title}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white/60 text-white"
        >
          <Icon name={v.icon} size={20} />
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
