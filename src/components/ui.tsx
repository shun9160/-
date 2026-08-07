import Icon, { type IconName } from './Icon'

/**
 * 画面をまたいで使う小さな部品。
 * どの画面も同じ見出し・同じ数値の見せ方になるよう、ここに集約する。
 */

/** 画面上部の見出し。右側に操作を置ける */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string
  sub?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** カードの中の見出し */
export function SectionHeader({
  title,
  sub,
  actions,
}: {
  title: string
  sub?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-ink3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** 前の期間からの増減。数字だけでなく矢印でも向きを示す */
export function Delta({ ratio, label = '前の期間から' }: { ratio: number | null; label?: string }) {
  if (ratio == null || !isFinite(ratio)) {
    return <span className="text-xs text-ink3">比較できる期間がありません</span>
  }
  const up = ratio >= 0
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs">
      <span
        className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 font-semibold ${
          up ? 'bg-up-soft text-up' : 'bg-down-soft text-down'
        }`}
        title={label}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d={up ? 'M5 1.5 L9 8 H1 Z' : 'M5 8.5 L1 2 H9 Z'} fill="currentColor" />
        </svg>
        {up ? '+' : '−'}
        {Math.abs(ratio * 100).toFixed(1)}%
      </span>
      {/* 狭い画面では折り返して読みにくくなるので、説明は広い画面だけ出す */}
      <span className="hidden whitespace-nowrap text-ink3 xl:inline">{label}</span>
    </span>
  )
}

/** 主要な数値をひとつ見せるカード */
export function StatCard({
  icon,
  label,
  value,
  unit,
  valueClass,
  delta,
  hint,
}: {
  icon: IconName
  label: string
  value: string
  unit?: string
  valueClass?: string
  delta?: React.ReactNode
  hint?: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon name={icon} size={15} />
        </span>
        <span className="text-sm font-medium text-ink2">{label}</span>
      </div>
      <p className={`mt-2.5 text-2xl font-bold tabular-nums ${valueClass ?? ''}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-ink3">{unit}</span>}
      </p>
      <div className="mt-1.5">{delta ?? (hint && <span className="text-xs text-ink3">{hint}</span>)}</div>
    </div>
  )
}

/** 状態を色と文字の両方で示す小さなラベル */
export type PillTone = 'up' | 'down' | 'brand' | 'neutral'

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const cls: Record<PillTone, string> = {
    up: 'bg-up-soft text-up',
    down: 'bg-down-soft text-down',
    brand: 'bg-brand-soft text-brand',
    neutral: 'bg-sunken text-ink2',
  }
  const dot: Record<PillTone, string> = {
    up: 'bg-up',
    down: 'bg-down',
    brand: 'bg-brand',
    neutral: 'bg-ink3',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {children}
    </span>
  )
}

/** 期間などの切り替え */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`seg ${value === o.value ? 'seg-on' : 'seg-off'} ${
            size === 'sm' ? 'px-2.5 py-1 text-xs' : ''
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 何も無いときの表示 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="mt-3.5 text-base font-bold">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-sm text-ink2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * ひとつの入力欄で探す検索窓。
 * 中身が入っているときだけ、消すボタンを出す。
 */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label = '検索',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink3">
        <Icon name="search" size={16} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        // 入力欄そのものの ✕ はブラウザごとに出たり出なかったりするので、自前で出す
        className="input pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="検索をやめる"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink3 hover:bg-sunken hover:text-ink"
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  )
}
