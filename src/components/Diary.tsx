import { useEffect, useMemo, useState } from 'react'
import type { EnrichedTrade } from '../lib/types'
import { dailySeries } from '../lib/analytics'
import { friendlyError } from '../lib/errors'
import { upsertDayNote } from '../lib/repo'
import { fmtJst } from '../lib/timezone'
import { currencyLabel } from '../lib/appConfig'
import { colorOf, fmtMoney } from '../lib/format'
import TradesTable from './TradesTable'
import Icon from './Icon'
import { EmptyState } from './ui'

interface Props {
  trades: EnrichedTrade[]
  dayNotes: Record<string, string>
  onChanged: () => void
  focusDay?: string | null
  readOnly?: boolean
}

export default function Diary({ trades, dayNotes, onChanged, focusDay, readOnly }: Props) {
  const days = useMemo(() => dailySeries(trades).reverse(), [trades])
  const [selected, setSelected] = useState<string | null>(focusDay ?? days[0]?.day ?? null)

  useEffect(() => {
    if (focusDay) setSelected(focusDay)
  }, [focusDay])

  const dayTrades = useMemo(
    () => (selected ? trades.filter((t) => t.jstDay === selected) : []),
    [trades, selected],
  )
  const dayNet = useMemo(() => dayTrades.reduce((s, t) => s + t.netProfit, 0), [dayTrades])

  if (days.length === 0) {
    return (
      <EmptyState
        icon="book"
        title="まだ記録がありません"
        body="取引を追加すると、日ごとに振り返れます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[220px_1fr] lg:items-start">
      {/* 日付の切り替え — モバイルは横スクロール、PCは縦リスト */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto lg:px-0 lg:pb-0">
        {days.map((d) => {
          const on = selected === d.day
          return (
            <button
              key={d.day}
              onClick={() => setSelected(d.day)}
              className={`flex shrink-0 flex-col items-start rounded-xl border px-3 py-2 transition-colors lg:w-full ${
                on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-sunken'
              }`}
            >
              <span className={`text-xs font-semibold ${on ? 'text-brand' : 'text-ink2'}`}>
                {d.day.slice(5).replace('-', '/')}
              </span>
              <span className={`text-sm font-bold tabular-nums ${colorOf(d.net)}`}>
                {fmtMoney(d.net, { sign: true })}
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-bold">
              {fmtJst(selected + 'T00:00:00+09:00', 'yyyy年M月d日')}
            </h3>
            <p className="text-sm text-ink2">
              {dayTrades.length}件 ・{' '}
              <span className={`font-bold tabular-nums ${colorOf(dayNet)}`}>
                {fmtMoney(dayNet, { sign: true })} {currencyLabel()}
              </span>
            </p>
          </div>

          {readOnly ? (
            <div className="card p-4">
              <p className="label mb-1">その日の振り返り</p>
              <p className="text-sm text-ink3">
                {dayNotes[selected] || 'サンプル表示中は保存できません'}
              </p>
            </div>
          ) : (
            <DayNoteEditor
              key={selected}
              day={selected}
              initial={dayNotes[selected] ?? ''}
              onChanged={onChanged}
            />
          )}

          <TradesTable
            trades={dayTrades}
            onChanged={onChanged}
            filterDay={selected}
            readOnly={readOnly}
          />
        </div>
      )}
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
  // saved = いまデータベースに入っている内容。text = 書きかけの内容。
  const [saved, setSaved] = useState(initial)
  const [text, setText] = useState(initial)
  // まだ何も書いていない日は、すぐ書けるように最初から入力欄を開く。
  const [editing, setEditing] = useState(initial === '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      await upsertDayNote(day, text)
      // ここまで来たら確実に保存できている。
      setSaved(text)
      setEditing(false)
      onChanged()
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setText(saved)
    setErr(null)
    setEditing(false)
  }

  // 保存済みの表示。ボタンが「編集」になっていることで、
  // 書いた内容がちゃんと残っていると分かる。
  if (!editing) {
    return (
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="label">その日の振り返り</p>
          {saved !== '' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-up">
              <Icon name="check" size={14} />
              保存済み
            </span>
          )}
        </div>
        {saved === '' ? (
          <p className="text-sm text-ink3">まだ書いていません</p>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{saved}</p>
        )}
        <button className="btn btn-quiet mt-3" onClick={() => setEditing(true)}>
          <Icon name="pencil" size={15} />
          {saved === '' ? '書く' : '編集'}
        </button>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <p className="label mb-2">その日の振り返り</p>
      <textarea
        className="input min-h-[110px] resize-y"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        placeholder="相場の印象、メンタル、良かった点、次に直すこと"
      />
      {err && <p className="mt-2 text-sm text-down">{err}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
        {saved !== '' && (
          <button className="btn btn-quiet" onClick={cancel} disabled={saving}>
            やめる
          </button>
        )}
      </div>
    </div>
  )
}
