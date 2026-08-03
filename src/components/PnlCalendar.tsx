import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { groupNetByDay } from '../lib/analytics'
import { fmtMoney } from '../lib/format'

interface Props {
  trades: EnrichedTrade[]
  onSelectDay?: (day: string) => void
}

type Mode = 'daily' | 'monthly'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function ymKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

export default function PnlCalendar({ trades, onSelectDay }: Props) {
  const byDay = useMemo(() => groupNetByDay(trades), [trades])

  // 取引が存在する最新の日付を初期表示にする
  const latest = useMemo(() => {
    const days = Object.keys(byDay).sort()
    return days.length ? days[days.length - 1] : null
  }, [byDay])

  const initial = latest ? new Date(latest + 'T00:00:00') : new Date('2026-08-01T00:00:00')
  const [mode, setMode] = useState<Mode>('daily')
  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth())

  const byMonth = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [day, net] of Object.entries(byDay)) {
      const key = day.slice(0, 7)
      out[key] = (out[key] ?? 0) + net
    }
    return out
  }, [byDay])

  function shift(delta: number) {
    if (mode === 'daily') {
      let m = month + delta
      let y = year
      while (m < 0) {
        m += 12
        y--
      }
      while (m > 11) {
        m -= 12
        y++
      }
      setMonth(m)
      setYear(y)
    } else {
      setYear(year + delta)
    }
  }

  return (
    <div>
      {/* ヘッダ: モード切替 + 月/年ナビ */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            className={`chip ${mode === 'daily' ? 'chip-on' : 'chip-off'}`}
            onClick={() => setMode('daily')}
          >
            日別
          </button>
          <button
            className={`chip ${mode === 'monthly' ? 'chip-on' : 'chip-off'}`}
            onClick={() => setMode('monthly')}
          >
            月別
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-gray-400 hover:text-white" onClick={() => shift(-1)} aria-label="前へ">
            ‹
          </button>
          <span className="min-w-[7rem] text-center text-lg font-semibold">
            {mode === 'daily' ? `${year}年 ${MONTHS[month]}` : `${year}年`}
          </span>
          <button className="text-gray-400 hover:text-white" onClick={() => shift(1)} aria-label="次へ">
            ›
          </button>
        </div>
      </div>

      {mode === 'daily' ? (
        <DailyGrid
          year={year}
          month={month}
          byDay={byDay}
          onSelectDay={onSelectDay}
        />
      ) : (
        <MonthlyGrid year={year} byMonth={byMonth} />
      )}
    </div>
  )
}

function DailyGrid({
  year,
  month,
  byDay,
  onSelectDay,
}: {
  year: number
  month: number
  byDay: Record<string, number>
  onSelectDay?: (day: string) => void
}) {
  // 月曜始まりのオフセット
  const first = new Date(Date.UTC(year, month, 1))
  const firstWeekday = (first.getUTCDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs text-gray-500">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i >= 5 ? 'text-gray-600' : ''}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const net = byDay[key]
          const has = net != null
          const pos = has && net > 0
          const neg = has && net < 0
          return (
            <button
              key={i}
              onClick={() => has && onSelectDay?.(key)}
              className={[
                'flex aspect-square flex-col items-center justify-center rounded-lg border text-center transition-colors',
                has
                  ? 'border-border bg-panel-2 hover:border-gray-500'
                  : 'border-transparent bg-transparent',
                has ? 'cursor-pointer' : 'cursor-default',
              ].join(' ')}
            >
              <span className={`text-sm ${has ? 'font-semibold text-gray-200' : 'text-gray-600'}`}>
                {d}
              </span>
              {has ? (
                <span
                  className={`mt-0.5 text-[10px] font-medium leading-tight ${
                    pos ? 'text-up' : neg ? 'text-down' : 'text-gray-400'
                  }`}
                >
                  {fmtMoney(net, { sign: true })}
                </span>
              ) : (
                <span className="mt-0.5 text-[10px] text-gray-700">--</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MonthlyGrid({ year, byMonth }: { year: number; byMonth: Record<string, number> }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {MONTHS.map((label, m) => {
        const key = ymKey(year, m)
        const net = byMonth[key]
        const has = net != null
        return (
          <div
            key={key}
            className={`flex flex-col items-center justify-center rounded-xl border py-6 ${
              has ? 'border-border bg-panel-2' : 'border-transparent'
            }`}
          >
            <span className="text-sm text-gray-400">{label}</span>
            <span
              className={`mt-1 text-sm font-semibold ${
                has ? (net > 0 ? 'text-up' : net < 0 ? 'text-down' : 'text-gray-300') : 'text-gray-700'
              }`}
            >
              {has ? fmtMoney(net, { sign: true }) : '--'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
