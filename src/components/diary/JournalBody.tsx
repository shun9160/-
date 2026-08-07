import { useEffect, useRef, useState } from 'react'
import type { Block } from '../../lib/journal'
import { newImage, newText } from '../../lib/journal'
import { fileToDownscaledBlob } from '../../lib/image'
import { uploadImage, signedUrls } from '../../lib/storage'
import { friendlyError } from '../../lib/errors'
import AutoTextarea from '../AutoTextarea'
import ImageViewer from '../ImageViewer'
import Icon from '../Icon'

/**
 * 記事の本文。文章と画像が縦に続く。
 *
 * 「文章の欄」と「画像の欄」に分けない。分けると、書く前に
 * どこに何を入れるかを決めさせることになる。日記はそうではなく、
 * 書いていて「ここでチャートを見せたい」と思ったところに挟むもの。
 *
 * 中身は塊（ブロック）の並びとして持つ。文章の塊のあいだに
 * 画像の塊が入る。画像を入れると、そのすぐ下に新しい文章の塊を
 * 作って、そのまま書き続けられるようにする。
 *
 * 画像そのものは持たない。Storage へ送って、置き場所だけを覚える。
 */

interface Props {
  blocks: Block[]
  onChange: (next: Block[]) => void
  readOnly?: boolean
}

export default function JournalBody({ blocks, onChange, readOnly }: Props) {
  /** 置き場所 → 見るための時限URL */
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  /** どの塊の下に入れるか。null なら末尾 */
  const pickAfter = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 画像の時限URLは、まだ持っていないものだけ作る
  const paths = blocks
    .filter((b): b is Extract<Block, { kind: 'image' }> => b.kind === 'image')
    .map((b) => b.path)
  const key = paths.join(',')

  useEffect(() => {
    const need = paths.filter((p) => !urls[p])
    if (need.length === 0) return
    let alive = true
    signedUrls(need)
      .then((m) => alive && setUrls((cur) => ({ ...cur, ...m })))
      .catch(() => {
        /* 出せなくても文章は読める */
      })
    return () => {
      alive = false
    }
    // 置き場所が増えたときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  function setText(id: string, text: string) {
    onChange(blocks.map((b) => (b.id === id && b.kind === 'text' ? { ...b, text } : b)))
  }

  function setCaption(id: string, caption: string) {
    onChange(blocks.map((b) => (b.id === id && b.kind === 'image' ? { ...b, caption } : b)))
  }

  function removeBlock(id: string) {
    const next = blocks.filter((b) => b.id !== id)
    // 全部消えたら、書き始められる空の塊を1つ残す
    onChange(next.length ? merged(next) : [newText()])
  }

  async function addImage(file: File) {
    setBusy(true)
    setErr(null)
    try {
      const blob = await fileToDownscaledBlob(file)
      const path = await uploadImage(blob, 'journal')
      const image = newImage(path)
      // 画像のすぐ下に、続きを書ける場所を用意する
      const after = pickAfter.current
      const at = after ? blocks.findIndex((b) => b.id === after) + 1 : blocks.length
      const next = [...blocks]
      next.splice(at, 0, image, newText())
      onChange(next)
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
      pickAfter.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function openPicker(afterId: string | null) {
    pickAfter.current = afterId
    fileRef.current?.click()
  }

  // 見るだけのときは、書いてあるところだけを出す
  const shown = readOnly ? blocks.filter((b) => b.kind === 'image' || b.text.trim()) : blocks

  return (
    <div>
      {shown.map((b, i) =>
        b.kind === 'text' ? (
          <div key={b.id} className="group/blk relative">
            {readOnly ? (
              <p className="whitespace-pre-wrap text-[16px] leading-[1.95] text-ink">{b.text}</p>
            ) : (
              <AutoTextarea
                value={b.text}
                onChange={(e) => setText(b.id, e.target.value)}
                placeholder={i === 0 ? '今日のトレードについて書いてみよう。' : ''}
                className="text-[16px] leading-[1.95] text-ink"
                minHeight={i === 0 ? 128 : 34}
              />
            )}

            {/*
              この文章の下に画像を挟む。ふだんは隠しておき、
              その文章に触れている間だけ出す。

              hover だけにすると、指で使う端末では一生出てこない。
              focus-within を併せて、書いている塊の下にだけ出るようにする。
            */}
            {!readOnly && (
              <button
                type="button"
                // 指を離す前に消えると押せないので、押し下げの時点で開く
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => openPicker(b.id)}
                className="mt-0.5 flex items-center gap-1 rounded-lg py-1 text-[12px] font-semibold text-brand opacity-0 transition-opacity focus:opacity-100 group-focus-within/blk:opacity-100 group-hover/blk:opacity-100"
              >
                <Icon name="camera" size={13} />
                ここにチャートを挟む
              </button>
            )}
          </div>
        ) : (
          <figure key={b.id} className="my-4">
            <button
              type="button"
              onClick={() => urls[b.path] && setZoom(urls[b.path])}
              className="block w-full overflow-hidden rounded-2xl border border-line bg-sunken"
              aria-label="チャートを大きく見る"
            >
              {urls[b.path] ? (
                <img src={urls[b.path]} alt={b.caption || 'チャート'} className="w-full" />
              ) : (
                <span className="block h-40 animate-pulse bg-sunken" />
              )}
            </button>

            <figcaption className="mt-1.5 flex items-start gap-2">
              {readOnly ? (
                b.caption && <span className="text-[12px] text-ink3">{b.caption}</span>
              ) : (
                <>
                  <AutoTextarea
                    value={b.caption ?? ''}
                    onChange={(e) => setCaption(b.id, e.target.value)}
                    placeholder="このチャートの説明（任意）"
                    className="text-[12px] leading-relaxed text-ink3"
                  />
                  <button
                    type="button"
                    onClick={() => removeBlock(b.id)}
                    className="shrink-0 rounded-lg p-1 text-ink3 transition-colors hover:bg-down-soft hover:text-down"
                    aria-label="この画像を外す"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </>
              )}
            </figcaption>
          </figure>
        ),
      )}

      {!readOnly && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void addImage(f)
            }}
          />
          <button
            type="button"
            onClick={() => openPicker(null)}
            disabled={busy}
            className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-brand/35 px-3 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-soft disabled:opacity-50"
          >
            <Icon name="camera" size={15} />
            {busy ? '取り込んでいます…' : 'チャートを追加'}
          </button>
        </>
      )}

      {err && <p className="mt-2 text-[12px] text-down">{err}</p>}

      {zoom && <ImageViewer src={zoom} alt="チャート" onClose={() => setZoom(null)} />}
    </div>
  )
}

/** 画像を外したあとに、文章の塊が2つ続いたらつなげる */
function merged(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    const prev = out[out.length - 1]
    if (b.kind === 'text' && prev?.kind === 'text') {
      out[out.length - 1] = { ...prev, text: [prev.text, b.text].filter(Boolean).join('\n\n') }
    } else {
      out.push(b)
    }
  }
  return out
}
