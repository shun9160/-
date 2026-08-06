import type { EnrichedTrade } from '../lib/types'
import PnlCalendar from './PnlCalendar'

interface Props {
  trades: EnrichedTrade[]
  onSelectDay: (day: string) => void
}

export default function CalendarScreen({ trades, onSelectDay }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <PnlCalendar trades={trades} onSelectDay={onSelectDay} />
      {/* 凡例と使い方は1行にまとめて、1か月ぶんが画面に収まるようにする */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink2">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-up/25 bg-up-soft" />
          プラスの日
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-down/25 bg-down-soft" />
          マイナスの日
        </span>
        <span className="text-ink3">色のついた日を押すと、その日の取引と振り返りを開けます</span>
      </div>
    </div>
  )
}
