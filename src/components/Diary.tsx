import { useEffect, useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { dailySeries } from '../lib/analytics'
import { upsertDayNote } from '../lib/repo'
import { fmtJst } from '../lib/timezone'
import { colorOf, fmtMoney } from '../lib/format'
import TradesTable from './TradesTable'

interface Props {
  trades: EnrichedTrade[]
  dayNotes: Record<string, string>
  onChanged: () => void
  focusDay?: string | null
}

export default function Diary({ trades, dayNotes, onChanged, focusDay }: Props) {
  const days = useMemo(() => dailySeries(trades).reverse(), [trades]) // 新しい日付が上
  const [selected, setSelected] = useState<string | null>(focusDay ?? days[0]?.day ?? null)

  useEffect(() => {
    if (focusDay) setSelected(focusDay)
  }, [focusDay])

  const dayTrades = useMemo(
    () => (selected ? trades.filter((t) => t.jstDay === selected) : []),
    [trades, selected],
  )

  if (days.length === 0) {
    return <div className="card p-8 text-center text-sm text-gray-500">まだ取引がありません</div>
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
      {/* 日付リスト */}
      <div className="card max-h-[70vh] overflow-y-auto p-2">
        {days.map((d) => (
          <button
            key={d.day}
            onClick={() => setSelected(d.day)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              selected === d.day ? 'bg-panel-2' : 'hover:bg-panel-2/60'
            }`}
          >
            <span className="text-gray-300">{d.day.slice(5).replace('-', '/')}</span>
            <span className={`text-xs font-medium ${colorOf(d.net)}`}>
              {fmtMoney(d.net, { sign: true })}
            </span>
          </button>
        ))}
      </div>

      {/* 選択日の詳細 */}
      <div>
        {selected && (
          <>
            <DayNoteEditor
              key={selected}
              day={selected}
              initial={dayNotes[selected] ?? ''}
              onChanged={onChanged}
            />
            <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-300">
              {fmtJst(selected + 'T00:00:00+09:00', 'yyyy年M月d日')} の取引 ({dayTrades.length}件)
            </h3>
            <TradesTable trades={dayTrades} onChanged={onChanged} filterDay={selected} />
          </>
        )}
      </div>
    </div>
  )
}

function DayNoteEditor({
  day,
  initial,
  onChanged,
}: {
  day: string
  initial: string
  onChanged: () => void
}) {
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await upsertDayNote(day, text)
      setSaved(true)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">📔 その日の振り返り</h3>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-up">保存しました</span>}
          <button
            className="btn bg-accent text-white hover:bg-blue-500 disabled:opacity-40"
            onClick={save}
            disabled={saving}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
      <textarea
        className="min-h-[120px] w-full rounded-lg border border-border bg-panel-2 p-3 text-sm outline-none focus:border-accent"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        placeholder="相場観・メンタル・良かった点・改善点などを記録…"
      />
    </div>
  )
}
