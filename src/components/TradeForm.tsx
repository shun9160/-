import { useRef, useState } from 'react'
import type { Side, Trade, TradeInput } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { fileToDownscaledDataUrl } from '../lib/image'
import { readTradeFromImage } from '../lib/ocr'
import { getTradeScreenshot } from '../lib/repo'
import { getAppConfig } from '../lib/appConfig'
import { fmtBrokerTime, parseMt5DateTime } from '../lib/timezone'
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
    symbol: trade?.symbol ?? getAppConfig().defaultSymbol,
    side: (trade?.side ?? 'buy') as Side,
    volume: str(trade?.volume, '0.02'),
    open_price: str(trade?.open_price),
    close_price: str(trade?.close_price),
    sl: str(trade?.sl),
    tp: str(trade?.tp),
    open_time: trade ? fmtBrokerTime(trade.open_time) : '',
    close_time: trade ? fmtBrokerTime(trade.close_time) : '',
    commission: str(trade?.commission, '0'),
    swap: str(trade?.swap, '0'),
    profit: str(trade?.profit),
    currency: trade?.currency ?? getAppConfig().accountCurrency,
  })

  // 画像: undefined=未変更 / string=新規 / null=削除
  const [shot, setShot] = useState<string | null | undefined>(undefined)
  const [preview, setPreview] = useState<string | null>(null)
  const [loadingShot, setLoadingShot] = useState(false)

  // 文字認識は縮小前の元画像に対して行うので保持しておく
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrFilled, setOcrFilled] = useState<string[] | null>(null)
  const [ocrMissing, setOcrMissing] = useState<string[]>([])

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value })

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    setOcrFilled(null)
    try {
      const dataUrl = await fileToDownscaledDataUrl(file)
      setShot(dataUrl)
      setPreview(dataUrl)
      setSourceFile(file)
      // 画像を選んだらそのまま読み取りに進む（手間を減らす）
      void runOcr(file)
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** 画像から項目を読み取ってフォームに入れる */
  async function runOcr(file: File) {
    setOcrBusy(true)
    setOcrProgress(0)
    setErr(null)
    try {
      const { parsed } = await readTradeFromImage(file, setOcrProgress)

      // 読み取れた項目を先に確定させる。
      // setF の更新関数の中で数えると、実行が後回しになるため件数を判定できない。
      const patch: Partial<typeof f> = {}
      const filled: string[] = []
      const put = (key: keyof typeof f, value: string | undefined, label: string) => {
        if (value == null || value === '') return
        patch[key] = value as never
        filled.push(label)
      }
      put('symbol', parsed.symbol, '通貨ペア')
      if (parsed.side) {
        patch.side = parsed.side
        filled.push('売買')
      }
      put('volume', parsed.volume?.toString(), 'ロット')
      put('ticket', parsed.ticket, 'ポジション番号')
      put('open_price', parsed.openPrice?.toString(), '建値')
      put('close_price', parsed.closePrice?.toString(), '決済価格')
      put('sl', parsed.sl?.toString(), '損切り')
      put('tp', parsed.tp?.toString(), '利確')
      put('open_time', parsed.openTime, 'エントリー時刻')
      put('close_time', parsed.closeTime, '決済時刻')
      put('profit', parsed.profit?.toString(), '損益')
      put('commission', parsed.commission?.toString(), '手数料')

      setF((prev) => ({ ...prev, ...patch }))

      if (filled.length) {
        setOcrFilled(filled)
        // 読み取れなかった項目は自分で入れてもらう必要があるので明示する
        const missLabels: [keyof typeof f, string][] = [
          ['sl', '損切り S/L'],
          ['tp', '利確 T/P'],
          ['commission', '手数料'],
          ['profit', '損益'],
        ]
        setOcrMissing(missLabels.filter(([k]) => patch[k] == null).map(([, l]) => l))
        setShowDetail(true)
      } else {
        setErr(
          '画像から数字を読み取れませんでした。MT5のポジション詳細（S/L・T/Pが見える画面）だと読み取りやすくなります。お手数ですが手入力をお願いします。',
        )
      }
    } catch (e) {
      setErr(`読み取りに失敗しました: ${friendlyError(e)}`)
    } finally {
      setOcrBusy(false)
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
      currency: f.currency.trim() || getAppConfig().accountCurrency,
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
        <p className="label mb-1.5">
          MT5のスクリーンショット
          <span className="ml-1 font-normal text-ink3">選ぶと数字を自動で読み取ります</span>
        </p>
        {preview ? (
          <div className="overflow-hidden rounded-2xl border border-line">
            <img src={preview} alt="添付画像" className="max-h-72 w-full object-contain bg-sunken" />

            {/* 読み取りの状態 */}
            {ocrBusy && (
              <div className="border-t border-line px-3 py-2.5">
                <p className="text-xs font-semibold text-brand">
                  画像から数字を読み取っています… {Math.round(ocrProgress * 100)}%
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${Math.max(ocrProgress * 100, 4)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink3">初回は準備に少し時間がかかります</p>
              </div>
            )}
            {!ocrBusy && ocrFilled && (
              <div className="flex gap-2 border-t border-line bg-up-soft px-3 py-2.5">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-up" />
                <p className="text-xs text-ink2">
                  <span className="font-semibold text-up">
                    {ocrFilled.length}項目を読み取りました
                  </span>
                  <br />
                  {ocrFilled.join('・')}
                  <br />
                  {ocrMissing.length > 0 ? (
                    <span className="font-semibold text-ink2">
                      {ocrMissing.join('・')} は読み取れませんでした。必要なら入力してください
                    </span>
                  ) : (
                    <span className="text-ink3">数字が違う場合は下の欄で直してください</span>
                  )}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 border-t border-line p-2">
              {sourceFile && !ocrBusy && (
                <button
                  className="btn btn-quiet"
                  type="button"
                  onClick={() => runOcr(sourceFile)}
                >
                  <Icon name="refresh" size={16} />
                  もう一度読み取る
                </button>
              )}
              <button className="btn btn-quiet" onClick={() => fileRef.current?.click()} type="button">
                差し替え
              </button>
              <button
                className="btn btn-danger ml-auto"
                type="button"
                onClick={() => {
                  setShot(null)
                  setPreview(null)
                  setSourceFile(null)
                  setOcrFilled(null)
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
