/**
 * トレーダータイプ診断の型とタイプ定義。
 *
 * タイプの追加はこのファイルの TYPES に足すだけで済むようにしている。
 * 文言は messages.ts に寄せてあるので、将来の英語化もここを触らずにできる。
 */

export const TYPE_IDS = ['BLAZE', 'LOGIC', 'GUARD', 'SHIFT', 'WATCH', 'RISE'] as const
export type TypeId = (typeof TYPE_IDS)[number]

/** 診断の確からしさの段階 */
export type DiagnosisStatus = 'questionnaire_only' | 'provisional' | 'data_backed'

/** キャラクターの状態 */
export type CharacterState = 'happy' | 'sad' | 'cheer'

export type ScoreMap = Record<TypeId, number>
export type PartialScoreMap = Record<TypeId, number | null>

export interface TypeDefinition {
  id: TypeId
  /** 日本語の呼び名 */
  nameJa: string
  /** 「突破型トレーダー」など */
  category: string
  /** 画面で使う色。tailwind の任意値で使えるよう16進で持つ */
  color: string
  /** 色の名前（表示用） */
  colorLabel: string
  /** 既存の Icon コンポーネントの名前 */
  icon: string
  /** 診断コピー */
  copy: string
  strengths: string[]
  cautions: string[]
  /** 画像・アニメの置き場所の鍵。実体が無くても構造だけ先に決めておく */
  characterId: string
}

export interface Evidence {
  key: string
  label: string
  value: string | number
  /** どの観点の根拠か */
  impactType: string
  impact: 'positive' | 'neutral' | 'warning'
}

export interface RecommendedAction {
  id: string
  title: string
  description: string
  priority: 1 | 2 | 3
  completed: boolean
}

export interface CharacterView {
  characterId: string
  state: CharacterState
  message: string
  /** characters/<id>/<state> を指す。拡張子は表示側が決める */
  assetKey: string
}

export interface DiagnosisResult {
  diagnosisId: string
  diagnosisVersion: string
  questionVersion: string
  scoringVersion: string
  userId: string
  status: DiagnosisStatus
  primaryType: TypeId
  secondaryType: TypeId | null
  /** 1位と2位の差から決まる見せ方 */
  display: 'single' | 'with_secondary' | 'hybrid'
  scores: ScoreMap
  questionnaireScores: ScoreMap
  behaviorScores: PartialScoreMap
  confidence: number
  /** 信頼度の言い換え */
  confidenceLabel: string
  evidence: Evidence[]
  strengths: string[]
  cautions: string[]
  recommendedActions: RecommendedAction[]
  character: CharacterView
  /** 同点で決着がつかず、追加の質問が要るとき */
  needsTiebreak: boolean
  createdAt: string
  updatedAt: string
}

/** 回答。question id -> 1..5 */
export type Answers = Record<string, number>

/**
 * 6タイプ。
 * 優劣は付けない。どのタイプにも強みと注意点を必ず持たせる。
 */
export const TYPES: Record<TypeId, TypeDefinition> = {
  BLAZE: {
    id: 'BLAZE',
    nameJa: 'ブレイズ',
    category: '突破型トレーダー',
    color: '#E1620E',
    colorLabel: 'オレンジ',
    icon: 'flame',
    copy: '流れが来たら、迷わず乗る。',
    strengths: ['判断が速い', '相場の勢いを利用する', 'チャンスに対して積極的', '利益を伸ばす力がある'],
    cautions: ['飛び乗り', '過剰取引', '損切りの遅れ', '勢いだけで判断する'],
    characterId: 'blaze',
  },
  LOGIC: {
    id: 'LOGIC',
    nameJa: 'ロジック',
    category: '分析型トレーダー',
    color: '#1D4ED8',
    colorLabel: 'ブルー',
    icon: 'chart',
    copy: '答えは、記録の中にある。',
    strengths: ['データを重視する', 'ルールを守る', '計画性が高い', '再現性を重視する'],
    cautions: ['分析しすぎる', '判断が遅れる', 'チャンスを見送る', '完璧を求めすぎる'],
    characterId: 'logic',
  },
  GUARD: {
    id: 'GUARD',
    nameJa: 'ガード',
    category: '防衛型トレーダー',
    color: '#15803D',
    colorLabel: 'グリーン',
    icon: 'shield',
    copy: '守れる人だけが、最後まで残る。',
    strengths: ['資金管理を重視する', '大きな損失を避ける', '安定して継続できる', '損失許容額を守る'],
    cautions: ['利確が早い', 'リスクを避けすぎる', '好機を見送る', '利益を伸ばしにくい'],
    characterId: 'guard',
  },
  SHIFT: {
    id: 'SHIFT',
    nameJa: 'シフト',
    category: '適応型トレーダー',
    color: '#BE185D',
    colorLabel: 'マゼンタ',
    icon: 'refresh',
    copy: '相場が変われば、自分も変える。',
    strengths: ['相場変化への対応が速い', '戦略を柔軟に切り替える', '複数の手法を扱える', '状況判断が得意'],
    cautions: ['戦略変更が多い', '一貫性が失われる', '根拠が曖昧になる', '手法を検証する前に変更する'],
    characterId: 'shift',
  },
  WATCH: {
    id: 'WATCH',
    nameJa: 'ウォッチ',
    category: '観察型トレーダー',
    color: '#7C3AED',
    colorLabel: 'パープル',
    icon: 'target',
    copy: '待つことも、戦略のひとつ。',
    strengths: ['条件が揃うまで待てる', '無駄な取引が少ない', '確認を重視する', 'エントリーを厳選する'],
    cautions: ['エントリーが遅い', '見送りすぎる', '判断に時間がかかる', '確認条件を増やしすぎる'],
    characterId: 'watch',
  },
  RISE: {
    id: 'RISE',
    nameJa: 'ライズ',
    category: '再起型トレーダー',
    color: '#B45309',
    colorLabel: 'ゴールド',
    icon: 'rocket',
    copy: '負けた後の行動が、未来を決める。',
    strengths: ['損失から学べる', '改善を継続できる', '失敗を引きずりにくい', '再挑戦する力がある'],
    cautions: ['取り返しトレード', '負けた直後の過剰取引', '改善を急ぎすぎる', '一度に多くを変えすぎる'],
    characterId: 'rise',
  },
}

export function emptyScores(): ScoreMap {
  return { BLAZE: 0, LOGIC: 0, GUARD: 0, SHIFT: 0, WATCH: 0, RISE: 0 }
}
