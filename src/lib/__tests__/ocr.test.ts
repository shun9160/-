import { describe, expect, it } from 'vitest'
import { parseMt5Main, parseMt5Screenshot, parseMt5Text } from '../ocr'

/**
 * MT5 のスクリーンショットの読み取り。
 *
 * 取り込みの入口なので、ここが1件しか拾わないと、
 * 10件写っている画面を10回撮り直すことになる。
 *
 * 下の文字は、実機（iPhone の MT5）の画面から出てくる形に合わせてある。
 * 桁区切りが半角スペース、マイナスがダッシュ、といった癖もそのまま。
 */

/** 履歴の一覧だけが写っている画面 */
const LIST = `17:51
Positions Orders Deals
XAUUSD.raw buy 0.02 1 609
4259.49 → 4264.59 2026.08.06 08:42:21
XAUUSD.raw buy 0.02 2 104
4257.92 → 4264.59 2026.08.06 08:42:21
XAUUSD.raw sell 0.02 -937
4263.66 → 4266.63 2026.08.06 08:46:15
XAUUSD.raw buy 0.02 -2 395
4266.57 → 4258.98 2026.08.06 09:12:27
XAUUSD.raw buy 0.02 -2 345
4266.41 → 4258.98 2026.08.06 09:12:27
XAUUSD.raw buy 0.02 -1 240
4262.82 → 4258.89 2026.08.06 09:12:32
XAUUSD.raw buy 0.02 1 335
4273.13 → 4277.36 2026.08.06 12:07:24
XAUUSD.raw buy 0.02 -2 280
4278.05 → 4270.83 2026.08.06 13:01:20
XAUUSD.raw buy 0.02 136
4242.17 → 4242.60 2026.08.06 20:07:44
XAUUSD.raw buy 0.02 -1 451
4292.31 → 4287.73 2026.08.07 10:25:27
Deposit 249 940
Profit -244 042
Swap 0
Commission -3 616
Balance 2 282`

/**
 * 同じ画面で、いちばん下の1件を押して詳細を開いたところ。
 * パネルの裏になった行は、下半分（値段と時刻）が隠れている
 */
const LIST_WITH_DETAIL = `17:56
Positions Orders Deals
XAUUSD.raw buy 0.02 1 609
4259.49 → 4264.59 2026.08.06 08:42:21
XAUUSD.raw buy 0.02 2 104
4257.92 → 4264.59 2026.08.06 08:42:21
XAUUSD.raw sell 0.02 -937
4263.66 → 4266.63 2026.08.06 08:46:15
XAUUSD.raw buy 0.02 -2 395
4266.57 → 4258.98 2026.08.06 09:12:27
XAUUSD.raw buy 0.02 -2 345
4266.41 → 4258.98 2026.08.06 09:12:27
XAUUSD.raw buy 0.02 -1 240
4262.82 → 4258.89 2026.08.06 09:12:32
XAUUSD.raw buy 0.02 1 335
4273.13 → 4277.36 2026.08.06 12:07:24
XAUUSD.raw buy 0.02 -2 280
4278.05 → 4270.83 2026.08.06 13:01:20
XAUUSD.raw buy 0.02 136
XAUUSD.raw buy 0.02 #19378981
Gold vs US Dollar / Spot
4242.17 → 4242.60 136
Δ = 43 (0.01%)
2026.08.06 20:07:39 → 2026.08.06 20:07:44
S/L: - Swap: -
T/P: - Charges: -8
Chart`

describe('一覧だけが写っている画面', () => {
  const trades = parseMt5Text(LIST)

  it('写っている取引をすべて取り出す', () => {
    expect(trades.length).toBe(10)
  })

  it('1件ごとに、銘柄・売買・ロット・値段・決済時刻・損益がそろう', () => {
    for (const t of trades) {
      expect(t.symbol).toBe('XAUUSD.raw')
      expect(t.side === 'buy' || t.side === 'sell').toBe(true)
      expect(t.volume).toBe(0.02)
      expect(t.openPrice).toBeGreaterThan(4000)
      expect(t.closePrice).toBeGreaterThan(4000)
      expect(t.closeTime).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/)
      expect(t.profit).not.toBeUndefined()
    }
  })

  it('1件目と最後の1件が、画面のとおりに読める', () => {
    expect(trades[0]).toMatchObject({
      symbol: 'XAUUSD.raw',
      side: 'buy',
      volume: 0.02,
      openPrice: 4259.49,
      closePrice: 4264.59,
      profit: 1609,
      closeTime: '2026.08.06 08:42:21',
    })
    expect(trades[9]).toMatchObject({
      openPrice: 4292.31,
      closePrice: 4287.73,
      profit: -1451,
      closeTime: '2026.08.07 10:25:27',
    })
  })

  it('売りの1件も、売りとして読める', () => {
    const sell = trades.filter((t) => t.side === 'sell')
    expect(sell.length).toBe(1)
    expect(sell[0].profit).toBe(-937)
  })

  it('損失は、マイナスのまま読む', () => {
    // 符号を落とすと、負けた日が勝った日として集計される
    expect(trades.map((t) => t.profit)).toEqual([
      1609, 2104, -937, -2395, -2345, -1240, 1335, -2280, 136, -1451,
    ])
  })

  it('いちばん下の合計欄を、取引として数えない', () => {
    // Deposit / Profit / Swap / Commission / Balance の5行
    expect(trades.some((t) => t.profit === 249940)).toBe(false)
    expect(trades.some((t) => t.profit === -244042)).toBe(false)
    expect(trades.some((t) => t.profit === 2282)).toBe(false)
  })
})

describe('一覧の上に詳細パネルが開いている画面', () => {
  const trades = parseMt5Text(LIST_WITH_DETAIL)

  it('パネルが開いていても、一覧の取引を全部取り出す', () => {
    // 以前はここで1件（パネルのぶん）しか返さず、上の8件を捨てていた
    expect(trades.length).toBe(9)
  })

  it('パネルの見出しを、もう1件として数えない', () => {
    // "XAUUSD.raw buy 0.02  #19378981" の行。
    // 数えてしまうと、行末の番号を損益として拾って 19378981 円になる
    expect(trades.some((t) => t.profit === 19378981)).toBe(false)
  })

  it('パネルの裏で隠れていた行を、パネルの中身で埋める', () => {
    const t = trades[trades.length - 1]
    expect(t).toMatchObject({
      symbol: 'XAUUSD.raw',
      side: 'buy',
      volume: 0.02,
      profit: 136,
      // ここは一覧では隠れていて、パネルにしか出ていない
      ticket: '19378981',
      openPrice: 4242.17,
      closePrice: 4242.60,
      openTime: '2026.08.06 20:07:39',
      closeTime: '2026.08.06 20:07:44',
      commission: -8,
    })
  })

  it('入った時刻と決済時刻が、別の時刻になる', () => {
    // 一覧にしか出ていない行は、決済時刻しか分からないので同じ値が入る。
    // パネルを開いた1件だけは、入った時刻が本当の値になる
    const t = trades[trades.length - 1]
    expect(t.openTime).not.toBe(t.closeTime)

    const listOnly = trades[0]
    expect(listOnly.openTime).toBe(listOnly.closeTime)
  })

  it('パネルより上の取引は、これまでどおり読める', () => {
    expect(trades[0]).toMatchObject({
      openPrice: 4259.49,
      closePrice: 4264.59,
      profit: 1609,
    })
    expect(trades[3]).toMatchObject({ openPrice: 4266.57, profit: -2395 })
  })

  it('番号・S/L・T/P は、パネルを開いた1件にだけ付く', () => {
    const withTicket = trades.filter((t) => t.ticket != null)
    expect(withTicket.length).toBe(1)
    // 画面では S/L も T/P も「-」なので、値は入らない
    expect(withTicket[0].sl).toBeUndefined()
    expect(withTicket[0].tp).toBeUndefined()
  })
})

describe('詳細パネルだけを撮った画面', () => {
  const DETAIL = `XAUUSD.raw buy 0.02 #19378981
Gold vs US Dollar / Spot
4242.17 → 4242.60 136
2026.08.06 20:07:39 → 2026.08.06 20:07:44
S/L: 4230.00 Swap: 0
T/P: 4260.50 Charges: -8`

  it('1件として、細かいところまで読める', () => {
    expect(parseMt5Screenshot(DETAIL)).toMatchObject({
      symbol: 'XAUUSD.raw',
      side: 'buy',
      volume: 0.02,
      ticket: '19378981',
      openPrice: 4242.17,
      closePrice: 4242.6,
      profit: 136,
      openTime: '2026.08.06 20:07:39',
      closeTime: '2026.08.06 20:07:44',
      sl: 4230,
      tp: 4260.5,
      commission: -8,
    })
  })

  it('一覧が写っていなくても、1件だけ返る', () => {
    const trades = parseMt5Text(DETAIL)
    expect(trades.length).toBe(1)
    expect(trades[0].ticket).toBe('19378981')
  })
})

describe('読み違えやすいところ', () => {
  it('時刻の後ろのマイナスを、矢印と読み違えない', () => {
    // "08:46:15 -937" の - を矢印にすると、損失が利益になる
    const t = parseMt5Text(
      'XAUUSD.raw sell 0.02 -937\n4263.66 → 4266.63 2026.08.06 08:46:15',
    )[0]
    expect(t.profit).toBe(-937)
  })

  it('桁区切りの半角スペースを、別の数値にしない', () => {
    const t = parseMt5Text(
      'XAUUSD.raw buy 0.02 -2 395\n4266.57 → 4258.98 2026.08.06 09:12:27',
    )[0]
    expect(t.profit).toBe(-2395)
  })

  it('矢印がハイフンに化けても、値段として読める', () => {
    const t = parseMt5Text(
      'XAUUSD.raw buy 0.02 1 609\n4259.49 - 4264.59 2026.08.06 08:42:21',
    )[0]
    expect(t.openPrice).toBe(4259.49)
    expect(t.closePrice).toBe(4264.59)
  })

  it('取引が1件も写っていなければ、空で返る', () => {
    expect(parseMt5Text('Positions Orders Deals\nBalance 2 282')).toEqual([])
  })
})

describe('1件だけ記録する画面（記録タブのカメラ）', () => {
  it('パネルを開いて撮ったときは、その1件がフォームに入る', () => {
    // わざわざ開いて撮ったのに、いちばん上の別の取引が入ると
    // 毎回選び直すことになる
    const main = parseMt5Main(LIST_WITH_DETAIL)
    expect(main).toMatchObject({
      ticket: '19378981',
      profit: 136,
      openPrice: 4242.17,
      closePrice: 4242.6,
      openTime: '2026.08.06 20:07:39',
    })
  })

  it('一覧だけのときは、いちばん上の1件が入る', () => {
    expect(parseMt5Main(LIST)).toMatchObject({ profit: 1609, openPrice: 4259.49 })
  })
})

/**
 * ロットが読めなかった行。
 *
 * 実物のスクショで起きた形をそのまま置いてある。
 * MT5 の浮いているタブ（Positions / Orders / Deals）の下に入った行が薄くなり、
 * 「0.05」が「u.us」に化けた。銘柄も損益も時刻も読めているのに、
 * ロット1つのために行ごと消えていた。
 */
const FADED_LOT = `XAUUSD.raw buy u.us 161
4433.24 → 4433.45 2026.09.08 07:39:01
XAUUSD.raw sell 0.05 346
4397.21 → 4396.76 2026.09.08 10:40:55`

describe('ロットが読めなかった行', () => {
  it('行ごと捨てない。読めたところは残す', () => {
    const rows = parseMt5Text(FADED_LOT)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      symbol: 'XAUUSD.raw',
      side: 'buy',
      profit: 161,
      openPrice: 4433.24,
      closePrice: 4433.45,
      closeTime: '2026.09.08 07:39:01',
    })
  })

  it('読めなかったロットは、空のままにする', () => {
    // 化けた文字から数を作ろうとしない。人が打ち直せるように空で出す
    expect(parseMt5Text(FADED_LOT)[0].volume).toBeUndefined()
  })

  it('となりの行は、これまで通り全部読める', () => {
    expect(parseMt5Text(FADED_LOT)[1]).toMatchObject({
      side: 'sell',
      volume: 0.05,
      profit: 346,
      closeTime: '2026.09.08 10:40:55',
    })
  })

  it('ロットの一部が化けていても、途中まででは拾わない', () => {
    // 「0.1O」を 0.1 として入れると、0.10 なのか 0.15 なのか分からないまま
    // それらしい数が入ってしまう。空にして人に確かめてもらう
    const rows = parseMt5Text(`XAUUSD.raw buy 0.1O 161
4433.24 → 4433.45 2026.09.08 07:39:01`)
    expect(rows).toHaveLength(1)
    expect(rows[0].volume).toBeUndefined()
    expect(rows[0].profit).toBe(161)
  })

  it('ロットが読めた行の損益を、ロットと取り違えない', () => {
    // 損益の書いていない行では、行末の数がロットそのもの
    const rows = parseMt5Text(`XAUUSD.raw sell 0.05
4393.55 → 4393.55 2026.09.08 10:50:26`)
    expect(rows[0].volume).toBe(0.05)
    expect(rows[0].profit).toBeUndefined()
  })
})
