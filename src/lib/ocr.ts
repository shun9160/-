/**
 * MT5 のポジション詳細スクリーンショットから取引内容を読み取る。
 *
 * 文字認識(OCR)は誤読が避けられないので、
 *  - 読み取れた項目だけを返す（分からない項目は undefined のまま）
 *  - 呼び出し側でフォームに入れて、人が直せるようにする
 * という方針にしている。
 */

export interface ParsedTrade {
  symbol?: string
  side?: 'buy' | 'sell'
  volume?: number
  ticket?: string
  openPrice?: number
  closePrice?: number
  /** "2026.08.04 07:45:30" 形式 (MT5表示のまま) */
  openTime?: string
  closeTime?: string
  sl?: number
  tp?: number
  profit?: number
  commission?: number
}

/** マイナス記号として使われうる文字（OCRはハイフンをダッシュと読むことがある） */
const DASH = '-–—−‒'

/** OCR結果にありがちな崩れをならす */
function normalize(raw: string): string {
  return (
    raw
      // 全角英数を半角へ
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[：]/g, ':')
      .replace(/[．]/g, '.')
      // 明確な矢印は矢印に寄せる
      .replace(/[→⇒➔➜»]+/g, '→')
      // ダッシュ類を矢印とみなすのは「数字 ␣ ─ ␣ 数字」の形のときだけ。
      //
      // 前後に空白があることを必須にしないと、
      //   "05:50:54 -1520"（時刻の後ろのマイナス損益）
      // のマイナスまで矢印に変えてしまい、損失がプラスとして読まれる。
      // 区切りの矢印は前後が空いていて、マイナス記号は数字に密着している。
      // 矢印は "-." "—." のように、点や読点が付いて認識されることがある
      .replace(new RegExp(`(\\d)\\s+[${DASH}~>]{1,2}[.,]?\\s+(\\d)`, 'g'), '$1 → $2')
  )
  // ここで桁区切りをまとめて消すと "4063.48 101"(価格+損益) を
  // 1つの数値に繋げてしまうため、数値を取り出す時に個別に処理する。
}

/** 桁区切り・各種マイナスを含む数値表現。例: "2 044" "1,234.5" "—8" */
const SIGN = `[${DASH}]?\\s?`
const NUM = `${SIGN}\\d{1,3}(?:[ ,]\\d{3})+(?:\\.\\d+)?|${SIGN}\\d+(?:\\.\\d+)?`

/** "2 044" "—8" のような文字列を数値へ */
function num(s: string | undefined): number | undefined {
  if (!s) return undefined
  const cleaned = s
    .replace(new RegExp(`[${DASH}]`, 'g'), '-') // マイナスを統一
    .replace(/[ ,]/g, '')
    .replace(/[^\d.-]/g, '')
  const v = parseFloat(cleaned)
  return isNaN(v) ? undefined : v
}

/** ラベルの後ろにある値を探す。列が崩れて次の行に落ちている場合も拾う。 */
function findLabelValue(
  lines: string[],
  label: RegExp,
  value: RegExp,
): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].search(label)
    if (at < 0) continue

    // 同じ行のラベルより後ろを見る
    const after = lines[i].slice(at).replace(label, ' ')
    const inLine = after.match(value)
    if (inLine) return inLine[1]

    // 次の行に落ちている場合（ラベルだけの行 → 値だけの行）。
    // ただし次の行が別のラベル行なら取り違えるので使わない。
    const next = lines[i + 1]
    if (next && !/[A-Za-z]{4,}|S\s*[\/|]\s*L|T\s*[\/|]\s*P/i.test(next)) {
      const m = next.match(value)
      if (m) return m[1]
    }
  }
  return undefined
}

export function parseMt5Screenshot(rawText: string): ParsedTrade {
  const allLines = normalize(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // スクショに一覧と詳細パネルが両方写っていることが多い。
  // 一覧の他トレードを拾わないよう、詳細パネル(ポジション番号の行から下)だけを見る。
  const detailAt = allLines.findIndex((l) => /#\s*\d{5,}/.test(l))
  const lines = detailAt >= 0 ? allLines.slice(detailAt) : allLines
  const text = lines.join('\n')
  const out: ParsedTrade = {}

  // --- 銘柄 / 売買 / ロット -------------------------------------
  // 例: "XAUUSD.raw buy 0.02"
  const head = text.match(/([A-Z][A-Z0-9]{2,}(?:\.[A-Za-z]+)?)\s+(buy|sell)\s+(\d+(?:\.\d+)?)/i)
  if (head) {
    out.symbol = head[1]
    out.side = head[2].toLowerCase() as 'buy' | 'sell'
    out.volume = num(head[3])
  } else {
    const side = text.match(/\b(buy|sell)\b/i)
    if (side) out.side = side[1].toLowerCase() as 'buy' | 'sell'
    const sym = text.match(/\b([A-Z]{6}(?:\.[A-Za-z]+)?)\b/)
    if (sym) out.symbol = sym[1]
  }

  // --- ポジション番号 -------------------------------------------
  const ticket = text.match(/#\s*(\d{5,})/)
  if (ticket) out.ticket = ticket[1]

  // --- 日時 (2つあれば エントリー→決済) --------------------------
  const times = [...text.matchAll(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/g)]
  const fmt = (m: RegExpMatchArray) =>
    `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')} ` +
    `${m[4].padStart(2, '0')}:${m[5]}:${(m[6] ?? '00').padStart(2, '0')}`
  if (times.length >= 2) {
    out.openTime = fmt(times[0])
    out.closeTime = fmt(times[times.length - 1])
  } else if (times.length === 1) {
    out.openTime = fmt(times[0])
  }

  // --- S/L と T/P ------------------------------------------------
  // "S/L: 4063.48" / OCRが S|L, SIL などと読むことがある
  const SL_LABEL = /S\s*[\/|Il1]\s*L\s*[:.]?/i
  const TP_LABEL = /T\s*[\/|Il1]\s*P\s*[:.]?/i
  const PRICE_RE = /(\d{2,7}\.\d{1,3})/
  out.sl = num(findLabelValue(lines, SL_LABEL, PRICE_RE))
  out.tp = num(findLabelValue(lines, TP_LABEL, PRICE_RE))

  // --- 手数料 ----------------------------------------------------
  // ラベルは "Charges" / "Commission"。OCRで g→q, e→o などに化けても拾えるようにする。
  const FEE_LABELS = [/Ch[a@]r[gq][e0o]s?\s*[:.]?/i, /C[o0]mm[il1]ss[il1][o0]n\s*[:.]?/i]
  const FEE_RE = new RegExp(`(${NUM})`)
  for (const label of FEE_LABELS) {
    const v = num(findLabelValue(lines, label, FEE_RE))
    if (v != null) {
      out.commission = v
      break
    }
  }

  // --- 価格 (建値 → 決済) と 損益 --------------------------------
  // 例: "4063.16 → 4063.48    101"
  const PRICE = String.raw`\d{2,7}\.\d{1,3}`
  // 矢印はOCRでハイフンに化けることがあるので、どちらも区切りとして扱う
  const ARROW = String.raw`\s*(?:→|-)\s*`
  const priceLine = new RegExp(`(${PRICE})${ARROW}(${PRICE})(?:\\s+(${NUM}))?\\s*$`)
  for (const line of lines) {
    const m = line.match(priceLine)
    if (m) {
      out.openPrice = num(m[1])
      out.closePrice = num(m[2])
      if (m[3] != null) out.profit = num(m[3])
      break
    }
  }
  // 矢印が読めなかった場合: 同じ行に価格が2つ並んでいれば拾う
  if (out.openPrice == null) {
    const tailNum = new RegExp(`(?:^|[^\\d.,])(${NUM})\\s*$`)
    for (const line of lines) {
      if (/S\s*[\/|Il1]\s*L|T\s*[\/|Il1]\s*P/i.test(line)) continue
      const prices = line.match(new RegExp(PRICE, 'g'))
      if (prices && prices.length >= 2) {
        out.openPrice = num(prices[0])
        out.closePrice = num(prices[1])
        const tail = line.match(tailNum)
        if (tail && num(tail[1]) !== out.closePrice) out.profit = num(tail[1])
        break
      }
    }
  }

  // --- 損益が拾えていない場合の保険 ------------------------------
  // 一覧表示 ("XAUUSD.raw sell 0.02 ... 2 044") の右端の数値を損益とみなす
  if (out.profit == null) {
    const tailNum = new RegExp(`(?:^|[^\\d.,])(${NUM})\\s*$`)
    for (const line of lines) {
      if (!/(buy|sell)/i.test(line)) continue
      const tail = line.match(tailNum)
      const v = num(tail?.[1])
      // ロットや価格そのものを拾わないよう確認する
      if (v != null && v !== out.volume && v !== out.closePrice && Math.abs(v) >= 10) {
        out.profit = v
        break
      }
    }
  }

  return out
}

export interface OcrResult {
  parsed: ParsedTrade
  /** 一覧画面のように複数の取引が写っている場合、そのすべて */
  trades: ParsedTrade[]
  /** 認識した生テキスト (デバッグ・確認用) */
  text: string
}

interface OcrWord {
  text: string
  bbox: Bbox
}
interface OcrLine {
  text: string
  words: OcrWord[]
}

/** 認識結果から、行と単語の位置を取り出す */
function toLines(data: unknown): OcrLine[] {
  const out: OcrLine[] = []
  const blocks = (data as { blocks?: unknown[] }).blocks ?? []
  for (const b of blocks as { paragraphs?: unknown[] }[]) {
    for (const p of (b.paragraphs ?? []) as { lines?: unknown[] }[]) {
      for (const l of (p.lines ?? []) as { text?: string; words?: OcrWord[] }[]) {
        const words = (l.words ?? []).map((w) => ({ text: w.text, bbox: w.bbox }))
        out.push({ text: (l.text ?? '').trim(), words })
      }
    }
  }
  return out
}

/**
 * 一覧画面から取引を1件ずつ取り出す。
 *
 * MT5の履歴一覧は2行で1件になっている。
 *   XAUUSD.raw sell 0.02              -1 766
 *   4129.46 → 4135.07   2026.08.05 06:08:17
 */
function parseListRows(lines: OcrLine[]): { trade: ParsedTrade; profitWord?: OcrWord }[] {
  const head = new RegExp(
    `([A-Z][A-Z0-9]{2,}(?:\\.[A-Za-z]+)?)\\s+(buy|sell)\\s+(\\d+(?:\\.\\d+)?)`,
    'i',
  )
  const tailNum = new RegExp(`(?:^|[^\\d.,])(${NUM})\\s*$`)
  const PRICE = String.raw`\d{2,7}\.\d{1,3}`
  const priceRow = new RegExp(`(${PRICE})\\s*→\\s*(${PRICE})`)

  const out: { trade: ParsedTrade; profitWord?: OcrWord }[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = normalize(lines[i].text)
    const m = raw.match(head)
    if (!m) continue

    const t: ParsedTrade = {
      symbol: m[1],
      side: m[2].toLowerCase() as 'buy' | 'sell',
      volume: num(m[3]),
    }

    // 行末の数値が損益
    const pm = raw.match(tailNum)
    if (pm) {
      const v = num(pm[1])
      // ロットそのものを拾わないよう確認する
      if (v != null && v !== t.volume) t.profit = v
    }

    // 損益が書かれている単語を探す（色を見るため）
    let profitWord: OcrWord | undefined
    if (t.profit != null) {
      profitWord = findWordForNumber(lines[i].words, t.profit)
    }

    // 次の行に価格と決済時刻がある
    const next = lines[i + 1] ? normalize(lines[i + 1].text) : ''
    const pr = next.match(priceRow)
    if (pr) {
      t.openPrice = num(pr[1])
      t.closePrice = num(pr[2])
      const dt = next.match(
        /(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/,
      )
      if (dt) {
        const s =
          `${dt[1]}.${dt[2].padStart(2, '0')}.${dt[3].padStart(2, '0')} ` +
          `${dt[4].padStart(2, '0')}:${dt[5]}:${(dt[6] ?? '00').padStart(2, '0')}`
        // 一覧に出ているのは決済時刻。エントリー時刻は分からないので同じ値を入れる
        t.closeTime = s
        t.openTime = s
      }
      i++ // 価格行は消費した
    }

    out.push({ trade: t, profitWord })
  }
  return out
}

/** その数値が書かれている単語を探す（桁区切りで分かれている場合もつなげる） */
function findWordForNumber(words: OcrWord[], value: number): OcrWord | undefined {
  const norm = (s: string) => s.replace(new RegExp(`[${DASH}\\s,]`, 'g'), '')
  const wanted = String(Math.abs(value))
  for (let i = words.length - 1; i >= 0; i--) {
    if (norm(words[i].text) === wanted) return words[i]
  }
  for (let i = words.length - 1; i > 0; i--) {
    if (norm(words[i - 1].text) + norm(words[i].text) === wanted) {
      return {
        text: words[i - 1].text + words[i].text,
        bbox: {
          x0: Math.min(words[i - 1].bbox.x0, words[i].bbox.x0),
          y0: Math.min(words[i - 1].bbox.y0, words[i].bbox.y0),
          x1: Math.max(words[i - 1].bbox.x1, words[i].bbox.x1),
          y1: Math.max(words[i - 1].bbox.y1, words[i].bbox.y1),
        },
      }
    }
  }
  return undefined
}

/**
 * 画像から取引内容を読み取る。tesseract.js は重いので必要になった時だけ読み込む。
 * 認識に使う画像は縮小前の元ファイルを渡すこと（小さくすると精度が落ちる）。
 *
 * 認識用のデータ(約6MB)は public/tesseract/ から自前で配信している。
 * 外部CDNに頼らないので、回線や配信元の状況に左右されない。
 */
/** これより小さい画像は拡大してから認識する */
const OCR_MIN_LONG_EDGE = 1400

interface Bbox {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * その範囲の文字が赤系かどうかを見る。
 *
 * MT5は損失を赤、利益を青(または緑)で表示する。マイナス記号が細くて
 * 読み取れないことがあるので、色からも符号を判定できるようにしている。
 */
function isRedText(canvas: HTMLCanvasElement, box: Bbox): boolean | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const x = Math.max(0, Math.floor(box.x0))
  const y = Math.max(0, Math.floor(box.y0))
  const w = Math.min(canvas.width - x, Math.ceil(box.x1 - box.x0))
  const h = Math.min(canvas.height - y, Math.ceil(box.y1 - box.y0))
  if (w <= 0 || h <= 0) return null

  let img: ImageData
  try {
    img = ctx.getImageData(x, y, w, h)
  } catch {
    return null
  }

  const d = img.data
  let red = 0
  let other = 0

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)

    // 背景(白や黒に近い無彩色)は文字ではないので数えない
    if (max - min < 40) continue

    if (r === max && r - g > 35 && r - b > 25) red++
    else other++
  }

  const inked = red + other
  if (inked < 12) return null // 色を判断できるだけの画素がない
  return red / inked > 0.6
}

export async function readTradeFromImage(
  image: File | string,
  onProgress?: (ratio: number) => void,
): Promise<OcrResult> {
  const worker = await makeWorker(onProgress)
  try {
    return await recognizeOne(worker, image)
  } finally {
    await worker.terminate()
  }
}

/** 1枚を認識して、色も見ながら取引を組み立てる */
type OcrWorker = Awaited<ReturnType<typeof makeWorker>>

async function recognizeOne(
  worker: OcrWorker,
  image: File | string,
): Promise<OcrResult> {
  const prepared = await prepareForOcr(image)
  const { data } = await worker.recognize(
    prepared.target as never,
    {},
    { blocks: true, text: true },
  )
  const text = (data as { text?: string }).text ?? ''
  const lines = toLines(data)

  // 色から損益の符号を決める。読めない場合は文字どおりの値を使う。
  // MT5 は損失を赤で出す。マイナス記号は細くて読み落とすことがあるので、
  // 色でも確かめる
  const { trades, mainIndex } = collectTrades(lines, text, (trade, word) => {
    if (trade.profit != null && word && prepared.canvas) {
      if (isRedText(prepared.canvas, word.bbox) === true) {
        trade.profit = -Math.abs(trade.profit)
      }
    }
  })

  if (trades.length === 0) {
    const single = parseMt5Screenshot(text)
    return { parsed: single, trades: [single], text }
  }
  return { parsed: trades[mainIndex], trades, text }
}

/**
 * 1枚に写っている取引を、すべて取り出す。
 *
 * 1枚の中に、一覧と詳細パネルが両方写っていることが多い。
 * 履歴を見ていて、1件を押して開いたまま撮った画面がそれにあたる。
 *
 * 以前はどちらか片方しか読んでいなかった。番号(#…)が見つかったら
 * 詳細として1件だけ読み、その上に写っている9件も10件も捨てていた。
 * せっかく全部写っているのに、1件ずつ開いて撮り直すことになる。
 *
 * いまは両方読む。
 *   一覧から … 写っている全部の取引
 *   詳細から … その1件にしか出ない番号・入った時刻・S/L・T/P・手数料
 * 同じ取引なら1件にまとめる。
 *
 * @param fixSign 損益の符号を色から直す。色を見られないときは省く
 * @returns mainIndex は「その画面の主役」の位置。
 *   詳細パネルが開いていればその1件。1件だけ記録する画面（TradeForm）は
 *   ここを使う。わざわざ開いて撮ったのだから、いちばん上の行ではなく
 *   その1件が出ないと、毎回選び直すことになる
 */
function collectTrades(
  lines: OcrLine[],
  text: string,
  fixSign?: (trade: ParsedTrade, word: OcrWord | undefined) => void,
): { trades: ParsedTrade[]; mainIndex: number } {
  /*
    詳細パネルは番号の行から下。一覧を読むときはそこから上だけを見る。
    分けておかないと、パネルの見出し（"XAUUSD.raw buy 0.02  #19378981"）を
    もう1件の取引として数えたうえ、行末の番号を損益として拾ってしまう。
  */
  const at = lines.findIndex((l) => /#\s*\d{5,}/.test(l.text))
  const listLines = at >= 0 ? lines.slice(0, at) : lines

  const trades = parseListRows(listLines).map(({ trade, profitWord }) => {
    fixSign?.(trade, profitWord)
    return trade
  })

  // 詳細パネル。番号が読めたときだけ、詳細として扱う
  const detail = at >= 0 ? parseMt5Screenshot(text) : null
  if (detail?.ticket != null) {
    fixSign?.(
      detail,
      findWordForNumber(lines.slice(at).flatMap((l) => l.words), detail.profit ?? NaN),
    )
    return { trades, mainIndex: mergeDetail(trades, detail) }
  }
  return { trades, mainIndex: 0 }
}

/**
 * 文字だけから読み取る。
 * 色が見られない場面と、テストのための入口。
 * 画像から読むときと同じ道を通るので、片方だけ直すことにならない。
 */
export function parseMt5Text(rawText: string): ParsedTrade[] {
  return collectTrades(toTextLines(rawText), rawText).trades
}

/** 詳細パネルを開いて撮った1枚から、その1件を読む */
export function parseMt5Main(rawText: string): ParsedTrade | undefined {
  const { trades, mainIndex } = collectTrades(toTextLines(rawText), rawText)
  return trades[mainIndex]
}

function toTextLines(rawText: string): OcrLine[] {
  return rawText
    .split(/\r?\n/)
    .map((t) => ({ text: t.trim(), words: [] }))
    .filter((l) => l.text)
}

/**
 * 詳細パネルで読んだ1件を、一覧から読んだ取引に合流させる。
 *
 * 一覧に同じ取引があればそこへ足す。無ければ1件として加える。
 *
 * 詳細パネルは一覧の上に重なって開くので、その裏の行は
 * 下半分（価格と時刻）が隠れていることが多い。
 * 隠れていたぶんを詳細側から補えるのが、まとめるいちばんの利点。
 *
 * @returns 合流させた（または加えた）位置
 */
function mergeDetail(trades: ParsedTrade[], detail: ParsedTrade): number {
  const i = matchIndex(trades, detail)
  if (i < 0) {
    trades.push(detail)
    return trades.length - 1
  }

  const row = trades[i]
  // 番号・入った時刻・S/L・T/P・手数料は一覧には出ない。必ず詳細のものを使う
  if (detail.ticket != null) row.ticket = detail.ticket
  if (detail.sl != null) row.sl = detail.sl
  if (detail.tp != null) row.tp = detail.tp
  if (detail.commission != null) row.commission = detail.commission
  if (detail.openTime != null) row.openTime = detail.openTime

  // 一覧側が読めていない（パネルに隠れていた）ぶんだけ補う
  if (row.openPrice == null && detail.openPrice != null) row.openPrice = detail.openPrice
  if (row.closePrice == null && detail.closePrice != null) row.closePrice = detail.closePrice
  if (row.closeTime == null && detail.closeTime != null) row.closeTime = detail.closeTime
  if (row.profit == null && detail.profit != null) row.profit = detail.profit
  if (row.symbol == null && detail.symbol != null) row.symbol = detail.symbol
  if (row.side == null && detail.side != null) row.side = detail.side
  if (row.volume == null && detail.volume != null) row.volume = detail.volume
  return i
}

/**
 * 詳細と同じ取引が一覧のどこにあるか。無ければ -1。
 *
 * 同じ銘柄・売買・ロットの行が何件も並ぶので、それだけでは決められない。
 * 値段か損益まで一致した行だけを同じ取引とみなす。
 * 迷ったときは「合流させない」（別件として増える）ほうを選ぶ。
 * 取り違えて別の取引の番号や時刻を書き込むほうが、はるかに厄介なため。
 */
function matchIndex(trades: ParsedTrade[], d: ParsedTrade): number {
  const sameKind = (t: ParsedTrade) =>
    (d.symbol == null || t.symbol == null || t.symbol === d.symbol) &&
    (d.side == null || t.side == null || t.side === d.side) &&
    (d.volume == null || t.volume == null || t.volume === d.volume)

  // 値段が両方そろって一致する行
  const byPrice = trades.findIndex(
    (t) =>
      sameKind(t) &&
      d.openPrice != null &&
      d.closePrice != null &&
      t.openPrice === d.openPrice &&
      t.closePrice === d.closePrice,
  )
  if (byPrice >= 0) return byPrice

  // 損益が一致する行（符号の読み違いがあるので絶対値で見る）
  const byProfit = trades.findIndex(
    (t) =>
      sameKind(t) &&
      d.profit != null &&
      t.profit != null &&
      Math.abs(t.profit) === Math.abs(d.profit),
  )
  if (byProfit >= 0) return byProfit

  // パネルに隠れて、値段も損益も読めなかった行。
  // 下半分が隠れるのはいちばん下の行なので、後ろから探す
  for (let i = trades.length - 1; i >= 0; i--) {
    const t = trades[i]
    if (sameKind(t) && t.openPrice == null && t.closePrice == null && t.profit == null) return i
  }
  return -1
}

/** 認識に使う画像と、色を調べるためのキャンバスを用意する */
async function prepareForOcr(
  image: File | string,
): Promise<{ target: string | File; canvas: HTMLCanvasElement | null }> {
  try {
    const bitmap =
      typeof image === 'string'
        ? await createImageBitmap(await (await fetch(image)).blob())
        : await createImageBitmap(image)

    const long = Math.max(bitmap.width, bitmap.height)
    const scale = long >= OCR_MIN_LONG_EDGE ? 1 : Math.min(3, OCR_MIN_LONG_EDGE / long)
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { target: image, canvas: null }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)
    // 認識にも同じ画像を渡すので、文字の位置と色の位置がぴったり合う
    return { target: canvas.toDataURL('image/png'), canvas }
  } catch {
    return { target: image, canvas: null }
  }
}

/** 認識用のワーカーを1つ作る。複数枚を読むときは使い回す。 */
async function makeWorker(onProgress?: (ratio: number) => void) {
  const { createWorker } = await import('tesseract.js')
  const base = `${window.location.origin}/tesseract`
  return createWorker('eng', 1, {
    langPath: base,
    corePath: base,
    workerPath: `${base}/worker.min.js`,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
}

export interface BatchOcrItem extends OcrResult {
  file: File
}

/**
 * 複数の画像をまとめて読み取る。
 * ワーカーを1つだけ作って順に処理するので、枚数が増えても準備は1回で済む。
 */
export async function readTradesFromImages(
  files: File[],
  onProgress?: (done: number, total: number, ratioOfCurrent: number) => void,
): Promise<BatchOcrItem[]> {
  if (files.length === 0) return []
  let done = 0
  const worker = await makeWorker((r) => onProgress?.(done, files.length, r))
  const out: BatchOcrItem[] = []
  try {
    for (const file of files) {
      const res = await recognizeOne(worker, file)
      out.push({ file, ...res })
      done++
      onProgress?.(done, files.length, 1)
    }
  } finally {
    await worker.terminate()
  }
  return out
}
