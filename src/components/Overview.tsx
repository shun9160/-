import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { summarize } from '../lib/analytics'
import { jstDayKey } from '../lib/timezone'
import { colorOf, fmtMoney, fmtPct } from '../lib/format'
import PnlCalendar from './PnlCalendar'
import PnlCharts from './PnlCharts'

interface Props {
  trades: EnrichedTrade[]
  onSelectDay?: (day: string) => void
}

type PnlTab = 'daily' | 'cumulative' | 'equity'
type RangeKey = 7 | 30 | 90 | 0 // 0 = 全期間

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 7, label: '直近7日' },
  { key: 30, label: '直近30日' },
  { key: 90, label: '直近90日' },
  { key: 0, label: '全期間' },
]

function withinDays(trades: EnrichedTrade[], days: number): EnrichedTrade[] {
  if (days <= 0) return trades
  const cutoff = Date.now() - days * 86400_000
  return trades.filter((t) => t.openJst.getTime() >= cutoff)
}

export default function Overview({ trades, onSelectDay }: Props) {
  const [tab, setTab] = useState<PnlTab>('daily')
  const [range, setRange] = useState<RangeKey>(90)
  const [dailyView, setDailyView] = useState<'calendar' | 'bar'>('calendar')
  const [startBalance, setStartBalance] = useState<number>(() => {
    const v = localStorage.getItem('fxjournal.startBalance')
    return v ? Number(v) : 0
  })

  const all = useMemo(() => summarize(trades), [trades])
  const todayKey = jstDayKey(new Date())

  const todayNet = useMemo(
    () => trades.filter((t) => t.jstDay === todayKey).reduce((s, t) => s + t.netProfit, 0),
    [trades, todayKey],
  )
  const net7 = useMemo(
    () => withinDays(trades, 7).reduce((s, t) => s + t.netProfit, 0),
    [trades],
  )
  const rangeTrades = useMemo(() => withinDays(trades, range), [trades, range])
  const rangeSum = useMemo(() => summarize(rangeTrades), [rangeTrades])

  const equity = all.netTotal + startBalance

  function saveStartBalance(v: number) {
    setStartBalance(v)
    localStorage.setItem('fxjournal.startBalance', String(v))
  }

  return (
    <div className="space-y-4">
      {/* ===== ヒーロー: 口座状況 ===== */}
      <div className="card p-6">
        <div className="text-center">
          <div className="text-sm text-gray-400">
            {startBalance > 0 ? '推定口座残高 (開始残高 + 純損益)' : '累計純損益 (手数料込)'}
          </div>
          <div className="mt-1 text-4xl font-bold tracking-tight">
            {startBalance > 0 ? fmtMoney(equity) : fmtMoney(all.netTotal, { sign: true })}
            <span className="ml-2 text-base font-medium text-gray-500">JPY</span>
          </div>
        </div>

        <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-500">本日のPNL</div>
            <div className={`mt-0.5 text-xl font-bold ${colorOf(todayNet)}`}>
              {fmtMoney(todayNet, { sign: true })}
            </div>
          </div>
          <div className="border-l border-border text-center">
            <div className="text-xs text-gray-500">7日間のPNL</div>
            <div className={`mt-0.5 text-xl font-bold ${colorOf(net7)}`}>
              {fmtMoney(net7, { sign: true })}
            </div>
          </div>
        </div>
      </div>

      {/* ===== PNL セクション ===== */}
      <div className="card p-5">
        {/* タブ */}
        <div className="flex gap-6 border-b border-border">
          {(
            [
              ['daily', '日別PNL'],
              ['cumulative', '累積PNL'],
              ['equity', '残高推移'],
            ] as [PnlTab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition-colors ${
                tab === k ? 'border-accent text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* レンジ選択 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`chip ${range === r.key ? 'chip-on' : 'chip-off'}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* レンジ集計サマリ */}
        <div className="mt-3 rounded-xl bg-panel-2 px-4 py-3">
          <span className="text-sm text-gray-400">
            {RANGES.find((r) => r.key === range)?.label} PNL:{' '}
          </span>
          <span className={`text-base font-bold ${colorOf(rangeSum.netTotal)}`}>
            {fmtMoney(rangeSum.netTotal, { sign: true })} JPY
          </span>
          <span className="ml-2 text-sm text-gray-500">
            ({rangeSum.count}件 / 勝率 {fmtPct(rangeSum.winRate)})
          </span>
        </div>

        {/* 日別のみカレンダー/バー切替 */}
        {tab === 'daily' && (
          <div className="mt-4 flex justify-end gap-2">
            <button
              className={`chip text-xs ${dailyView === 'calendar' ? 'chip-on' : 'chip-off'}`}
              onClick={() => setDailyView('calendar')}
            >
              🗓 カレンダー
            </button>
            <button
              className={`chip text-xs ${dailyView === 'bar' ? 'chip-on' : 'chip-off'}`}
              onClick={() => setDailyView('bar')}
            >
              ⁝⁝ バー
            </button>
          </div>
        )}

        {/* 本体 */}
        <div className="mt-4">
          {tab === 'daily' &&
            (dailyView === 'calendar' ? (
              <PnlCalendar trades={rangeTrades} onSelectDay={onSelectDay} />
            ) : (
              <PnlCharts trades={rangeTrades} kind="daily" />
            ))}
          {tab === 'cumulative' && <PnlCharts trades={rangeTrades} kind="cumulative" />}
          {tab === 'equity' && (
            <div>
              <label className="mb-3 flex items-center gap-2 text-xs text-gray-400">
                開始残高:
                <input
                  type="number"
                  className="w-32 rounded-lg border border-border bg-panel-2 px-2 py-1 text-sm text-gray-100 outline-none focus:border-accent"
                  value={startBalance || ''}
                  placeholder="0"
                  onChange={(e) => saveStartBalance(Number(e.target.value) || 0)}
                />
                <span className="text-gray-600">を基準に残高推移を描画</span>
              </label>
              <PnlCharts trades={rangeTrades} kind="equity" startBalance={startBalance} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
