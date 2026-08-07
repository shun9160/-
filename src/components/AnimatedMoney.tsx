import { colorOf, fmtMoney } from '../lib/format'
import { currencyLabel } from '../lib/appConfig'
import AnimatedNumber, { DURATION } from './AnimatedNumber'

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
  /** ふくらむときの軸。右そろえの数字は 'right' にする */
  origin?: 'left' | 'center' | 'right'
  /** 止まったあと、光を一度流す。主役の金額だけ true にする */
  sheen?: boolean
  className?: string
  /** 動く時間(ms) */
  duration?: number
  /** 動かさない。表の中など、数が多い場所で使う */
  animate?: boolean
}

/**
 * 金額のカウントアップ。
 * 中身は AnimatedNumber と同じで、金額用の書式・色をあらかじめ入れてある。
 */
export default function AnimatedMoney({
  value,
  sign = true,
  colored = true,
  unit = false,
  unitClassName = 'ml-1 text-base font-semibold text-ink3',
  origin = 'left',
  sheen = true,
  className = '',
  duration = DURATION,
  animate = true,
}: Props) {
  return (
    <AnimatedNumber
      value={value}
      // 目標が整数なら、途中も整数で出す。小数が出たり消えたりすると桁が踊る
      decimals={Number.isInteger(value) ? 0 : 2}
      format={(n) => fmtMoney(n, { sign })}
      origin={origin}
      sheen={sheen}
      duration={duration}
      animate={animate}
      className={`${colored ? colorOf(value) : ''} ${className}`}
    >
      {unit && <span className={unitClassName}>{currencyLabel()}</span>}
    </AnimatedNumber>
  )
}
