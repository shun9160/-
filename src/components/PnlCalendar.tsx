import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { groupNetByDay } from '../lib/analytics'
import { colorOf, fmtMoney } from '../lib/format'
import Icon from './Icon'

interface Props {
  trades: EnrichedTrade[]
  onSelectDay?: (day: string) => void
}

type Mode = 'daily' | 'monthly'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export default function PnlCalendar({ trades, onSelectDay }: Props) {
  const byDay = useMemo(() => groupNetByDay(trades), [trades])

  // 取引のある最新月を初期表示にする
  const initial = useMemo(() => {
    const days = Object.keys(byDay).sort()
    const latest = days.length ? days[days.length - 1] : null
    return latest ? new Date(latest + 'T00:00:00') : new Date()
  }, [byDay])

  const [mode, setMode] = useState<Mode>('daily')
  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth())

  const byMonth = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [day, net] of Object.entries(byDay)) {
      const k = day.slice(0, 7)
      out[k] = (out[k] ?? 0) + net
    }
    return out
  }, [byDay])

  const monthTotal = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return Object.entries(byDay)
      .filter(([d]) => d.startsWith(prefix))
      .reduce((s, [, v]) => s + v, 0)
  }, [byDay, year, month])

  const yearTotal = useMemo(
    () =>
      Object.entries(byMonth)
        .filter(([k]) => k.startsWith(String(year)))
        .reduce((s, [, v]) => s + v, 0),
    [byMonth, year],
  )

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

  const total = mode === 'daily' ? monthTotal : yearTotal

  return (
    <div className="card p-4 sm:p-5">
      {/* 期間の移動。広い画面では 日別/月別 も同じ行に置いて縦を詰める */}
      <div className="flex items-center justify-between gap-3">
        <div className="hidden sm:block sm:w-32" />
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost px-2" onClick={() => shift(-1)} aria-label="前へ">
            <Icon name="left" size={18} />
          </button>
          <div className="min-w-[9rem] text-center">
            <p className="text-base font-bold">
              {mode === 'daily' ? `${year}年 ${MONTHS[month]}` : `${year}年`}
            </p>
            <p className={`text-sm font-semibold tabular-nums ${colorOf(total)}`}>
              {fmtMoney(total, { sign: true })} 円
            </p>
          </div>
          <button className="btn btn-ghost px-2" onClick={() => shift(1)} aria-label="次へ">
            <Icon name="right" size={18} />
          </button>
        </div>
        <div className="hidden sm:flex sm:w-32 sm:justify-end">
          <Modes mode={mode} setMode={setMode} />
        </div>
      </div>

      {/* 狭い画面では下に置く */}
      <div className="mx-auto mt-3 flex w-fit sm:hidden">
        <Modes mode={mode} setMode={setMode} />
      </div>

      <div className="mt-3 sm:mt-4">
        {mode === 'daily' ? (
          <DailyGrid year={year} month={month} byDay={byDay} onSelectDay={onSelectDay} />
        ) : (
          <MonthlyGrid year={year} byMonth={byMonth} />
        )}
      </div>
    </div>
  )
}

function Modes({
  mode,
  setMode,
}: {
  mode: 'daily' | 'monthly'
  setMode: (m: 'daily' | 'monthly') => void
}) {
  return (
    <div className="flex rounded-xl bg-sunken p-1">
      {(
        [
          ['daily', '日別'],
          ['monthly', '月別'],
        ] as const
      ).map(([k, l]) => (
        <button
          key={k}
          onClick={() => setMode(k)}
          className={`seg ${mode === k ? 'seg-on' : 'seg-off'}`}
        >
          {l}
        </button>
      ))}
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
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7 // 月曜始まり
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`text-[11px] font-semibold ${i >= 5 ? 'text-ink3' : 'text-ink2'}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
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
              disabled={!has}
              className={[
                // スマホは正方形が収まりよい。
                // 画面が広いと正方形のままでは背が高くなりすぎ、
                // ノートパソコンで1か月が画面に入らないので高さを決め打つ。
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 transition-colors sm:aspect-auto sm:h-[clamp(2.4rem,calc((100vh-25rem)/6),4.75rem)]',
                has
                  ? pos
                    ? 'border-up/20 bg-up-soft hover:border-up/50'
                    : neg
                      ? 'border-down/20 bg-down-soft hover:border-down/50'
                      : 'border-line bg-sunken'
                  : 'border-transparent',
              ].join(' ')}
            >
              <span className={`text-xs font-semibold ${has ? 'text-ink' : 'text-ink3'}`}>{d}</span>
              {has && (
                <span
                  className={`text-[10px] font-bold leading-none tabular-nums ${
                    pos ? 'text-up' : neg ? 'text-down' : 'text-ink3'
                  }`}
                >
                  {shorten(net)}
                </span>
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
        const key = `${year}-${String(m + 1).padStart(2, '0')}`
        const net = byMonth[key]
        const has = net != null
        return (
          <div
            key={key}
            className={`flex flex-col items-center rounded-xl border py-5 ${
              has
                ? net > 0
                  ? 'border-up/20 bg-up-soft'
                  : 'border-down/20 bg-down-soft'
                : 'border-line'
            }`}
          >
            <span className="text-xs text-ink2">{label}</span>
            <span
              className={`mt-0.5 text-sm font-bold tabular-nums ${has ? colorOf(net) : 'text-ink3'}`}
            >
              {has ? fmtMoney(net, { sign: true }) : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** カレンダーのマス用に桁を詰める (符号は必ず残す) */
function shorten(n: number): string {
  const s = n > 0 ? '+' : '−'
  const a = Math.abs(n)
  if (a >= 10000) return `${s}${(a / 10000).toFixed(a >= 100000 ? 0 : 1)}万`
  if (a >= 1000) return `${s}${(a / 1000).toFixed(1)}k`
  return `${s}${Math.round(a)}`
}
