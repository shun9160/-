import { useMemo, useState } from 'react'
import type { Account, EnrichedTrade } from '../lib/types'
import { comparePeriods, compareWithYesterday, summarize } from '../lib/analytics'
import { jstDayKey } from '../lib/timezone'
import CapitalCard from './CapitalCard'
import Icon from './Icon'
import { EmptyState, SegmentedControl } from './ui'
import TodayCard from './home/TodayCard'
import AssetSummary from './home/AssetSummary'
import StatTiles from './home/StatTiles'
import InsightCard from './home/InsightCard'
import PnlSection from './home/PnlSection'
import StyleCard from './home/StyleCard'
import RecentTrades from './home/RecentTrades'
import GrowthSteps from './home/GrowthSteps'

interface Props {
  trades: EnrichedTrade[]
  /** 表示中の口座。「すべて」なら null */
  account: Account | null
  accounts: Account[]
  onShowAll: () => void
  onAdd: () => void
  onStats: () => void
  onDiary: () => void
  onOpenDay: (day: string) => void
  onChanged: () => void
  readOnly?: boolean
}

type RangeKey = '7' | '30' | '90' | '0'

const RANGES: { value: RangeKey; label: string }[] = [
  { value: '7', label: '7日' },
  { value: '30', label: '30日' },
  { value: '90', label: '90日' },
  { value: '0', label: '全期間' },
]

export default function Home({
  trades,
  account,
  accounts,
  onShowAll,
  onAdd,
  onStats,
  onDiary,
  onOpenDay,
  onChanged,
  readOnly,
}: Props) {
  const [range, setRange] = useState<RangeKey>('30')
  /** 原資の編集を開いているか */
  const [editingCapital, setEditingCapital] = useState(false)
  const days = Number(range)

  const cmp = useMemo(() => comparePeriods(trades, days), [trades, days])
  const ranged = days > 0 ? cmp.current : trades
  const sum = useMemo(() => summarize(ranged), [ranged])
  const all = useMemo(() => summarize(trades), [trades])

  const todayKey = jstDayKey(new Date())
  const yesterdayKey = jstDayKey(new Date(Date.now() - 86400_000))
  const today = useMemo(
    () => compareWithYesterday(trades, todayKey, yesterdayKey),
    [trades, todayKey, yesterdayKey],
  )

  const recent = useMemo(
    () => [...trades].sort((a, b) => b.openJst.getTime() - a.openJst.getTime()).slice(0, 5),
    [trades],
  )

  const rangeLabel = days > 0 ? `直近${days}日` : '全期間'

  if (trades.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <AssetSummary
          account={account}
          accounts={accounts}
          netTotal={0}
          onEditCapital={() => setEditingCapital(true)}
          readOnly={readOnly}
        />
        {editingCapital && (
          <CapitalCard
            account={account}
            accounts={accounts}
            netTotal={0}
            onChanged={() => {
              setEditingCapital(false)
              onChanged()
            }}
            readOnly={readOnly}
            startEditing
            onClose={() => setEditingCapital(false)}
          />
        )}
        <EmptyState
          icon="upload"
          title="まだ取引がありません"
          body="MT5のレポートを読み込むか、スクリーンショットから1件ずつ記録できます。"
          action={
            <button className="btn btn-primary" onClick={onAdd}>
              <Icon name="plus" size={17} />
              最初の取引を記録する
            </button>
          }
        />
      </div>
    )
  }

  return (
    // 広い画面では2列。左に「いまの状態」、右に「中身の確認」を並べる。
    <div className="flex flex-col gap-4 xl:grid xl:grid-cols-2 xl:items-start">
      {/* --- 左: いまどうなっているか ---------------------------- */}
      <div className="flex flex-col gap-4">
        <TodayCard today={today} netTotal={all.netTotal} onSeeDetail={() => onOpenDay(todayKey)} />

        <AssetSummary
          account={account}
          accounts={accounts}
          netTotal={all.netTotal}
          onEditCapital={() => setEditingCapital(true)}
          readOnly={readOnly}
        />

        {editingCapital && (
          <CapitalCard
            account={account}
            accounts={accounts}
            netTotal={all.netTotal}
            onChanged={() => {
              setEditingCapital(false)
              onChanged()
            }}
            readOnly={readOnly}
            startEditing
            onClose={() => setEditingCapital(false)}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl value={range} onChange={setRange} options={RANGES} />
          <button className="btn btn-quiet" onClick={onAdd}>
            <Icon name="plus" size={16} />
            取引を記録
          </button>
        </div>

        <StatTiles trades={ranged} sum={sum} />

        <InsightCard trades={ranged} sum={sum} onSeeStats={onStats} />

        <PnlSection trades={ranged} netTotal={sum.netTotal} rangeLabel={rangeLabel} />
      </div>

      {/* --- 右: 中身をたしかめる -------------------------------- */}
      <div className="flex flex-col gap-4">
        <StyleCard trades={ranged} sum={sum} rangeLabel={rangeLabel} />

        <RecentTrades
          recent={recent}
          total={trades.length}
          onShowAll={onShowAll}
          onOpenDay={onOpenDay}
        />

        <GrowthSteps onRecord={onAdd} onStats={onStats} onDiary={onDiary} />
      </div>
    </div>
  )
}
