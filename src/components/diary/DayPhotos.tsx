import { useEffect, useRef, useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { fetchTradeImagesFor, fetchTradeScreenshots } from '../../lib/repo'
import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'
import ImageViewer from '../ImageViewer'

/**
 * その日に貼った写真を、横に流して見せるところ。
 *
 * 日記でいちばん上に置く。文字より先に写真が目に入ると、
 * その日のことを思い出しやすく、貼っておきたくなるため。
 *
 * 縦に積むと写真の数だけ画面が伸びて、下の文章まで届かなくなる。
 * 横に流せば場所は1枚ぶんで済み、指で送れる。
 */

interface Shot {
  key: string
  url: string
  caption: string | null
  tradeId: string
  at: string | null
}

interface Props {
  /** その日の取引。ここから写真を引く */
  trades: EnrichedTrade[]
  /** 「トレードを記録する」へ。写真が1枚も無いときに出す */
  onAdd?: () => void
}

export default function DayPhotos({ trades, onAdd }: Props) {
  const [shots, setShots] = useState<Shot[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Shot | null>(null)
  /** いま見えている枚目。下の点をひとつだけ濃くするのに使う */
  const [at, setAt] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // 取引の並びは日ごとに変わるので、id をつないだものを合図にする
  const ids = trades.map((t) => t.id).join(',')

  useEffect(() => {
    let alive = true
    const list = ids ? ids.split(',') : []
    if (list.length === 0) {
      setShots([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timeOf = new Map(trades.map((t) => [t.id, t.open_time]))

    Promise.all([fetchTradeImagesFor(list), fetchTradeScreenshots(list)])
      .then(([charts, screenshots]) => {
        if (!alive) return
        const out: Shot[] = []
        for (const im of charts) {
          if (!im.image) continue
          out.push({
            key: `c-${im.id}`,
            url: im.image,
            caption: im.caption ?? null,
            tradeId: im.trade_id,
            at: timeOf.get(im.trade_id) ?? null,
          })
        }
        for (const s of screenshots) {
          out.push({
            key: `s-${s.tradeId}`,
            url: s.url,
            caption: '記録したときのスクショ',
            tradeId: s.tradeId,
            at: timeOf.get(s.tradeId) ?? null,
          })
        }
        // 取引の早い順。その日の流れの通りに並ぶ
        out.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))
        setShots(out)
      })
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
    // trades は毎回作り直されるので、中身の合図だけを見る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  if (loading && shots.length === 0) {
    return <div className="h-44 animate-pulse rounded-2xl bg-sunken sm:h-56" />
  }

  if (shots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-4 py-9 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon name="camera" size={19} />
        </span>
        <p className="text-sm font-semibold">この日の写真はまだありません</p>
        <p className="text-xs leading-relaxed text-ink3">
          トレードの「チャート」からチャート画像を貼ると、ここに並びます。
        </p>
        {onAdd && (
          <button className="btn btn-primary mt-1" onClick={onAdd}>
            <Icon name="plus" size={16} />
            トレードを記録する
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        ref={boxRef}
        // 端まで写真を見せたいので、狭い画面では外側の余白ぶんだけ外へ出す
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: 'none', overscrollBehaviorX: 'contain' }}
        onScroll={(e) => {
          // 1枚ぶんの幅で割って、いま何枚目かを出す
          const el = e.currentTarget
          const card = el.firstElementChild as HTMLElement | null
          const step = card ? card.offsetWidth + 12 : el.clientWidth
          setAt(Math.max(0, Math.min(shots.length - 1, Math.round(el.scrollLeft / step))))
        }}
      >
        {shots.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setOpen(s)}
            className="group relative w-[80%] max-w-[440px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-sunken sm:w-[19rem]"
            aria-label={s.caption ?? 'チャートを大きく見る'}
          >
            <img
              src={s.url}
              alt={s.caption ?? 'チャート'}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
            {/* 文字が写真に埋もれないよう、下だけ暗く落とす */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
              style={{
                background: 'linear-gradient(to top, rgba(12,10,32,0.72), rgba(12,10,32,0))',
              }}
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-3 pb-2.5 text-left text-[11px] font-semibold text-white">
              {s.at && <span className="shrink-0 tabular-nums">{fmtJst(s.at, 'HH:mm')}</span>}
              <span className="truncate opacity-90">{s.caption ?? 'チャート'}</span>
              <span className="ml-auto shrink-0 opacity-90">
                <Icon name="search" size={13} />
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* 何枚あって、いま何枚目か。数字より点のほうが目に入る */}
      {shots.length > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1.5" aria-hidden="true">
          {shots.map((s, i) => (
            <span
              key={s.key}
              className={`h-1.5 rounded-full transition-all ${
                i === at ? 'w-4 bg-brand' : 'w-1.5 bg-brand/25'
              }`}
            />
          ))}
        </div>
      )}
      <p className="sr-only">チャート {shots.length}枚。横に送って見られます</p>

      {open && (
        <ImageViewer
          src={open.url}
          alt={open.caption ?? 'チャート'}
          caption={open.caption}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
