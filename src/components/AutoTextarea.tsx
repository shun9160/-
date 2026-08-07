import { useEffect, useRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

/**
 * 枠の無い、書いたぶんだけ伸びる入力欄。
 *
 * 高さを固定すると、中でスクロールが起きて「書いた文章の続きが
 * 見えない」状態になる。日記は読み返すものなので、
 * 書いたものは全部そのまま見えているほうがいい。
 *
 * 高さは中身に合わせて毎回測り直す。いったん auto に戻してから
 * scrollHeight を読むこと。そうしないと、消したときに縮まない。
 */
type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** 最低でもこの高さは空けておく（px） */
  minHeight?: number
}

export default function AutoTextarea({ minHeight = 0, className = '', ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`
  }, [rest.value, minHeight])

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`w-full resize-none border-0 bg-transparent p-0 outline-none placeholder:text-ink3/70 focus:ring-0 ${className}`}
      style={{ minHeight: minHeight || undefined }}
      {...rest}
    />
  )
}
