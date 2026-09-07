import { useRef } from 'react'
import Icon from './Icon'

/**
 * 一覧の1行を、左へ払うと「削除」が出てくる形にする。
 *
 * 作りは browser の横スクロールそのもの。指の動きを自前で拾っていない。
 * 理由が2つある。
 *
 *  1. 慣性も、途中で止めるのも、跳ね返りも、browser のほうが手になじむ
 *  2. 口座や日を左右に振って切り替える仕組み（SwipePager）は、
 *     「横に動かせる入れ物」から始まった指を見送るようにしてある。
 *     つまりここを本物の横スクロールにしておけば、
 *     行を払ったつもりが隣の日に飛ぶ、ということが起きない
 *
 * 吸い付く先は2つだけ。閉じた位置と、削除が出きった位置。
 * 途中で半端に止まらないので、「出しかけ」で迷わせない。
 */

interface Props {
  /** 押されたときにすること。消す前の確認は呼び出し側で */
  onDelete: () => void
  /** 読み上げ用。何を消すのかが分かる短い文 */
  label: string
  /** 払っても何も出さない（見るだけの画面） */
  disabled?: boolean
  children: React.ReactNode
}

export default function SwipeRow({ onDelete, label, disabled, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)

  return (
    /*
      止めるとき（disabled）も、同じ形の箱を返すこと。
      ここで箱ごと消すと、木の形が変わって中身が作り直され、
      開いていた詳細が勝手に閉じる
    */
    <div
      ref={boxRef}
      className={
        disabled
          ? ''
          : 'no-bar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain'
      }
    >
      <div
        className={disabled ? '' : 'w-full shrink-0 snap-start'}
        onClickCapture={(e) => {
          const el = boxRef.current
          if (!el || el.scrollLeft <= 4) return
          // 赤が出ている間の1回目は「しまう」。
          // 中身を押したことにすると、消すつもりで触った指で
          // 別のものが開く
          e.preventDefault()
          e.stopPropagation()
          el.scrollTo({ left: 0, behavior: 'smooth' })
        }}
      >
        {children}
      </div>

      {!disabled && (
        <button
          type="button"
          // 指でしか届かない近道なので、読み上げには出さない。
          // 同じことは、行を開いたところにある「この取引を削除」でできる
          tabIndex={-1}
          aria-hidden="true"
          aria-label={`${label}を削除`}
          onClick={() => {
            // 押したあとは閉じておく。消さなかったときに
            // 赤いままだと、消えたのかどうかが分からない
            boxRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
            onDelete()
          }}
          className="flex w-[84px] shrink-0 snap-end flex-col items-center justify-center gap-1 bg-down text-[12px] font-bold text-white"
        >
          <Icon name="trash" size={17} />
          削除
        </button>
      )}
    </div>
  )
}
