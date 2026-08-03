import { useRef, useState } from 'react'
import type { Side, TradeInput } from '../lib/types'
import { parseAuto } from '../lib/mt5Parser'
import { insertTrades } from '../lib/repo'
import { seedTrades } from '../lib/seed'
import { parseMt5DateTime } from '../lib/timezone'

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
      setMsg({ text: `保存エラー: ${e instanceof Error ? e.message : String(e)}`, ok: false })
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
      for (const f of files) {
        const text = await f.text()
        all.push(...parseAuto(f.name, text))
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
        PC版MT5の「口座履歴 → レポート → HTML」または CSV をアップロード。時刻はドバイ時間として取り込み、
        日本時間に変換して記録します。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn bg-accent text-white hover:bg-blue-500 disabled:opacity-40"
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
          className="btn bg-panel-2 text-gray-200 hover:bg-border disabled:opacity-40"
          onClick={() => commit(seedTrades, 'スクショ2件を投入')}
          disabled={disabled || busy}
          title="アップロードいただいた画像1・2の2トレードを投入します"
        >
          スクショ2件を投入
        </button>
        <button
          className="btn bg-panel-2 text-gray-200 hover:bg-border"
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? '手入力を閉じる' : '手入力で追加'}
        </button>
      </div>

      {msg && (
        <div className={`mt-3 text-sm ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</div>
      )}

      {showManual && <ManualForm onSubmit={(row) => commit([row], '手入力')} busy={busy} />}
    </div>
  )
}

function ManualForm({ onSubmit, busy }: { onSubmit: (row: TradeInput) => void; busy: boolean }) {
  const [f, setF] = useState({
    ticket: '',
    symbol: 'XAUUSD.raw',
    side: 'buy' as Side,
    volume: '0.02',
    open_price: '',
    close_price: '',
    sl: '',
    tp: '',
    open_time: '',
    close_time: '',
    commission: '0',
    swap: '0',
    profit: '',
  })

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value })

  const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

  function submit() {
    const openT = parseMt5DateTime(f.open_time)
    if (!openT) {
      alert('エントリー時刻を「2026.08.03 17:23:23」の形式で入力してください（ドバイ時間）。')
      return
    }
    const closeT = parseMt5DateTime(f.close_time)
    onSubmit({
      ticket: f.ticket.trim() || null,
      symbol: f.symbol.trim(),
      side: f.side,
      volume: Number(f.volume) || 0,
      open_price: Number(f.open_price) || 0,
      close_price: numOrNull(f.close_price),
      sl: numOrNull(f.sl),
      tp: numOrNull(f.tp),
      open_time: openT.toISOString(),
      close_time: closeT ? closeT.toISOString() : null,
      commission: Number(f.commission) || 0,
      swap: Number(f.swap) || 0,
      profit: Number(f.profit) || 0,
      currency: 'JPY',
      note: null,
      source: 'manual',
    })
  }

  const field = (label: string, k: keyof typeof f, ph = '') => (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      {label}
      <input
        className="rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-accent"
        value={f[k] as string}
        onChange={set(k)}
        placeholder={ph}
      />
    </label>
  )

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        売買
        <select
          className="rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-accent"
          value={f.side}
          onChange={set('side')}
        >
          <option value="buy">buy</option>
          <option value="sell">sell</option>
        </select>
      </label>
      {field('シンボル', 'symbol')}
      {field('ロット', 'volume', '0.02')}
      {field('ポジション番号', 'ticket', '19235918')}
      {field('建値', 'open_price', '4033.89')}
      {field('決済価格', 'close_price', '4036.50')}
      {field('S/L', 'sl', '4034.14')}
      {field('T/P', 'tp', '')}
      {field('エントリー時刻(ドバイ)', 'open_time', '2026.08.03 17:23:23')}
      {field('決済時刻(ドバイ)', 'close_time', '2026.08.03 17:35:36')}
      {field('損益', 'profit', '817')}
      {field('手数料', 'commission', '-8')}
      <div className="col-span-2 flex items-end sm:col-span-4">
        <button
          className="btn bg-accent text-white hover:bg-blue-500 disabled:opacity-40"
          onClick={submit}
          disabled={busy}
        >
          追加
        </button>
      </div>
    </div>
  )
}
