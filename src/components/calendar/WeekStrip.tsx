import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'

/**
 * 上に置く、日付の並び。
 *
 * ひと月ぶんを大きく出すと、それ自体が主役になってしまう。
 * ここで選ぶのは「どの日の中身を見るか」なので、
 * 1行だけにして、あとは中身に場所をゆずる。
 *
 * 横に流して過去へ辿れる。1週間ずつ矢印で送るより、
 * 指で流したほうが速いし、途中の日も目に入る。
 * 矢印は残してある（画面が広いときや、正確に1週間送りたいとき用）。
 *
 * 組み方:
 *   年と月は左に2段。そこから細い縦線1本で日付と分ける。
 *   囲いを作らず、線1本だけで「暦の見出し」と「日付」を分ける。
 *   年月は、いま左端に見えている日のものに合わせて変わる。
 *
 * 取引があった日は下に点を打つ。数字を入れると窮屈になるうえ、
 * 金額はすぐ下のカードと履歴に出るので、ここでは「あったか無いか」だけ。
 */

const WEEKDAYS_JA = ['月', '火', '水', '木', '金', '土', '日']

/** さかのぼれる日数。ひと目盛り分の幅×この数だけ横に並ぶ */
const SPAN = 180
/** 1日ぶんの幅と間隔(px)。左端の日を割り出すのにも使う */
const CELL = 46
const GAP = 2

interface Props {
  /** 選んでいる日（YYYY-MM-DD） */
  value: string
  onChange: (day: string) => void
  /** 取引のあった日。点を打つのに使う */
  activeDays: Set<string>
  /** ここから先へは進ませない（ふつうは今日） */
  max: string
}

export default function WeekStrip({ value, onChange, activeDays, max }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  /** 左端に見えている日。左の年月はこれに合わせる */
  const [headDay, setHeadDay] = useState(value)

  // 過去 SPAN 日ぶん。古い順に並べ、いちばん新しい日が右端に来る
  const days = useMemo(
    () => Array.from({ length: SPAN }, (_, i) => shift(max, -(SPAN - 1 - i))),
    [max],
  )

  /** 選んだ日が見えるところまで寄せる */
  function scrollTo(day: string, smooth: boolean) {
    const el = boxRef.current
    if (!el) return
    const i = days.indexOf(day)
    if (i < 0) return
    // 真ん中あたりに置く。端に寄せると前後が見えなくなる
    const left = i * (CELL + GAP) - el.clientWidth / 2 + CELL / 2
    el.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' })
  }

  // 開いたときと、外から日が変わったときに寄せる
  useEffect(() => {
    scrollTo(value, false)
    setHeadDay(value)
    // days は max が変わったときだけ作り直される
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, days])

  const iso = `${headDay}T00:00:00+09:00`
  const canNext = value < max

  return (
    <div>
      {/* 週ごとに送る矢印。指で流せるので、こちらは控えめに */}
      <div className="flex justify-end gap-0.5">
        <Nav dir="left" onClick={() => onChange(shift(value, -7))} />
        <Nav
          dir="right"
          onClick={() => canNext && onChange(min(shift(value, 7), max))}
          disabled={!canNext}
        />
      </div>

      <div className="flex items-stretch gap-3">
        {/* 年と月。囲わず、細い線1本だけで日付と分ける */}
        <div className="w-10 shrink-0 pt-1.5">
          <p className="text-[11px] font-semibold leading-none text-ink3">
            {fmtJst(iso, 'yyyy')}
          </p>
          <p className="mt-1 text-[18px] font-bold leading-none tracking-tight">
            {fmtJst(iso, 'M')}月
          </p>
        </div>
        <div aria-hidden="true" className="w-px shrink-0 bg-line" />

        <div
          ref={boxRef}
          className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto"
          style={{ gap: GAP, scrollbarWidth: 'none', overscrollBehaviorX: 'contain' }}
          onScroll={(e) => {
            const i = Math.round(e.currentTarget.scrollLeft / (CELL + GAP))
            const d = days[Math.max(0, Math.min(days.length - 1, i))]
            if (d) setHeadDay(d)
          }}
        >
          {days.map((day) => {
            const on = day === value
            const has = activeDays.has(day)
            const wd = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onChange(day)
                  scrollTo(day, true)
                }}
                style={{ width: CELL }}
                className={`flex shrink-0 snap-center flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${
                  on ? 'bg-night text-white' : 'text-ink2'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold ${
                    on ? 'text-white/70' : wd === 5 ? 'text-[#4A6BFF]' : wd === 6 ? 'text-down' : ''
                  }`}
                >
                  {WEEKDAYS_JA[wd]}
                </span>
                <span
                  className={`text-[16px] font-bold leading-none tabular-nums ${
                    on ? '' : 'text-ink'
                  }`}
                >
                  {fmtJst(`${day}T00:00:00+09:00`, 'd')}
                </span>
                {/* 取引があった日の印。無い日は同じ高さの空きを残して、
                    数字の位置が上下にずれないようにする */}
                <span
                  aria-hidden="true"
                  className={`h-1 w-1 rounded-full ${
                    has ? (on ? 'bg-white' : 'bg-brand') : 'bg-transparent'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Nav({
  dir,
  onClick,
  disabled,
}: {
  dir: 'left' | 'right'
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? '前の週' : '次の週'}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-sunken hover:text-ink disabled:text-ink3/40"
    >
      <Icon name={dir} size={16} />
    </button>
  )
}

/** その日から delta 日ずらした日付（YYYY-MM-DD） */
function shift(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function min(a: string, b: string): string {
  return a < b ? a : b
}
