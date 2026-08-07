import { useState } from 'react'
import type { CharacterState } from '../../lib/diagnosis/types'
import { drawCharacter, hasDrawing } from './characters'

/**
 * タイプのキャラクター。
 *
 * 絵は図形で描いている（characters.tsx）。まだ描いていないタイプは
 * 同じ形の代用図を出す。
 * public/characters/<characterId>/<state>.webp を置いて
 * HAS_ASSETS を true にすれば、そのまま差し替わる。
 * （Rive を使う場合も同じ場所に .riv を置き、この1ファイルだけ差し替える）
 */

/** 画像を置いたら true にする */
export const HAS_ASSETS = false
export const ASSET_BASE = '/characters'

interface Props {
  characterId: string
  state: CharacterState
  /** タイプの色 */
  color: string
  /** 読み上げ用の名前 */
  name: string
  size?: number
}

export default function CharacterFigure({ characterId, state, color, name, size = 120 }: Props) {
  const [failed, setFailed] = useState(false)
  const src = `${ASSET_BASE}/${characterId}/${state}.webp`
  const label = `${name}（${STATE_LABELS[state]}）`

  if (HAS_ASSETS && !failed) {
    return (
      <img
        src={src}
        width={size}
        height={size}
        alt={label}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-2xl object-cover"
      />
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      {hasDrawing(characterId) ? (
        drawCharacter(characterId, { state, color })
      ) : (
        // まだ描いていないタイプ。形だけ揃えた代用図を出す
        <>
          <rect x="0" y="0" width="120" height="120" rx="28" fill={color} opacity="0.12" />
          <circle cx="60" cy="58" r="34" fill={color} opacity="0.9" />
          <Face state={state} />
          <rect x="24" y="100" width="72" height="8" rx="4" fill={color} opacity="0.25" />
        </>
      )}
    </svg>
  )
}

const STATE_LABELS: Record<CharacterState, string> = {
  happy: 'よろこんでいる',
  sad: '落ち着いている',
  cheer: '応援している',
}

/** 表情。sad でも責める顔にはしない（少し伏し目がちにするだけ） */
function Face({ state }: { state: CharacterState }) {
  const stroke = { stroke: '#FFFFFF', strokeWidth: 3.5, strokeLinecap: 'round' as const, fill: 'none' }
  if (state === 'happy') {
    return (
      <>
        <path d="M46 52c2-3 6-3 8 0" {...stroke} />
        <path d="M66 52c2-3 6-3 8 0" {...stroke} />
        <path d="M48 66c4 6 20 6 24 0" {...stroke} />
      </>
    )
  }
  if (state === 'sad') {
    return (
      <>
        <path d="M46 54h8" {...stroke} />
        <path d="M66 54h8" {...stroke} />
        <path d="M50 70c4-3 16-3 20 0" {...stroke} />
      </>
    )
  }
  return (
    <>
      <circle cx="50" cy="53" r="3" fill="#FFFFFF" />
      <circle cx="70" cy="53" r="3" fill="#FFFFFF" />
      <path d="M48 64c4 7 20 7 24 0" {...stroke} />
      <path d="M92 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFFFFF" opacity="0.85" />
    </>
  )
}
