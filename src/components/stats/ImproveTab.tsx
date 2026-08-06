import { useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import type { Summary } from '../../lib/analytics'
import { suggestActions } from '../../lib/analytics'
import { BRAND } from '../../lib/brand'
import Icon from '../Icon'
import { Empty } from './parts'

interface Props {
  trades: EnrichedTrade[]
  sum: Summary
  onDiary: () => void
}

/**
 * 次にやることの候補。
 * 記録から見つかったものだけを出し、なぜそう言えるかを必ず添える。
 */
export default function ImproveTab({ trades, sum, onDiary }: Props) {
  const items = suggestActions(trades, sum)
  const [done, setDone] = useState<Record<string, boolean>>({})

  if (trades.length === 0) return <Empty text="取引がありません" />

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4">
        <h2 className="text-base font-bold">今日からできること</h2>
        <p className="mt-0.5 text-xs text-ink2">記録から見つかったものだけを出しています。</p>

        {items.length === 0 ? (
          <p className="mt-4 rounded-xl bg-up-soft px-3 py-3 text-sm text-up">
            いまのところ、直したほうがよい点は見つかりませんでした。この調子で記録を続けてください。
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((a) => (
              <li key={a.key}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-sunken">
                  <input
                    type="checkbox"
                    checked={Boolean(done[a.key])}
                    onChange={(e) => setDone((d) => ({ ...d, [a.key]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-bold ${
                        done[a.key] ? 'text-ink3 line-through' : 'text-ink'
                      }`}
                    >
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink2">{a.why}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[11px] text-ink3">
          チェックはこの画面を開いている間だけ残ります。決めたことは日記に書いておくと残ります。
        </p>
        <button className="btn btn-quiet mt-2" onClick={onDiary}>
          <Icon name="book" size={16} />
          日記に書く
        </button>
      </section>

      <section className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-soft/70 to-surface p-5 shadow-card">
        <h2 className="text-lg font-bold leading-snug">
          記録は、
          <br />
          あなたを強くする
        </h2>
        <p className="mt-2 text-sm text-ink2">
          データから見つかる小さな優位性が、大きな差を生みます。
        </p>
        <p className="mt-3 text-xs text-ink3">{BRAND.tagline}</p>
      </section>
    </div>
  )
}
