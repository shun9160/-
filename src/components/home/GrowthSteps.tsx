import Icon from '../Icon'
import type { IconName } from '../Icon'

interface Props {
  onRecord: () => void
  onStats: () => void
  onDiary: () => void
}

const STEPS: { icon: IconName; title: string; body: string; key: 'record' | 'stats' | 'diary' }[] = [
  { key: 'record', icon: 'book', title: '記録する', body: '取引とチャートを残す' },
  { key: 'stats', icon: 'chart', title: '分析する', body: '強みと課題を数字で見る' },
  { key: 'diary', icon: 'rocket', title: '改善する', body: '振り返りを次の取引へ' },
]

/** 使い方の流れ。押すとその画面へ行ける。 */
export default function GrowthSteps({ onRecord, onStats, onDiary }: Props) {
  const go = { record: onRecord, stats: onStats, diary: onDiary }
  return (
    <section className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-soft/50 to-surface p-5 shadow-card">
      <h2 className="text-base font-bold">記録を続けて、もっと成長しよう</h2>
      <p className="mt-0.5 text-sm text-ink2">続けることで、あなたの優位性が見えてきます。</p>

      <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <button
              onClick={go[s.key]}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-line bg-surface px-3 py-4 text-center transition-colors hover:border-brand hover:bg-sunken"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon name={s.icon} size={18} />
              </span>
              <span className="mt-1 text-sm font-bold text-ink">{s.title}</span>
              <span className="text-[11px] leading-tight text-ink2">{s.body}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="hidden shrink-0 text-ink3 sm:block">
                <Icon name="right" size={16} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
