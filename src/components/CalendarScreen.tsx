import { useMemo } from 'react'
import type { EnrichedTrade } from '../lib/types'
import PnlCalendar from './PnlCalendar'

/**
 * カレンダー。ひと月ぶんを俯瞰するところ。
 *
 * 「その日の中身を見る」のは日記タブが受け持つ。あちらには
 * 1週間ぶんの日付があって、選んだ日の記録とトレードが出る。
 * ここは「先月どうだったか」「どのあたりで負けているか」を
 * ひと目で掴むための升目に徹する。
 *
 * 日を押すと、その日の日記が開く。
 * 升目は「日を探す道具」なので、探し終わったら中身へ渡す。
 */

interface Props {
  trades: EnrichedTrade[]
  /** 日記を書いた日。升目に印を出す */
  dayNotes: Record<string, string>
  dayTitles?: Record<string, string>
  /** その日の日記を開く */
  onSelectDay: (day: string) => void
}

export default function CalendarScreen({ trades, dayNotes, dayTitles, onSelectDay }: Props) {
  const written = useMemo(
    () =>
      new Set([
        ...Object.entries(dayNotes)
          .filter(([, v]) => v)
          .map(([k]) => k),
        ...Object.entries(dayTitles ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k),
      ]),
    [dayNotes, dayTitles],
  )

  return (
    <div className="mx-auto flex max-w-[42rem] flex-col gap-3">
      <PnlCalendar trades={trades} writtenDays={written} onSelectDay={onSelectDay} />

      {/* 凡例と使い方は1行にまとめて、1か月ぶんが画面に収まるようにする */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink2">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-up-soft" />
          プラスの日
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-down-soft" />
          マイナスの日
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          日記あり
        </span>
        <span className="text-ink3">日を押すと、その日の日記が開きます</span>
      </div>
    </div>
  )
}
