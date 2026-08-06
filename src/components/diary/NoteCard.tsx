import { useState } from 'react'
import { upsertDayNote } from '../../lib/repo'
import { friendlyError } from '../../lib/errors'
import Icon from '../Icon'

interface Props {
  day: string
  initial: string
  isToday: boolean
  readOnly?: boolean
  onChanged: () => void
}

/** その日の振り返り。書いてあるかどうかがひと目で分かるようにする */
export default function NoteCard({ day, initial, isToday, readOnly, onChanged }: Props) {
  // saved = いまデータベースに入っている内容。text = 書きかけの内容。
  const [saved, setSaved] = useState(initial)
  const [text, setText] = useState(initial)
  // 開いた時点では入力欄を出さない。
  // いきなり開くと、スマホでキーボードが勝手にせり上がって
  // 「書かされている」画面になってしまうため、押されてから開く。
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const title = isToday ? '今日の振り返り' : 'この日の振り返り'

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

  if (readOnly) {
    return (
      <Shell title={title}>
        <p className="text-sm text-ink3">{saved || 'サンプル表示中は保存できません'}</p>
      </Shell>
    )
  }

  if (editing) {
    return (
      <Shell title={title}>
        <textarea
          className="input min-h-[120px] resize-y"
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
          <button
            className="btn btn-quiet"
            onClick={() => {
              setText(saved)
              setErr(null)
              setEditing(false)
            }}
            disabled={saving}
          >
            やめる
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell
      title={title}
      action={
        <button
          className={`btn ${saved === '' ? 'btn-primary' : 'btn-quiet'}`}
          onClick={() => setEditing(true)}
        >
          <Icon name="pencil" size={15} />
          {saved === '' ? '書く' : '編集'}
        </button>
      }
      saved={saved !== ''}
    >
      {saved === '' ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sunken text-ink3">
            <Icon name="pencil" size={17} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink2">
              まだ振り返りを書いていません
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink3">
              その日の気づきや学びを記録して、トレードを成長につなげましょう。
            </span>
          </span>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{saved}</p>
      )}
    </Shell>
  )
}

function Shell({
  title,
  action,
  saved,
  children,
}: {
  title: string
  action?: React.ReactNode
  saved?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="card p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon name="book" size={13} />
        </span>
        <h3 className="text-sm font-bold">{title}</h3>
        {saved && (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-up">
            <Icon name="check" size={12} />
            保存済み
          </span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  )
}
