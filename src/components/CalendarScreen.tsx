import { useMemo, useState } from 'react'
import type { Account, EnrichedTrade } from '../lib/types'
import { jstDayKey } from '../lib/timezone'
import PnlCalendar from './PnlCalendar'
import WeekStrip from './calendar/WeekStrip'
import DayPreviewCard from './calendar/DayPreviewCard'
import TradeEmbed from './diary/TradeEmbed'
import Icon from './Icon'

/**
 * カレンダー。
 *
 * 主役は「ひと月の升目」ではなく「選んだ日の中身」。
 * 升目を大きく出すと、そこが画面のほとんどを占めてしまい、
 * 日を押したあとに何が見られるのかが分からない。
 *
 * 上から順に、見る順番のとおりに並べる:
 *   1週間ぶんの日付  … どの日を見るか選ぶ
 *   日記の1枚        … その日を書いたか / これから書くか
 *   トレードの履歴    … その日に何をしたか
 *
 * ひと月の升目は残してある。「先月どうだったか」を俯瞰するには
 * あちらのほうが速いので、切り替えて使えるようにしている。
 */

interface Props {
  trades: EnrichedTrade[]
  accounts?: Account[]
  dayNotes: Record<string, string>
  dayTitles?: Record<string, string>
  readOnly?: boolean
  onChanged: () => void
  /** その日の日記を開く */
  onSelectDay: (day: string) => void
  /** 記録タブへ */
  onAdd?: () => void
}

export default function CalendarScreen({
  trades,
  accounts,
  dayNotes,
  dayTitles,
  readOnly,
  onChanged,
  onSelectDay,
  onAdd,
}: Props) {
  const today = useMemo(() => jstDayKey(new Date().toISOString()), [])
  const [selected, setSelected] = useState(today)
  const [mode, setMode] = useState<'day' | 'month'>('day')

  const byDay = useMemo(() => {
    const m = new Map<string, EnrichedTrade[]>()
    for (const t of trades) {
      const list = m.get(t.jstDay)
      if (list) list.push(t)
      else m.set(t.jstDay, [t])
    }
    return m
  }, [trades])

  const activeDays = useMemo(() => new Set(byDay.keys()), [byDay])
  const dayTrades = byDay.get(selected) ?? []

  return (
    <div className="mx-auto max-w-[42rem]">
      {/* 日で見るか、ひと月を俯瞰するか。
          選んだほうが濃い面になるのは、ほかの画面と同じ決まり */}
      <div className="mb-3 flex justify-end">
        <div className="flex rounded-xl bg-sunken p-0.5">
          {(
            [
              ['day', '日で見る'],
              ['month', 'ひと月'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={`seg ${mode === k ? 'seg-on' : 'seg-off'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'month' ? (
        <>
          <PnlCalendar
            trades={trades}
            onSelectDay={(d) => {
              // 升目は「日を選ぶところ」。押したら日の画面へ戻す
              setSelected(d)
              setMode('day')
            }}
          />
          <p className="mt-3 text-center text-[12px] text-ink3">
            色のついた日を押すと、その日の中身が見られます
          </p>
        </>
      ) : (
        <>
          <WeekStrip
            value={selected}
            onChange={setSelected}
            activeDays={activeDays}
            max={today}
          />

          <div className="mt-4">
            <DayPreviewCard
              day={selected}
              title={dayTitles?.[selected] ?? ''}
              note={dayNotes[selected] ?? ''}
              isToday={selected === today}
              onOpen={onSelectDay}
            />
          </div>

          {/* 日記の中と同じ見せ方。画面が変わっても、
              同じものは同じ形で出てくるようにする */}
          <TradeEmbed
            trades={dayTrades}
            accounts={accounts}
            readOnly={readOnly}
            onChanged={onChanged}
            onAdd={onAdd}
            title={selected === today ? '今日のトレード' : 'この日のトレード'}
          />

          <button
            type="button"
            onClick={() => setMode('month')}
            className="mt-8 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold text-ink3 transition-colors hover:bg-sunken hover:text-ink"
          >
            <Icon name="calendar" size={15} />
            ひと月ぶんをまとめて見る
          </button>
        </>
      )}
    </div>
  )
}
