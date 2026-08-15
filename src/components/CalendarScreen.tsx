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
      {mode === 'month' ? (
        <>
          <button
            type="button"
            onClick={() => setMode('day')}
            className="btn -ml-2 mb-2 text-brand hover:bg-brand-soft"
          >
            <Icon name="back" size={17} />
            日で見る
          </button>
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
          {/*
            上のひとかたまり。日付を選ぶところと、その日の日記を
            1枚の白い面に収める。別々に置くと「操作」と「中身」が
            バラバラに見えるが、ここは「選ぶ→見る」でひと続き。
            狭い画面では左右の余白ぶんだけ外へ出し、下だけ丸める。
            画面の上から続いてきた面が、ここで終わるように見せる
          */}
          <div className="-mx-4 rounded-b-3xl bg-surface px-4 pb-5 pt-1 sm:mx-0 sm:rounded-2xl sm:px-5 sm:pt-4">
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
                onOpen={(d) => onSelectDay(d)}
              />
            </div>
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
            bare
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
