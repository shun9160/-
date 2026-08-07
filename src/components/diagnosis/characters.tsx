import type { ReactNode } from 'react'
import type { CharacterState } from '../../lib/diagnosis/types'

/**
 * タイプのキャラクターを、絵ではなく図形で描く。
 *
 * 絵を外から用意すると、6タイプ×3状態＝18枚を同じ絵柄で揃えるのが難しく、
 * 売り物にする以上、使ってよい権利もはっきりさせないといけない。
 * 図形で描けば、色も大きさも状態も、そのつど作り直せる。
 *
 * 描き方の決まりごと:
 *  - 120×120 の枠の中に描く。使う側が大きさを変える
 *  - 色はタイプ色ひとつだけ。明るさは「白地の上での薄め」と
 *    「黒をうっすら重ねる」で作る。タイプが増えても色の計算がいらない
 *  - いちばん小さいのは 56px。線を細くしすぎない、細部を描き込まない
 *  - 「落ち着いている」顔は、責める顔にしない。負けた日に見る絵なので
 */

export interface DrawProps {
  state: CharacterState
  color: string
}

/** そのタイプの絵があるか */
export function hasDrawing(characterId: string): boolean {
  return characterId in DRAWINGS
}

export function drawCharacter(characterId: string, props: DrawProps): ReactNode {
  const draw = DRAWINGS[characterId]
  return draw ? draw(props) : null
}

const DRAWINGS: Record<string, (p: DrawProps) => ReactNode> = {
  blaze: Blaze,
}

// ---------------------------------------------------------------
// 共通の部品
// ---------------------------------------------------------------

/** 枠と、足もとの影。どのタイプも同じ */
function Stage({ color }: { color: string }) {
  return (
    <>
      <rect x="0" y="0" width="120" height="120" rx="28" fill={color} opacity="0.1" />
      <ellipse cx="60" cy="103" rx="26" ry="4.5" fill={color} opacity="0.2" />
    </>
  )
}

/** 胴体。角の丸い四角ひとつ。小さくしても形が崩れない */
function Body({ color }: { color: string }) {
  return (
    <>
      <rect x="28" y="36" width="64" height="62" rx="28" fill={color} />
      {/* 下側にうっすら影を落として、平らな板に見えないようにする。
          影のふちは丸くする。まっすぐに切ると、服を着ているように見えてしまう */}
      <path
        d="M28 66c9 11 20 16.5 32 16.5S83 77 92 66v4c0 15.5-12.5 28-28 28h-8c-15.5 0-28-12.5-28-28z"
        fill="#000"
        opacity="0.09"
      />
      {/* 左上の光 */}
      <ellipse cx="46" cy="49" rx="11" ry="8" fill="#FFF" opacity="0.16" transform="rotate(-24 46 49)" />
    </>
  )
}

/** 足。胴体の下からちょこんと出す */
function Feet({ color }: { color: string }) {
  return (
    <>
      <ellipse cx="47" cy="97" rx="9.5" ry="5.5" fill={color} />
      <ellipse cx="73" cy="97" rx="9.5" ry="5.5" fill={color} />
      <ellipse cx="47" cy="97" rx="9.5" ry="5.5" fill="#000" opacity="0.12" />
      <ellipse cx="73" cy="97" rx="9.5" ry="5.5" fill="#000" opacity="0.12" />
    </>
  )
}

/**
 * 腕。応援しているときだけ、片方を上げる。
 * 上げた腕は、そのタイプらしさが伝わる一番わかりやすい合図になる。
 */
function Arms({ color, state }: DrawProps) {
  const cheering = state === 'cheer'
  return (
    <>
      <ellipse cx="25" cy="72" rx="7" ry="9.5" fill={color} transform="rotate(-12 25 72)" />
      {cheering ? (
        <ellipse cx="97" cy="50" rx="7" ry="9.5" fill={color} transform="rotate(34 97 50)" />
      ) : (
        <ellipse cx="95" cy="72" rx="7" ry="9.5" fill={color} transform="rotate(12 95 72)" />
      )}
    </>
  )
}

/**
 * 顔。白で描く。色の濃い胴体の上でいちばん読みやすい。
 *
 * happy … 目を弧にして、口を開けて笑う
 * cheer … 目をまるく開けて、小さく笑う
 * sad  … 目を伏せて、口は真一文字に近く。困り顔にはしない
 */
function Face({ state }: { state: CharacterState }) {
  const line = {
    stroke: '#FFF',
    strokeWidth: 4,
    strokeLinecap: 'round' as const,
    fill: 'none',
  }

  if (state === 'happy') {
    return (
      <>
        <path d="M43 63c2.5-4 7.5-4 10 0" {...line} />
        <path d="M67 63c2.5-4 7.5-4 10 0" {...line} />
        <path d="M50 74c3.5 7 16.5 7 20 0z" fill="#FFF" />
      </>
    )
  }

  if (state === 'sad') {
    return (
      <>
        {/* 伏し目。上まぶただけを描くと、静かな顔になる */}
        <path d="M43 62c2.5 3 7.5 3 10 0" {...line} />
        <path d="M67 62c2.5 3 7.5 3 10 0" {...line} />
        <path d="M53 76h14" {...line} />
      </>
    )
  }

  return (
    <>
      <circle cx="48" cy="62" r="4.2" fill="#FFF" />
      <circle cx="72" cy="62" r="4.2" fill="#FFF" />
      <path d="M53 73c2.5 4 11.5 4 14 0" {...line} />
    </>
  )
}

// ---------------------------------------------------------------
// ブレイズ（突破型）
// ---------------------------------------------------------------

/**
 * 頭の炎で見分ける。
 * 色が見えない人にも形だけで分かるよう、輪郭を他のタイプと変える。
 *
 * 勢いのあるタイプなので、炎の大きさで気分を出す。
 * よろこんでいる＝大きく、落ち着いている＝小さく。
 */
function Blaze({ state, color }: DrawProps) {
  const flame = { happy: 2.9, cheer: 2.6, sad: 2.1 }[state]
  const top = { happy: 5, cheer: 9, sad: 16 }[state]

  return (
    <>
      <Stage color={color} />
      <Arms color={color} state={state} />

      {/* 炎。アイコンと同じ形を大きくして、頭の上に載せる */}
      <g transform={`translate(60 ${top}) scale(${flame}) translate(-12 -3)`}>
        <path
          d="M12 3s4.5 3.6 4.5 8a4.5 4.5 0 0 1-9 0c0-1.4.6-2.6 1.3-3.5.2 1.2.9 2 1.7 2 1 0 1.5-.9 1.5-2.3 0-1.6-.5-3-1-4.2z"
          fill={color}
        />
        {/* 炎の芯。白を重ねて、燃えている感じを出す */}
        <path
          d="M12 7.5c1.6 1.8 2.4 3.2 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1.3.9-2.8 2.4-4.6z"
          fill="#FFF"
          opacity="0.5"
        />
      </g>

      <Feet color={color} />
      <Body color={color} />
      <Face state={state} />
    </>
  )
}
