import { TYPES, TYPE_IDS } from '../../lib/diagnosis/types'
import type { HistoryEntry } from '../../lib/diagnosisClient'
import { STATUS_LABELS } from '../../lib/diagnosis/messages'
import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'

interface Props {
  history: HistoryEntry[]
  onOpen: (id: string) => void
}

/** 過去の診断。上書きせず積み上げているので、変化が見える */
export default function HistoryList({ history, onOpen }: Props) {
  if (history.length === 0) {
    return <p className="card px-6 py-8 text-center text-sm text-ink3">まだ履歴がありません</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {history.map((h, i) => {
        const def = TYPES[h.primaryType]
        // 1つ前（＝時系列でうしろ）と比べる
        const prev = history[i + 1]
        const changed = prev && prev.primaryType !== h.primaryType
        const confDelta = prev ? h.confidence - prev.confidence : null
        const shifts = prev
          ? [...TYPE_IDS]
              .map((id) => ({ id, d: Math.round(h.scores[id] - prev.scores[id]) }))
              .filter((x) => x.d !== 0)
              .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
              .slice(0, 3)
          : []

        return (
          <li key={h.diagnosisId}>
            <button
              onClick={() => onOpen(h.diagnosisId)}
              className="card flex w-full items-center gap-3 p-3.5 text-left hover:bg-sunken/60"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ background: def.color }}
              >
                {h.primaryType.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-bold">{h.primaryType}</span>
                  <span className="text-xs text-ink2">{def.category}</span>
                  {changed && (
                    <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">
                      {prev.primaryType} から変化
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] text-ink3">
                  {fmtJst(h.createdAt, 'yyyy/MM/dd HH:mm')}
                  <span className="mx-1">·</span>
                  {STATUS_LABELS[h.status]}
                  <span className="mx-1">·</span>
                  信頼度 {h.confidence}%
                  {confDelta != null && confDelta !== 0 && (
                    <span className={confDelta > 0 ? 'text-up' : 'text-ink3'}>
                      （{confDelta > 0 ? '+' : ''}
                      {confDelta}）
                    </span>
                  )}
                  {h.completedActions > 0 && (
                    <>
                      <span className="mx-1">·</span>
                      改善アクション {h.completedActions}件完了
                    </>
                  )}
                </span>
                {shifts.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {shifts.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-md bg-sunken px-1.5 py-0.5 text-[10px] tabular-nums text-ink2"
                      >
                        {s.id} {s.d > 0 ? '+' : ''}
                        {s.d}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <Icon name="right" size={16} className="shrink-0 text-ink3" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
