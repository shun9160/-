import type { EnrichedTrade } from '../../lib/types'
import { dayInsights } from '../../lib/dayInsights'
import Icon from '../Icon'

interface Props {
  trades: EnrichedTrade[]
  note?: string | null
}

/**
 * その日の記録から読み取れること。
 *
 * 数字と同じで、ここも人が書くところではない。決まった条件で
 * 並べているだけで、外部のAIには何も送っていないので、そう名乗らない。
 *
 * 振り返りを書く直前に置いている。まっさらな気持ちで
 * 「今日はどうだった？」と聞かれるより、事実をひとつ見てからのほうが
 * 書き出しやすいため。
 */
export default function DayInsights({ trades, note }: Props) {
  const items = dayInsights(trades, note)
  if (items.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-ink2">
        <Icon name="bulb" size={14} />
        この日からわかること
        <span className="ml-1 rounded-md bg-sunken px-1.5 text-[10px] font-semibold text-ink3">
          記録から自動
        </span>
      </h2>

      <ul className="mt-2.5 flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-start gap-2.5">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                i.tone === 'good' ? 'bg-up' : i.tone === 'warn' ? 'bg-amber' : 'bg-ink3'
              }`}
            />
            <span className="text-[15px] leading-[1.9] text-ink2">{i.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
