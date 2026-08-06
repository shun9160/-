import { useRef } from 'react'
import type { AccountFilter } from './useTrades'

/** 横に振ったと認めるまでの距離(px) */
const MIN_DISTANCE = 60
/** 縦より横に、これだけ大きく動いていること */
const HORIZONTAL_RATIO = 1.4

/**
 * スマホで左右に振って、見る口座を切り替える。
 *
 * 気をつけていること:
 *  - 縦スクロールを邪魔しない（縦の動きが勝っていたら何もしない）
 *  - 日付の帯や表など、それ自体が横スクロールする場所から始めた指は無視する
 *  - 端では止まる（一周しない）ので、いま端にいることが分かる
 */
export function useAccountSwipe(
  order: AccountFilter[],
  current: AccountFilter,
  onChange: (id: AccountFilter) => void,
) {
  const start = useRef<{ x: number; y: number; ignore: boolean } | null>(null)

  if (order.length < 2) return {}

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) {
      start.current = null
      return
    }
    const t = e.touches[0]
    start.current = {
      x: t.clientX,
      y: t.clientY,
      ignore: startsInsideHorizontalScroller(e.target),
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = start.current
    start.current = null
    if (!s || s.ignore) return

    const t = e.changedTouches[0]
    if (!t) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < MIN_DISTANCE) return
    if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return

    const i = order.findIndex((x) => x === current)
    if (i < 0) return
    // 左に振ったら次の口座へ
    const next = dx < 0 ? i + 1 : i - 1
    if (next < 0 || next >= order.length) return
    onChange(order[next])
  }

  return { onTouchStart, onTouchEnd }
}

/** その要素自身か親が、横に動かせる入れ物か */
function startsInsideHorizontalScroller(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el)
    const scrollable = /(auto|scroll)/.test(style.overflowX)
    if (scrollable && el.scrollWidth > el.clientWidth + 1) return true
    el = el.parentElement
  }
  return false
}
