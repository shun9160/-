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
 * 下地はロゴの色そのものではなく、ごく薄く色を混ぜた白（#F6F4FF）。
 * 長く文章を読み書きする場所なので、色が濃いと目が疲れる。
 * ロゴの色は、ボタン・選んだもの・押せるところに使って出す。
 *
 * body の直下に出しているのは、親に transform が掛かっていると
 * position: fixed がその親を基準にしてしまい、画面いっぱいにならないため。
 */

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
  /** 書いたものが保存できているか。右上に小さく出す */
  saveState?: 'idle' | 'saving' | 'saved' | 'error'
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
  saveState = 'idle',
  children,
}: Props) {
  const iso = `${day}T00:00:00+09:00`
  const saveLabel =
    saveState === 'saving'
      ? '保存中…'
      : saveState === 'saved'
        ? '保存しました'
        : saveState === 'error'
          ? '保存できませんでした'
          : ''

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${fmtJst(iso, 'yyyy年M月d日')}の日記`}
      className={`fixed inset-0 z-50 overflow-y-auto bg-[#F6F4FF] ${
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
      <SwipePager items={swipeDays} current={day} onChange={onPickDay}>
        <div
          className="relative px-4 pb-32"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
        >
          {/* 保存の様子。書くことの邪魔にならないよう、右上に小さく */}
          <div className="mx-auto flex h-4 max-w-[42rem] items-center justify-end">
            {isToday && !saveLabel && (
              <span className="text-[10px] font-bold tracking-wider text-brand/70">TODAY</span>
            )}
            {saveLabel && (
              <span
                aria-live="polite"
                className={`text-[11px] font-semibold ${
                  saveState === 'error' ? 'text-down' : 'text-ink3'
                }`}
              >
                {saveLabel}
              </span>
            )}
          </div>

          {children}
        </div>
      </SwipePager>

      {/* 下に浮かせた操作。親指の届くところに置く */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex items-center justify-center gap-3 bg-gradient-to-t from-[#F6F4FF] via-[#F6F4FF]/85 to-transparent px-4 pt-8"
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
            className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-raised transition-transform active:scale-95"
          >
            <Icon name="plus" size={22} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
