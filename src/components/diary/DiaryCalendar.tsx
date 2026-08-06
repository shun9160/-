import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { groupNetByDay } from '../../lib/analytics'
import { colorOf, fmtMoney } from '../../lib/format'
import { jstDayKey } from '../../lib/timezone'
import Icon from '../Icon'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

interface Props {
  trades: EnrichedTrade[]
  /** 日記が書いてある日 */
  noteDays: Set<string>
  selected: string | null
  onSelect: (day: string) => void
}

/**
 * 日記のための月カレンダー。
 *
 * 分析のカレンダー(PnlCalendar)は「金額を見る」ためのもので大きく作ってあるが、
 * こちらは日記の横に置くので、日付を選ぶことを優先して小さくまとめている。
 */
export default function DiaryCalendar({ trades, noteDays, selected, onSelect }: Props) {
  const byDay = useMemo(() => groupNetByDay(trades), [trades])
  const today = useMemo(() => jstDayKey(new Date().toISOString()), [])

  const base = selected ?? today
  const [cursor, setCursor] = useState(() => ({
    year: Number(base.slice(0, 4)),
    month: Number(base.slice(5, 7)) - 1,
  }))

  const cells = useMemo(() => buildMonth(cursor.year, cursor.month), [cursor])
  const monthTotal = useMemo(() => {
    const prefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
    return Object.entries(byDay)
      .filter(([d]) => d.startsWith(prefix))
      .reduce((s, [, v]) => s + v, 0)
  }, [byDay, cursor])

  function shift(delta: number) {
    setCursor((c) => {
      let m = c.month + delta
      let y = c.year
      while (m < 0) {
        m += 12
        y--
      }
      while (m > 11) {
        m -= 12
        y++
      }
      return { year: y, month: m }
    })
  }

  function goToday() {
    setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 })
    onSelect(today)
  }

  return (
    <section className="card p-4">
      <div className="flex items-center gap-1">
        <button className="btn btn-ghost px-1.5" onClick={() => shift(-1)} aria-label="前の月">
          <Icon name="left" size={17} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-bold">
            {cursor.year}年{MONTHS[cursor.month]}
          </p>
          <p className={`text-xs font-semibold tabular-nums ${colorOf(monthTotal)}`}>
            {fmtMoney(monthTotal, { sign: true })}
          </p>
        </div>
        <button className="btn btn-ghost px-1.5" onClick={() => shift(1)} aria-label="次の月">
          <Icon name="right" size={17} />
        </button>
        <button className="btn btn-quiet ml-1 shrink-0 px-2 py-1 text-xs" onClick={goToday}>
          今日
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={`pb-1 text-center text-[11px] font-semibold ${
              i === 5 ? 'text-brand/70' : i === 6 ? 'text-down/70' : 'text-ink3'
            }`}
          >
            {w}
          </span>
        ))}

        {cells.map((c) => {
          const net = byDay[c.day]
          const has = net != null
          const isToday = c.day === today
          const on = c.day === selected
          return (
            <button
              key={c.day}
              onClick={() => onSelect(c.day)}
              aria-pressed={on}
              aria-label={`${c.day}${has ? ` ${fmtMoney(net, { sign: true })}` : ''}`}
              className="flex flex-col items-center gap-px rounded-lg py-1 transition-colors hover:bg-sunken"
            >
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs tabular-nums transition-colors',
                  !c.inMonth ? 'text-ink3/50' : '',
                  on
                    ? 'bg-brand font-bold text-white ring-2 ring-brand/25'
                    : isToday
                      ? 'bg-brand-soft font-bold text-brand'
                      : has
                        ? net >= 0
                          ? 'bg-up-soft font-bold text-up'
                          : 'bg-down-soft font-bold text-down'
                        : c.inMonth
                          ? 'text-ink2'
                          : '',
                ].join(' ')}
              >
                {c.date}
              </span>
              <span className="flex h-3 items-center">
                {has ? (
                  <span
                    className={`text-[9px] font-bold tabular-nums ${
                      on ? 'text-brand' : colorOf(net)
                    }`}
                  >
                    {compact(net)}
                  </span>
                ) : noteDays.has(c.day) ? (
                  <span className="h-1 w-1 rounded-full bg-brand" />
                ) : null}
              </span>
              <span className="flex h-1 items-center">
                {has && noteDays.has(c.day) && (
                  <span className="h-1 w-1 rounded-full bg-brand" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[10px] text-ink2">
        <Legend className="bg-up" label="利益" />
        <Legend className="bg-down" label="損失" />
        <Legend className="bg-brand" label="選択中" />
        <Legend className="bg-brand" label="日記あり" dot />
      </ul>
    </section>
  )
}

function Legend({ className, label, dot }: { className: string; label: string; dot?: boolean }) {
  return (
    <li className="flex items-center gap-1">
      <span className={`${dot ? 'h-1 w-1' : 'h-2 w-2'} rounded-full ${className}`} />
      {label}
    </li>
  )
}

/** 狭い升目に入るよう「+8.4千」のように縮める */
function compact(v: number): string {
  const a = Math.abs(v)
  const sign = v >= 0 ? '+' : '−'
  if (a >= 10000) return `${sign}${(a / 10000).toFixed(a >= 100000 ? 0 : 1)}万`
  if (a >= 1000) return `${sign}${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}千`
  return `${sign}${Math.round(a)}`
}

interface Cell {
  day: string
  date: number
  inMonth: boolean
}

/** 月曜はじまりの6週ぶん */
function buildMonth(year: number, month: number): Cell[] {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7 // 月曜=0
  const start = new Date(first.getTime() - offset * 86400000)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000)
    return {
      day: d.toISOString().slice(0, 10),
      date: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    }
  })
}
