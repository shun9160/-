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

/** OCR結果にありがちな崩れをならす */
function normalize(raw: string): string {
  return (
    raw
      // 全角英数を半角へ
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[：]/g, ':')
      .replace(/[．]/g, '.')
      // 各種の矢印を統一
      .replace(/[→⇒➔➜»—–~>]+/g, '→')
  )
  // ここで桁区切りをまとめて消すと "4063.48 101"(価格+損益) を
  // 1つの数値に繋げてしまうため、数値を取り出す時に個別に処理する。
}

/** 桁区切りを含む数値表現。例: "2 044" "1,234.5" "-8" */
const NUM = String.raw`-?\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?`

/** "2 044" のような文字列を数値へ */
function num(s: string | undefined): number | undefined {
  if (!s) return undefined
  const v = parseFloat(s.replace(/[ ,]/g, '').replace(/[^\d.-]/g, ''))
  return isNaN(v) ? undefined : v
}

export function parseMt5Screenshot(rawText: string): ParsedTrade {
  const text = normalize(rawText)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
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
  const sl = text.match(/S\s*[\/|Il1]\s*L\s*:?\s*([\d.]+)/i)
  if (sl) out.sl = num(sl[1])
  const tp = text.match(/T\s*[\/|Il1]\s*P\s*:?\s*([\d.]+)/i)
  if (tp) out.tp = num(tp[1])

  // --- 手数料 ----------------------------------------------------
  const charges = text.match(/Charges?\s*:?\s*(-?\d+(?:\.\d+)?)/i)
  if (charges) out.commission = num(charges[1])
  else {
    const comm = text.match(/Commission\s*:?\s*(-?\d+(?:\.\d+)?)/i)
    if (comm) out.commission = num(comm[1])
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
  /** 認識した生テキスト (デバッグ・確認用) */
  text: string
}

/**
 * 画像から取引内容を読み取る。tesseract.js は重いので必要になった時だけ読み込む。
 * 認識に使う画像は縮小前の元ファイルを渡すこと（小さくすると精度が落ちる）。
 *
 * 認識用のデータ(約6MB)は public/tesseract/ から自前で配信している。
 * 外部CDNに頼らないので、回線や配信元の状況に左右されない。
 */
export async function readTradeFromImage(
  image: File | string,
  onProgress?: (ratio: number) => void,
): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js')
  const base = `${window.location.origin}/tesseract`
  const worker = await createWorker('eng', 1, {
    langPath: base,
    corePath: base,
    workerPath: `${base}/worker.min.js`,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return { parsed: parseMt5Screenshot(data.text), text: data.text }
  } finally {
    await worker.terminate()
  }
}
