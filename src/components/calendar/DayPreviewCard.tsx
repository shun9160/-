import type { ReactNode } from 'react'
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
 *  - 書いてある → 冒頭を、この面に入るぶんだけ見せる
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
  /**
   * 上にのせるもの。日付の並び（WeekStrip）が入る。
   *
   * 日付の並びとこのカードは、別々の面に見えていた。
   * どちらも「どの日を見るか」の話なので、1つの面にまとめる。
   * 離れていると、上で日を選んだこととカードの中身が
   * つながって見えない。
   */
  header?: ReactNode
  /** y は押した場所の高さ。そこを軸に開く動きに使う */
  onOpen: (day: string, y: number) => void
}

/**
 * 冒頭を、見出しと続きに分ける。
 *
 * 題名があればそれが見出し。無ければ本文の1行目を見出しに借りる。
 * 借りるだけで、続きにも同じ文字を出さない（同じ文が二度出ると、
 * 読んだのに進んでいない感じになる）。
 *
 * 続きのほうは改行を潰して1本の文にする。日記の改行をそのまま残すと、
 * 1文字しかない行で1行ぶん使ってしまい、この面がすかすかになる。
 * ここは読む場所ではなく「どんな日だったか思い出す」場所なので、
 * 入るところまで詰めて見せたほうがいい。
 */
function splitPreview(title: string, note: string) {
  const clean = note.replace(/\r/g, '').trim()
  if (title) return { headline: title, body: clean.replace(/\s+/g, ' ') }

  const nl = clean.indexOf('\n')
  if (nl === -1) return { headline: clean, body: '' }
  return {
    headline: clean.slice(0, nl).trim(),
    body: clean.slice(nl + 1).replace(/\s+/g, ' ').trim(),
  }
}

export default function DayPreviewCard({ day, title, note, isToday, header, onOpen }: Props) {
  const iso = `${day}T00:00:00+09:00`
  const wd = WEEKDAYS_JA[new Date(`${day}T00:00:00Z`).getUTCDay()]
  const written = !!(title || note)
  const { headline, body } = splitPreview(title, note)

  return (
    // ロゴの紫そのままだと、上に載る小さな白文字が読める濃さに届かない
    // （白100%でも 5.15 しか出ない）。同じ色みのまま一段だけ暗くしてある
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5433E0] to-[#3A2FC0] text-white">
      {/*
        日付の並び。押せるところが中に入るので、外側は button にできない。
        button の中に button は置けず、置くと横に流すこともできなくなる
      */}
      {header && (
        <>
          <div className="px-4 pt-3">{header}</div>
          <div aria-hidden="true" className="mx-4 mt-3 h-px bg-white/20" />
        </>
      )}

      <button
        type="button"
        onClick={(e) => onOpen(day, e.currentTarget.getBoundingClientRect().top)}
        className="block w-full px-5 py-5 text-left transition-transform active:scale-[0.995]"
      >
      <div className="flex items-start gap-3">
        {/*
          高さを下限で揃えておく。書いてある日と書いていない日で
          面の大きさが変わると、日を移すたびに下の履歴が飛び跳ねる。
          「続きを読む」は mt-auto で下に貼り付け、
          冒頭の文がその手前まで伸びられるようにしてある
        */}
        <div className="flex min-h-[6.75rem] min-w-0 flex-1 flex-col">
          <p className="text-[12px] font-semibold text-white/85">
            {fmtJst(iso, 'M月d日')}（{wd}）{isToday && <span className="ml-1">・今日</span>}
          </p>

          {written ? (
            <>
              <p className="mt-1.5 line-clamp-2 text-[19px] font-bold leading-snug">{headline}</p>
              {body && (
                <p className="mt-1.5 line-clamp-4 text-[13.5px] leading-relaxed text-white/85">
                  {body}
                </p>
              )}
              <p className="mt-auto flex items-center gap-1 pt-3 text-[13px] font-bold">
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
              <p className="mt-auto flex items-center gap-1 pt-3 text-[13px] font-bold">
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
    </div>
  )
}
