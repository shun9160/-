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

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold tabular-nums">
          {fmtJst(`${value}T00:00:00+09:00`, 'yyyy年 M月')}
        </p>
        <div className="flex items-center gap-1">
          <Nav dir="left" onClick={() => onChange(shift(value, -7))} />
          <Nav dir="right" onClick={() => canNext && onChange(min(shift(value, 7), max))} disabled={!canNext} />
        </div>
      </div>

      <div className="mt-2.5 flex gap-1">
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
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                on
                  ? 'bg-night text-white'
                  : future
                    ? 'text-ink3/50'
                    : 'text-ink2 hover:bg-sunken'
              }`}
            >
              <span
                className={`text-[10px] font-bold ${
                  on ? 'text-white/70' : i === 5 ? 'text-[#4A6BFF]' : i === 6 ? 'text-down' : ''
                }`}
              >
                {WEEKDAYS_JA[i]}
              </span>
              <span className={`text-[17px] font-bold tabular-nums ${on ? '' : 'text-ink'}`}>
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
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink2 transition-colors hover:bg-sunken disabled:text-ink3/40"
    >
      <Icon name={dir} size={18} />
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
