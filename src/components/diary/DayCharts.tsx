import { useEffect, useRef, useState } from 'react'
import type { Photo } from '../../lib/journal'
import { newPhoto } from '../../lib/journal'
import { fileToDownscaledBlob } from '../../lib/image'
import { removeImages, signedUrls, uploadImage } from '../../lib/storage'
import { friendlyError } from '../../lib/errors'
import AutoTextarea from '../AutoTextarea'
import ImageViewer from '../ImageViewer'
import Icon from '../Icon'

/**
 * 記事のいちばん上に並べる、その日のチャート。
 *
 * ここは自分で貼るところ。取引に添付した画像や、取り込んだときの
 * スクショを勝手に持ってこない。取引の添付は「その1件の証拠」で、
 * ここは「その日を思い出すための絵」だから、役割が違う。
 * 見返したい絵は自分で選びたい。
 *
 * 1枚も無いときは、貼るための場所そのものを大きく置く。
 * 空っぽの枠を置くより、押せば貼れると分かるほうがいい。
 *
 * 画像そのものは持たない。Storage へ送って、置き場所だけを覚える。
 */

interface Props {
  photos: Photo[]
  onChange: (next: Photo[]) => void
  readOnly?: boolean
}

export default function DayCharts({ photos, onChange, readOnly }: Props) {
  /** 置き場所 → 見るための時限URL */
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [zoom, setZoom] = useState<Photo | null>(null)
  /** いま見えている枚目。下の点をひとつだけ濃くするのに使う */
  const [at, setAt] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const key = photos.map((p) => p.path).join(',')

  useEffect(() => {
    const need = photos.map((p) => p.path).filter((p) => !urls[p])
    if (need.length === 0) return
    let alive = true
    signedUrls(need)
      .then((m) => alive && setUrls((cur) => ({ ...cur, ...m })))
      .catch(() => {
        /* 出せなくても記事は読める */
      })
    return () => {
      alive = false
    }
    // 置き場所が増えたときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function add(files: FileList) {
    setBusy(true)
    setErr(null)
    try {
      const added: Photo[] = []
      // 何枚まとめて選ばれても、順番どおりに送る
      for (const f of Array.from(files)) {
        const blob = await fileToDownscaledBlob(f)
        added.push(newPhoto(await uploadImage(blob, 'day')))
      }
      onChange([...photos, ...added])
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function remove(p: Photo) {
    onChange(photos.filter((x) => x.id !== p.id))
    // 置き場所からも消す。失敗しても記事側はもう外れている
    void removeImages([p.path])
  }

  function setCaption(id: string, caption: string) {
    onChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)))
  }

  const picker = !readOnly && (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(e) => {
        const f = e.target.files
        if (f?.length) void add(f)
      }}
    />
  )

  // まだ1枚も無いとき
  if (photos.length === 0) {
    if (readOnly) return null
    return (
      <div>
        {picker}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand/40 bg-white/70 px-4 py-10 text-center transition-colors hover:bg-brand-soft disabled:opacity-60"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <Icon name="camera" size={20} />
          </span>
          <span className="text-[15px] font-bold text-brand">
            {busy ? '取り込んでいます…' : 'チャートを追加'}
          </span>
          <span className="text-[12px] leading-relaxed text-ink3">
            その日のチャートを貼ると、ここに並びます
          </span>
        </button>
        {err && <p className="mt-2 text-[12px] text-down">{err}</p>}
      </div>
    )
  }

  return (
    <div>
      {picker}

      <div
        // 端まで見せたいので、狭い画面では外側の余白ぶんだけ外へ出す。
        // scroll-pl も要る。これが無いと、吸い付く位置が余白を無視して
        // 1枚目だけ画面の左端に貼り付いてしまう
        className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-pl-0 sm:px-0"
        style={{ scrollbarWidth: 'none', overscrollBehaviorX: 'contain' }}
        onScroll={(e) => {
          const el = e.currentTarget
          const card = el.firstElementChild as HTMLElement | null
          const step = card ? card.offsetWidth + 12 : el.clientWidth
          setAt(Math.max(0, Math.min(photos.length - 1, Math.round(el.scrollLeft / step))))
        }}
      >
        {photos.map((p) => (
          <div
            key={p.id}
            className="relative w-[80%] max-w-[440px] shrink-0 snap-start sm:w-[19rem]"
          >
            <button
              type="button"
              onClick={() => urls[p.path] && setZoom(p)}
              // relative を付けること。付けないと、中の暗い覆いが
              // ひとつ外側の箱を基準にして、説明文まで覆ってしまう
              className="relative block w-full overflow-hidden rounded-2xl border border-line bg-sunken"
              aria-label={p.caption || 'チャートを大きく見る'}
            >
              {urls[p.path] ? (
                <img
                  src={urls[p.path]}
                  alt={p.caption || 'チャート'}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <span className="block aspect-[4/3] w-full animate-pulse bg-sunken" />
              )}

              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-2xl"
                style={{
                  background: 'linear-gradient(to top, rgba(12,10,32,0.66), rgba(12,10,32,0))',
                }}
              />
              <span className="pointer-events-none absolute bottom-2.5 right-3 text-white/90">
                <Icon name="search" size={14} />
              </span>
            </button>

            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label="このチャートを外す"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/55 text-white backdrop-blur-sm transition-colors hover:bg-down"
              >
                <Icon name="trash" size={13} />
              </button>
            )}

            {readOnly ? (
              p.caption && <p className="mt-1.5 text-[12px] text-ink3">{p.caption}</p>
            ) : (
              <AutoTextarea
                value={p.caption ?? ''}
                onChange={(e) => setCaption(p.id, e.target.value)}
                placeholder="説明（任意）"
                className="mt-1.5 text-[12px] leading-relaxed text-ink3"
              />
            )}
          </div>
        ))}

        {/* 最後にもう1枚足すところ。並びの続きに置くのが分かりやすい */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex aspect-[4/3] w-[38%] max-w-[210px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-brand/40 bg-white/70 text-brand transition-colors hover:bg-brand-soft disabled:opacity-60 sm:w-[9rem]"
          >
            <Icon name="plus" size={20} />
            <span className="px-2 text-center text-[12px] font-bold leading-tight">
              {busy ? '取り込み中…' : 'チャートを追加'}
            </span>
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1.5" aria-hidden="true">
          {photos.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 rounded-full transition-all ${
                i === at ? 'w-4 bg-brand' : 'w-1.5 bg-brand/25'
              }`}
            />
          ))}
        </div>
      )}
      <p className="sr-only">チャート {photos.length}枚。横に送って見られます</p>

      {err && <p className="mt-2 text-[12px] text-down">{err}</p>}

      {zoom && urls[zoom.path] && (
        <ImageViewer
          src={urls[zoom.path]}
          alt={zoom.caption || 'チャート'}
          caption={zoom.caption}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  )
}
