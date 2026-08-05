import { useRef, useState } from 'react'
import type { TradeInput } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { parseAuto } from '../lib/mt5Parser'
import { insertTrades } from '../lib/repo'
import { seedTrades } from '../lib/seed'
import BatchImport from './BatchImport'
import TradeForm from './TradeForm'
import Icon from './Icon'

interface Props {
  onChanged: () => void
  disabled?: boolean
  /** 保存後にホームへ戻すなど */
  onDone?: () => void
}

type Method = 'shots' | 'manual' | 'file'

export default function UploadPanel({ onChanged, disabled, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [method, setMethod] = useState<Method>('shots')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function commit(rows: TradeInput[], label: string) {
    if (rows.length === 0) {
      setMsg({
        text: '取引を読み取れませんでした。MT5の「レポート → HTML」で書き出したファイルをお試しください。',
        ok: false,
      })
      return
    }
    setBusy(true)
    try {
      const n = await insertTrades(rows)
      setMsg({ text: `${label} ${n}件を保存しました`, ok: true })
      onChanged()
    } catch (e) {
      setMsg({ text: friendlyError(e), ok: false })
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setBusy(true)
    setMsg(null)
    try {
      const all: TradeInput[] = []
      for (const file of files) {
        all.push(...parseAuto(file.name, await file.text()))
      }
      await commit(all, 'ファイルから')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 方法を選ぶ */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <MethodCard
          active={method === 'shots'}
          onClick={() => setMethod('shots')}
          icon="camera"
          title="スクショ"
          desc="何枚でもまとめて"
        />
        <MethodCard
          active={method === 'file'}
          onClick={() => setMethod('file')}
          icon="upload"
          title="MT5レポート"
          desc="正確・一括"
        />
        <MethodCard
          active={method === 'manual'}
          onClick={() => setMethod('manual')}
          icon="pencil"
          title="手入力"
          desc="1件ずつ"
        />
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
            msg.ok
              ? 'border-up/25 bg-up-soft text-up'
              : 'border-down/25 bg-down-soft text-down'
          }`}
        >
          <Icon name={msg.ok ? 'check' : 'info'} size={17} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{msg.text}</p>
            {msg.ok && onDone && (
              <button className="mt-1 font-semibold underline" onClick={onDone}>
                ホームで確認する
              </button>
            )}
          </div>
        </div>
      )}

      {method === 'shots' ? (
        <BatchImport
          disabled={disabled}
          onSaved={(n) => {
            setMsg({ text: `スクショから ${n}件を保存しました`, ok: true })
            onChanged()
          }}
        />
      ) : method === 'manual' ? (
        <div className="card p-4 sm:p-5">
          <TradeForm
            mode="add"
            onSubmit={async (input) => {
              await commit([input], '取引を')
            }}
          />
        </div>
      ) : (
        <div className="card p-5">
          <h3 className="text-base font-bold">MT5のレポートを読み込む</h3>
          <ol className="mt-3 flex flex-col gap-2 text-sm text-ink2">
            <Step n={1}>パソコン版MT5の下部にある「口座履歴」タブを右クリック</Step>
            <Step n={2}>「レポート」→「HTML」を選んで保存</Step>
            <Step n={3}>下のボタンでそのファイルを選ぶ</Step>
          </ol>
          <button
            className="btn btn-primary mt-4 w-full sm:w-auto"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || busy}
          >
            <Icon name="upload" size={17} />
            {busy ? '読み込み中…' : 'ファイルを選ぶ'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,.csv,.tsv,.txt"
            multiple
            className="hidden"
            onChange={onFile}
          />
          <p className="mt-2 text-xs text-ink3">
            CSVにも対応しています。同じ取引を二重に登録することはありません。
          </p>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs text-ink3">動作を試したいときは</p>
            <button
              className="btn btn-quiet mt-1.5"
              onClick={() => commit(seedTrades, 'サンプルを')}
              disabled={disabled || busy}
            >
              サンプル2件を入れる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MethodCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  icon: 'camera' | 'upload' | 'pencil'
  title: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors ${
        active
          ? 'border-brand bg-brand-soft'
          : 'border-line bg-surface hover:bg-sunken'
      }`}
    >
      <span className={active ? 'text-brand' : 'text-ink3'}>
        <Icon name={icon} size={22} />
      </span>
      <span className={`text-sm font-bold ${active ? 'text-brand' : 'text-ink'}`}>{title}</span>
      <span className="text-xs text-ink2">{desc}</span>
    </button>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] font-bold text-ink2">
        {n}
      </span>
      {children}
    </li>
  )
}
