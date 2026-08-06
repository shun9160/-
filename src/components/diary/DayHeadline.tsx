import type { ReactNode } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { gradeTrade, summarize } from '../../lib/analytics'
import { colorOf, fmtMoney, fmtNum } from '../../lib/format'
import { fmtJst } from '../../lib/timezone'
import { currencyLabel } from '../../lib/appConfig'
import Icon from '../Icon'
import AnimatedMoney from '../AnimatedMoney'

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

interface Props {
  day: string
  trades: EnrichedTrade[]
  isToday: boolean
  /** 前後の日へ動かす */
  onShiftDay?: (delta: number) => void
  onToday?: () => void
  /** 狭い画面ではこのカードの中にキャラクターを入れる */
  aside?: ReactNode
}

/** その日の見出し。日付・損益・評価と、主な数字を並べる */
export default function DayHeadline({
  day,
  trades,
  isToday,
  onShiftDay,
  onToday,
  aside,
}: Props) {
  const iso = `${day}T00:00:00+09:00`
  const weekday = WEEKDAYS_JA[new Date(`${day}T00:00:00Z`).getUTCDay()]
  const sum = summarize(trades)
  const stars = avgStars(trades)
  // 勝ちがない日に「最大利益」、負けがない日に「最大損失」を出しても意味がないので、
  // それぞれ該当する取引があるときだけ数字にする。
  const wins = trades.filter((t) => t.netProfit > 0).map((t) => t.netProfit)
  const losses = trades.filter((t) => t.netProfit < 0).map((t) => t.netProfit)
  const best = wins.length ? Math.max(...wins) : null
  const worst = losses.length ? Math.min(...losses) : null

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-8">
        <div className="shrink-0">
          {/* 日付はすぐ下に大きく出ているので、印は「今日」のときだけ */}
          {isToday && (
            <span className="inline-block rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand">
              TODAY
            </span>
          )}

          <div className={`flex flex-wrap items-end gap-x-3 gap-y-1 ${isToday ? 'mt-2' : ''}`}>
            <p className="text-sm font-semibold text-ink3">{fmtJst(iso, 'yyyy')}</p>
            <p className="flex items-center gap-2 text-4xl font-bold leading-none tracking-tight">
              {fmtJst(iso, 'MM/dd')}
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  weekday === '土'
                    ? 'bg-brand-soft text-brand'
                    : weekday === '日'
                      ? 'bg-down-soft text-down'
                      : 'bg-sunken text-ink2'
                }`}
              >
                {weekday}
              </span>
            </p>
          </div>
          <p className="mt-0.5 text-xs text-ink3">{fmtJst(iso, 'EEEE')}</p>

          {/* 日を前後に動かす。月をまたいで選ぶのは「カレンダー」タブから */}
          {onShiftDay && (
            <div className="mt-2.5 flex items-center gap-1">
              <button
                className="btn btn-quiet px-2"
                onClick={() => onShiftDay(-1)}
                aria-label="前の日"
              >
                <Icon name="left" size={16} />
              </button>
              <button
                className="btn btn-quiet px-2"
                onClick={() => onShiftDay(1)}
                aria-label="次の日"
                disabled={isToday}
              >
                <Icon name="right" size={16} />
              </button>
              {!isToday && onToday && (
                <button className="btn btn-quiet ml-1 px-2.5 text-xs" onClick={onToday}>
                  今日
                </button>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="sm:mt-6">
            <p className="text-xs text-ink2">{isToday ? '今日の損益' : 'この日の損益'}</p>
            <p className="text-3xl font-bold">
              <AnimatedMoney value={sum.netTotal} />
              <span className="ml-1 text-sm font-semibold text-ink3">{currencyLabel()}</span>
            </p>
            {trades.length > 0 && (
              <>
                <Stars n={stars} />
                <p className="mt-1 text-sm font-semibold text-ink2">{comment(stars, sum.netTotal)}</p>
              </>
            )}
          </div>
        </div>

        {aside && <div className="xl:hidden">{aside}</div>}
      </div>

      {trades.length > 0 && (
        // 狭い画面は3列（3つ＋2つ）。2列だと5つ目だけが余って落ち着かない。
        <div className="-mb-px grid grid-cols-3 border-t border-line lg:grid-cols-5">
          <Tile label="トレード数" value={String(sum.count)} unit="件" />
          {/* 狭い升目に入るよう、勝率だけは小数を出さない */}
          <Tile label="勝率" value={`${Math.round(sum.winRate * 100)}%`} ring={sum.winRate} />
          <Tile label="平均RR" value={sum.avgPlannedRR != null ? fmtNum(sum.avgPlannedRR, 2) : '—'} />
          <Tile
            label="最大利益"
            value={best != null ? fmtMoney(best, { sign: true }) : '—'}
            unit={best != null ? currencyLabel() : undefined}
            cls={best != null ? colorOf(best) : undefined}
          />
          <Tile
            label="最大損失"
            value={worst != null ? fmtMoney(worst, { sign: true }) : '—'}
            unit={worst != null ? currencyLabel() : undefined}
            cls={worst != null ? colorOf(worst) : undefined}
          />
        </div>
      )}
    </section>
  )
}

function Tile({
  label,
  value,
  unit,
  cls,
  ring,
}: {
  label: string
  value: string
  unit?: string
  cls?: string
  ring?: number
}) {
  return (
    <div className="flex items-center gap-2 border-b border-r border-line px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-ink3">{label}</p>
        <p className={`truncate text-base font-bold tabular-nums sm:text-lg ${cls ?? 'text-ink'}`}>
          {value}
          {unit && <span className="ml-0.5 text-[11px] font-semibold text-ink3">{unit}</span>}
        </p>
      </div>
      {ring != null && <MiniRing ratio={ring} />}
    </div>
  )
}

function MiniRing({ ratio }: { ratio: number }) {
  const r = 9
  const c = 2 * Math.PI * r
  const on = Math.max(0, Math.min(1, ratio))
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-line" />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${c * on} ${c}`}
        transform="rotate(-90 12 12)"
        className="text-up"
      />
    </svg>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <span className="mt-2 flex gap-0.5" aria-label={`この日の評価 5段階中 ${n}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? 'text-amber' : 'text-line'}>
          <Icon name="star" size={18} strokeWidth={0} className="fill-current" />
        </span>
      ))}
    </span>
  )
}

/** 勝ち負けではなく「決めた通りにやれたか」を言葉にする */
function comment(stars: number, net: number): string {
  if (stars >= 4) return '決めた通りにやれた一日でした。'
  if (stars >= 3) return net >= 0 ? '落ち着いて進められた一日でした。' : '損失を限定できた一日でした。'
  if (stars >= 2) return '決めた形から少しはずれた取引がありました。'
  return '損切りを置かずに入った取引がありました。'
}

function avgStars(trades: EnrichedTrade[]): number {
  if (trades.length === 0) return 0
  const total = trades.reduce((s, t) => s + gradeTrade(t).stars, 0)
  return Math.round(total / trades.length)
}
