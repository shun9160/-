import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useInView } from '../lib/useInView'

interface Props {
  /** 出したい数。まだ出せないときは null */
  value: number | null
  /** 数を文字にする。fmtMoney や fmtPct などを渡す */
  format: (n: number) => string
  /** value が null／∞ のときに出す文字 */
  fallback?: string
  /**
   * 動いている途中の丸め方。
   * 省略すると丸めずに format へ渡す（format 側が丸める前提）。
   * 「14件」のように整数で見せたいものは 0 を渡す。
   */
  decimals?: number
  /** ふくらむときの軸。右そろえの数字は 'right' にする */
  origin?: 'left' | 'center' | 'right'
  /** 止まったあと、光を一度流す。主役の数字だけ true にする */
  sheen?: boolean
  className?: string
  /** 動く時間(ms) */
  duration?: number
  /** 動かさない。表の中など、数が多い場所で使う */
  animate?: boolean
  /** うしろに付ける単位など。数字と一緒に動かず、その場に残る */
  children?: ReactNode
}

/** 既定の長さ。短いと安っぽく、長いと待たされるので、この辺り */
export const DURATION = 1100

/**
 * 数字のカウントアップ。
 *
 * 0 から目標の数まで上がっていき、主役の数字だけ、
 * 上がりきったところで光が左から右へ一度だけ流れる。
 *
 * 作りで気をつけていること:
 *  - 1コマごとに React を描き直さない。数字は ref から直接書き換える。
 *    そうしないと、1秒間に60回ぶんの再描画が画面全体に走る。
 *  - 桁がズレないよう tabular-nums（数字の幅が揃う書体設定）を使う。
 *  - 「動きを減らす」設定の端末では、動かさずに最後の値をそのまま出す。
 */
export default function AnimatedNumber({
  value,
  format,
  fallback = '—',
  decimals,
  origin = 'left',
  sheen = false,
  className = '',
  duration = DURATION,
  animate = true,
  children,
}: Props) {
  const numRef = useRef<HTMLSpanElement>(null)
  const sheenRef = useRef<HTMLSpanElement>(null)
  // 画面に入ってから動かす。スマホだと、下のほうのカードは
  // 開いた時点ではまだ見えていないため
  const [boxRef, inView] = useInView<HTMLSpanElement>()
  /** いま出している数。次に動かすときの出発点になる */
  const shown = useRef(0)

  const target = value != null && Number.isFinite(value) ? value : null

  // useEffect ではなく useLayoutEffect。
  // 描く前に出発点へ戻しておかないと、最初の1コマだけ最終値がちらっと見えてしまう。
  useLayoutEffect(() => {
    const num = numRef.current
    const box = boxRef.current
    if (!num || !box) return

    if (target == null) {
      // 出せる数がない。次に数が入ったら 0 から上げ直す
      shown.current = 0
      num.textContent = fallback
      box.style.transform = ''
      return
    }

    const round = (v: number) => (decimals == null ? v : Number(v.toFixed(decimals)))
    const draw = (v: number) => {
      num.textContent = format(round(v))
    }

    const finish = () => {
      shown.current = target
      draw(target)
      box.style.transform = ''
      sweep()
    }

    /** 上がりきったあと、光を一度だけ流す */
    const sweep = () => {
      const el = sheenRef.current
      if (!el || !sheen || !animate || reduced()) return
      el.textContent = num.textContent
      el.classList.remove('money-sheen')
      // クラスを付け直すだけでは再生されないので、一度レイアウトを読ませる
      void el.offsetWidth
      el.classList.add('money-sheen')
    }

    const from = shown.current

    // まだ画面に入っていない。出発点だけ描いて、入るまで待つ
    if (!inView) {
      draw(from)
      return
    }

    if (!animate || reduced() || from === target) {
      finish()
      return
    }

    // 先に出発点を描いておく。ここで描かないと、次のコマが来るまでのあいだ
    // React が置いた「最終値」がそのまま見えてしまう。
    draw(from)
    // 前回の光に残っていた古い数字を消しておく
    if (sheenRef.current) {
      sheenRef.current.classList.remove('money-sheen')
      sheenRef.current.textContent = ''
    }

    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      // now は「そのコマの開始時刻」なので、t0 より前になることがある。
      // 0 未満にしないと、一瞬だけ逆向き（マイナス側）に飛ぶ。
      const p = Math.min(1, Math.max(0, (now - t0) / duration))
      draw(from + (target - from) * ease(p))
      box.style.transform = `scale(${scaleAt(p).toFixed(4)})`
      if (p < 1) raf = requestAnimationFrame(tick)
      else finish()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // format は毎回作り直される関数なので、依存に入れると毎描画で動き直してしまう
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, fallback, decimals, duration, animate, sheen, inView])

  const ORIGIN = { left: 'origin-left', center: 'origin-center', right: 'origin-right' }[origin]

  return (
    <span
      ref={boxRef}
      className={`relative inline-block whitespace-nowrap tabular-nums will-change-transform ${ORIGIN} ${className}`}
    >
      <span ref={numRef}>{target != null ? format(target) : fallback}</span>
      {/* 光。数字の形だけに乗るよう、同じ文字を重ねて背景を切り抜いている */}
      {sheen && (
        <span ref={sheenRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0" />
      )}
      {children}
    </span>
  )
}

/** この端末が「動きを減らす」設定か */
export function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * easeOutExpo。最初にぐっと伸びて、あとはゆっくり近づく。
 * 終わりぎわだけ、さらに一段やわらかく止める。
 */
function ease(p: number): number {
  if (p >= 1) return 1
  const TAIL = 0.85
  const expo = (x: number) => 1 - Math.pow(2, -10 * x)
  if (p <= TAIL) return expo(p)
  const q = (p - TAIL) / (1 - TAIL)
  const soft = q * q * (3 - 2 * q)
  const at = expo(TAIL)
  return at + (1 - at) * soft
}

/** 0.98 → 1.04 → 1.00。数字が動いているあいだの軽いふくらみ */
function scaleAt(p: number): number {
  const PEAK = 0.22
  if (p < PEAK) return 0.98 + (1.04 - 0.98) * (p / PEAK)
  const q = (p - PEAK) / (1 - PEAK)
  return 1.04 + (1.0 - 1.04) * (q * q * (3 - 2 * q))
}
