import { useEffect, useState } from 'react'

/**
 * 立ち上がりを待っているあいだの画面。
 *
 * ここが行き止まりになると、いちばん手の打ちようがない。
 * 「読み込み中…」だけが真ん中に出たまま、押せるものが何も無い状態は、
 * 利用者から見ればアプリが壊れているのと同じ。
 *
 * そこで、しばらく待っても始まらなければ逃げ道を出す。
 * 出すのは遅れてから。すぐ出すと、普通に開けた人にも
 * 「うまくいかなかったのか」と思わせてしまう。
 */

/** これだけ待っても始まらなければ、逃げ道を出す(ms) */
const SLOW_AFTER = 6000

export default function Loading({ label = '読み込み中…' }: { label?: string }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), SLOW_AFTER)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="px-6 py-32 text-center">
      <p className="text-sm text-ink3">{label}</p>

      {slow && (
        <div className="mx-auto mt-6 max-w-sm">
          <p className="text-[13px] leading-relaxed text-ink2">
            時間がかかっています。電波の状態を確かめてから、
            <br />
            もう一度ひらいてみてください。
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition-transform active:scale-[0.98]"
            >
              開き直す
            </button>
            {/*
              それでも駄目なとき用。控えを捨ててから開き直す。
              保存したものには触らないので、押しても記録は消えない
            */}
            <a
              href="/?reset=1"
              className="rounded-xl px-4 py-2 text-[12px] font-semibold text-ink2 underline underline-offset-2 transition-colors hover:text-ink"
            >
              それでも開かないとき（記録は消えません）
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
