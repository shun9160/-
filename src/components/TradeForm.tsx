import { useRef, useState } from 'react'
import type { Side, Trade, TradeInput } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { fileToDownscaledDataUrl } from '../lib/image'
import { getTradeScreenshot } from '../lib/repo'
import { fmtDubai, parseMt5DateTime } from '../lib/timezone'
import Icon from './Icon'

interface Props {
  mode: 'add' | 'edit'
  trade?: Trade
  onSubmit: (input: TradeInput, opts: { screenshotChanged: boolean }) => Promise<void>
  onCancel?: () => void
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

export default function TradeForm({ mode, trade, onSubmit, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(mode === 'edit')

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
  const [preview, setPreview] = useState<string | null>(null)
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
      setPreview(dataUrl)
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
      setPreview(url)
      if (!url) setErr('この取引に画像は登録されていません')
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setLoadingShot(false)
    }
  }

  async function submit() {
    setErr(null)
    const openT = parseMt5DateTime(f.open_time)
    if (!f.symbol.trim()) return setErr('通貨ペアを入力してください')
    if (!openT)
      return setErr('エントリー時刻は「2026.08.03 17:23:23」の形式で入力してください')
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
      source: mode === 'add' ? (shot ? 'screenshot' : 'manual') : (trade?.source ?? 'manual'),
    }
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

  const field = (label: string, k: keyof typeof f, ph = '', hint?: string) => (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input
        className="input tabular-nums"
        value={f[k] as string}
        onChange={set(k)}
        placeholder={ph}
        inputMode={
          ['volume', 'open_price', 'close_price', 'sl', 'tp', 'profit', 'commission'].includes(k)
            ? 'decimal'
            : undefined
        }
      />
      {hint && <span className="text-[11px] text-ink3">{hint}</span>}
    </label>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 画像 */}
      <div>
        <p className="label mb-1.5">スクリーンショット（任意）</p>
        {preview ? (
          <div className="overflow-hidden rounded-2xl border border-line">
            <img src={preview} alt="添付画像" className="max-h-72 w-full object-contain bg-sunken" />
            <div className="flex gap-1.5 border-t border-line p-2">
              <button className="btn btn-quiet" onClick={() => fileRef.current?.click()} type="button">
                差し替え
              </button>
              <button
                className="btn btn-danger ml-auto"
                type="button"
                onClick={() => {
                  setShot(null)
                  setPreview(null)
                }}
              >
                削除
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-quiet"
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              <Icon name="camera" size={17} />
              画像を選ぶ
            </button>
            {mode === 'edit' && shot === undefined && (
              <button className="btn btn-ghost" onClick={showExisting} disabled={loadingShot} type="button">
                {loadingShot ? '読み込み中…' : '登録済みの画像を見る'}
              </button>
            )}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
      </div>

      {/* 必須の3項目 */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="label">売買</span>
          <div className="flex rounded-xl bg-sunken p-1">
            {(
              [
                ['buy', '買い'],
                ['sell', '売り'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setF({ ...f, side: v })}
                className={`seg flex-1 ${f.side === v ? 'seg-on' : 'seg-off'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </label>
        {field('ロット', 'volume', '0.02')}
        {field('エントリー時刻', 'open_time', '2026.08.03 17:23:23', 'MT5の表示（ドバイ時間）のまま')}
        {field('損益（円）', 'profit', '817')}
      </div>

      {/* 詳細 */}
      {showDetail ? (
        <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
          {field('通貨ペア', 'symbol')}
          {field('決済時刻', 'close_time', '2026.08.03 17:35:36')}
          {field('建値', 'open_price', '4033.89')}
          {field('決済価格', 'close_price', '4036.50')}
          {field('損切り S/L', 'sl', '4034.14', '入れるとリスクリワードを計算')}
          {field('利確 T/P', 'tp', '4040.00', '入れると達成率を計算')}
          {field('手数料', 'commission', '-8')}
          {field('ポジション番号', 'ticket', '19235918')}
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-quiet self-start"
          onClick={() => setShowDetail(true)}
        >
          <Icon name="plus" size={16} />
          価格・損切り・利確も入力する
        </button>
      )}

      {err && (
        <p className="rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
          {err}
        </p>
      )}

      <div className="flex gap-2">
        <button className="btn btn-primary flex-1 sm:flex-none" onClick={submit} disabled={busy} type="button">
          {busy ? '保存中…' : mode === 'add' ? '記録する' : '変更を保存'}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel} type="button">
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
