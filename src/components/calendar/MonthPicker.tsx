import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon'

/**
 * 年と月を選んで、その月へ飛ぶ。
 *
 * 日付の並びは指で流せるが、何ヶ月も前へ戻るには向いていない。
 * 見出しの「2026 / 9月」を押したら、ここが開く。
 *
 * 取引のあった月には点を打つ。空の月へ飛んでも見るものが無いので、
 * どこに何かあるのかが、押す前に分かるようにしておく。
 *
 * 面は白。紫のカードの上に開くが、紫のまま重ねると
 * どこからどこまでが「選ぶところ」なのか分からなくなる。
 */

/** ここより古い年は出さない。空の年をいくらでも遡れても仕方がない */
const MAX_YEARS_BACK = 10

interface Props {
  /** いま選んでいる日（YYYY-MM-DD） */
  value: string
  /** これより先へは行けない（ふつうは今日） */
  max: string
  /** 取引のあった日。月に点を打つのと、遡れる年を決めるのに使う */
  activeDays: Set<string>
  onPick: (day: string) => void
  onClose: () => void
}

export default function MonthPicker({ value, max, activeDays, onPick, onClose }: Props) {
  const [year, setYear] = useState(() => Number(value.slice(0, 4)))
  const panelRef = useRef<HTMLDivElement>(null)

  const maxYear = Number(max.slice(0, 4))
  const maxMonth = Number(max.slice(5, 7))

  /** 取引のある月（YYYY-MM）と、いちばん古い年 */
  const { months, firstYear } = useMemo(() => {
    const months = new Set<string>()
    let first = maxYear
    for (const d of activeDays) {
      months.add(d.slice(0, 7))
      const y = Number(d.slice(0, 4))
      if (y < first) first = y
    }
    return { months, firstYear: Math.max(first, maxYear - MAX_YEARS_BACK) }
  }, [activeDays, maxYear])

  useEffect(() => {
    panelRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="年と月を選ぶ"
        onClick={(e) => e.stopPropagation()}
        /*
          文字の色をここで言い切る。
          この面は紫のカードの中から開くので、何も言わないと
          カードの text-white を受け継いで、白い面に白い字が出る
        */
        className="w-[min(20rem,100%)] rounded-2xl bg-surface p-4 text-ink shadow-raised outline-none"
      >
        {/* 年 */}
        <div className="flex items-center justify-between">
          <YearNav
            dir="left"
            onClick={() => setYear((y) => y - 1)}
            disabled={year <= firstYear}
          />
          <p className="text-[17px] font-bold tabular-nums">{year}年</p>
          <YearNav dir="right" onClick={() => setYear((y) => y + 1)} disabled={year >= maxYear} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const key = `${year}-${String(m).padStart(2, '0')}`
            // これから先の月は選べない。まだ来ていない日は記録できない
            const ahead = year > maxYear || (year === maxYear && m > maxMonth)
            const on = key === value.slice(0, 7)
            const has = months.has(key)
            return (
              <button
                key={m}
                type="button"
                disabled={ahead}
                aria-pressed={on}
                onClick={() => onPick(dayIn(year, m, value, max, activeDays))}
                className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[15px] font-bold transition-colors ${
                  on
                    ? 'bg-brand text-white'
                    : ahead
                      ? 'text-ink3/50'
                      : 'bg-sunken text-ink hover:bg-brand-soft'
                }`}
              >
                {m}月
                {/* 取引のあった月の印。無い月も同じ高さを空けて、字の位置をそろえる */}
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

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-2 text-[13px] font-semibold text-ink2 hover:bg-sunken"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}

function YearNav({
  dir,
  onClick,
  disabled,
}: {
  dir: 'left' | 'right'
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? '前の年' : '次の年'}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink2 transition-colors hover:bg-sunken hover:text-ink disabled:text-ink3/40 disabled:hover:bg-transparent"
    >
      <Icon name={dir} size={18} />
    </button>
  )
}

/**
 * その月の、どの日を開くか。
 *
 * 取引のある月なら、その月の最後の取引日。
 * 月を選ぶ人は「その月に何があったか」を見にきているので、
 * 何も無い日に降ろされるより、まず記録のある日に着いたほうがいい。
 * 取引の無い月は、いま選んでいる日と同じ日にちにする（月末で足りなければ末日）。
 */
export function dayIn(
  year: number,
  month: number,
  value: string,
  max: string,
  activeDays: Set<string>,
): string {
  const prefix = `${year}-${String(month).padStart(2, '0')}`

  let latest = ''
  for (const d of activeDays) {
    if (d.startsWith(prefix) && d > latest && d <= max) latest = d
  }
  if (latest) return latest

  // 月の末日。翌月の0日目を数えると出る
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = Math.min(Number(value.slice(8, 10)), last)
  const iso = `${prefix}-${String(day).padStart(2, '0')}`
  return iso > max ? max : iso
}
