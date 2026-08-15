import { useRef } from 'react'
import type { Block } from '../../lib/journal'
import AutoTextarea from '../AutoTextarea'
import JournalBody from './JournalBody'

/**
 * 題名と本文。
 *
 * 入力欄は2つあるが、使う人には「1枚の紙に上から書いている」だけに
 * 見せる。枠も背景も付けず、あいだも空けない。ちがうのは文字の大きさだけ。
 *
 *   1行目が大きく、改行すると普通の大きさになる
 *
 * 紙に書くときと同じ順序で、見出しが自然にできる。
 * 「題名を入れる欄」と「本文を入れる欄」に分けて見せると、
 * 書く前に書式を決めさせることになり、書き出しが重くなる。
 *
 * 上下の行き来:
 *   題名で改行  → 本文の先頭へ
 *   本文の先頭でさらに消す → 題名の末尾へ
 */

interface Props {
  title: string
  onTitleChange: (v: string) => void
  blocks: Block[]
  onBlocksChange: (b: Block[]) => void
  readOnly?: boolean
}

export default function JournalWriter({
  title,
  onTitleChange,
  blocks,
  onBlocksChange,
  readOnly,
}: Props) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div>
      {readOnly ? (
        title && <h1 className="text-[27px] font-bold leading-snug tracking-tight">{title}</h1>
      ) : (
        <AutoTextarea
          ref={titleRef}
          value={title}
          // 題名は1行。貼り付けで改行が入っても、そこで折らない
          onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, ''))}
          onKeyDown={(e) => {
            // 日本語を変換している最中の Enter は「確定」なので、横取りしない。
            // ここを見ないと、変換を確定しただけで本文へ飛んでしまう
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            bodyRef.current?.focus()
            bodyRef.current?.setSelectionRange(0, 0)
          }}
          // 27px だと長い言葉は2行に折れて、下の本文まで押し下げてしまう。
          // 1行に収まる長さにする
          placeholder="タイトルをつける"
          className="text-[27px] font-bold leading-snug tracking-tight"
          aria-label="日記のタイトル"
        />
      )}

      <div className="mt-1.5">
        <JournalBody
          blocks={blocks}
          onChange={onBlocksChange}
          readOnly={readOnly}
          firstRef={bodyRef}
          onLeaveTop={() => {
            const el = titleRef.current
            if (!el) return
            el.focus()
            el.setSelectionRange(el.value.length, el.value.length)
          }}
        />
      </div>
    </div>
  )
}
