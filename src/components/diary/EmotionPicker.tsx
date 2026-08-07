import { EMOTIONS } from '../../lib/journal'
import AutoTextarea from '../AutoTextarea'

/**
 * そのとき何を感じていたか。
 *
 * 勝ち負けは自分では決められないが、どう感じていたかは自分のもの。
 * あとから「焦っていた日」だけを並べて読み返せるように、
 * 文章とは別に、選んだものとして残す。
 *
 * 複数選べる。ひとつに絞らせると「だいたい普通」に寄ってしまい、
 * 記録として役に立たなくなる。
 */

interface Props {
  value: string[]
  onChange: (next: string[]) => void
  why: string
  onWhyChange: (next: string) => void
  readOnly?: boolean
}

export default function EmotionPicker({ value, onChange, why, onWhyChange, readOnly }: Props) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])
  }

  // 見るだけのときは、選んだものだけを並べる
  const shown = readOnly ? EMOTIONS.filter((e) => value.includes(e.key)) : EMOTIONS
  if (readOnly && shown.length === 0 && !why) return null

  return (
    <section className="mt-9">
      <h2 className="text-[13px] font-bold tracking-wide text-ink2">今日のトレード中の気持ち</h2>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {shown.map((e) => {
          const on = value.includes(e.key)
          return (
            <button
              key={e.key}
              type="button"
              disabled={readOnly}
              aria-pressed={on}
              onClick={() => toggle(e.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                on
                  ? 'border-brand/35 bg-brand-soft text-brand'
                  : 'border-line bg-surface text-ink2 hover:border-brand/30 hover:bg-brand-soft/60'
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {e.emoji}
              </span>
              {e.label}
            </button>
          )
        })}
      </div>

      {/* 何か選んでからでないと出さない。
          いきなり「なぜ？」と聞かれると、答えを探す作業になってしまう */}
      {(value.length > 0 || why) && (
        <div className="mt-4 border-l-2 border-brand/25 pl-3.5">
          <p className="text-[13px] font-bold text-brand">なぜそう感じた？</p>
          {readOnly ? (
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-[1.9] text-ink2">{why}</p>
          ) : (
            <AutoTextarea
              value={why}
              onChange={(e) => onWhyChange(e.target.value)}
              placeholder="上がっていくのを見て、乗り遅れる気がして焦った。"
              className="mt-1 text-[15px] leading-[1.9] text-ink2"
              minHeight={30}
            />
          )}
        </div>
      )}
    </section>
  )
}
