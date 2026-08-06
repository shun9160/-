import { useMemo, useState } from 'react'
import type { Account, EnrichedTrade } from '../lib/types'
import { comparePeriods, netOf, summarize } from '../lib/analytics'
import { jstDayKey } from '../lib/timezone'
import { currencyLabel } from '../lib/appConfig'
import { colorOf, fmtMoney, fmtNum, fmtPct } from '../lib/format'
import CapitalCard from './CapitalCard'
import PnlCharts from './PnlCharts'
import TradesTable from './TradesTable'
import Icon from './Icon'
import { Delta, EmptyState, SectionHeader, SegmentedControl, StatCard } from './ui'

interface Props {
  trades: EnrichedTrade[]
  /** 表示中の口座。「すべて」なら null */
  account: Account | null
  accounts: Account[]
  onShowAll: () => void
  onAdd: () => void
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
  trades, account, accounts, onShowAll, onAdd, onChanged, readOnly,
}: Props) {
  const [range, setRange] = useState<RangeKey>('30')
  const [chart, setChart] = useState<'cumulative' | 'daily'>('cumulative')
  const days = Number(range)

  const cmp = useMemo(() => comparePeriods(trades, days), [trades, days])
  const ranged = days > 0 ? cmp.current : trades
  const sum = useMemo(() => summarize(ranged), [ranged])
  const all = useMemo(() => summarize(trades), [trades])

  const todayKey = jstDayKey(new Date())
  const todayNet = useMemo(
    () => netOf(trades.filter((t) => t.jstDay === todayKey)),
    [trades, todayKey],
  )

  const recent = useMemo(
    () => [...trades].sort((a, b) => b.openJst.getTime() - a.openJst.getTime()).slice(0, 5),
    [trades],
  )

  const netDelta = cmp.ratioOf(netOf)
  const countDelta = cmp.ratioOf((t) => t.length)
  const winDelta = cmp.ratioOf((t) =>
    t.length ? t.filter((x) => x.win).length / t.length : 0,
  )
  const rangeLabel = days > 0 ? `直近${days}日` : '全期間'

  if (trades.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <CapitalCard
          account={account}
          accounts={accounts}
          netTotal={0}
          onChanged={onChanged}
          readOnly={readOnly}
        />
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
    // 画面幅にかかわらず、口座の残高を一番上に置く。
    // 広い画面では、その下を2列（グラフ／内訳）に分ける。
    <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[1.6fr_1fr] xl:items-start">
      {/* 残高と原資 — 最初に見たい数字 */}
      <div className="order-1 xl:order-none xl:col-span-2 xl:row-start-1">
        <CapitalCard
          account={account}
          accounts={accounts}
          netTotal={all.netTotal}
          onChanged={onChanged}
          readOnly={readOnly}
        />
      </div>

      {/* 期間の切り替え */}
      <div className="order-2 flex flex-wrap items-center justify-between gap-3 xl:order-none xl:col-span-2 xl:row-start-2">
        <SegmentedControl value={range} onChange={setRange} options={RANGES} />
        <button className="btn btn-quiet" onClick={onAdd}>
          <Icon name="plus" size={16} />
          取引を記録
        </button>
      </div>

      {/* 主要な数値 */}
      <div className="order-3 grid grid-cols-2 gap-3 xl:order-none xl:col-span-2 xl:row-start-3 xl:grid-cols-4">
        <StatCard
          icon="chart"
          label={`${rangeLabel}の損益`}
          value={fmtMoney(sum.netTotal, { sign: true })}
          unit={currencyLabel()}
          valueClass={colorOf(sum.netTotal)}
          delta={days > 0 ? <Delta ratio={netDelta} /> : undefined}
          hint="手数料・スワップ込み"
        />
        <StatCard
          icon="check"
          label="勝率"
          value={fmtPct(sum.winRate)}
          delta={days > 0 ? <Delta ratio={winDelta} /> : undefined}
          hint={`${sum.wins}勝 ${sum.losses}敗`}
        />
        <StatCard
          icon="book"
          label="取引数"
          value={`${sum.count}`}
          unit="件"
          delta={days > 0 ? <Delta ratio={countDelta} /> : undefined}
        />
        <StatCard
          icon="home"
          label="今日の損益"
          value={fmtMoney(todayNet, { sign: true })}
          unit={currencyLabel()}
          valueClass={colorOf(todayNet)}
          hint={`累計 ${fmtMoney(all.netTotal, { sign: true })}`}
        />
      </div>

      {/* 損益の推移 */}
      <section className="order-4 card p-5 xl:order-none xl:col-start-1 xl:row-start-4 xl:row-span-2">
          <SectionHeader
            title="損益の推移"
            sub={rangeLabel}
            actions={
              <SegmentedControl
                size="sm"
                value={chart}
                onChange={setChart}
                options={[
                  { value: 'cumulative', label: '累積' },
                  { value: 'daily', label: '日別' },
                ]}
              />
            }
          />
          <p className={`text-2xl font-bold tabular-nums ${colorOf(sum.netTotal)}`}>
            {fmtMoney(sum.netTotal, { sign: true })}
            <span className="ml-1 text-sm font-semibold text-ink3">{currencyLabel()}</span>
          </p>
          {days > 0 && (
            <div className="mt-1">
              <Delta ratio={netDelta} />
            </div>
          )}
          <div className="mt-4">
            <PnlCharts trades={ranged} kind={chart} />
          </div>
      </section>

      {/* 平均のすがた */}
      <section className="order-5 card p-5 xl:order-none xl:col-start-2 xl:row-start-4 xl:self-start">
        <SectionHeader title="平均のすがた" sub={rangeLabel} />
        <dl className="flex flex-col gap-3">
          <Row label="平均ロット" value={fmtNum(sum.avgVolume, 2)} />
          <Row
            label="損益比"
            value={
              sum.profitFactor == null
                ? '—'
                : sum.profitFactor === Infinity
                  ? '∞'
                  : fmtNum(sum.profitFactor)
            }
          />
          <Row
            label="実際の損益倍率"
            value={sum.avgRMultiple != null ? `${fmtNum(sum.avgRMultiple)} R` : '—'}
            cls={sum.avgRMultiple != null ? colorOf(sum.avgRMultiple) : undefined}
          />
          <Row label="TPまで届いた割合" value={fmtPct(sum.tpHitRate)} />
        </dl>
      </section>

      {/* 最近の取引 */}
      <section className="order-6 xl:order-none xl:col-span-2 xl:row-start-6">
        <SectionHeader
          title="最近の取引"
          sub={`全${trades.length}件のうち直近${recent.length}件`}
          actions={
            <button className="btn btn-quiet" onClick={onShowAll}>
              すべて見る
              <Icon name="right" size={15} />
            </button>
          }
        />
        <TradesTable trades={recent} onChanged={onChanged} readOnly compact />
      </section>
    </div>
  )
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-ink2">{label}</dt>
      <dd className={`text-base font-bold tabular-nums ${cls ?? 'text-ink'}`}>{value}</dd>
    </div>
  )
}
