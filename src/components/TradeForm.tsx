import { useRef, useState } from 'react'
import type { Side, Trade, TradeInput } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { fileToDownscaledDataUrl } from '../lib/image'
import { getTradeScreenshot } from '../lib/repo'
import { fmtDubai, parseMt5DateTime } from '../lib/timezone'

interface Props {
  mode: 'add' | 'edit'
  /** edit 時の元データ */
  trade?: Trade
  onSubmit: (input: TradeInput, opts: { screenshotChanged: boolean }) => Promise<void>
  onCancel?: () => void
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

export default function TradeForm({ mode, trade, onSubmit, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [f, setF] = useState({
    ticket: trade?.ticket ?? '',
    symbol: trade?.symbol ?? 'XAUUSD.raw',
    side: (trade?.side ?? 'buy') as Side,
    volume: str(trade?.volume, '0.02'),
    open_price: str(trade?.open_price),
    close_price: str(trade?.close_price),
    sl: str(trade?.sl),
    tp: str(trade?.tp),
    open_time: trade ? fmtDubai(trade.open_time) : '',
    close_time: trade ? fmtDubai(trade.close_time) : '',
    commission: str(trade?.commission, '0'),
    swap: str(trade?.swap, '0'),
    profit: str(trade?.profit),
    currency: trade?.currency ?? 'JPY',
  })

  // 画像: undefined=未変更 / string=新規 / null=削除
  const [shot, setShot] = useState<string | null | undefined>(undefined)
  const [shotPreview, setShotPreview] = useState<string | null>(null)
  const [loadingShot, setLoadingShot] = useState(false)

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value })

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    try {
      const dataUrl = await fileToDownscaledDataUrl(file)
      setShot(dataUrl)
      setShotPreview(dataUrl)
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function showExisting() {
    if (!trade) return
    setLoadingShot(true)
    try {
      const url = await getTradeScreenshot(trade.id)
      setShotPreview(url)
      if (!url) setErr('この取引に画像はありません')
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setLoadingShot(false)
    }
  }

  function removeImage() {
    setShot(null)
    setShotPreview(null)
  }

  async function submit() {
    setErr(null)
    const openT = parseMt5DateTime(f.open_time)
    if (!f.symbol.trim()) return setErr('シンボルを入力してください')
    if (!openT)
      return setErr('エントリー時刻を「2026.08.03 17:23:23」の形式で入力してください（ドバイ時間）')
    if (!(Number(f.volume) > 0)) return setErr('ロットを入力してください')

    const closeT = parseMt5DateTime(f.close_time)
    const input: TradeInput = {
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
      currency: f.currency.trim() || 'JPY',
      note: trade?.note ?? null,
      source: mode === 'add' ? (shot ? 'screenshot' : 'manual') : trade?.source ?? 'manual',
    }
    // 画像の反映: 変更があるときだけ含める
    const screenshotChanged = shot !== undefined
    if (screenshotChanged) input.screenshot = shot

    setBusy(true)
    try {
      await onSubmit(input, { screenshotChanged })
    } catch (e) {
      setErr(friendlyError(e))
      setBusy(false)
    }
  }

  const field = (label: string, k: keyof typeof f, ph = '', mono = false) => (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      {label}
      <input
        className={`rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-accent ${
          mono ? 'tabular-nums' : ''
        }`}
        value={f[k] as string}
        onChange={set(k)}
        placeholder={ph}
        inputMode={mono ? 'decimal' : undefined}
      />
    </label>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 画像 */}
      <div className="rounded-xl border border-dashed border-border bg-panel-2/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">📷 スクショ（任意）</span>
          <div className="flex gap-2">
            {mode === 'edit' && shot === undefined && (
              <button
                className="btn bg-panel-2 text-xs text-gray-300 hover:bg-border"
                onClick={showExisting}
                disabled={loadingShot}
                type="button"
              >
                {loadingShot ? '読込中…' : '現在の画像を表示'}
              </button>
            )}
            <button
              className="btn bg-accent text-xs text-white hover:bg-blue-500"
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              画像を選ぶ
            </button>
            {(shotPreview || shot) && (
              <button
                className="btn text-xs text-down hover:bg-down/10"
                onClick={removeImage}
                type="button"
              >
                削除
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
        {shotPreview ? (
          <img
            src={shotPreview}
            alt="スクショ"
            className="max-h-72 w-full rounded-lg object-contain"
          />
        ) : (
          <p className="text-xs text-gray-600">
            スマホなら写真・カメラから選べます。画像は自動で縮小して保存されます。
          </p>
        )}
      </div>

      {/* 入力欄 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        {field('ロット', 'volume', '0.02', true)}
        {field('ポジション番号', 'ticket', '19235918')}
        {field('建値', 'open_price', '4033.89', true)}
        {field('決済価格', 'close_price', '4036.50', true)}
        {field('S/L', 'sl', '4034.14', true)}
        {field('T/P', 'tp', '', true)}
        {field('エントリー時刻(ドバイ)', 'open_time', '2026.08.03 17:23:23')}
        {field('決済時刻(ドバイ)', 'close_time', '2026.08.03 17:35:36')}
        {field('損益', 'profit', '817', true)}
        {field('手数料', 'commission', '-8', true)}
      </div>

      {err && <div className="text-sm text-down">{err}</div>}

      <div className="flex gap-2">
        <button
          className="btn bg-accent text-white hover:bg-blue-500 disabled:opacity-40"
          onClick={submit}
          disabled={busy}
          type="button"
        >
          {busy ? '保存中…' : mode === 'add' ? '追加' : '更新を保存'}
        </button>
        {onCancel && (
          <button
            className="btn bg-panel-2 text-gray-300 hover:bg-border"
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
        )}
      </div>
    </div>
  )
}

function str(v: number | null | undefined, dflt = ''): string {
  return v == null ? dflt : String(v)
}
