import { colorOf, fmtMoney, fmtPct } from '../../lib/format'
import { currencyLabel } from '../../lib/appConfig'
import Icon from '../Icon'
import type { IconName } from '../Icon'

/** 見出し */
export function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-base font-bold">{title}</h2>
      {sub && <span className="shrink-0 text-xs text-ink3">{sub}</span>}
    </div>
  )
}

/** 大きめの数字ひとつ */
export function Metric({
  label,
  value,
  unit,
  note,
  valueClass,
  children,
}: {
  label: string
  value: string
  unit?: string
  note?: string
  valueClass?: string
  children?: React.ReactNode
}) {
  return (
    <div className="card flex flex-col p-4">
      <p className="text-xs text-ink2">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass ?? 'text-ink'}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-ink3">{unit}</span>}
      </p>
      {children}
      {note && <p className="mt-2 text-[11px] text-ink3">{note}</p>}
    </div>
  )
}

/** 割合を輪で示す。数字も必ず添える（色だけに頼らない） */
export function Ring({ ratio, size = 56 }: { ratio: number; size?: number }) {
  const r = 20
  const c = 2 * Math.PI * r
  const on = Math.max(0, Math.min(1, ratio))
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-line" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${c * on} ${c}`}
        transform="rotate(-90 24 24)"
        className="text-brand"
      />
    </svg>
  )
}

/** 行に並べる指標 */
export function Row({
  icon,
  label,
  value,
  note,
  valueClass,
  right,
}: {
  icon?: IconName
  label: string
  value: string
  note?: string
  valueClass?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      {icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon name={icon} size={16} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink2">{label}</p>
        {note && <p className="truncate text-[11px] text-ink3">{note}</p>}
      </div>
      <p className={`shrink-0 text-lg font-bold tabular-nums ${valueClass ?? 'text-ink'}`}>
        {value}
      </p>
      {right}
    </div>
  )
}

/** 金額を色と符号で示す */
export function Money({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`font-bold tabular-nums ${colorOf(value)} ${className}`}>
      {fmtMoney(value, { sign: true })}
      <span className="ml-0.5 text-[11px] font-semibold text-ink3">{currencyLabel()}</span>
    </span>
  )
}

/** 割合の帯 */
export function Bar({ ratio, tone = 'brand' }: { ratio: number; tone?: 'brand' | 'up' | 'down' }) {
  const bg = { brand: 'bg-brand', up: 'bg-up', down: 'bg-down' }[tone]
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <span
        className={`block h-full rounded-full ${bg}`}
        style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }}
      />
    </span>
  )
}

export function Empty({ text }: { text: string }) {
  return <p className="card px-6 py-10 text-center text-sm text-ink3">{text}</p>
}

export { fmtPct }
