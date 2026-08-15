import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'

/**
 * その日の日記の、いちばん上に出す1枚。
 *
 * この画面で唯一、ブランドの色を面いっぱいに使うところ。
 * 色を使う場所をひとつに絞ると、そこが「今いちばん見てほしいところ」
 * だと目で分かる。
 *
 * 役目は2つあって、書いてあるかどうかで入れ替わる。
 *  - 書いてある → 冒頭を見せて、続きへ入る扉になる
 *  - 書いていない → 書き始める入口になる
 *
 * 数字は出さない。数字はすぐ下の履歴が受け持つ。
 * ここに損益を出すと、日記より先に結果を見てしまい、
 * 「勝った日だけ書く」ことになりやすい。
 */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

interface Props {
  day: string
  /** その日の記事の題名。無ければ空 */
  title: string
  /** 本文の文字。冒頭だけ見せる */
  note: string
  isToday: boolean
  /** y は押した場所の高さ。そこを軸に開く動きに使う */
  onOpen: (day: string, y: number) => void
}

export default function DayPreviewCard({ day, title, note, isToday, onOpen }: Props) {
  const iso = `${day}T00:00:00+09:00`
  const wd = WEEKDAYS_JA[new Date(`${day}T00:00:00Z`).getUTCDay()]
  const written = !!(title || note)

  return (
    <button
      type="button"
      onClick={(e) => onOpen(day, e.currentTarget.getBoundingClientRect().top)}
      // ロゴの紫そのままだと、上に載る小さな白文字が読める濃さに届かない
      // （白100%でも 5.15 しか出ない）。同じ色みのまま一段だけ暗くしてある
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#5433E0] to-[#3A2FC0] px-5 py-5 text-left text-white transition-transform active:scale-[0.995]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-white/85">
            {fmtJst(iso, 'M月d日')}（{wd}）{isToday && <span className="ml-1">・今日</span>}
          </p>

          {written ? (
            <>
              <p className="mt-1.5 line-clamp-2 text-[19px] font-bold leading-snug">
                {title || note}
              </p>
              {title && note && (
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-white/85">
                  {note}
                </p>
              )}
              <p className="mt-3 flex items-center gap-1 text-[13px] font-bold">
                続きを読む
                <Icon name="right" size={15} />
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-[19px] font-bold leading-snug">
                {isToday ? '今日のことを書く' : 'この日の振り返りを書く'}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/85">
                チャートを貼って、そのとき考えていたことを残しておく
              </p>
              <p className="mt-3 flex items-center gap-1 text-[13px] font-bold">
                書きはじめる
                <Icon name="right" size={15} />
              </p>
            </>
          )}
        </div>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Icon name={written ? 'book' : 'pencil'} size={18} />
        </span>
      </div>
    </button>
  )
}
