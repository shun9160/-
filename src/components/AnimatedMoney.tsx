import { useLayoutEffect, useRef } from 'react'
import { colorOf, fmtMoney } from '../lib/format'
import { currencyLabel } from '../lib/appConfig'

interface Props {
  value: number
  /** 符号（＋/−）を付ける。損益なら付ける */
  sign?: boolean
  /** 損益の色（緑／赤）を付ける。残高など、色を付けたくないときは false */
  colored?: boolean
  /** うしろに通貨（円など）を出す */
  unit?: boolean
  /** 通貨の見た目 */
  unitClassName?: string
  className?: string
  /** 動く時間(ms) */
  duration?: number
  /** 動かさない。表の中など、数が多い場所で使う */
  animate?: boolean
}

/** 既定の長さ。短いと安っぽく、長いと待たされるので、この辺り */
const DURATION = 1100

/**
 * 金額のカウントアップ。
 *
 * 0 から目標の額まで数字が上がっていき、上がりきったところで
 * 光が左から右へ一度だけ流れる。
 *
 * 作りで気をつけていること:
 *  - 1コマごとに React を描き直さない。数字は ref から直接書き換える。
 *    そうしないと、1秒間に60回ぶんの再描画が画面全体に走る。
 *  - 桁がズレないよう tabular-nums（数字の幅が揃う書体設定）を使う。
 *  - 「動きを減らす」設定の端末では、動かさずに最後の値をそのまま出す。
 */
export default function AnimatedMoney({
  value,
  sign = true,
  colored = true,
  unit = false,
  unitClassName = 'ml-1 text-base font-semibold text-ink3',
  className = '',
  duration = DURATION,
  animate = true,
}: Props) {
  const numRef = useRef<HTMLSpanElement>(null)
  const sheenRef = useRef<HTMLSpanElement>(null)
  const boxRef = useRef<HTMLSpanElement>(null)
  /** いま出している数。次に動かすときの出発点になる */
  const shown = useRef(0)

  // useEffect ではなく useLayoutEffect。
  // 描く前に0へ戻しておかないと、最初の1コマだけ最終値がちらっと見えてしまう。
  useLayoutEffect(() => {
    const num = numRef.current
    const box = boxRef.current
    if (!num || !box) return

    // 目標が整数なら、途中も整数で出す。小数が出たり消えたりすると桁が踊る。
    const decimals = Number.isInteger(value) ? 0 : 2
    const round = (v: number) => Number(v.toFixed(decimals))
    const draw = (v: number) => {
      num.textContent = fmtMoney(round(v), { sign })
    }

    const finish = () => {
      shown.current = value
      draw(value)
      box.style.transform = ''
      sweep()
    }

    /** 上がりきったあと、光を一度だけ流す */
    const sweep = () => {
      const sheen = sheenRef.current
      if (!sheen || !animate || reduced()) return
      sheen.textContent = num.textContent
      sheen.classList.remove('money-sheen')
      // クラスを付け直すだけでは再生されないので、一度レイアウトを読ませる
      void sheen.offsetWidth
      sheen.classList.add('money-sheen')
    }

    const from = shown.current
    if (!animate || reduced() || from === value) {
      finish()
      return
    }

    // 先に出発点を描いておく。ここで描かないと、次のコマが来るまでのあいだ
    // React が置いた「最終値」がそのまま見えてしまう。
    draw(from)

    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      // now は「そのコマの開始時刻」なので、t0 より前になることがある。
      // 0 未満にしないと、一瞬だけ逆向き（マイナス側）に飛ぶ。
      const p = Math.min(1, Math.max(0, (now - t0) / duration))
      draw(from + (value - from) * ease(p))
      box.style.transform = `scale(${scaleAt(p).toFixed(4)})`
      if (p < 1) raf = requestAnimationFrame(tick)
      else finish()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, sign, duration, animate])

  return (
    <span
      ref={boxRef}
      className={`relative inline-block origin-left whitespace-nowrap tabular-nums will-change-transform ${
        colored ? colorOf(value) : ''
      } ${className}`}
    >
      <span ref={numRef}>{fmtMoney(value, { sign })}</span>
      {/* 光。数字の形だけに乗るよう、同じ文字を重ねて背景を切り抜いている */}
      <span ref={sheenRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0" />
      {unit && <span className={unitClassName}>{currencyLabel()}</span>}
    </span>
  )
}

/** この端末が「動きを減らす」設定か */
function reduced(): boolean {
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
