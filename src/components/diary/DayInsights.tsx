import type { EnrichedTrade } from '../../lib/types'
import { dayInsights } from '../../lib/dayInsights'
import Icon from '../Icon'

interface Props {
  trades: EnrichedTrade[]
  note?: string | null
  onDetail: () => void
}

/**
 * その日の記録から読み取れること。
 *
 * 見た目は「まとめ」だが、中身は決まった条件で並べているだけ。
 * 外部のAIには何も送っていないので、そう名乗らない。
 */
export default function DayInsights({ trades, note, onDetail }: Props) {
  const items = dayInsights(trades, note)
  if (items.length === 0) return null

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon name="bulb" size={14} />
        </span>
        <h2 className="text-base font-bold">この日からわかること</h2>
        <span className="ml-auto rounded-md bg-sunken px-2 py-0.5 text-[10px] font-semibold text-ink2">
          記録から自動で作成
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                i.tone === 'good'
                  ? 'bg-up-soft text-up'
                  : i.tone === 'warn'
                    ? 'bg-amber-soft text-amber'
                    : 'bg-sunken text-ink3'
              }`}
            >
              <Icon name={i.tone === 'good' ? 'check' : 'info'} size={12} />
            </span>
            <span className="text-sm leading-relaxed text-ink2">{i.text}</span>
          </li>
        ))}
      </ul>

      <button className="btn btn-quiet mt-3.5 w-full justify-center" onClick={onDetail}>
        分析で詳しく見る
        <Icon name="right" size={15} />
      </button>
    </section>
  )
}
