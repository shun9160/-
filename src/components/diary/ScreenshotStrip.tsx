import { useState } from 'react'
import type { TradeImage } from '../../lib/types'
import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'

interface Props {
  images: TradeImage[]
  /** その画像の取引の時刻。無ければ null */
  timeOf: (tradeId: string) => string | null
  /** 画像を押したときに、その取引の日を開く */
  onOpenTrade: (tradeId: string) => void
}

/** 最近貼ったチャート画像。押すとその取引の日に飛ぶ */
export default function ScreenshotStrip({ images, timeOf, onOpenTrade }: Props) {
  const [zoom, setZoom] = useState<TradeImage | null>(null)

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon name="camera" size={13} />
        </span>
        <h3 className="text-sm font-bold">最近のチャート</h3>
      </div>

      {images.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs leading-relaxed text-ink3">
          まだ貼っていません。
          <br />
          取引の「チャート」から画像を追加できます。
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {images.map((im) => {
            const at = timeOf(im.trade_id)
            return (
              <li key={im.id}>
                <button
                  className="block w-full text-left"
                  onClick={() => setZoom(im)}
                  title={im.caption ?? undefined}
                >
                  <img
                    src={im.image}
                    alt={im.caption ?? 'チャート'}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-lg border border-line object-cover"
                  />
                  <span className="mt-1 block truncate text-[10px] text-ink3">
                    {im.caption || (at ? fmtJst(at, 'M/d HH:mm') : '—')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
          role="dialog"
          aria-label="チャート"
          onClick={() => setZoom(null)}
        >
          <div className="max-h-full w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoom.image}
              alt={zoom.caption ?? 'チャート'}
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                className="btn btn-primary"
                onClick={() => {
                  onOpenTrade(zoom.trade_id)
                  setZoom(null)
                }}
              >
                この取引の日を開く
                <Icon name="right" size={15} />
              </button>
              <button className="btn btn-quiet" onClick={() => setZoom(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
