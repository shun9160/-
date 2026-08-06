import CharacterFigure from '../diagnosis/CharacterFigure'
import { TYPES } from '../../lib/diagnosis/types'
import type { DiagnosisResult } from '../../lib/diagnosis/types'
import Icon from '../Icon'

interface Props {
  result: DiagnosisResult | null
  loading: boolean
  /** 狭い画面で、その日のカードの中に入れる形 */
  compact?: boolean
  onOpen: () => void
  className?: string
}

/** いまのトレーダータイプと、そのひとこと */
export default function TypeCard({ result, loading, compact, onOpen, className = '' }: Props) {
  if (loading) {
    return compact ? null : (
      <section className={`card px-4 py-8 text-center text-xs text-ink3 ${className}`}>
        読み込んでいます…
      </section>
    )
  }

  // まだ診断していない
  if (!result) {
    if (compact) return null
    return (
      <section className={`card p-4 ${className}`}>
        <p className="text-[10px] font-bold tracking-[0.18em] text-ink3">TRADER TYPE</p>
        <h3 className="mt-1 text-sm font-bold">まだ診断していません</h3>
        <p className="mt-1 text-xs text-ink2">
          24問と取引記録から、いまのトレードの傾向を6タイプで整理します。
        </p>
        <button className="btn btn-primary mt-3 w-full justify-center" onClick={onOpen}>
          <Icon name="sparkle" size={15} />
          タイプ診断を受ける
        </button>
      </section>
    )
  }

  const def = TYPES[result.primaryType]

  if (compact) {
    return (
      <button
        onClick={onOpen}
        className={`flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:bg-sunken ${className}`}
        style={{ background: `linear-gradient(120deg, ${def.color}12, transparent 70%)` }}
      >
        <CharacterFigure
          characterId={def.characterId}
          state={result.character.state}
          color={def.color}
          name={def.nameJa}
          size={56}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ background: def.color }}
            >
              {result.primaryType}タイプ
            </span>
            <span className="truncate text-[10px] text-ink3">{def.category}</span>
            <Icon name="right" size={13} className="ml-auto shrink-0 text-ink3" />
          </span>
          <span className="mt-1 block text-[11px] leading-relaxed text-ink2">
            {result.character.message}
          </span>
        </span>
      </button>
    )
  }

  return (
    <section className={`card overflow-hidden ${className}`}>
      <div
        className="flex items-start gap-3 p-4"
        style={{ background: `linear-gradient(140deg, ${def.color}14, transparent 65%)` }}
      >
        <p className="mt-2 flex-1 rounded-2xl rounded-bl-sm border border-line bg-surface px-3 py-2.5 text-xs leading-relaxed text-ink2 shadow-card">
          {result.character.message}
        </p>
        <CharacterFigure
          characterId={def.characterId}
          state={result.character.state}
          color={def.color}
          name={def.nameJa}
          size={92}
        />
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ background: def.color }}
        >
          {result.primaryType}タイプ
        </span>
        <span className="truncate text-[11px] text-ink3">{def.category}</span>
        <span className="ml-auto shrink-0 text-[11px] text-ink3">信頼度 {result.confidence}%</span>
      </div>

      <button
        className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-sunken"
        onClick={onOpen}
      >
        タイプ詳細を見る
        <Icon name="right" size={15} />
      </button>
    </section>
  )
}
