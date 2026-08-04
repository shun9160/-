import { useRef, useState } from 'react'
import type { TradeInput } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { parseAuto } from '../lib/mt5Parser'
import { insertTrades } from '../lib/repo'
import { seedTrades } from '../lib/seed'
import TradeForm from './TradeForm'

interface Props {
  onChanged: () => void
  disabled?: boolean
}

export default function UploadPanel({ onChanged, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showManual, setShowManual] = useState(false)

  async function commit(rows: TradeInput[], label: string) {
    if (rows.length === 0) {
      setMsg({ text: '取り込める取引が見つかりませんでした。形式をご確認ください。', ok: false })
      return
    }
    setBusy(true)
    try {
      const n = await insertTrades(rows)
      setMsg({ text: `${label}: ${n}件を保存しました。`, ok: true })
      onChanged()
    } catch (e) {
      setMsg({ text: `保存エラー: ${friendlyError(e)}`, ok: false })
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
        const text = await file.text()
        all.push(...parseAuto(file.name, text))
      }
      await commit(all, 'ファイル取込')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold">データ取込</h2>
      <p className="mt-1 text-xs text-gray-500">
        PC版MT5の「口座履歴 → レポート → HTML」/ CSV をアップロード、または「スクショ＋手入力」で1件ずつ追加。
        時刻はドバイ時間として取り込み、日本時間に変換して記録します。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn bg-panel-2 text-gray-200 hover:bg-border disabled:opacity-40"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? '処理中…' : 'HTML / CSV を選択'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,.csv,.tsv,.txt"
          multiple
          className="hidden"
          onChange={onFile}
        />
        <button
          className="btn bg-accent text-white hover:bg-blue-500 disabled:opacity-40"
          onClick={() => setShowManual((v) => !v)}
          disabled={disabled}
        >
          {showManual ? '入力フォームを閉じる' : '＋ スクショ／手入力で追加'}
        </button>
        <button
          className="btn bg-panel-2 text-gray-200 hover:bg-border disabled:opacity-40"
          onClick={() => commit(seedTrades, 'サンプル2件を投入')}
          disabled={disabled || busy}
          title="スクショ(画像1・2)の2トレードを投入します"
        >
          サンプル2件を投入
        </button>
      </div>

      {msg && <div className={`mt-3 text-sm ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</div>}

      {showManual && (
        <div className="mt-4 border-t border-border pt-4">
          <TradeForm
            mode="add"
            onSubmit={async (input) => {
              await commit([input], input.screenshot ? 'スクショから追加' : '手入力')
              setShowManual(false)
            }}
            onCancel={() => setShowManual(false)}
          />
        </div>
      )}
    </div>
  )
}
