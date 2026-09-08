import { useRef, useState } from 'react'
import type { Side, TradeInput } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { fileToDownscaledDataUrl } from '../lib/image'
import { readTradesFromImages } from '../lib/ocr'
import { hashFile } from '../lib/imageHash'
import { duplicateIndexes, tradeKey } from '../lib/tradeDedup'
import { findSavedScreenshotHashes, findSavedTradeKeys } from '../lib/repo'
import { addTradeImages, insertTrades } from '../lib/repo'
import { getAppConfig, currencyLabel } from '../lib/appConfig'
import { colorOf, fmtMoney } from '../lib/format'
import { parseMt5DateTime } from '../lib/timezone'
import ChartPicker, { type PickedImage } from './ChartPicker'
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
  charts: PickedImage[]
  /** 取込元スクショの指紋 */
  shotHash: string
  /** すでに入っている取引と重なりそうか。印を出すだけで、消しはしない */
  dup?: boolean
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

/**
 * 下書き1件ぶんの鍵。同じ取引が二重に入らないかを見るのに使う。
 * 見るところは tradeKey に書いてある（銘柄・売買・ロット・時刻・値段・損益）。
 */
function draftKey(d: Draft): string | null {
  return tradeKey({
    symbol: d.symbol,
    side: d.side,
    volume: d.volume,
    openTime: parseMt5DateTime(d.open_time),
    closeTime: parseMt5DateTime(d.close_time),
    openPrice: d.open_price,
    closePrice: d.close_price,
    profit: d.profit,
  })
}

/**
 * 読み取れた損益。手数料を引いたあとの、実際に記録される額。
 *
 * 読み取れていなければ null。0 と「読めなかった」は別のことなので、
 * 0 に丸めない。0円のつもりで入れてしまう
 */
export function draftNet(d: { profit: string; commission: string }): number | null {
  if (d.profit.trim() === '') return null
  const p = Number(d.profit)
  if (!Number.isFinite(p)) return null
  const fee = Number(d.commission)
  return p + (Number.isFinite(fee) ? fee : 0)
}

/** 登録するぶんの合計。読み取れなかったものは足しようがないので数だけ返す */
export function draftTotal(list: { profit: string; commission: string }[]): {
  sum: number
  unknown: number
} {
  let sum = 0
  let unknown = 0
  for (const d of list) {
    const n = draftNet(d)
    if (n == null) unknown++
    else sum += n
  }
  return { sum, unknown }
}

/** 同じスクショだったことを、どこと重なったかまで含めて伝える */
function shotDuplicateMessage(kept: number, already: number, past: number): string | null {
  const dup = already + past
  if (dup === 0) return null
  const where =
    already && past
      ? '読み取り済み・取込済みの画像'
      : already
        ? 'この画面で読み取り済みの画像'
        : '以前に取り込んだ画像'
  return kept > 0
    ? `${dup}枚は${where}と同じだったので除きました`
    : `${where}と同じです。読み取っていません`
}

/**
 * 取引番号が読み取れなかったぶんの、二重登録の知らせ。
 * 外したことと、戻せることの両方を書く。
 */
function dupTradeMessage(n: number): string | null {
  if (n === 0) return null
  return `${n}件は、すでに入っている取引と同じかもしれません（銘柄・売買・ロット・時刻・値段・損益がすべて一致）。登録しない印を付けました。必要なら選び直せます`
}

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
    // いま画面に出ているぶんだけでなく、過去に取り込んだぶんとも照合する。
    const hashes = await Promise.all(files.map(hashFile))
    let savedShots = new Set<string>()
    try {
      savedShots = await findSavedScreenshotHashes(hashes)
    } catch {
      // 照合できなくても、この画面の中での重複は防げる
    }

    const fresh: { file: File; hash: string }[] = []
    let already = 0
    let past = 0
    files.forEach((f, i) => {
      const h = hashes[i]
      if (seen.current.has(h)) return void already++
      if (savedShots.has(h)) return void past++
      seen.current.add(h)
      fresh.push({ file: f, hash: h })
    })
    const shotMsg = shotDuplicateMessage(fresh.length, already, past)
    setErr(shotMsg)
    if (fresh.length === 0) return

    setReading(true)
    setProgress({ done: 0, total: fresh.length, ratio: 0 })
    try {
      const results = await readTradesFromImages(
        fresh.map((x) => x.file),
        (done, total, ratio) => setProgress({ done, total, ratio }),
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
            shotHash: fresh[i].hash,
          })
        })
      }
      /*
        取引番号が読み取れなかったぶんだけ、中身で二重登録を見る。
        番号があるものは、記録するときに番号で上書きされるので増えない。

        照合するのは「同じ時刻の取引」だけにしぼる。
        取引が何千件あっても、引いてくる量は読み取った枚数ぶんで済む。
      */
      const keys = made.map((d) => (d.ticket.trim() ? null : draftKey(d)))
      const times = made
        .map((d, i) => (keys[i] ? parseMt5DateTime(d.open_time)?.toISOString() : null))
        .filter((t): t is string => Boolean(t))
      const savedKeys = await findSavedTradeKeys([...new Set(times)], accountId).catch(
        () => new Set<string>(), // 照合できなくても取り込みは止めない
      )

      // いま画面に出ているぶんとも重ねて見る
      const known = new Set(savedKeys)
      for (const d of drafts) {
        if (d.ticket.trim()) continue
        const k = draftKey(d)
        if (k) known.add(k)
      }

      const dupIdx = new Set(duplicateIndexes(keys, known))
      const marked = made.map((d, i) =>
        dupIdx.has(i) ? { ...d, dup: true, include: false } : d,
      )

      setDrafts((prev) => [...prev, ...marked])
      setErr([shotMsg, dupTradeMessage(dupIdx.size)].filter(Boolean).join('\n') || null)
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
  const total = draftTotal(chosen)

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
          /*
            画像そのものは1件目にだけ付ける（同じ画像を何件にも持たせると重くなる）。
            指紋のほうは、その画像から作った全部の行に付ける。
            以前は画像と同じく1件目だけに付けていたので、
            1件目の選択を外して登録すると、その画像の指紋がどこにも残らず、
            後日おなじ画像を選び直しても「取り込み済み」と言えなかった。
          */
          screenshot_hash: d.shotHash || null,
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
          await addTradeImages(
            id,
            d.charts.map((c) => ({ image: c.image, hash: c.hash })),
          )
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

          <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface p-3 shadow-raised md:bottom-4">
            <p className="text-sm">
              <span className="font-bold">{chosen.length}件</span> を登録します
              {invalid.length > 0 && (
                <span className="ml-2 text-down">（{invalid.length}件に不足あり）</span>
              )}
            </p>

            {/*
              選んだぶんの合計。入れる・外すたびにここが動くので、
              いくらぶんを取り込もうとしているのかが、押す前に分かる
            */}
            <p className="text-sm">
              {/* 20px。18px だと「大きい字」に届かず、緑が基準を割る */}
              <span className={`text-xl font-bold tabular-nums ${colorOf(total.sum)}`}>
                {fmtMoney(total.sum, { sign: true })}
              </span>
              <span className="ml-0.5 text-[11px] font-semibold text-ink3">{currencyLabel()}</span>
              {total.unknown > 0 && (
                <span className="ml-1.5 text-[11px] text-ink3">
                  （損益を読めなかった{total.unknown}件を除く）
                </span>
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

/**
 * 1件ぶんの損益。
 *
 * 手数料を引いたあとの額を出す。登録したあと日記や一覧に並ぶのと同じ数字にして、
 * 「取り込む前と後で額が違う」を起こさない。
 * 手数料があったときだけ、そのぶんを小さく添える。
 */
function Money({ profit, commission }: { profit: string; commission: string }) {
  const net = draftNet({ profit, commission })
  if (net == null) return <span className="shrink-0 text-xs text-ink3">損益 読み取れず</span>

  const fee = Number(commission)
  return (
    <span className="shrink-0">
      {/*
        19px。勝ちの緑は白の上で 3.3 しかなく、小さい字だと基準（4.5）を割る。
        太字で 18.66px を超えると「大きい字」として 3 でよくなる。
        ここは決め手になる数字なので、大きくするほうが筋も通る
      */}
      <span className={`text-[19px] font-bold leading-tight tabular-nums ${colorOf(net)}`}>
        {fmtMoney(net, { sign: true })}
      </span>
      {Number.isFinite(fee) && fee !== 0 && (
        <span className="ml-1 whitespace-nowrap text-[11px] tabular-nums text-ink3">
          手数料 {fmtMoney(fee, { sign: true })} 込み
        </span>
      )}
    </span>
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
            {d.dup && <Pill tone="down">前に入れたものと同じかも</Pill>}
          </div>
          {/*
            損益と時刻。どちらも切らない。
            以前は1行に流して端から切っていたので、時刻が長いと
            「2026.09.08 06:12:22 損…」となり、
            いくらの取引なのかが分からなかった。ここを見て
            入れる・外すを決める人がいるので、額のほうを先に置く。
            狭ければ時刻が下に回る。切れて消えるよりは行が増えるほうがいい
          */}
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <Money profit={d.profit} commission={d.commission} />
            <span className="text-xs tabular-nums text-ink3">
              {d.open_time || 'エントリー時刻が読み取れませんでした'}
            </span>
          </div>
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
