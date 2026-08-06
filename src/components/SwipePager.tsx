import { useEffect, useRef, useState } from 'react'

/** 横に振ったと決めるまでに必要な指の動き(px) */
const DECIDE = 8
/** ここまで動かしたら切り替える。画面幅に対する割合 */
const COMMIT_RATIO = 0.22
/** 割合が足りなくても、これだけ動かせば切り替える(px) */
const COMMIT_PX = 90
/** 端で引っぱったときの重さ。1に近いほど軽く動く */
const RUBBER = 0.3
/** 滑らせる時間(ms) */
const SLIDE_MS = 220

interface Props<T> {
  /** 切り替えられる順番 */
  items: T[]
  current: T
  onChange: (next: T) => void
  children: React.ReactNode
}

/**
 * スマホで、画面を指と一緒に横へ動かして隣に移る。
 *
 * 指を離してから切り替えるのではなく、動かしている間ずっと
 * 中身が付いてくる。どちらへ動いているかが手で分かるようにする。
 *
 * 気をつけていること:
 *  - 縦の動きが勝っていたら何もしない（縦スクロールを邪魔しない）
 *  - 日付の帯や表など、それ自体が横に動く場所から始めた指は無視する
 *  - 端では重くなって戻る（一周しないことが手で分かる）
 */
export default function SwipePager<T>({ items, current, onChange, children }: Props<T>) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  const [sliding, setSliding] = useState(false)

  // 指の動きは1フレームに何度も来るので、描画に関わらない値は ref に置く
  const g = useRef({
    active: false,
    x0: 0,
    y0: 0,
    lock: 'undecided' as 'undecided' | 'x' | 'y',
    width: 1,
  })

  const enabled = items.length > 1

  useEffect(() => {
    const el = boxRef.current
    if (!el || !enabled) return

    /**
     * 隣の位置。無ければ -1。
     *
     * 「隣が無い」を値そのもの（null）で表すと、
     * 「すべての口座」を null で渡している呼び出し側では
     * 端っこと同じ扱いになり、そこへ移れなくなる。
     * だから値ではなく番号で持つ。
     */
    const neighbourIndex = (dir: -1 | 1) => {
      const here = items.indexOf(current)
      if (here < 0) return -1
      const i = here + dir
      return i >= 0 && i < items.length ? i : -1
    }

    function onStart(e: TouchEvent) {
      if (sliding || e.touches.length !== 1) return
      const t = e.touches[0]
      if (insideHorizontalScroller(e.target)) return
      g.current = {
        active: true,
        x0: t.clientX,
        y0: t.clientY,
        lock: 'undecided',
        width: el!.clientWidth || 1,
      }
    }

    function onMove(e: TouchEvent) {
      const s = g.current
      if (!s.active) return
      const t = e.touches[0]
      const mx = t.clientX - s.x0
      const my = t.clientY - s.y0

      if (s.lock === 'undecided') {
        if (Math.abs(mx) < DECIDE && Math.abs(my) < DECIDE) return
        // 縦のほうが大きければ、これは縦スクロール。手を出さない。
        s.lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      }
      if (s.lock !== 'x') return

      // 行き先が無い方向は重くして、端だと分かるようにする
      const dir = mx < 0 ? 1 : -1
      const move = neighbourIndex(dir) < 0 ? mx * RUBBER : mx
      setDx(move)
    }

    function onEnd() {
      const s = g.current
      if (!s.active) return
      s.active = false
      if (s.lock !== 'x') return

      const moved = dxRef.current
      const dir: -1 | 1 = moved < 0 ? 1 : -1
      const ni = neighbourIndex(dir)
      const enough = Math.abs(moved) > Math.min(s.width * COMMIT_RATIO, COMMIT_PX)

      if (ni >= 0 && enough) {
        const next = items[ni]
        // いったん画面の外まで送り出してから、隣を入れ替える
        setSliding(true)
        setDx(dir === 1 ? -s.width : s.width)
        window.setTimeout(() => {
          onChange(next)
          // 反対側に置き直してから、するっと戻す
          setSliding(false)
          setDx(dir === 1 ? s.width : -s.width)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setSliding(true)
              setDx(0)
              window.setTimeout(() => setSliding(false), SLIDE_MS)
            })
          })
        }, SLIDE_MS)
      } else {
        // 足りなければ元の位置に戻す
        setSliding(true)
        setDx(0)
        window.setTimeout(() => setSliding(false), SLIDE_MS)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [items, current, onChange, enabled, sliding])

  // onEnd の中から最新の位置を読むための控え
  const dxRef = useRef(0)
  dxRef.current = dx

  if (!enabled) return <>{children}</>

  return (
    <div
      ref={boxRef}
      // 縦スクロールは browser に任せ、横だけこちらで受け持つ
      style={{ touchAction: 'pan-y' }}
      className="overflow-x-clip"
    >
      <div
        style={{
          transform: `translate3d(${dx}px, 0, 0)`,
          transition: sliding ? `transform ${SLIDE_MS}ms cubic-bezier(.22,.61,.36,1)` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** その要素自身か親が、横に動かせる入れ物か */
function insideHorizontalScroller(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el)
    if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) return true
    el = el.parentElement
  }
  return false
}
