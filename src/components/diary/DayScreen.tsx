import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import { fmtJst } from '../../lib/timezone'
import SwipePager from '../SwipePager'
import Icon from '../Icon'

/**
 * 一日ぶんの日記を、画面いっぱいで開く。
 *
 * 一覧の中で入れ替えるのではなく、上にかぶせて開く。理由は2つある。
 *  - 「別のところへ入った」と分かる。戻る先があることが体で分かる
 *  - 開く動きが、後ろに残っている一覧との差で見える。
 *    同じ場所で中身だけ入れ替えると、300ms の動きは気づかれない
 *
 * 色はロゴと同じ紫から青。ただし敷くのは上の見出しのぶんだけにして、
 * 下へ向かって消していく。本文は黒い文字なので、下まで色を敷くと
 * 読めなくなるため。色は見出しと、下に浮かせたボタンで出す。
 *
 * body の直下に出しているのは、親に transform が掛かっていると
 * position: fixed がその親を基準にしてしまい、画面いっぱいにならないため。
 */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

interface Props {
  /** 開いている日（YYYY-MM-DD） */
  day: string
  isToday: boolean
  /** 押した場所の高さ。そこを軸に開く */
  originY: number
  /**
   * 開いている最中か、閉じている最中か、動きが終わったか。
   *
   * 終わったら null にして class を外すこと。動きの class には
   * will-change が入っていて、付いたままだとこの箱が
   * position: fixed の基準になり、下に浮かせたボタンが
   * 一緒にスクロールして消えてしまう。
   */
  phase: 'in' | 'out' | null
  onClose: () => void
  onAnimationEnd: (e: React.AnimationEvent<HTMLDivElement>) => void
  /** 前後の日へ */
  onShiftDay: (delta: number) => void
  onToday: () => void
  /** 記録タブへ */
  onAdd?: () => void
  /** 横に振って移れる日。真ん中がいま開いている日 */
  swipeDays: string[]
  onPickDay: (day: string) => void
  children: ReactNode
}

export default function DayScreen({
  day,
  isToday,
  originY,
  phase,
  onClose,
  onAnimationEnd,
  onShiftDay,
  onToday,
  onAdd,
  swipeDays,
  onPickDay,
  children,
}: Props) {
  const iso = `${day}T00:00:00+09:00`
  const wd = WEEKDAYS_JA[new Date(`${day}T00:00:00Z`).getUTCDay()]

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${fmtJst(iso, 'yyyy年M月d日')}の日記`}
      className={`fixed inset-0 z-50 overflow-y-auto bg-page ${
        phase === 'in' ? 'reveal-in' : phase === 'out' ? 'reveal-out' : ''
      }`}
      style={
        {
          height: '100dvh',
          // 後ろの一覧まで一緒に動かない
          overscrollBehavior: 'contain',
          ['--reveal-y']: `${originY}px`,
        } as CSSProperties
      }
      onAnimationEnd={onAnimationEnd}
    >
      {/* 上だけロゴの色にする。
          下まで色を敷くと、その上に載る本文（黒い文字）が読めなくなる。
          色は見出しと下のボタンで出し、本文はいつもの白い紙の上に置く */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[21rem]"
        style={{
          background:
            'linear-gradient(to bottom, #4A2ECC 0%, #3538C6 46%, rgba(47, 66, 191, 0.55) 76%, rgba(250, 250, 252, 0) 100%)',
        }}
      />

      <SwipePager items={swipeDays} current={day} onChange={onPickDay}>
        <div
          className="relative mx-auto max-w-5xl px-4 pb-32"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
        >
          {/* 見出し。曜日を大きく、日付をその下に */}
          <header className="mb-5 text-white">
            {isToday && (
              <span className="mb-1.5 inline-block rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wider">
                TODAY
              </span>
            )}
            <h1 className="text-[2rem] font-bold leading-none tracking-tight">
              {wd}曜日
            </h1>
            {/* 損益はすぐ下のカードに大きく出るので、ここでは出さない */}
            <p className="mt-1.5 text-sm font-semibold text-white/80">
              {fmtJst(iso, 'yyyy年M月d日')}
            </p>
          </header>

          {children}
        </div>
      </SwipePager>

      {/* 下に浮かせた操作。親指の届くところに置く */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex items-center justify-center gap-3 bg-gradient-to-t from-page via-page/85 to-transparent px-4 pt-8"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="日記の一覧へ戻る"
          className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-brand shadow-raised transition-transform active:scale-95"
        >
          <Icon name="back" size={20} />
        </button>

        {/* 日をずらす。真ん中は「今日」へ一気に戻る */}
        <div className="pointer-events-auto flex h-12 items-center gap-0.5 rounded-full bg-white px-1.5 shadow-raised">
          <button
            type="button"
            onClick={() => onShiftDay(-1)}
            aria-label="前の日"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-sunken"
          >
            <Icon name="left" size={18} />
          </button>
          <button
            type="button"
            onClick={onToday}
            disabled={isToday}
            className="rounded-full px-2.5 text-xs font-bold text-brand transition-colors hover:bg-brand-soft disabled:text-ink3"
          >
            今日
          </button>
          <button
            type="button"
            onClick={() => onShiftDay(1)}
            disabled={isToday}
            aria-label="次の日"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-sunken disabled:text-ink3"
          >
            <Icon name="right" size={18} />
          </button>
        </div>

        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="トレードを記録する"
            className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-brand shadow-raised transition-transform active:scale-95"
          >
            <Icon name="plus" size={22} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
