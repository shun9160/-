import type { Account } from '../../lib/types'
import { currencyLabel } from '../../lib/appConfig'
import { colorOf, fmtMoney, fmtPct } from '../../lib/format'
import Icon from '../Icon'
import AnimatedMoney from '../AnimatedMoney'
import type { IconName } from '../Icon'

interface Props {
  /** 表示中の口座。「すべて」なら null */
  account: Account | null
  accounts: Account[]
  /** 累計の純損益 */
  netTotal: number
  onEditCapital: () => void
  readOnly?: boolean
}

/** 資産の全体像。原資・いまの資産・増え方を並べる。 */
export default function AssetSummary({
  account,
  accounts,
  netTotal,
  onEditCapital,
  readOnly,
}: Props) {
  // 通貨が混ざっていると足せないので、そのときは原資を出さない
  const mixed = account == null && new Set(accounts.map((a) => a.currency)).size > 1
  const capital = account
    ? account.initial_capital
    : mixed
      ? 0
      : accounts.reduce((s, a) => s + a.initial_capital, 0)
  const hasCapital = capital > 0
  const rate = hasCapital ? netTotal / capital : null

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">資産サマリー</h2>
        <span className="text-xs text-ink3">全期間</span>
      </div>

      {mixed ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-ink2">
          通貨のちがう口座が混ざっているため、資産はまとめて出せません。口座を1つ選ぶと表示されます。
        </p>
      ) : (
        <dl className="grid grid-cols-3 divide-x divide-line">
          <Cell
            icon="wallet"
            label="現在の資産"
            money={hasCapital ? capital + netTotal : netTotal}
            moneySign={!hasCapital}
            moneyColored={false}
            unit={currencyLabel()}
          />
          <Cell
            icon="trendUp"
            label="累計利益"
            money={netTotal}
            unit={currencyLabel()}
            tone={netTotal >= 0 ? 'up' : 'down'}
          />
          <Cell
            icon="percent"
            label="初期資金から"
            value={rate != null ? `${rate > 0 ? '+' : ''}${fmtPct(rate)}` : '—'}
            valueClass={rate != null ? colorOf(rate) : undefined}
            tone={rate != null && rate >= 0 ? 'up' : rate != null ? 'down' : 'neutral'}
          />
        </dl>
      )}

      {!readOnly && account && !hasCapital && (
        <button
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-ink2 hover:bg-sunken"
          onClick={onEditCapital}
        >
          <Icon name="plus" size={16} />
          原資を登録すると増減率が出ます
        </button>
      )}
      {!readOnly && account && hasCapital && (
        <button className="btn btn-ghost mt-3 -ml-2" onClick={onEditCapital}>
          <Icon name="pencil" size={15} />
          原資（{fmtMoney(capital)} {currencyLabel()}）を編集
        </button>
      )}
    </section>
  )
}

function Cell({
  icon,
  label,
  value,
  money,
  moneySign = true,
  moneyColored = true,
  unit,
  valueClass,
  tone = 'neutral',
}: {
  icon: IconName
  label: string
  /** 文字のまま出す値 */
  value?: string
  /** 金額。渡すとカウントアップして出る */
  money?: number
  moneySign?: boolean
  moneyColored?: boolean
  unit?: string
  valueClass?: string
  tone?: 'up' | 'down' | 'neutral'
}) {
  const ring = {
    up: 'bg-up-soft text-up',
    down: 'bg-down-soft text-down',
    neutral: 'bg-sunken text-ink2',
  }[tone]
  return (
    <div className="flex min-w-0 flex-col items-center px-1.5 text-center sm:px-2">
      <dt className="text-xs text-ink3">{label}</dt>
      {/* 金額が長いと折り返して、3つの升目の高さがずれるので折り返さない */}
      <dd
        className={`mt-1 w-full truncate whitespace-nowrap text-base font-bold tabular-nums sm:text-lg ${
          money != null && moneyColored ? '' : (valueClass ?? 'text-ink')
        }`}
      >
        {money != null ? (
          <AnimatedMoney value={money} sign={moneySign} colored={moneyColored} />
        ) : (
          value
        )}
        {unit && <span className="ml-0.5 text-[11px] font-semibold text-ink3">{unit}</span>}
      </dd>
      <span className={`mt-2 flex h-8 w-8 items-center justify-center rounded-full ${ring}`}>
        <Icon name={icon} size={16} />
      </span>
    </div>
  )
}
