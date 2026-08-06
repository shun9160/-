/**
 * 採点の共通ヘルパー。
 *
 * すべて純粋関数。副作用も乱数も時計も使わないので、
 * 同じ入力からは必ず同じ結果が出る。
 */

import { MIN_AVAILABLE_WEIGHT } from './config'

export function clamp(v: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(v)) return lo
  return Math.min(hi, Math.max(lo, v))
}

/**
 * low 以下なら0、high 以上なら100、あいだは線形。
 * low > high を渡されたときは逆向きの尺度として扱う。
 */
export function scale(value: number, low: number, high: number): number {
  if (Number.isNaN(value)) return 0
  if (low === high) return value >= high ? 100 : 0
  if (low > high) return 100 - scale(value, high, low)
  if (value <= low) return 0
  if (value >= high) return 100
  return clamp(((value - low) / (high - low)) * 100)
}

/** 小さいほど高得点にしたいとき */
export function inverseScale(value: number, low: number, high: number): number {
  return 100 - scale(value, low, high)
}

/** 0〜1の比率を0〜100にする */
export function ratioScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return clamp(value * 100)
}

export function mean(values: number[]): number | null {
  const ok = values.filter((v) => Number.isFinite(v))
  if (ok.length === 0) return null
  return ok.reduce((a, b) => a + b, 0) / ok.length
}

/**
 * 分散度。銘柄や時間帯がどれだけばらけているかを0〜100で返す。
 *
 * 1種類しかなければ0、均等に散らばっているほど100。
 * 種類数そのものではなく「偏りの少なさ」を見るので、
 * 種類を増やしただけでは満点にならない。
 */
export function normalizedEntropy(values: number[]): number {
  const counts = values.filter((v) => Number.isFinite(v) && v > 0)
  const total = counts.reduce((a, b) => a + b, 0)
  if (total <= 0 || counts.length <= 1) return 0
  let h = 0
  for (const c of counts) {
    const p = c / total
    h -= p * Math.log(p)
  }
  const max = Math.log(counts.length)
  if (max <= 0) return 0
  return clamp((h / max) * 100)
}

/**
 * 一貫性。ばらつき（変動係数）が小さいほど高得点。
 *
 * 平均が0に近いときは変動係数が発散するので、そのときは判定不能として null。
 */
export function consistencyScore(values: number[]): number | null {
  const ok = values.filter((v) => Number.isFinite(v))
  if (ok.length < 2) return null
  const m = mean(ok)
  if (m == null || Math.abs(m) < 1e-9) return null
  const variance = ok.reduce((a, v) => a + (v - m) ** 2, 0) / ok.length
  const cv = Math.sqrt(variance) / Math.abs(m)
  // 変動係数1.0（平均と同じだけばらついている）で0点になるようにする
  return clamp((1 - cv) * 100)
}

// ---------------------------------------------------------------
// 指標をまとめる
// ---------------------------------------------------------------

export interface Indicator {
  key: string
  /** 画面に出す説明。「なぜこのタイプか」の根拠になる */
  label: string
  weight: number
  /** 0〜100。取れなかった指標は null（0点にはしない） */
  score: number | null
  /** 根拠として見せる実際の値 */
  value: string | number | null
}

export interface Combined {
  /** 取れた指標だけで再正規化した0〜100。使えないときは null */
  score: number | null
  /** 取れた指標のウェイト合計 (0〜1) */
  available: number
  indicators: Indicator[]
}

/**
 * 取れた指標だけでスコアを出す。
 *
 * 欠けた指標を0点にすると「記録していないだけ」で低いタイプになってしまうので、
 * 欠けたぶんはウェイトから外して残りで割り直す。
 * それでも半分に届かないときは、取引データを使わない判断にする。
 */
export function combineIndicators(indicators: Indicator[]): Combined {
  const usable = indicators.filter((i) => i.score != null)
  const available = usable.reduce((a, i) => a + i.weight, 0)
  if (available < MIN_AVAILABLE_WEIGHT) {
    return { score: null, available, indicators }
  }
  const sum = usable.reduce((a, i) => a + (i.score as number) * i.weight, 0)
  return { score: clamp(sum / available), available, indicators }
}
