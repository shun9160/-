import { useMemo } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { hourBreakdown, sessionBreakdown, summarize } from '../lib/analytics'
import { SESSION_LABELS } from '../lib/timezone'
import { colorOf, fmtMoney, fmtNum, fmtPct, fmtRR } from '../lib/format'

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
      <div className="card px-6 py-16 text-center">
        <p className="font-semibold">分析するデータがありません</p>
        <p className="mt-1 text-sm text-ink2">取引を記録すると、ここに傾向が表示されます。</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 成績の要約 */}
      <Group title="成績" note="手数料・スワップを含めた実質の数字です">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="純損益"
            value={`${fmtMoney(s.netTotal, { sign: true })} 円`}
            cls={colorOf(s.netTotal)}
            sub={`手数料 ${fmtMoney(s.commissionTotal)} 円`}
          />
          <Stat label="勝率" value={fmtPct(s.winRate)} sub={`${s.wins}勝 ${s.losses}敗`} />
          <Stat
            label="損益比"
            value={
              s.profitFactor == null ? '—' : s.profitFactor === Infinity ? '∞' : fmtNum(s.profitFactor)
            }
            sub="勝ち合計 ÷ 負け合計"
          />
          <Stat
            label="平均ロット"
            value={fmtNum(s.avgVolume, 2)}
            sub={`合計 ${fmtNum(s.totalVolume, 2)}`}
          />
        </div>
      </Group>

      {/* 損切り・利確 */}
      <Group title="損切りと利確" note="SL・TPを記録した取引だけが対象です">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="計画リスクリワード" value={fmtRR(s.avgPlannedRR)} sub="狙った利益 ÷ 許容損失" />
          <Stat
            label="実際の損益倍率"
            value={s.avgRMultiple != null ? `${fmtNum(s.avgRMultiple)} R` : '—'}
            cls={s.avgRMultiple != null ? colorOf(s.avgRMultiple) : undefined}
            sub="1回のリスクの何倍取れたか"
          />
          <Stat label="TPまで届いた割合" value={fmtPct(s.tpHitRate)} sub="計画通り利確できた率" />
          <Stat
            label="狙いの何%取れたか"
            value={fmtPct(s.avgCapturedRatio)}
            cls={s.avgCapturedRatio != null ? colorOf(s.avgCapturedRatio) : undefined}
            sub="TPまでの値幅に対する実績"
          />
        </div>
      </Group>

      {/* 時間帯 */}
      {sessions.length > 0 && (
        <Group title="時間帯別の相性" note="日本時間で集計しています">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {sessions.map((ss) => (
              <div key={ss.key} className="card p-4">
                <p className="text-xs font-medium text-ink2">{SESSION_LABELS[ss.key]}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${colorOf(ss.net)}`}>
                  {fmtMoney(ss.net, { sign: true })}
                </p>
                <p className="mt-0.5 text-xs text-ink3">
                  {ss.count}件 ・ 勝率 {fmtPct(ss.winRate)}
                </p>
              </div>
            ))}
          </div>
        </Group>
      )}

      {/* 時刻別 */}
      {hours.length > 0 && (
        <Group title="何時に勝てているか" note="エントリー時刻（日本時間）ごとの合計損益">
          <div className="card divide-y divide-line p-1">
            {hours.map((h) => {
              const w = (Math.abs(h.net) / maxAbs) * 100
              const pos = h.net >= 0
              return (
                <div key={h.hour} className="flex items-center gap-3 px-3 py-2">
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
        </Group>
      )}
    </div>
  )
}

function Group({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5">
        <h3 className="text-base font-bold">{title}</h3>
        {note && <p className="text-xs text-ink3">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
  cls,
}: {
  label: string
  value: string
  sub?: string
  cls?: string
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink2">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${cls ?? 'text-ink'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-tight text-ink3">{sub}</p>}
    </div>
  )
}
