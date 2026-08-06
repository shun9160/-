import { useEffect, useRef, useState } from 'react'
import type { TradeImage } from '../lib/types'
import {
  addTradeImages,
  deleteTradeImage,
  fetchTradeImages,
  findSavedImageHashes,
  updateTradeImageCaption,
} from '../lib/repo'
import { fileToDownscaledDataUrl } from '../lib/image'
import { friendlyError } from '../lib/errors'
import { hashFile } from '../lib/imageHash'
import { duplicateMessage } from './ChartPicker'
import Icon from './Icon'

// チャートは細い線と数字を見るので、スクショより少し大きめ・高画質で残す。
const MAX_DIM = 1600
const QUALITY = 0.82

interface Props {
  tradeId: string
  readOnly?: boolean
  /** 枚数が変わったら知らせる（一覧のバッジ更新用） */
  onCountChange?: (n: number) => void
}

export default function ChartImages({ tradeId, readOnly, onCountChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<TradeImage[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** 拡大表示する画像 */
  const [zoom, setZoom] = useState<TradeImage | null>(null)

  useEffect(() => {
    let alive = true
    fetchTradeImages(tradeId)
      .then((rows) => {
        if (!alive) return
        setImages(rows)
        onCountChange?.(rows.length)
      })
      .catch((e) => alive && setErr(friendlyError(e)))
    return () => {
      alive = false
    }
    // tradeId が変わったときだけ読み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setBusy(true)
    setErr(null)
    try {
      // 指紋は縮小前の元ファイルから作る
      const incoming = await Promise.all(
        files.map(async (f) => ({
          hash: await hashFile(f),
          image: await fileToDownscaledDataUrl(f, MAX_DIM, QUALITY),
        })),
      )

      // この取引に貼ってあるぶん + 過去に登録したぶん の両方と見比べる
      const known = new Set((images ?? []).map((x) => x.image_hash).filter(Boolean) as string[])
      const saved = await findSavedImageHashes(incoming.map((x) => x.hash)).catch(
        () => new Set<string>(), // 照合できなくても登録は続ける
      )

      const keep: { image: string; hash: string }[] = []
      let already = 0
      let past = 0
      for (const x of incoming) {
        if (known.has(x.hash)) {
          already++
          continue
        }
        if (saved.has(x.hash)) {
          past++
          continue
        }
        known.add(x.hash)
        keep.push(x)
      }

      if (keep.length) {
        const added = await addTradeImages(tradeId, keep)
        const next = [...(images ?? []), ...added]
        setImages(next)
        onCountChange?.(next.length)
      }
      setErr(duplicateMessage(keep.length, already, past))
    } catch (e2) {
      setErr(friendlyError(e2))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function remove(img: TradeImage) {
    if (!confirm('このチャート画像を削除します。よろしいですか？')) return
    try {
      await deleteTradeImage(img.id)
      const next = (images ?? []).filter((x) => x.id !== img.id)
      setImages(next)
      onCountChange?.(next.length)
      if (zoom?.id === img.id) setZoom(null)
    } catch (e) {
      setErr(friendlyError(e))
    }
  }

  async function saveCaption(img: TradeImage, caption: string) {
    const trimmed = caption.trim()
    if (trimmed === (img.caption ?? '')) return
    try {
      await updateTradeImageCaption(img.id, trimmed)
      setImages((list) =>
        (list ?? []).map((x) => (x.id === img.id ? { ...x, caption: trimmed || null } : x)),
      )
    } catch (e) {
      setErr(friendlyError(e))
    }
  }

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="label">チャート</p>
        {!readOnly && (
          <button
            className="btn btn-quiet"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Icon name="upload" size={15} />
            {busy ? '取り込み中…' : '画像を追加'}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {err && <p className="mb-2 whitespace-pre-wrap text-sm text-down">{err}</p>}

      {images === null ? (
        <p className="text-xs text-ink3">読み込み中…</p>
      ) : images.length === 0 ? (
        <p className="text-xs text-ink3">
          {readOnly
            ? 'チャート画像はありません'
            : 'エントリーや決済のチャートを貼ると、あとで根拠を見返せます。何枚でも追加できます。'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.id} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setZoom(img)}
                className="overflow-hidden rounded-xl border border-line bg-sunken transition-colors hover:border-brand"
                aria-label="チャートを大きく見る"
              >
                <img
                  src={img.image}
                  alt={img.caption ?? 'この取引のチャート'}
                  className="h-28 w-full object-cover"
                  loading="lazy"
                />
              </button>
              {readOnly ? (
                img.caption && <p className="text-xs text-ink2">{img.caption}</p>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    className="input px-2 py-1 text-xs"
                    defaultValue={img.caption ?? ''}
                    placeholder="説明（任意）"
                    onBlur={(e) => saveCaption(img, e.target.value)}
                  />
                  <button
                    className="btn btn-danger px-1.5"
                    onClick={() => remove(img)}
                    aria-label="このチャートを削除"
                    title="削除"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {zoom && <Lightbox img={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}

/** 画面いっぱいに広げてチャートを見る */
function Lightbox({ img, onClose }: { img: TradeImage; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={img.caption ?? 'チャート'}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 p-4 backdrop-blur-sm"
    >
      <img
        src={img.image}
        alt={img.caption ?? 'チャート'}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-xl bg-surface object-contain"
      />
      <div className="mt-3 flex items-center gap-3">
        {img.caption && <p className="text-sm font-semibold text-white">{img.caption}</p>}
        <button className="btn btn-quiet" onClick={onClose}>
          <Icon name="close" size={15} />
          閉じる
        </button>
      </div>
    </div>
  )
}
