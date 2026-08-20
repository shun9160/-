import { rememberDismissed } from '../lib/install'
import Icon from './Icon'

/**
 * 「ホーム画面に追加すると、アプリのように使えます」の案内。
 *
 * iPhone の Safari でだけ出す。ほかの端末は、ブラウザのほうから
 * 「インストールしますか」と聞いてくれるので、こちらで言う必要がない。
 *
 * 面としては立てない。線1本で区切るだけにしてある。
 * カードにすると、いちばん上のいちばん大きな面が「お知らせ」になり、
 * 今日の損益より先に目に入ってしまう。
 *
 * 一度閉じたら二度と出さない。毎回出る案内は、読まれずに邪魔になるだけ。
 *
 * 出すかどうかの判定は App が持っている。ここに置くと、
 * この案内が入るぶんホームの上端の作りが変わることを、
 * App 側が知らないままになる。
 */
export default function InstallHint({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-3 flex items-start gap-2 border-b border-line pb-3 text-[13px]">
      <Icon name="sparkle" size={16} className="mt-0.5 shrink-0 text-brand" />
      <p className="flex-1 leading-relaxed text-ink2">
        <span className="font-bold text-ink">ホーム画面に追加できます</span>
        <span className="ml-1.5">
          下の
          <ShareGlyph />
          を押して「ホーム画面に追加」を選ぶと、アプリのように全画面で使えます。
        </span>
      </p>
      <button
        onClick={() => {
          rememberDismissed()
          onClose()
        }}
        aria-label="この案内を閉じる"
        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-ink3 transition-colors hover:bg-surface hover:text-ink"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}

/**
 * iOS の共有ボタン（四角から矢印が出ている印）。
 * 「共有ボタン」と言葉で書くより、同じ形を見せたほうが早い
 */
function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-1 inline-block -translate-y-px text-brand"
      aria-label="共有"
      role="img"
    >
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  )
}
