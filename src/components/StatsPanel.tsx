import { useMemo } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { hourBreakdown, sessionBreakdown, summarize } from '../lib/analytics'
import { SESSION_LABELS } from '../lib/timezone'
import { colorOf, fmtMoney, fmtNum, fmtPct, fmtRR } from '../lib/format'

interface Props {
  trades: EnrichedTrade[]
}

function Stat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${valueClass ?? ''}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

export default function StatsPanel({ trades }: Props) {
  const s = useMemo(() => summarize(trades), [trades])
  const sessions = useMemo(() => sessionBreakdown(trades), [trades])
  const hours = useMemo(() => hourBreakdown(trades), [trades])
  const maxHourAbs = Math.max(1, ...hours.map((h) => Math.abs(h.net)))

  return (
    <div className="space-y-4">
      {/* リスクリワード & 利確系 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-300">リスクリワード・利確分析</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="計画RR比 (平均)" value={fmtRR(s.avgPlannedRR)} sub="|TP−建値| ÷ |建値−SL|" />
          <Stat
            label="実現Rマルチプル (平均)"
            value={s.avgRMultiple != null ? `${fmtNum(s.avgRMultiple)} R` : '—'}
            valueClass={s.avgRMultiple != null ? colorOf(s.avgRMultiple) : ''}
            sub="実現値幅 ÷ リスク幅"
          />
          <Stat
            label="TP到達で利確した比率"
            value={fmtPct(s.tpHitRate)}
            sub="TP設定トレード中"
          />
          <Stat
            label="TP目標の獲得率 (平均)"
            value={fmtPct(s.avgCapturedRatio)}
            valueClass={s.avgCapturedRatio != null ? colorOf(s.avgCapturedRatio) : ''}
            sub="実現値幅 ÷ TPまでの値幅"
          />
        </div>
      </div>

      {/* 損益・勝率・ロット */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-300">損益・勝率・ロット</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="純損益 (手数料込)"
            value={fmtMoney(s.netTotal, { sign: true })}
            valueClass={colorOf(s.netTotal)}
            sub={`グロス ${fmtMoney(s.grossTotal, { sign: true })} / 手数料 ${fmtMoney(
              s.commissionTotal,
            )}`}
          />
          <Stat
            label="勝率"
            value={fmtPct(s.winRate)}
            sub={`${s.wins}勝 ${s.losses}敗 / ${s.count}件`}
          />
          <Stat
            label="プロフィットファクター"
            value={s.profitFactor == null ? '—' : s.profitFactor === Infinity ? '∞' : fmtNum(s.profitFactor)}
            sub="総利益 ÷ 総損失"
          />
          <Stat
            label="ロット"
            value={fmtNum(s.avgVolume, 2)}
            sub={`平均 / 合計 ${fmtNum(s.totalVolume, 2)}`}
          />
        </div>
      </div>

      {/* 時間帯セッション (日本時間) */}
      {sessions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-300">
            時間帯セッション別 <span className="text-xs font-normal text-gray-500">(日本時間)</span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {sessions.map((ss) => (
              <div key={ss.key} className="card p-4">
                <div className="text-xs text-gray-400">{SESSION_LABELS[ss.key]}</div>
                <div className={`mt-1 text-lg font-bold ${colorOf(ss.net)}`}>
                  {fmtMoney(ss.net, { sign: true })}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {ss.count}件 / 勝率 {fmtPct(ss.winRate)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 時間帯別バー (日本時間 0-23時) */}
      {hours.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-300">
            時間帯別損益 <span className="text-xs font-normal text-gray-500">(日本時間 0〜23時)</span>
          </h3>
          <div className="card space-y-1.5 p-4">
            {hours.map((h) => {
              const w = (Math.abs(h.net) / maxHourAbs) * 100
              const pos = h.net >= 0
              return (
                <div key={h.hour} className="flex items-center gap-2 text-xs">
                  <span className="w-10 shrink-0 text-right text-gray-400">{h.hour}時</span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-panel-2">
                    <div
                      className={`absolute inset-y-0 left-0 ${pos ? 'bg-up/70' : 'bg-down/70'}`}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                  <span className={`w-24 shrink-0 text-right tabular-nums ${colorOf(h.net)}`}>
                    {fmtMoney(h.net, { sign: true })}
                  </span>
                  <span className="w-10 shrink-0 text-right text-gray-600">{h.count}件</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
