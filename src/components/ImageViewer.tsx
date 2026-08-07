import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Icon from './Icon'

/**
 * 画像を画面いっぱいに出して見るところ。
 *
 * これまでの作りの問題:
 *  - 高さを 75vh などで決めていた。スマホの vh はアドレスバーを
 *    含んだ高さなので、実際に見えている範囲より大きく、下が切れていた
 *  - 画像の下にボタンを置いていたので、合計が画面を超えてはみ出していた
 *  - 後ろのページが動くので、指で送ると裏側がスクロールしていた
 *  - 拡大できないので、細かいローソク足が読めなかった
 *
 * 直し方:
 *  - 高さは dvh（いま実際に見えている高さ）で取る
 *  - 画像の場所とボタンの場所を分け、画像は「余った分」に収める。
 *    どんな縦横比でもはみ出さない
 *  - 開いているあいだは後ろを止める
 *  - つまむ・二本指・ダブルタップで拡大。拡大中は指でずらせる
 */

interface Props {
  src: string
  alt?: string
  /** 画像の下に出す説明 */
  caption?: string | null
  onClose: () => void
  /** 右下に置く操作。「この取引を開く」など */
  actions?: ReactNode
}

/** 拡大の上限と下限 */
const MIN = 1
const MAX = 5
/** ダブルタップ1回で、どこまで寄るか */
const STEP = 2.5

export default function ImageViewer({ src, alt, caption, onClose, actions }: Props) {
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  /** いま触れている指。2本になったら「つまむ」操作にする */
  const points = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const lastTap = useRef(0)

  const reset = useCallback(() => {
    setScale(1)
    setTx(0)
    setTy(0)
  }, [])

  // 後ろのページが動かないようにする。
  //
  // body に overflow: hidden を掛ける手が一般的だが、このアプリは
  // html と body の高さを 100% にしているため、掛けた瞬間に
  // スクロールできる高さが消え、見ていた位置が先頭に飛んでしまう。
  // body ごと固定する手も、閉じたあと元の位置に戻せなかった。
  //
  // そこで裏側には一切触らず、この覆い自体で指の動きを受け止める
  // （下の touchAction: none）。位置はそのまま残る。

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 画像が変わったら、拡大の状態は持ち越さない
  useEffect(reset, [src, reset])

  /** 拡大したぶんだけ、ずらせる範囲も広げる */
  function clampPan(x: number, y: number, s: number) {
    const el = boxRef.current
    if (!el) return { x, y }
    const limX = (el.clientWidth * (s - 1)) / 2
    const limY = (el.clientHeight * (s - 1)) / 2
    return {
      x: Math.max(-limX, Math.min(limX, x)),
      y: Math.max(-limY, Math.min(limY, y)),
    }
  }

  function apply(s: number, x = tx, y = ty) {
    const next = Math.max(MIN, Math.min(MAX, s))
    const p = next === 1 ? { x: 0, y: 0 } : clampPan(x, y, next)
    setScale(next)
    setTx(p.x)
    setTy(p.y)
  }

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (points.current.size === 2) {
      const [a, b] = [...points.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale }
      drag.current = null
      return
    }
    if (scale > 1) {
      drag.current = { x: e.clientX, y: e.clientY, tx, ty }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!points.current.has(e.pointerId)) return
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pinch.current && points.current.size === 2) {
      const [a, b] = [...points.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current.dist > 0) apply((pinch.current.scale * dist) / pinch.current.dist)
      return
    }
    if (drag.current) {
      const d = drag.current
      apply(scale, d.tx + (e.clientX - d.x), d.ty + (e.clientY - d.y))
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    points.current.delete(e.pointerId)
    if (points.current.size < 2) pinch.current = null
    if (points.current.size === 0) drag.current = null
  }

  /** 素早く2回たたいたら、寄る／戻る */
  function onTap(e: React.MouseEvent) {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      apply(scale > 1 ? 1 : STEP)
      return
    }
    lastTap.current = now
    // 1回だけのときは、少し待ってから「何もない所を押した＝閉じる」
    window.setTimeout(() => {
      if (lastTap.current !== now) return
      if (scale === 1 && e.currentTarget === e.target) onClose()
    }, 300)
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return
    apply(scale * (e.deltaY > 0 ? 0.9 : 1.1))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? '画像'}
      className="fixed inset-0 z-[60] flex flex-col bg-ink/95 backdrop-blur-sm"
      style={{
        // dvh は「いま実際に見えている高さ」。vh と違ってアドレスバーを含まない
        height: '100dvh',
        // ここで指の動きを受け止める。裏のページには渡さない
        touchAction: 'none',
        overscrollBehavior: 'contain',
      }}
    >
      {/* 上の帯。閉じると、拡大を戻す */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-3 pt-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <span className="min-w-0 truncate text-xs text-white/70">{caption || ''}</span>
        <div className="flex shrink-0 items-center gap-1">
          {scale > 1 && (
            <button
              onClick={reset}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15"
            >
              もとの大きさ
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/15"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      </div>

      {/* 画像。余った高さに収める。ここが伸び縮みするので、はみ出さない */}
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onTap}
        onWheel={onWheel}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3"
        // ブラウザに指の動きを取られると、つまむ操作が効かない
        style={{ touchAction: 'none' }}
      >
        <img
          src={src}
          alt={alt ?? '画像'}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: drag.current || pinch.current ? 'none' : 'transform 180ms ease-out',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
        />
      </div>

      {/* 下の帯。ボタンはここに固定するので、画像を押し出さない */}
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 pb-3 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <p className="text-[11px] text-white/50">
          {scale > 1 ? '指でずらせます' : '2本指かダブルタップで拡大'}
        </p>
        {actions}
      </div>
    </div>
  )
}
