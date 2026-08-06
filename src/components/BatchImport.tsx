import { useRef, useState } from 'react'
import type { Side, TradeInput } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { fileToDownscaledDataUrl } from '../lib/image'
import { readTradesFromImages } from '../lib/ocr'
import { hashFile } from '../lib/imageHash'
import { addTradeImages, insertTrades } from '../lib/repo'
import { getAppConfig } from '../lib/appConfig'
import { parseMt5DateTime } from '../lib/timezone'
import ChartPicker from './ChartPicker'
import Icon from './Icon'
import { EmptyState, Pill } from './ui'

interface Props {
  onSaved: (count: number) => void
  /** 記録先の口座 */
  accountId?: string | null
  disabled?: boolean
}

/** 読み取り後、確認・修正するための1件ぶん */
interface Draft {
  key: string
  include: boolean
  thumb: string
  screenshot: string
  filled: number
  symbol: string
  side: Side
  volume: string
  open_time: string
  close_time: string
  open_price: string
  close_price: string
  sl: string
  tp: string
  profit: string
  commission: string
  ticket: string
  /** この取引に貼るチャート画像。保存できてから取引に付ける */
  charts: string[]
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

export default function BatchImport({ onSaved, disabled, accountId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, ratio: 0 })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** 読み取り済みの画像の指紋。同じ画像を二重に読ませないために覚えておく */
  const seen = useRef<Set<string>>(new Set())

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (fileRef.current) fileRef.current.value = ''
    if (files.length === 0) return

    setErr(null)

    // 同じ画像を二重に読み取らない。中身で見分けるので、
    // 名前を変えただけの同じ写真もはじく。
    const fresh: File[] = []
    let duplicates = 0
    for (const f of files) {
      const h = await hashFile(f)
      if (seen.current.has(h)) {
        duplicates++
        continue
      }
      seen.current.add(h)
      fresh.push(f)
    }
    if (duplicates > 0) {
      setErr(
        fresh.length
          ? `${duplicates}枚は読み取り済みの画像だったので除きました`
          : '同じ画像です。すでに読み取っています',
      )
    }
    if (fresh.length === 0) return

    setReading(true)
    setProgress({ done: 0, total: fresh.length, ratio: 0 })
    try {
      const results = await readTradesFromImages(fresh, (done, total, ratio) =>
        setProgress({ done, total, ratio }),
      )
      const made: Draft[] = []
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        const shot = await fileToDownscaledDataUrl(r.file)

        // 一覧画面には複数の取引が写っているので、1枚から何件でも作る
        r.trades.forEach((p, j) => {
          const filled = [
            p.symbol,
            p.side,
            p.volume,
            p.openTime,
            p.closeTime,
            p.openPrice,
            p.closePrice,
            p.sl,
            p.tp,
            p.profit,
            p.commission,
            p.ticket,
          ].filter((v) => v != null && v !== '').length

          made.push({
            key: `${Date.now()}-${i}-${j}`,
            include: true,
            thumb: shot,
            // 同じ画像を何件にも付けると重くなるので、添付は1件目だけにする
            screenshot: j === 0 ? shot : '',
            filled,
            symbol: p.symbol ?? getAppConfig().defaultSymbol,
            side: p.side ?? 'buy',
            volume: p.volume?.toString() ?? '',
            open_time: p.openTime ?? '',
            close_time: p.closeTime ?? '',
            open_price: p.openPrice?.toString() ?? '',
            close_price: p.closePrice?.toString() ?? '',
            sl: p.sl?.toString() ?? '',
            tp: p.tp?.toString() ?? '',
            profit: p.profit?.toString() ?? '',
            commission: p.commission?.toString() ?? '',
            ticket: p.ticket ?? '',
            charts: [],
          })
        })
      }
      setDrafts((prev) => [...prev, ...made])
    } catch (e) {
      setErr(`読み取りに失敗しました: ${friendlyError(e)}`)
    } finally {
      setReading(false)
    }
  }

  function patch(key: string, p: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...p } : d)))
  }

  const chosen = drafts.filter((d) => d.include)
  const invalid = chosen.filter(
    (d) => !parseMt5DateTime(d.open_time) || !(Number(d.volume) > 0) || !d.symbol.trim(),
  )

  async function saveAll() {
    setErr(null)
    if (chosen.length === 0) return setErr('登録する取引を選んでください')
    if (invalid.length > 0)
      return setErr(
        `${invalid.length}件に不足があります。銘柄・ロット・エントリー時刻を入れてください`,
      )

    setSaving(true)
    try {
      const rows: TradeInput[] = chosen.map((d) => {
        const openT = parseMt5DateTime(d.open_time)!
        const closeT = parseMt5DateTime(d.close_time)
        return {
          ticket: d.ticket.trim() || null,
          symbol: d.symbol.trim(),
          side: d.side,
          volume: Number(d.volume) || 0,
          open_price: Number(d.open_price) || 0,
          close_price: numOrNull(d.close_price),
          sl: numOrNull(d.sl),
          tp: numOrNull(d.tp),
          open_time: openT.toISOString(),
          close_time: closeT ? closeT.toISOString() : null,
          commission: Number(d.commission) || 0,
          swap: 0,
          profit: Number(d.profit) || 0,
          currency: getAppConfig().accountCurrency,
          note: null,
          screenshot: d.screenshot || null,
          source: 'screenshot',
        }
      })
      const saved = await insertTrades(rows, accountId)

      // 取引が出来てから、それぞれにチャートを貼る。
      // 取引番号があるものは番号で照合し、無いものは並び順で対応させる。
      const byTicket = new Map(
        saved.filter((x) => x.ticket).map((x) => [x.ticket as string, x.id]),
      )
      const noTicket = saved.filter((x) => !x.ticket).map((x) => x.id)
      let k = 0
      for (const d of chosen) {
        const id = d.ticket.trim() ? byTicket.get(d.ticket.trim()) : noTicket[k++]
        if (id && d.charts.length) {
          await addTradeImages(id, d.charts.map((image) => ({ image })))
        }
      }

      setDrafts([])
      seen.current.clear()
      onSaved(saved.length)
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 選択 */}
      <div className="card p-5">
        <h3 className="text-base font-bold">スクリーンショットから登録</h3>
        <p className="mt-1 text-sm text-ink2">
          MT5の画面を撮った画像を選ぶと、数字を読み取って一覧にします。
          <span className="font-semibold text-ink">何枚でもまとめて選べます。</span>
        </p>
        <button
          className="btn btn-primary mt-4"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || reading}
        >
          <Icon name="camera" size={17} />
          {reading ? '読み取り中…' : drafts.length ? '画像を追加する' : '画像を選ぶ'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPick}
        />

        {reading && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-brand">
              {progress.done} / {progress.total} 枚を読み取り中…
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{
                  width: `${
                    ((progress.done + progress.ratio) / Math.max(progress.total, 1)) * 100
                  }%`,
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-ink3">初回は準備に少し時間がかかります</p>
          </div>
        )}

        <p className="mt-3 text-xs text-ink3">
          ポジション詳細（S/L・T/Pが見える画面）だと、より多くの項目を読み取れます。
        </p>
      </div>

      {err && (
        <p className="whitespace-pre-wrap rounded-2xl border border-down/25 bg-down-soft px-4 py-3 text-sm text-down">
          {err}
        </p>
      )}

      {/* 確認と修正 */}
      {drafts.length === 0 ? (
        !reading && (
          <EmptyState
            icon="camera"
            title="まだ画像がありません"
            body="上のボタンから、MT5のスクリーンショットを選んでください。"
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              読み取り結果 <span className="text-ink3">{drafts.length}件</span>
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => setDrafts((p) => p.map((d) => ({ ...d, include: true })))}
              >
                すべて選ぶ
              </button>
              <button className="btn btn-ghost" onClick={() => {
                  setDrafts([])
                  seen.current.clear()
                  setErr(null)
                }}>
                やり直す
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {drafts.map((d) => (
              <DraftCard key={d.key} d={d} onPatch={patch} onRemove={(k) =>
                setDrafts((p) => p.filter((x) => x.key !== k))
              } />
            ))}
          </div>

          <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-raised md:bottom-4">
            <p className="text-sm">
              <span className="font-bold">{chosen.length}件</span> を登録します
              {invalid.length > 0 && (
                <span className="ml-2 text-down">（{invalid.length}件に不足あり）</span>
              )}
            </p>
            <button
              className="btn btn-primary ml-auto"
              onClick={saveAll}
              disabled={saving || chosen.length === 0}
            >
              {saving ? '保存中…' : `${chosen.length}件を登録する`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DraftCard({
  d,
  onPatch,
  onRemove,
}: {
  d: Draft
  onPatch: (key: string, p: Partial<Draft>) => void
  onRemove: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const timeOk = Boolean(parseMt5DateTime(d.open_time))
  const ok = timeOk && Number(d.volume) > 0 && d.symbol.trim() !== ''

  const field = (label: string, k: keyof Draft, ph = '') => (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input
        className="input tabular-nums"
        value={d[k] as string}
        onChange={(e) => onPatch(d.key, { [k]: e.target.value } as Partial<Draft>)}
        placeholder={ph}
      />
    </label>
  )

  return (
    <article className={`card overflow-hidden ${d.include ? '' : 'opacity-55'}`}>
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={d.include}
          onChange={(e) => onPatch(d.key, { include: e.target.checked })}
          className="mt-1 h-4 w-4 shrink-0 accent-brand"
          aria-label="登録する"
        />
        <img
          src={d.thumb}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg border border-line bg-sunken object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{d.symbol || '銘柄未設定'}</span>
            <Pill tone={d.side === 'buy' ? 'brand' : 'neutral'}>
              {d.side === 'buy' ? '買い' : '売り'}
            </Pill>
            <span className="text-xs text-ink2">{d.volume || '—'} lot</span>
            <Pill tone={ok ? 'up' : 'down'}>{ok ? `${d.filled}項目` : '入力が必要'}</Pill>
          </div>
          <p className="mt-1 truncate text-xs text-ink3">
            {d.open_time || 'エントリー時刻が読み取れませんでした'}
            {d.profit && <span className="ml-2 font-semibold text-ink2">損益 {d.profit}</span>}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className="btn btn-ghost px-2" onClick={() => setOpen(!open)}>
            {open ? '閉じる' : '直す'}
          </button>
          <button
            className="btn btn-danger px-2"
            onClick={() => onRemove(d.key)}
            aria-label="この画像を外す"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>

      {/* チャートは登録と同時に貼れるようにする（あとから探し直さなくて済む） */}
      <div className="border-t border-line px-3 py-2.5">
        <ChartPicker
          value={d.charts}
          onChange={(charts) => onPatch(d.key, { charts })}
        />
      </div>

      {open && (
        <div className="border-t border-line p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                    onClick={() => onPatch(d.key, { side: v })}
                    className={`seg flex-1 ${d.side === v ? 'seg-on' : 'seg-off'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </label>
            {field('銘柄', 'symbol')}
            {field('ロット', 'volume', '0.02')}
            {field('損益', 'profit', '817')}
            {field('エントリー時刻', 'open_time', '2026.08.03 17:23:23')}
            {field('決済時刻', 'close_time')}
            {field('建値', 'open_price')}
            {field('決済価格', 'close_price')}
            {field('損切り S/L', 'sl')}
            {field('利確 T/P', 'tp')}
            {field('手数料', 'commission')}
            {field('ポジション番号', 'ticket')}
          </div>
          {!timeOk && (
            <p className="mt-2 text-xs text-down">
              エントリー時刻は「2026.08.03 17:23:23」の形式で入力してください
            </p>
          )}
        </div>
      )}
    </article>
  )
}
