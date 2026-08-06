/**
 * 診断で使う日本語の文言をまとめた辞書。
 *
 * 画面にもロジックにも文字列を散らさない。
 * 英語化するときは、この形のまま en 版を足して切り替えられるようにしてある。
 */

import type { CharacterState, TypeId } from './types'

export const CHARACTER_MESSAGES: Record<TypeId, Record<CharacterState, string>> = {
  BLAZE: {
    happy: 'いい突破だった。勢いだけでなく、出口のルールも守れている。',
    sad: '仕掛けは速かった。次は入る前に、条件をもう一つ確認しよう。',
    cheer: '決めた条件が来たら、自信を持って動こう。',
  },
  LOGIC: {
    happy: 'データ通りの判断だった。再現できる勝ち方になっている。',
    sad: '結果より、どこで計画とズレたかを確認しよう。',
    cheer: '記録を続ければ、次の答えも見つかる。',
  },
  GUARD: {
    happy: '利益だけでなく、資金もしっかり守れている。',
    sad: '今日は守る日だった。損失を限定できたことにも価値がある。',
    cheer: '生き残ることが、次のチャンスにつながる。',
  },
  SHIFT: {
    happy: '相場の変化をうまく捉えた。切り替えが機能している。',
    sad: '戦略を変える前に、何が機能しなかったか整理しよう。',
    cheer: '柔軟さは強み。根拠を持って切り替えよう。',
  },
  WATCH: {
    happy: '待った判断が結果につながった。良い選別だった。',
    sad: '今回は条件が揃わなかった。見送ることも正しい判断。',
    cheer: '焦らなくて大丈夫。確信できる場面は必ず来る。',
  },
  RISE: {
    happy: '前回の反省が活きている。確実に前進している。',
    sad: 'この損失も、次の改善材料に変えられる。',
    cheer: '次は冷静に取り返せる。一緒に立て直そう。',
  },
}

// ---------------------------------------------------------------
// 改善アクション
//
// 「どう売買するか」ではなく「どう記録し、どう決めた通りにやるか」だけを扱う。
// 売買の指示や利益の約束はしない。
// ---------------------------------------------------------------

export interface ActionTemplate {
  id: string
  title: string
  description: string
  priority: 1 | 2 | 3
  /** この指標が低いときに出す */
  when: string
}

export const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    id: 'set-sl',
    title: '損切り位置を入れてから注文する',
    description: '損切りを置かずに入った取引が残っています。入る前に「ここまで」を決めて記録しておくと、あとで振り返れるようになります。',
    priority: 1,
    when: 'slRate',
  },
  {
    id: 'set-tp',
    title: '利確の目安も先に決めておく',
    description: '損切りだけでなく利確の目安も記録しておくと、計画通りに終えられたのかが分かるようになります。',
    priority: 2,
    when: 'slTpRate',
  },
  {
    id: 'write-journal',
    title: '取引した日にひとこと記録する',
    description: 'その日の狙いと結果を1行でも書いておくと、あとから何が効いたのかを見返せます。',
    priority: 2,
    when: 'journalRate',
  },
  {
    id: 'journal-loss',
    title: '負けた日こそ記録を残す',
    description: '負けた取引の記録が少なめです。理由が残っていると、同じ形をくり返しているかどうかが分かります。',
    priority: 1,
    when: 'lossJournalRate',
  },
  {
    id: 'steady-risk',
    title: '1回あたりのリスク幅をそろえる',
    description: '取引ごとに想定している損失の大きさがばらついています。幅をそろえると、成績の良し悪しを比べやすくなります。',
    priority: 2,
    when: 'riskConsistency',
  },
  {
    id: 'cool-down',
    title: '損切りの直後は少し時間を置く',
    description: '損失を確定した直後に入り直している取引があります。時間を空けた場合と比べてみると、判断の質が見えてきます。',
    priority: 1,
    when: 'noRevenge',
  },
  {
    id: 'keep-plan',
    title: '決めた損切り幅の中で終える',
    description: '想定より大きい損失で終わった取引があります。決めた幅で終えられた割合を、次の1か月の目安にしてみてください。',
    priority: 1,
    when: 'lossWithinPlan',
  },
  {
    id: 'watch-drawdown',
    title: '資金の減り幅を把握しておく',
    description: '資金の落ち込みが大きめの局面がありました。どこまで減ったら休むかを先に決めておくと、判断がぶれにくくなります。',
    priority: 1,
    when: 'lowDrawdown',
  },
  {
    id: 'more-records',
    title: '取引の記録を増やす',
    description: '記録の件数がまだ少ないため、取引データからの判断が限られています。件数が増えると診断の精度が上がります。',
    priority: 3,
    when: 'coverage',
  },
]

export const DISCLAIMER =
  'この診断は現在の取引記録と回答から傾向を整理したものです。投資助言ではなく、性格や能力を決めつけるものでもありません。記録が増えると結果は変わります。'

export const INTRO = {
  title: 'トレーダータイプ診断',
  lead: '24問の質問と、これまでの取引記録から、いまのトレードの傾向を6つのタイプで整理します。',
  dataUse: [
    '回答は自分のアカウントにのみ保存されます。',
    '採点にはこのアプリに記録した取引（損切り・利確の設定、記録の有無、時間帯など）を使います。',
    '取引の記録が少ない場合は、質問の回答だけで判定します。',
    '結果は上書きされず、履歴として残ります。',
  ],
}

export const STATUS_LABELS: Record<string, string> = {
  questionnaire_only: '回答のみで判定',
  provisional: '回答が中心の暫定判定',
  data_backed: '取引データが中心の判定',
}

export const SCORING_NOTE =
  'スコアはタイプの優劣ではありません。どのタイプにも強みと注意点があります。'
