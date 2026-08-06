import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { comparePeriods, summarize } from '../lib/analytics'
import Icon from './Icon'
import type { IconName } from './Icon'
import { EmptyState } from './ui'
import SummaryTab from './stats/SummaryTab'
import TimeTab from './stats/TimeTab'
import PatternTab from './stats/PatternTab'
import DetailTab from './stats/DetailTab'
import ImproveTab from './stats/ImproveTab'

interface Props {
  trades: EnrichedTrade[]
  onDiary: () => void
}

type TabKey = 'summary' | 'time' | 'pattern' | 'detail' | 'improve'
type RangeKey = '7' | '30' | '90' | '0'

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'summary', label: 'サマリー', icon: 'chart' },
  { key: 'time', label: '時間帯', icon: 'clock' },
  { key: 'pattern', label: '傾向', icon: 'target' },
  { key: 'detail', label: '詳細', icon: 'book' },
  { key: 'improve', label: '改善', icon: 'rocket' },
]

const RANGES: { value: RangeKey; label: string }[] = [
  { value: '7', label: '7日' },
  { value: '30', label: '30日' },
  { value: '90', label: '90日' },
  { value: '0', label: '全期間' },
]

/**
 * 分析。
 *
 * 全部を縦に並べると延々とスクロールすることになるので、
 * 「何を知りたいか」で5つに分け、1つずつ見られるようにする。
 */
export default function StatsPanel({ trades, onDiary }: Props) {
  const [tab, setTab] = useState<TabKey>('summary')
  const [range, setRange] = useState<RangeKey>('30')
  const days = Number(range)

  const ranged = useMemo(
    () => (days > 0 ? comparePeriods(trades, days).current : trades),
    [trades, days],
  )
  const sum = useMemo(() => summarize(ranged), [ranged])
  const rangeLabel = days > 0 ? `直近${days}日` : '全期間'

  if (trades.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="まだ分析できません"
        body="取引を記録すると、勝ちやすい時間帯や、決めた通りにやれているかが見えてきます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 何を見るか */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
        {TABS.map((t) => {
          const on = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={on}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                on
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line bg-surface text-ink2 hover:bg-sunken'
              }`}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* いつのぶんを見るか */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink2">
          期間
          <select
            className="input w-auto px-2 py-1 text-xs"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-ink3">{ranged.length}件</span>
      </div>

      {tab === 'summary' && (
        <SummaryTab
          trades={ranged}
          sum={sum}
          rangeLabel={rangeLabel}
          onSeeDetail={() => setTab('detail')}
        />
      )}
      {tab === 'time' && <TimeTab trades={ranged} />}
      {tab === 'pattern' && <PatternTab trades={ranged} />}
      {tab === 'detail' && <DetailTab trades={ranged} sum={sum} rangeLabel={rangeLabel} />}
      {tab === 'improve' && <ImproveTab trades={ranged} sum={sum} onDiary={onDiary} />}
    </div>
  )
}
