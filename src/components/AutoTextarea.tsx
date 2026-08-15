import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
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
 * 描く前に直すので useLayoutEffect（あとだと一瞬がくつく）。
 *
 * 触っているあいだの枠も出さない。文字の入力欄はカーソルが点滅して
 * いる場所そのものが「いまここ」を示すので、囲う必要がない。
 * 囲うと、1枚の紙に書いているはずが「入力欄」に見えてしまう。
 * （ボタンやリンクの枠は残してある。あちらはカーソルが出ないため）
 */
type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** 最低でもこの高さは空けておく（px） */
  minHeight?: number
}

const AutoTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoTextarea(
  { minHeight = 0, className = '', ...rest },
  outer,
) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // 外からも同じ入力欄を触れるようにする（題名から本文へ移るときに使う）
  useImperativeHandle(outer, () => ref.current as HTMLTextAreaElement, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`
  }, [rest.value, minHeight])

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`w-full resize-none border-0 bg-transparent p-0 outline-none placeholder:text-ink3/70 focus:ring-0 focus-visible:outline-none ${className}`}
      style={{ minHeight: minHeight || undefined }}
      {...rest}
    />
  )
})

export default AutoTextarea
