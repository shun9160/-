import type { Block, DayEntry, Photo } from './journal'
import { demoChartPath } from './demoChart'

/**
 * サンプルの日記。
 *
 * ログインしていない人が最初に見る画面。ここが空だと、
 * 「トレード履歴を貼るだけの表計算ソフト」に見えてしまう。
 * このアプリの中心は、勝ち負けではなく、そのとき何を考えていたか
 * を残すところにある。それが伝わるだけの中身を先に入れておく。
 *
 * 書き方も見本にする。うまくいった日ばかりを並べない。
 * 焦った日・待てた日・何もしなかった日を混ぜる。
 * 全部が反省文でも、全部が自慢でもない日記のほうが、
 * 自分も書けそうだと思える。
 */

/** 本文のひとかたまり。文字か、チャートか */
type Piece = string | { chart: ChartSpec; caption: string }

interface ChartSpec {
  seed: number
  symbol?: string
  timeframe?: string
  bias?: number
  side?: 'buy' | 'sell'
  levels?: boolean
}

interface Draft {
  /** 今日から数えて何営業日前か。0 は今日 */
  back: number
  title: string
  /** いちばん上に並べるチャート */
  charts?: { chart: ChartSpec; caption: string }[]
  body: Piece[]
  emotions?: string[]
  emotionWhy?: string
  good?: string
  improve?: string
  nextTime?: string
  lesson?: string
}

const DRAFTS: Draft[] = [
  {
    back: 0,
    title: '待つと決めた場所まで、はじめて待てた',
    charts: [
      {
        chart: { seed: 101, symbol: 'XAUUSD', timeframe: '15m', bias: 1, side: 'buy' },
        caption: '朝の安値を切り上げてから、赤い帯の上で待った',
      },
      {
        chart: { seed: 102, symbol: 'XAUUSD', timeframe: '1h', bias: 1, levels: false },
        caption: '1時間足。上目線は変えなくていい形だった',
      },
    ],
    body: [
      'ロンドンが開いてすぐ、ぐっと上に伸びた。いつもならここで飛び乗っている。今日は前の日に「伸びたところでは入らない」と書いたのを思い出して、指を止めた。',
      '15分足が一度戻ってきて、朝の安値を割らずに止まったところで入った。入ってから逆に行った時間が20分くらいあって、その間ずっと画面を閉じたくなったけれど、損切りの場所は動かさなかった。',
      {
        chart: { seed: 103, symbol: 'XAUUSD', timeframe: '5m', bias: 1, side: 'buy' },
        caption: '入ったところ。ここで待てたのが今日いちばん大きい',
      },
      '結果は決めていた場所の少し手前で閉じた。数字としては悪くない。ただ、閉じた理由が「怖くなったから」だったのは、あとで効いてくる気がする。',
    ],
    emotions: ['calm', 'anxious'],
    emotionWhy:
      '入るまでは落ち着いていた。持っている間は、含み益が減っていくのを見るのがつらかった。',
    good: '伸びきったところで飛び乗らなかった。前の日に書いたことを覚えていた。',
    improve: '決めた場所の手前で閉じた。理由が「怖い」だけなら、それは根拠ではない。',
    nextTime: '同じ形が来たら、同じ場所で入って、決めた場所まで一度は持ってみる。',
    lesson: '待てたかどうかは、勝ち負けとは別に数えていい。',
  },
  {
    back: 1,
    title: '取り返そうとして、二度目で大きくやられた',
    charts: [
      {
        chart: { seed: 111, symbol: 'USDJPY', timeframe: '5m', bias: -1, side: 'sell' },
        caption: '一度目。ここは決めた通りに切れた',
      },
      {
        chart: { seed: 112, symbol: 'USDJPY', timeframe: '5m', bias: 1, side: 'sell' },
        caption: '二度目。同じ方向に、倍のロットで入った',
      },
    ],
    body: [
      '一度目の損切りは問題なかった。決めた場所に置いて、決めた場所で切れた。ここまでは書くこともない。',
      '問題はそのあと。「さっきのは形が悪かっただけで、方向は合っている」と思って、5分後にもう一度入った。しかもロットを倍にしていた。倍にした理由を今書こうとしても出てこない。取り返したかった、だけだと思う。',
      '二度目は損切りも置かないまま持って、最後は見ていられなくなって切った。今日のマイナスの8割がこの1本。',
    ],
    emotions: ['revenge', 'rushed'],
    emotionWhy: '一度目を切った瞬間から、今日をプラスで終わらせることしか考えていなかった。',
    good: '最後は自分で切れた。放置して口座を溶かすところまでは行かなかった。',
    improve: '負けた直後の5分は、何も触らないほうがいい。ロットを上げる理由が「取り返す」なら、それは根拠ではない。',
    nextTime: '損切りしたら、その日はロットを上げない。次に入るのは最低30分あけてから。',
    lesson: '負けた直後の自分は、いつもの自分ではない。ルールはそのときのために作る。',
  },
  {
    back: 2,
    title: '何もしなかった日',
    body: [
      '朝から方向感がなくて、上にも下にも行かなかった。入れそうな形が一度も出なかったので、そのまま閉じた。',
      '前は「何もしていない日は日記に書くことがない」と思っていたけれど、入らなかった理由を書いておくと、あとで同じ相場が来たときに迷わない。',
    ],
    emotions: ['calm'],
    emotionWhy: '入りたくてうずうずはしたけれど、無理に入らなくても平気だった。',
    lesson: '入らなかった日も、判断をした日として数える。',
  },
  {
    back: 3,
    title: '指標の前に持ち越して、運で勝った',
    charts: [
      {
        chart: { seed: 121, symbol: 'XAUUSD', timeframe: '15m', bias: 1, side: 'buy' },
        caption: '発表の瞬間。上に飛んだが、下に飛んでいてもおかしくなかった',
      },
    ],
    body: [
      '入ったのは発表の20分前。指標があるのは分かっていたのに、「もう伸びているから大丈夫」と思って持ったまま迎えた。',
      '結果は上に飛んで、今週いちばんのプラスになった。ただ、これは自分がうまかったわけではない。逆に飛んでいたら、損切りの場所を飛び越えて決済されていた。',
      '嬉しかったけれど、同じことをもう一度やる気にはならない。',
    ],
    emotions: ['fomo', 'confident'],
    emotionWhy: '伸びているのを見て、置いていかれる気がした。勝ったあとは気が大きくなった。',
    good: 'ロットだけはいつも通りにしていた。',
    improve: '指標の時間を見ていなかった。持ち越すかどうかは、入る前に決めておくこと。',
    nextTime: '発表の30分前に持っていたら、半分は閉じる。',
    lesson: '勝った日ほど、なぜ勝ったのかを疑う。',
  },
  {
    back: 4,
    title: '損切りを置き忘れていた',
    body: [
      '入ってから15分くらいして、損切りが入っていないことに気づいた。慌てて入れたけれど、その15分は完全に無防備だった。',
      '幸い動きが小さくて何も起きなかった。起きなかっただけ。',
    ],
    emotions: ['anxious'],
    emotionWhy: '気づいた瞬間、手が冷たくなった。',
    improve: '入れたら真っ先に損切りを置く。順番を変えない。',
    lesson: '何も起きなかった日は、運がよかっただけのことがある。',
  },
  {
    back: 6,
    title: '同じ形で3回入って、3回とも同じところで切られた',
    charts: [
      {
        chart: { seed: 131, symbol: 'XAUUSD', timeframe: '15m', bias: -1, side: 'buy' },
        caption: '3回とも、この赤い帯のところで切られている',
      },
      {
        chart: { seed: 132, symbol: 'XAUUSD', timeframe: '1h', bias: -1, levels: false },
        caption: '1時間足で見たら、そもそも下向きだった',
      },
    ],
    body: [
      '15分足だけを見て、同じ形で3回買った。3回とも同じところで切られた。',
      '終わってから1時間足を出したら、ずっと下向きだった。上位足を見ていれば、そもそも買う場面ではなかった。',
      '3回目に入るとき、「今度こそ」と思っていた。そう思った時点で止めるべきだった。',
    ],
    emotions: ['rushed', 'revenge'],
    emotionWhy: '切られるたびに、認めたくない気持ちが強くなっていった。',
    good: '3回とも損切りは決めた場所に置いていた。傷が浅く済んだのはそれだけ。',
    improve: '入る前に、必ず1時間足を出す。',
    nextTime: '同じ形で2回切られたら、その日はその形を使わない。',
    lesson: '同じ形で2回切られたら、形ではなく相場のほうが変わっている。',
  },
  {
    back: 8,
    title: '朝いちばんに書いた計画どおりに動けた',
    charts: [
      {
        chart: { seed: 141, symbol: 'USDJPY', timeframe: '15m', bias: 1, side: 'buy' },
        caption: '朝に引いた線。ここまで来たら買う、と決めていた',
      },
    ],
    body: [
      '相場が動く前に、どこまで来たら入るかを書いておいた。書いてあると、来たときに迷わない。',
      '結果は小さなプラス。でも今日いちばんよかったのは、決めた場所以外では一度も入らなかったこと。',
    ],
    emotions: ['calm', 'confident'],
    good: '決めた場所以外で入らなかった。',
    lesson: '入る場所は、相場が動く前に決めておく。動いてから決めると、たいてい高いところで買う。',
  },
  {
    back: 10,
    title: '含み益が減るのが怖くて、すぐ閉じてしまう',
    body: [
      '今日も、決めた場所の半分くらいで閉じた。閉じたあとに、決めていた場所まで伸びていくのを見た。これで今週3回目。',
      '損切りは守れているのに、利確だけが守れていない。たぶん、減っていくのを見るのが損切りより怖い。',
    ],
    emotions: ['anxious'],
    emotionWhy: 'プラスがマイナスに変わるのが、最初から負けるより嫌だった。',
    improve: '半分だけ決済して、残りは決めた場所まで置いてみる。全部か0かにしない。',
    lesson: '守れないルールは、自分に合っていないだけかもしれない。守れる大きさに割る。',
  },
  {
    back: 13,
    title: 'ロットを上げた日は、判断がぶれる',
    body: [
      'いつもの倍のロットで入った。同じ形、同じ場所なのに、少し逆行しただけで手が動いた。',
      '同じ判断ができないなら、そのロットはまだ早い。',
    ],
    emotions: ['anxious', 'rushed'],
    lesson: '同じ判断ができる大きさが、いまの自分に合ったロット。',
  },
  {
    back: 17,
    title: 'はじめて1週間、記録を続けられた',
    body: [
      '書きはじめたころは、負けた日を書くのが嫌で飛ばしていた。今週は全部書いた。',
      '並べて読み返すと、負けている日はだいたい同じ理由だった。形が悪いのではなく、待てていない。',
    ],
    emotions: ['calm'],
    lesson: '書いた日が並んではじめて、自分の負け方が見えてくる。',
  },

  // ここから下は、続けているうちに書き方が短くなっていった日。
  // 毎日きっちり長文だと「これを毎日書くのか」と身構えてしまう。
  // 一行でも残っていれば、あとから読み返せることを見せたい
  {
    back: 5,
    title: '入る前に、損切りの場所を声に出した',
    body: [
      '声に出すと、置き忘れなくなった。頭の中で決めているだけだと、入った瞬間に消えている。',
      'ばかばかしいけれど、これが今のところいちばん効いている。',
    ],
    emotions: ['calm'],
    lesson: '決めごとは、頭の中ではなく口か紙に出す。',
  },
  {
    back: 7,
    title: '東京時間で入って、動かないまま切った',
    charts: [
      {
        chart: { seed: 151, symbol: 'USDJPY', timeframe: '15m', bias: 0, side: 'buy' },
        caption: '朝の時間。この幅の中で行ったり来たりしていた',
      },
    ],
    body: [
      '朝から幅の狭い動きが続いていた。動かないのを見ていたら退屈になって、動きそうな形にも見えてきて入った。',
      '結局そのまま動かず、時間だけ使って切った。損は小さいけれど、これは入らなくていい取引だった。',
    ],
    emotions: ['neutral'],
    emotionWhy: '退屈だった。それだけの理由で入っていた。',
    improve: '動かない時間帯だと分かっているなら、画面を閉じる。',
    lesson: '退屈は、入る理由にならない。',
  },
  {
    back: 9,
    title: '週のはじめに、今週やらないことを決めた',
    body: [
      'やることではなく、やらないことを3つ書いた。指標の直前に入らない、負けたあとすぐ入らない、ロットを上げない。',
      'やることを増やすより、こっちのほうが守れる気がする。',
    ],
    emotions: ['confident'],
    lesson: 'やることより、やらないことを決めるほうが守りやすい。',
  },
  {
    back: 11,
    title: '損切りにかかったあと、すぐ伸びていった',
    charts: [
      {
        chart: { seed: 161, symbol: 'XAUUSD', timeframe: '5m', bias: 1, side: 'buy' },
        caption: '切られたすぐあとに、狙っていたほうへ行った',
      },
    ],
    body: [
      '切られた直後に、狙っていた方向へ伸びていった。見ていて悔しかった。',
      'ただ、損切りの場所は間違っていなかったと思う。あそこを割ったら形が崩れる場所だった。悔しさと判断のよしあしは別だと、書きながら言い聞かせている。',
    ],
    emotions: ['rushed', 'anxious'],
    emotionWhy: '悔しくて、もう一度入り直したくなった。入らなかった。',
    good: '切られたあと、入り直さなかった。',
    lesson: '切られたあとに伸びても、切った判断が間違いだったとは限らない。',
  },
  {
    back: 12,
    title: 'ロンドンの最初の30分は、やはり荒い',
    body: [
      '開いた直後に入って、上にも下にも振られてから切られた。この時間に入って勝てた記憶があまりない。',
      '時間帯の成績を見たら、やっぱりここだけ悪かった。',
    ],
    emotions: ['neutral'],
    improve: 'ロンドンが開いて30分は、動きが落ち着くまで待つ。',
    lesson: '苦手な時間帯は、記録を見れば分かる。',
  },
  {
    back: 14,
    title: '利確の場所を、入る前に決めておいた',
    body: [
      'これまでは入ってから考えていた。入ってから考えると、含み益の増減に合わせて場所が動いてしまう。',
      '先に決めておくと、あとは待つだけになる。',
    ],
    emotions: ['calm'],
    good: '入る前に、出る場所まで決めた。',
    lesson: '出る場所は、入る前に決める。',
  },
  {
    back: 15,
    title: '負けた日の翌日は、ロットを下げてみた',
    body: [
      '半分にして入った。判断はいつも通りできた気がする。',
      '取り返そうとして上げるのと逆のことをやってみたら、ずいぶん楽だった。',
    ],
    emotions: ['calm', 'confident'],
    lesson: '調子が悪いときは、大きさを下げると判断が戻る。',
  },
  {
    back: 16,
    title: '同じ形を、別の通貨で試した',
    charts: [
      {
        chart: { seed: 171, symbol: 'USDJPY', timeframe: '15m', bias: 1, side: 'buy' },
        caption: '同じ押し目の形。動きの幅が違う',
      },
    ],
    body: [
      'いつもの形をドル円で試した。同じ形でも動く幅が違うので、損切りの幅もそのままでは合わない。',
      '通貨ごとに幅を決め直す必要がある。',
    ],
    emotions: ['neutral'],
    lesson: '同じ形でも、通貨が変われば幅が変わる。',
  },
  {
    back: 18,
    title: '含み益が乗ってから、損切りを建値に上げた',
    body: [
      '建値まで上げたら、そのあと戻ってきて建値で終わった。損はしていないけれど、伸びるところを取り逃した。',
      '上げるのが早すぎたのかもしれない。しばらくは上げずに置いてみる。',
    ],
    emotions: ['anxious'],
    improve: '損切りを動かすのは、決めた場所の半分まで来てから。',
    lesson: '守りを固めすぎると、伸びるところも取れなくなる。',
  },
  {
    back: 19,
    title: '記録を見返す日を作った',
    body: [
      '毎週、取引をしない日をひとつ作って、その週ぶんを読み返すことにした。',
      '入っているときは気づかないことが、読み返すと出てくる。',
    ],
    emotions: ['calm'],
    lesson: '読み返す時間を、あらかじめ空けておく。',
  },
  {
    back: 20,
    title: '大きく勝った翌日が、いちばん危ない',
    body: [
      '前の日に大きく勝って、今日は最初から気が大きくなっていた。いつもなら見送る形で入って、そのまま切られた。',
      '負けた翌日を警戒していたけれど、勝った翌日のほうが危ないかもしれない。',
    ],
    emotions: ['confident', 'rushed'],
    emotionWhy: '勝った次の日は、自分がうまくなった気がしていた。',
    improve: '勝った翌日も、ロットと本数はいつも通りにする。',
    lesson: '気が大きくなっている日は、勝った次の日にも来る。',
  },
  {
    back: 21,
    title: '入らなかった形を、あとで見返した',
    charts: [
      {
        chart: { seed: 181, symbol: 'XAUUSD', timeframe: '15m', bias: 1, levels: false },
        caption: '入らなかった形。結果としては伸びていた',
      },
    ],
    body: [
      '入らなかった形をあとで見たら、狙い通りに伸びていた。入らなかった理由は「なんとなく怖かった」だけだった。',
      '入る理由を言葉にできないのと同じくらい、入らない理由も言葉にできていない。',
    ],
    emotions: ['anxious'],
    lesson: '入らない判断にも、言葉にできる理由が要る。',
  },
  {
    back: 22,
    title: '一日の本数を3本までにした',
    body: [
      '本数を決めてから、1本ずつの選び方が変わった。あと何本入れるかを考えると、雑な形では入らなくなる。',
      'しばらくこれで続けてみる。',
    ],
    emotions: ['calm'],
    lesson: '本数に上限をつけると、1本の質が上がる。',
  },
  {
    back: 23,
    title: 'チャートを貼るようにしたら、思い出せるようになった',
    charts: [
      {
        chart: { seed: 191, symbol: 'XAUUSD', timeframe: '15m', bias: -1, side: 'sell' },
        caption: '入ったときの形。文字だけだと思い出せなかった',
      },
      {
        chart: { seed: 192, symbol: 'XAUUSD', timeframe: '5m', bias: -1, side: 'sell' },
        caption: '同じところを、細かい足で見たもの',
      },
    ],
    body: [
      '文字だけで書いていたころは、読み返しても「そんな日もあった」で終わっていた。',
      '絵が1枚あるだけで、そのときの画面と、迷っていた時間まで戻ってくる。',
    ],
    emotions: ['calm'],
    lesson: '文字より先に、そのとき見ていた絵を残す。',
  },
  {
    back: 24,
    title: '負けを取り返した日',
    body: [
      '午前に負けて、午後に取り返した。結果はプラスだけれど、午後に入った理由は「取り返したい」だった。',
      'たまたま合っていただけで、やったことは前に反省したのと同じ。',
    ],
    emotions: ['revenge'],
    emotionWhy: '午前のマイナスを、その日のうちに消したかった。',
    improve: '日をまたいで平らにすればいい。その日のうちに戻す必要はない。',
    lesson: '結果がプラスでも、やり方が同じなら次は同じようには行かない。',
  },
  {
    back: 25,
    title: '損切りの幅を、通貨ごとに書き出した',
    body: [
      '毎回その場で決めていたので、日によってばらばらだった。書き出してみたら、負けの大きい日は決まって幅が広かった。',
    ],
    emotions: ['neutral'],
    lesson: 'その場で決めているものは、たいていばらついている。',
  },
  {
    back: 26,
    title: '見送った日',
    body: ['形が出なかったので入らなかった。それだけの日。'],
    emotions: ['calm'],
  },
  {
    back: 28,
    title: '順張りと逆張りが混ざっていた',
    body: [
      '入った理由を並べてみたら、順張りのつもりで入った日と、下がったから買った日が混ざっていた。',
      '混ざっていると、うまくいかなかったときにどちらが悪かったのか分からない。',
    ],
    emotions: ['neutral'],
    improve: 'しばらくは順張りだけにする。',
    lesson: 'やり方を混ぜると、振り返っても原因が分からなくなる。',
  },
  {
    back: 30,
    title: '型に名前をつけはじめた',
    body: [
      '「押し目買い」「戻り売り」と名前をつけて記録するようにした。',
      '名前がつくと、同じものを数えられるようになる。',
    ],
    emotions: ['confident'],
    lesson: '数えたいものには、先に名前をつける。',
  },
  {
    back: 32,
    title: 'はじめて記録をつけた日',
    charts: [
      {
        chart: { seed: 201, symbol: 'XAUUSD', timeframe: '1h', bias: 1, levels: false },
        caption: 'この日から残しはじめた',
      },
    ],
    body: [
      '勝った負けたを紙に書くだけではなく、そのとき何を考えていたかを残すことにした。',
      '続くかどうかは分からないけれど、書いてみると、入った理由を思い出せない取引が思ったより多いことに気づいた。',
    ],
    emotions: ['neutral'],
    lesson: '入った理由を思い出せない取引が、いちばん多い。',
  },
]

/** 通し番号。並べ替えても取り違えないための印 */
let n = 0
function id(): string {
  n += 1
  return `demo-b${n}`
}

function photo(spec: ChartSpec, caption: string): Photo {
  return { id: id(), path: demoChartPath(spec), caption }
}

function toBlocks(pieces: Piece[]): Block[] {
  return pieces.map((p) =>
    typeof p === 'string'
      ? { id: id(), kind: 'text' as const, text: p }
      : { id: id(), kind: 'image' as const, path: demoChartPath(p.chart), caption: p.caption },
  )
}

/**
 * 何営業日前かを、日付（YYYY-MM-DD）にする。
 *
 * 0 は today をそのまま返す。土日でも返す。
 * サンプルを土曜に開いた人の「今日」が空だと、
 * 動いていないアプリに見えてしまうため。
 */
function dayBack(today: string, back: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  let left = back
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() - 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) left--
  }
  return d.toISOString().slice(0, 10)
}

/**
 * サンプルの日記を、日付をつけて組み立てる。
 * 今日を渡すのは、開いた日から見て「昨日」「一昨日」になるようにするため。
 */
export function demoEntries(today: string): Record<string, DayEntry> {
  const out: Record<string, DayEntry> = {}
  n = 0
  for (const d of DRAFTS) {
    const day = dayBack(today, d.back)
    out[day] = {
      day,
      title: d.title,
      photos: (d.charts ?? []).map((c) => photo(c.chart, c.caption)),
      blocks: toBlocks(d.body),
      emotions: d.emotions ?? [],
      emotionWhy: d.emotionWhy ?? '',
      good: d.good ?? '',
      improve: d.improve ?? '',
      nextTime: d.nextTime ?? '',
      lesson: d.lesson ?? '',
    }
  }
  return out
}

/** サンプルの日記が入っている日。取引もこの日に置く */
export function demoEntryDays(today: string): string[] {
  return DRAFTS.map((d) => dayBack(today, d.back))
}
