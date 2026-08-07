import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * その要素が画面に入ったかどうか。
 *
 * スマホは画面が縦に長く、下のほうのカードは開いた時点では見えていない。
 * 見えていないあいだに数字が上がりきってしまうと、
 * スクロールして辿り着いたときには止まったあとになってしまう。
 * そこで「画面に入ってから動かす」ためにこれを使う。
 *
 * 一度入ったら、そのあとは true のまま。
 * 上下にスクロールするたび動き直すと、うるさくて落ち着かないため。
 */
export function useInView<T extends Element>(
  /**
   * 画面の縁からどれだけ手前で「入った」ことにするか。
   *
   * 既定は 0。少しでも顔を出したら動かす。
   * 「もう少し入ってから」と内側にずらすと、ページのいちばん下にある
   * カードが、それ以上スクロールできないせいで永久に動き出さなくなる。
   */
  rootMargin = '0px',
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (inView) return
    const el = ref.current
    if (!el) return

    // 古い端末など、この仕組みがない場合はすぐ動かす（止まったままより良い）
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin, threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView, rootMargin])

  return [ref, inView]
}

/**
 * 画面に入るまで 0、入ったら本来の値を返す。
 * 帯や輪のように、CSS の transition で伸ばすものに使う。
 */
export function useReveal<T extends Element>(value: number): [RefObject<T>, number] {
  const [ref, inView] = useInView<T>()
  return [ref, inView ? value : 0]
}
