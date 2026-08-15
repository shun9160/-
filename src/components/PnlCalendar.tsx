import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { groupNetByDay } from '../lib/analytics'
import { colorOf, fmtMoney } from '../lib/format'
import Icon from './Icon'
import SwipePager from './SwipePager'

interface Props {
  trades: EnrichedTrade[]
  /** 日記を書いた日。升目に小さな点を打つ */
  writtenDays?: Set<string>
  onSelectDay?: (day: string) => void
}

type Mode = 'daily' | 'monthly'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

/** 月別のときの並び順 */
type MonthOrder = 'month' | 'profit' | 'loss'

const MONTH_ORDERS: { value: MonthOrder; label: string }[] = [
  { value: 'month', label: '月の順' },
  { value: 'profit', label: '損益が大きい順' },
  { value: 'loss', label: '損益が小さい順' },
]

export default function PnlCalendar({ trades, writtenDays, onSelectDay }: Props) {
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
  /** 月別のときの並び順 */
  const [monthOrder, setMonthOrder] = useState<MonthOrder>('month')

  // 選べる年。取引のある年に、今年と、いま見ている年を足す。
  // 矢印を何十回も押さないと去年に行けない、という状態をなくすため。
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const day of Object.keys(byDay)) set.add(Number(day.slice(0, 4)))
    set.add(new Date().getFullYear())
    set.add(year)
    return [...set].sort((a, b) => b - a)
  }, [byDay, year])

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

  /*
    横に振ったら、隣の月へ。
    暦を見ている人にとっての「隣」は前後の日付で、別の口座ではない。
    ここで受け取らないと、外側の口座切り替えに持っていかれる。

    行き先は前・いま・次の3つだけを渡す。暦はどこまでも続くので、
    ぜんぶ並べる意味がない。振るたびに、いまを真ん中にして作り直す。
  */
  const here = mode === 'daily' ? `${year}-${month}` : `${year}`
  const prev = mode === 'daily' ? monthKey(year, month - 1) : `${year - 1}`
  const next = mode === 'daily' ? monthKey(year, month + 1) : `${year + 1}`

  return (
    <SwipePager
      items={[prev, here, next]}
      current={here}
      onChange={(k) => shift(k === prev ? -1 : 1)}
    >
      <div className="py-1">
        {/*
          見出し。日記の上に出す週の並びと同じ組み方にする。
          年を小さく上に、月を大きく下に。矢印は右上へ小さく。
          画面ごとに暦の見出しの形が違うと、同じアプリに見えない
        */}
        <div className="flex justify-end gap-0.5">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-sunken hover:text-ink"
            onClick={() => shift(-1)}
            aria-label="前へ"
          >
            <Icon name="left" size={16} />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-sunken hover:text-ink"
            onClick={() => shift(1)}
            aria-label="次へ"
          >
            <Icon name="right" size={16} />
          </button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* 年と月は選んで飛べる。矢印だけだと、去年を見るのに何十回も押すことになる */}
            <Picker
              value={year}
              onChange={setYear}
              options={years.map((y) => ({ value: y, label: `${y}年` }))}
              label="年"
              small
            />
            {mode === 'daily' && (
              <div className="-mt-0.5">
                <Picker
                  value={month}
                  onChange={setMonth}
                  options={MONTHS.map((m, i) => ({ value: i, label: m }))}
                  label="月"
                />
              </div>
            )}
            <p className={`mt-1 text-sm font-bold tabular-nums ${colorOf(total)}`}>
              {fmtMoney(total, { sign: true })} 円
            </p>
          </div>

          <Modes mode={mode} setMode={setMode} />
        </div>

        {/* 月別のときだけ、12か月を「良かった順」に並べ替えられる。
            どの月が調子よかったかを知るのに、目で追わなくて済む */}
        {mode === 'monthly' && (
          <div className="mt-3 flex items-center justify-end gap-1.5">
            <label className="text-xs text-ink2" htmlFor="month-order">
              並び替え
            </label>
            <select
              id="month-order"
              className="input w-auto px-2 py-1 text-xs"
              value={monthOrder}
              onChange={(e) => setMonthOrder(e.target.value as MonthOrder)}
            >
              {MONTH_ORDERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3 sm:mt-4">
          {mode === 'daily' ? (
            <DailyGrid
              year={year}
              month={month}
              byDay={byDay}
              writtenDays={writtenDays}
              onSelectDay={onSelectDay}
            />
          ) : (
            <MonthlyGrid year={year} byMonth={byMonth} order={monthOrder} />
          )}
        </div>
      </div>
    </SwipePager>
  )
}

/** 年をまたいでも正しい、月の合い言葉。12月の次は翌年の1月 */
function monthKey(year: number, month: number): string {
  const y = year + Math.floor(month / 12)
  const m = ((month % 12) + 12) % 12
  return `${y}-${m}`
}

/**
 * 年・月を選ぶプルダウン。
 * 見出しの文字そのものを押せるようにして、行を増やさない。
 */
function Picker({
  value,
  onChange,
  options,
  label,
  small,
}: {
  value: number
  onChange: (v: number) => void
  options: { value: number; label: string }[]
  label: string
  /** 年のほう。月より一段小さく、目立たせない */
  small?: boolean
}) {
  return (
    <span className="relative inline-flex items-center">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // 見出しに見せるので枠は出さない。押せることは右の印で伝える
        className={`-ml-1.5 cursor-pointer appearance-none rounded-lg bg-transparent py-0.5 pl-1.5 pr-5 font-bold hover:bg-sunken focus:bg-sunken ${
          small ? 'text-[11px] text-ink3' : 'text-[18px] leading-none text-ink'
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1 text-ink3">
        <Icon name="down" size={small ? 11 : 13} />
      </span>
    </span>
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
    <div className="flex rounded-xl bg-sunken p-0.5">
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
  writtenDays,
  onSelectDay,
}: {
  year: number
  month: number
  byDay: Record<string, number>
  writtenDays?: Set<string>
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
          const wrote = writtenDays?.has(key) ?? false
          const has = net != null
          const pos = has && net > 0
          const neg = has && net < 0
          // 取引が無くても、日記を書いた日は押して開けるようにする
          const open = has || wrote
          return (
            <button
              key={i}
              onClick={() => open && onSelectDay?.(key)}
              disabled={!open}
              className={[
                // スマホは正方形が収まりよい。
                // 画面が広いと正方形のままでは背が高くなりすぎ、
                // ノートパソコンで1か月が画面に入らないので高さを決め打つ。
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 transition-colors sm:aspect-auto sm:h-[clamp(2.4rem,calc((100vh-17rem)/6),7rem)]',
                // 升目はぜんぶ塗る。塗らない日があると、下地と地続きになって
                // 「暦の形」そのものが見えなくなる。下地は升目のあいだの
                // 隙間として残り、それが罫線の代わりになる
                pos
                  ? 'bg-up-fill hover:bg-up/20'
                  : neg
                    ? 'bg-down-fill hover:bg-down/15'
                    : 'bg-surface hover:bg-sunken',
              ].join(' ')}
            >
              {/* 取引の無い日も、日付は読めること。暦なので
                  「21日はどこか」を探すのに使う。薄すぎると探せない */}
              <span className={`text-[13px] font-bold ${open ? 'text-ink' : 'text-ink2'}`}>{d}</span>
              {has && (
                <span
                  className={`text-[11px] font-bold leading-none tabular-nums ${
                    pos ? 'text-up-deep' : neg ? 'text-down' : 'text-ink3'
                  }`}
                >
                  {shorten(net)}
                </span>
              )}
              {/* 日記を書いた日の印。金額とは別の情報なので、
                  数字ではなく点で出して、升目を混み合わせない */}
              {wrote && (
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MonthlyGrid({
  year,
  byMonth,
  order,
}: {
  year: number
  byMonth: Record<string, number>
  order: MonthOrder
}) {
  const cells = useMemo(() => {
    const list = MONTHS.map((label, m) => {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`
      return { key, label, month: m, net: byMonth[key] ?? null }
    })
    if (order === 'month') return list
    // 取引のない月は、並べ替えても必ず最後にまとめる
    const withNet = list.filter((c) => c.net != null)
    const empty = list.filter((c) => c.net == null)
    withNet.sort((a, b) => (order === 'profit' ? b.net! - a.net! : a.net! - b.net!))
    return [...withNet, ...empty]
  }, [year, byMonth, order])

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {cells.map((c) => {
        const has = c.net != null
        return (
          <div
            key={c.key}
            className={`flex flex-col items-center rounded-lg py-5 ${
              has ? (c.net! > 0 ? 'bg-up-fill' : 'bg-down-fill') : 'bg-surface'
            }`}
          >
            <span className="text-xs text-ink2">{c.label}</span>
            <span
              className={`mt-0.5 text-sm font-bold tabular-nums ${
                // 塗りの上に載るので、緑は暗いほうを使う（薄い緑だと読めない）
                has ? (c.net! > 0 ? 'text-up-deep' : 'text-down') : 'text-ink3'
              }`}
            >
              {has ? fmtMoney(c.net!, { sign: true }) : '—'}
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
