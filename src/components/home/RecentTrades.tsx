import type { EnrichedTrade } from '../../lib/types'
import { gradeTrade } from '../../lib/analytics'
import { fmtJst } from '../../lib/timezone'
import { colorOf, fmtMoney, fmtNum } from '../../lib/format'
import Icon from '../Icon'

interface Props {
  /** 直近の取引（新しい順） */
  recent: EnrichedTrade[]
  total: number
  onShowAll: () => void
  onOpenDay: (day: string) => void
}

/** 記録の中身を、評価つきで並べる */
export default function RecentTrades({ recent, total, onShowAll, onOpenDay }: Props) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="text-base font-bold">最近の取引</h2>
          <p className="text-xs text-ink3">
            全{total}件のうち直近{recent.length}件
          </p>
        </div>
        <button className="btn btn-ghost px-2 text-brand" onClick={onShowAll}>
          すべて見る
          <Icon name="right" size={15} />
        </button>
      </div>

      {/* 狭い画面は表だと損益が右に隠れてしまうので、1件ずつ並べる */}
      <ul className="border-t border-line sm:hidden">
        {recent.map((t) => {
          const g = gradeTrade(t)
          return (
            <li key={t.id}>
              <button
                onClick={() => onOpenDay(t.jstDay)}
                className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-sunken/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{t.symbol}</span>
                    <span
                      className={`shrink-0 text-[11px] ${
                        t.side === 'buy' ? 'text-brand' : 'text-ink2'
                      }`}
                    >
                      {t.side === 'buy' ? '買い' : '売り'}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink3">
                    {fmtNum(t.volume, 2)} lot
                    <span className="mx-1">·</span>
                    {fmtJst(t.open_time, 'M/d HH:mm')}
                    <span className="mx-1">·</span>
                    <span className={t.win ? 'text-up' : 'text-down'}>
                      {t.tpHit
                        ? '利確ライン'
                        : t.slHit
                          ? '損切りライン'
                          : t.win
                            ? '手動で利確'
                            : '手動で損切り'}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-sm font-bold tabular-nums ${colorOf(t.netProfit)}`}>
                    {fmtMoney(t.netProfit, { sign: true })}
                  </span>
                  <Stars n={g.stars} title={g.reason} />
                </span>
                <Icon name="right" size={15} className="shrink-0 text-ink3" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[470px] text-sm">
          <thead>
            <tr className="border-y border-line text-left">
              {['銘柄', '売買', 'ロット', '日時', '終わり方', '損益'].map((h, i) => (
                <th
                  key={h}
                  className={`px-2.5 py-2.5 text-[11px] font-semibold text-ink3 ${
                    i === 5 ? 'text-right' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((t) => {
              const g = gradeTrade(t)
              return (
                <tr
                  key={t.id}
                  onClick={() => onOpenDay(t.jstDay)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken/60"
                >
                  <td className="max-w-[6.5rem] truncate px-2.5 py-2.5 text-xs font-semibold">
                    {t.symbol}
                  </td>
                  <td className="px-2.5 py-2.5 text-xs">
                    <span className={t.side === 'buy' ? 'text-brand' : 'text-ink2'}>
                      {t.side === 'buy' ? '買い' : '売り'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 text-xs tabular-nums text-ink2">
                    {fmtNum(t.volume, 2)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 text-xs tabular-nums text-ink2">
                    {fmtJst(t.open_time, 'M/d HH:mm')}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5">
                    <span className={`text-xs font-semibold ${t.win ? 'text-up' : 'text-down'}`}>
                      {t.tpHit
                        ? '利確ライン'
                        : t.slHit
                          ? '損切りライン'
                          : t.win
                            ? '手動で利確'
                            : '手動で損切り'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 text-right">
                    <span className={`block text-sm font-bold tabular-nums ${colorOf(t.netProfit)}`}>
                      {fmtMoney(t.netProfit, { sign: true })}
                    </span>
                    <Stars n={g.stars} title={g.reason} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <StarLegend />
    </section>
  )
}

function Stars({ n, title }: { n: number; title: string }) {
  return (
    <span
      className="mt-0.5 flex justify-end gap-0.5"
      title={title}
      aria-label={`評価 5段階中 ${n}: ${title}`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? 'text-amber' : 'text-line'}>
          <Icon name="star" size={11} strokeWidth={0} className="fill-current" />
        </span>
      ))}
    </span>
  )
}

const LEGEND = [
  [5, '素晴らしい取引（計画通り・一貫性あり）'],
  [4, '良い取引（概ね計画通り）'],
  [3, '普通（改善の余地あり）'],
  [2, '改善が必要（ルール逸脱あり）'],
  [1, '避けたい取引（損切りを置いていない）'],
] as const

function StarLegend() {
  return (
    <details className="border-t border-line px-5 py-3">
      <summary className="cursor-pointer text-xs font-semibold text-ink2">評価について</summary>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {LEGEND.map(([n, text]) => (
          <li key={n} className="flex items-center gap-2 text-xs text-ink2">
            <Stars n={n} title={text} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] text-ink3">
        勝ち負けではなく「決めた通りにやれたか」で付けています。
      </p>
    </details>
  )
}
