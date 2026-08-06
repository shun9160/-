/**
 * 診断の質問。
 *
 * 質問文はここだけに置く（画面側にはベタ書きしない）。
 * 質問IDと採点規則は固定。並び順を変えても結果は変わらない。
 *
 * どの質問がどのタイプに効くかは採点側の情報なので、
 * 画面に渡すときは type / reverse を落として送る（publicQuestions）。
 */

import type { TypeId } from './types'
import { QUESTION_VERSION } from './config'

export interface Question {
  id: string
  type: TypeId
  /** 「当てはまるほどそのタイプから遠い」質問 */
  reverse: boolean
  text: string
}

/** 画面に渡す形。タイプとの対応は含めない */
export interface PublicQuestion {
  id: string
  text: string
}

export const ANSWER_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'まったく当てはまらない' },
  { value: 2, label: 'あまり当てはまらない' },
  { value: 3, label: 'どちらともいえない' },
  { value: 4, label: 'やや当てはまる' },
  { value: 5, label: '非常に当てはまる' },
]

/** 1ステップに出す質問数 */
export const QUESTIONS_PER_STEP = 4

export const QUESTIONS: Question[] = [
  { id: 'Q01', type: 'BLAZE', reverse: false, text: '強い値動きを見たら、条件が完全でなくても素早く仕掛けることがある。' },
  { id: 'Q02', type: 'LOGIC', reverse: false, text: 'エントリー前に、ルールやチェック項目を確認している。' },
  { id: 'Q03', type: 'GUARD', reverse: false, text: '利益目標より先に、許容できる損失額を決めている。' },
  { id: 'Q04', type: 'SHIFT', reverse: false, text: '相場環境が変わったと感じたら、手法を切り替えられる。' },
  { id: 'Q05', type: 'WATCH', reverse: false, text: '条件が揃うまで待つことに、強いストレスを感じない。' },
  { id: 'Q06', type: 'RISE', reverse: false, text: '負けた取引ほど、原因を詳しく振り返っている。' },
  { id: 'Q07', type: 'BLAZE', reverse: false, text: '取引回数が少ない日は、チャンスを逃したように感じる。' },
  { id: 'Q08', type: 'LOGIC', reverse: false, text: '勝ったか負けたかよりも、ルール通りに取引できたかを重視する。' },
  { id: 'Q09', type: 'GUARD', reverse: false, text: '資金を守るためなら、魅力的に見える取引でも見送れる。' },
  { id: 'Q10', type: 'SHIFT', reverse: false, text: '現在の手法が機能していないと判断したら、柔軟に修正する。' },
  { id: 'Q11', type: 'WATCH', reverse: false, text: '取引回数より、見送る判断の質を重視している。' },
  { id: 'Q12', type: 'RISE', reverse: false, text: '連敗した後でも、感情を切り替えて次のルールを守れる。' },
  { id: 'Q13', type: 'BLAZE', reverse: false, text: '小さな損失を恐れるより、大きな値幅を狙いたい。' },
  { id: 'Q14', type: 'LOGIC', reverse: false, text: '過去の取引データを確認してから、使用する戦略を選ぶ。' },
  { id: 'Q15', type: 'GUARD', reverse: false, text: '連敗したときは、ロットを下げるか取引を止める。' },
  { id: 'Q16', type: 'SHIFT', reverse: false, text: '複数の時間帯や銘柄を比較し、戦う場所を選んでいる。' },
  { id: 'Q17', type: 'WATCH', reverse: false, text: '直前の値動きだけで飛び乗らず、追加の確認を待つ。' },
  { id: 'Q18', type: 'RISE', reverse: false, text: '過去1か月と比較して、改善した点を説明できる。' },
  { id: 'Q19', type: 'BLAZE', reverse: true, text: '少しでも迷いがある場合は、取引を見送ることが多い。' },
  { id: 'Q20', type: 'LOGIC', reverse: true, text: '相場では、記録や数字より直感の方が信頼できると思う。' },
  { id: 'Q21', type: 'GUARD', reverse: true, text: '含み損が増えたとき、当初の損切り位置を広げることがある。' },
  { id: 'Q22', type: 'SHIFT', reverse: true, text: '一度決めた戦略は、状況が変わっても変更しない。' },
  { id: 'Q23', type: 'WATCH', reverse: true, text: 'チャンスらしく見えたら、確認条件が揃う前でも入る。' },
  { id: 'Q24', type: 'RISE', reverse: true, text: '負けると、その日の途中でルールを大きく変えたくなる。' },
]

/** 同点が続いたときだけ出す追加の1問 */
export interface TiebreakQuestion {
  id: string
  text: string
  options: { value: TypeId; label: string }[]
}

export function tiebreakQuestion(a: TypeId, b: TypeId, labels: Record<TypeId, string>): TiebreakQuestion {
  return {
    id: 'T01',
    text: '今の自分の取引に、より近いのはどちらですか。',
    options: [
      { value: a, label: labels[a] },
      { value: b, label: labels[b] },
    ],
  }
}

/** 画面に渡す用。タイプとの対応関係は落とす */
export function publicQuestions(): { version: string; perStep: number; questions: PublicQuestion[] } {
  return {
    version: QUESTION_VERSION,
    perStep: QUESTIONS_PER_STEP,
    questions: QUESTIONS.map((q) => ({ id: q.id, text: q.text })),
  }
}

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id)
}
