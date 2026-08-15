import { useEffect, useMemo, useState } from 'react'
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
import DiagnosisPanel from './diagnosis/DiagnosisPanel'

export type StatsTabKey = 'summary' | 'time' | 'pattern' | 'detail' | 'improve' | 'type'

interface Props {
  trades: EnrichedTrade[]
  /** いま選んでいる口座。すべての口座なら null */
  accountId?: string | null
  /** ほかの画面から特定のタブを開かせたいとき。n を変えるたびに切り替わる */
  focusTab?: { tab: StatsTabKey; n: number } | null
  /** いま開いているタブ。横に振って移れるよう、外へ伝える */
  onTabChange?: (t: StatsTabKey) => void
  onDiary: () => void
}

type TabKey = StatsTabKey
type RangeKey = '7' | '30' | '90' | '0'

/** 横に振ったときに移る順番。画面に並んでいる順と同じにする */
export const STATS_TABS: StatsTabKey[] = ['summary', 'time', 'pattern', 'detail', 'improve', 'type']

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'summary', label: 'サマリー', icon: 'chart' },
  { key: 'time', label: '時間帯', icon: 'clock' },
  { key: 'pattern', label: '傾向', icon: 'target' },
  { key: 'detail', label: '詳細', icon: 'book' },
  { key: 'improve', label: '改善', icon: 'rocket' },
  { key: 'type', label: 'タイプ診断', icon: 'sparkle' },
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
export default function StatsPanel({ trades, accountId = null, focusTab, onTabChange, onDiary }: Props) {
  const [tab, setTab] = useState<TabKey>(focusTab?.tab ?? 'summary')
  const [range, setRange] = useState<RangeKey>('30')
  const days = Number(range)

  // 日記から「タイプ詳細を見る」で来たときに、そのタブを開く
  const focusN = focusTab?.n
  const focusKey = focusTab?.tab
  useEffect(() => {
    if (focusN != null && focusKey) setTab(focusKey)
  }, [focusN, focusKey])

  // 横に振ってタブを移れるよう、いまのタブを外へ知らせる
  useEffect(() => {
    onTabChange?.(tab)
  }, [tab, onTabChange])

  const ranged = useMemo(
    () => (days > 0 ? comparePeriods(trades, days).current : trades),
    [trades, days],
  )
  const sum = useMemo(() => summarize(ranged), [ranged])
  const rangeLabel = days > 0 ? `直近${days}日` : '全期間'

  // タイプ診断は取引が無くても受けられるので、空の案内は他のタブだけに出す
  if (trades.length === 0 && tab !== 'type') {
    return (
      <div className="flex flex-col gap-4">
        <TabRow tab={tab} onChange={setTab} />
        <EmptyState
          icon="chart"
          title="まだ分析できません"
          body="取引を記録すると、勝ちやすい時間帯や、決めた通りにやれているかが見えてきます。タイプ診断は取引がなくても受けられます。"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 何を見るか */}
      <TabRow tab={tab} onChange={setTab} />

      {/* いつのぶんを見るか（診断は期間で区切らない） */}
      {tab !== 'type' && (
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
      )}

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
      {tab === 'type' && <DiagnosisPanel accountId={accountId} />}
    </div>
  )
}

function TabRow({ tab, onChange }: { tab: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
      {TABS.map((t) => {
        const on = tab === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            aria-pressed={on}
            // 選んだものは濃色。カレンダーの日別/月別、下のタブと同じ決まりにして、
            // 「いま選ばれているもの＝濃い面」を全画面で共通にする
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              on ? 'bg-night text-white' : 'text-ink2 hover:bg-sunken hover:text-ink'
            }`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
