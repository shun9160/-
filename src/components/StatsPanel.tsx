import { useMemo } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { hourBreakdown, sessionBreakdown, summarize } from '../lib/analytics'
import { SESSION_LABELS } from '../lib/timezone'
import { currencyLabel } from '../lib/appConfig'
import { colorOf, fmtMoney, fmtNum, fmtPct, fmtRR } from '../lib/format'
import { EmptyState, Pill, SectionHeader, StatCard } from './ui'

interface Props {
  trades: EnrichedTrade[]
}

export default function StatsPanel({ trades }: Props) {
  const s = useMemo(() => summarize(trades), [trades])
  const sessions = useMemo(() => sessionBreakdown(trades), [trades])
  const hours = useMemo(() => hourBreakdown(trades), [trades])
  const maxAbs = Math.max(1, ...hours.map((h) => Math.abs(h.net)))

  if (trades.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="分析するデータがありません"
        body="取引を記録すると、ここに勝ちパターンが見えてきます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 成績の要約 */}
      <section>
        <SectionHeader title="成績" sub="手数料・スワップを含めた実質の数字です" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            icon="chart"
            label="純損益"
            value={fmtMoney(s.netTotal, { sign: true })}
            unit={currencyLabel()}
            valueClass={colorOf(s.netTotal)}
            hint={`手数料 ${fmtMoney(s.commissionTotal)} ${currencyLabel()}`}
          />
          <StatCard
            icon="check"
            label="勝率"
            value={fmtPct(s.winRate)}
            hint={`${s.wins}勝 ${s.losses}敗`}
          />
          <StatCard
            icon="book"
            label="損益比"
            value={
              s.profitFactor == null ? '—' : s.profitFactor === Infinity ? '∞' : fmtNum(s.profitFactor)
            }
            hint="勝ち合計 ÷ 負け合計"
          />
          <StatCard
            icon="home"
            label="平均ロット"
            value={fmtNum(s.avgVolume, 2)}
            hint={`合計 ${fmtNum(s.totalVolume, 2)}`}
          />
        </div>
      </section>

      {/* 損切り・利確 */}
      <section>
        <SectionHeader title="損切りと利確" sub="SL・TPを記録した取引だけが対象です" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            icon="calendar"
            label="計画リスクリワード"
            value={fmtRR(s.avgPlannedRR)}
            hint="狙った利益 ÷ 許容損失"
          />
          <StatCard
            icon="chart"
            label="実際の損益倍率"
            value={s.avgRMultiple != null ? `${fmtNum(s.avgRMultiple)} R` : '—'}
            valueClass={s.avgRMultiple != null ? colorOf(s.avgRMultiple) : undefined}
            hint="1回のリスクの何倍取れたか"
          />
          <StatCard
            icon="check"
            label="TPまで届いた割合"
            value={fmtPct(s.tpHitRate)}
            hint="計画通り利確できた率"
          />
          <StatCard
            icon="upload"
            label="狙いの何%取れたか"
            value={fmtPct(s.avgCapturedRatio)}
            valueClass={s.avgCapturedRatio != null ? colorOf(s.avgCapturedRatio) : undefined}
            hint="TPまでの値幅に対する実績"
          />
        </div>
      </section>

      {/* 時間帯 */}
      {sessions.length > 0 && (
        <section>
          <SectionHeader title="時間帯別の相性" sub="日本時間で集計しています" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {sessions.map((ss) => (
              <div key={ss.key} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-ink2">{SESSION_LABELS[ss.key]}</p>
                  <Pill tone={ss.net >= 0 ? 'up' : 'down'}>{ss.net >= 0 ? '勝ち越し' : '負け越し'}</Pill>
                </div>
                <p className={`mt-2 text-xl font-bold tabular-nums ${colorOf(ss.net)}`}>
                  {fmtMoney(ss.net, { sign: true })}
                </p>
                <p className="mt-0.5 text-xs text-ink3">
                  {ss.count}件 ・ 勝率 {fmtPct(ss.winRate)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 時刻別 */}
      {hours.length > 0 && (
        <section>
          <SectionHeader
            title="何時に勝てているか"
            sub="エントリー時刻（日本時間）ごとの合計損益"
          />
          <div className="card divide-y divide-line px-2 py-1">
            {hours.map((h) => {
              const w = (Math.abs(h.net) / maxAbs) * 100
              const pos = h.net >= 0
              return (
                <div key={h.hour} className="flex items-center gap-3 px-2 py-2">
                  <span className="w-9 shrink-0 text-xs font-semibold tabular-nums text-ink2">
                    {h.hour}時
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div
                      className={`h-full rounded-full ${pos ? 'bg-up' : 'bg-down'}`}
                      style={{ width: `${Math.max(w, 3)}%` }}
                    />
                  </div>
                  <span
                    className={`w-20 shrink-0 text-right text-xs font-bold tabular-nums ${colorOf(h.net)}`}
                  >
                    {fmtMoney(h.net, { sign: true })}
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs text-ink3">{h.count}件</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
