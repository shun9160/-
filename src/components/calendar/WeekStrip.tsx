import { useMemo } from 'react'
import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'

/**
 * 上に置く、コンパクトな日付の並び。
 *
 * ひと月ぶんを大きく出すと、それ自体が主役になってしまう。
 * ここで選ぶのは「どの日の中身を見るか」なので、
 * 1週間ぶんだけを横に並べて、あとは中身に場所をゆずる。
 *
 * 組み方:
 *   年と月は左に2段。そこから細い縦線1本で日付と分ける。
 *   囲いを作らず、線1本だけで「暦の見出し」と「日付」を分ける。
 *   前後の週へ動く矢印は、いちばん上の右へ小さく置く。
 *
 * 取引があった日は下に点を打つ。数字を入れると窮屈になるうえ、
 * 金額はすぐ下のカードと履歴に出るので、ここでは「あったか無いか」だけ。
 */

const WEEKDAYS_JA = ['月', '火', '水', '木', '金', '土', '日']

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
  // その週の月曜から7日ぶん
  const days = useMemo(() => {
    const d = new Date(`${value}T00:00:00Z`)
    // getUTCDay: 日=0。月曜を週のはじめにする
    const back = (d.getUTCDay() + 6) % 7
    const monday = shift(value, -back)
    return Array.from({ length: 7 }, (_, i) => shift(monday, i))
  }, [value])

  const canNext = days[6] < max
  const iso = `${value}T00:00:00+09:00`

  return (
    <div>
      {/* 週を動かす矢印。日付より先に目に入らないよう、小さく右上に */}
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

        <div className="flex min-w-0 flex-1 gap-0.5">
          {days.map((day, i) => {
            const on = day === value
            const future = day > max
            const has = activeDays.has(day)
            return (
              <button
                key={day}
                type="button"
                disabled={future}
                aria-pressed={on}
                onClick={() => onChange(day)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${
                  on
                    ? 'bg-night text-white'
                    : future
                      ? 'text-ink3/50'
                      : 'text-ink2 hover:bg-sunken'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold ${
                    on ? 'text-white/70' : i === 5 ? 'text-[#4A6BFF]' : i === 6 ? 'text-down' : ''
                  }`}
                >
                  {WEEKDAYS_JA[i]}
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
