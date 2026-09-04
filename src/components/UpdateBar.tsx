import { useState } from 'react'
import Icon from './Icon'

/**
 * 新しい版が出ていることを知らせる帯。
 *
 * 勝手に読み込み直さない。日記を書いている最中に画面が作り直されると、
 * 打っていた文が消えたように見える。押すのは本人に任せる。
 *
 * 面としては立てず、線1本で区切るだけ。
 * ここをカードにすると、いちばん上のいちばん大きな面が
 * 「お知らせ」になり、今日の損益より先に目に入ってしまう。
 */
export default function UpdateBar() {
  const [busy, setBusy] = useState(false)

  return (
    <div className="mb-3 flex items-center gap-2 border-b border-line pb-3 text-[13px]">
      <Icon name="rocket" size={16} className="shrink-0 text-brand" />
      <p className="min-w-0 flex-1 leading-relaxed text-ink2">
        <span className="font-bold text-ink">新しい版があります</span>
        <span className="ml-1.5">読み込み直すと、いちばん新しい状態になります。</span>
      </p>
      <button
        onClick={() => {
          setBusy(true)
          // 画面(HTML)は毎回インターネットを先に見る作りなので、
          // 読み込み直せば新しい部品に入れ替わる
          window.location.reload()
        }}
        disabled={busy}
        className="shrink-0 whitespace-nowrap rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
      >
        {busy ? '更新中…' : '更新する'}
      </button>
    </div>
  )
}
