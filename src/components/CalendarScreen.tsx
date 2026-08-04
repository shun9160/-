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
      <div className="flex items-center justify-center gap-4 text-xs text-ink2">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-up/25 bg-up-soft" />
          プラスの日
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-down/25 bg-down-soft" />
          マイナスの日
        </span>
      </div>
      <p className="text-center text-xs text-ink3">
        色のついた日付をタップすると、その日の取引と振り返りを開けます
      </p>
    </div>
  )
}
