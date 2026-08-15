/**
 * サンプル表示用のチャート画像。
 *
 * ログインしていない人が最初に見る画面で、日記のところが
 * 「チャートを追加」の空枠だらけだと、何ができるアプリなのか伝わらない。
 * かといって本物のスクリーンショットを同梱すると、
 * 何百KBもの画像をアプリ本体に抱えることになる。
 *
 * そこで絵をその場で組み立てる。SVGの文字列なので数KBで済み、
 * 拡大しても粗くならない。seed（種）から作るので、
 * 何度開いても同じ絵が出る（開くたびに形が変わると、
 * 「保存されていない」ように見えてしまう）。
 *
 * ここで作るのは data URL。Storage には置かない。
 * storage.signedUrls が data: をそのまま通すので、
 * 本物の画像と同じ道を通って画面に出る。
 */

/** 小さな決定論的 RNG (LCG)。同じ種からは必ず同じ並び */
function makeRng(seed: number) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const W = 800
const H = 600
/** 目盛りのぶんだけ内側に寄せる */
const L = 14
const R = 62
const T = 46
/** 下は出来高の帯に使う */
const B = 96

const BG = '#131722'
const GRID = '#242832'
const AXIS = '#787b86'
const UP = '#26a69a'
const DOWN = '#ef5350'

interface Candle {
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface DemoChartOptions {
  /** 同じ種からは同じ絵。日記のチャートごとに変える */
  seed: number
  symbol?: string
  timeframe?: string
  /**
   * 相場の向き。+ で上げ、- で下げ、0 でもみ合い。
   * 日記の文章と絵が食い違わないように、外から決められるようにしてある
   */
  bias?: number
  /** 入った所・損切り・利確の線を引くか */
  levels?: boolean
  /** 買い目線か売り目線か。線の向きが変わる */
  side?: 'buy' | 'sell'
}

/** ローソク足を作る。ランダムウォークに向きを少し足したもの */
function candles(rng: () => number, n: number, bias: number): Candle[] {
  const out: Candle[] = []
  let price = 100
  for (let i = 0; i < n; i++) {
    // 途中でひと押しさせる。まっすぐ伸びる絵は相場に見えない
    const wave = Math.sin((i / n) * Math.PI * 2.2) * 0.28
    const drift = bias * 0.16 + wave
    const o = price
    const move = (rng() - 0.5) * 1.9 + drift
    const c = o + move
    const wick = 0.25 + rng() * 0.9
    out.push({
      o,
      c,
      h: Math.max(o, c) + wick * rng(),
      l: Math.min(o, c) - wick * rng(),
      v: 0.25 + rng() * 0.75 + Math.abs(move) * 0.35,
    })
    price = c
  }
  return out
}

/** 数字を、目盛りに出すための文字にする */
function fmt(n: number): string {
  return n.toFixed(2)
}

export function demoChart({
  seed,
  symbol = 'XAUUSD',
  timeframe = '15m',
  bias = 0,
  levels = true,
  side = 'buy',
}: DemoChartOptions): string {
  const rng = makeRng(seed)
  const n = 58
  const cs = candles(rng, n, bias)

  const hi = Math.max(...cs.map((c) => c.h))
  const lo = Math.min(...cs.map((c) => c.l))
  // 上下に少し余白。天井と底が枠に貼り付くと窮屈に見える
  const pad = (hi - lo) * 0.12
  const top = hi + pad
  const bot = lo - pad
  const y = (p: number) => T + ((top - p) / (top - bot)) * (H - T - B)

  const step = (W - L - R) / n
  const bodyW = Math.max(3, step * 0.62)

  const parts: string[] = []
  parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`)

  // 横の目盛り。5本だけ。多いとローソクより線が目立つ
  for (let i = 0; i <= 4; i++) {
    const p = bot + ((top - bot) * i) / 4
    const gy = round(y(p))
    parts.push(`<line x1="${L}" y1="${gy}" x2="${W - R}" y2="${gy}" stroke="${GRID}"/>`)
    parts.push(
      `<text x="${W - R + 8}" y="${gy + 4}" fill="${AXIS}" font-size="13" font-family="monospace">${fmt(p)}</text>`,
    )
  }

  // 出来高。下に薄く敷くだけ。主役はローソク
  const vMax = Math.max(...cs.map((c) => c.v))
  cs.forEach((c, i) => {
    const x = L + i * step + (step - bodyW) / 2
    const h = Math.max(1, (c.v / vMax) * 46)
    parts.push(
      `<rect x="${round(x)}" y="${round(H - B + 40 - h)}" width="${round(bodyW)}" height="${round(h)}" fill="${c.c >= c.o ? UP : DOWN}" opacity="0.32"/>`,
    )
  })

  // ローソク足
  cs.forEach((c, i) => {
    const cx = L + i * step + step / 2
    const col = c.c >= c.o ? UP : DOWN
    const yo = y(c.o)
    const yc = y(c.c)
    parts.push(
      `<line x1="${round(cx)}" y1="${round(y(c.h))}" x2="${round(cx)}" y2="${round(y(c.l))}" stroke="${col}" stroke-width="1.4"/>`,
    )
    parts.push(
      `<rect x="${round(cx - bodyW / 2)}" y="${round(Math.min(yo, yc))}" width="${round(bodyW)}" height="${round(Math.max(1.5, Math.abs(yc - yo)))}" fill="${col}"/>`,
    )
  })

  // 入った所・損切り・利確。
  // 「絵の中に自分の判断が写っている」ようにしたいので、
  // ただのチャートでは終わらせない
  if (levels) {
    const at = Math.floor(n * 0.62)
    const entry = cs[at].c
    const range = (top - bot) * 0.16
    const dir = side === 'buy' ? 1 : -1
    // 枠からはみ出させない。はみ出すと TP の札だけ画面の外に消えて、
    // 「どこを取りにいったのか」が絵から読めなくなる
    const fit = (p: number) => Math.min(top - (top - bot) * 0.03, Math.max(bot + (top - bot) * 0.03, p))
    const sl = fit(entry - dir * range)
    const tp = fit(entry + dir * range * 1.9)
    const x0 = round(L + at * step)

    // 狙っていた幅を面で見せる。線だけより、どこを取りにいったか分かる
    parts.push(
      `<rect x="${x0}" y="${round(y(Math.max(entry, tp)))}" width="${round(W - R - x0)}" height="${round(Math.abs(y(tp) - y(entry)))}" fill="${UP}" opacity="0.1"/>`,
    )
    parts.push(
      `<rect x="${x0}" y="${round(y(Math.max(entry, sl)))}" width="${round(W - R - x0)}" height="${round(Math.abs(y(sl) - y(entry)))}" fill="${DOWN}" opacity="0.12"/>`,
    )

    const line = (p: number, col: string, label: string) => {
      const gy = round(y(p))
      parts.push(
        `<line x1="${x0}" y1="${gy}" x2="${W - R}" y2="${gy}" stroke="${col}" stroke-width="1.4" stroke-dasharray="6 4"/>`,
      )
      parts.push(`<rect x="${W - R}" y="${gy - 10}" width="${R}" height="20" fill="${col}"/>`)
      parts.push(
        `<text x="${W - R + 6}" y="${gy + 5}" fill="#0e1015" font-size="12" font-weight="bold" font-family="monospace">${label}</text>`,
      )
    }
    line(tp, UP, 'TP')
    line(entry, '#c8cbd4', 'IN')
    line(sl, DOWN, 'SL')
  }

  // 銘柄と時間足。本物のチャートは必ず左上にこれがある
  parts.push(
    `<text x="${L}" y="26" fill="#d1d4dc" font-size="17" font-weight="bold" font-family="sans-serif">${esc(symbol)}</text>`,
    `<text x="${L + symbol.length * 11 + 12}" y="26" fill="${AXIS}" font-size="14" font-family="sans-serif">${esc(timeframe)}</text>`,
  )

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    parts.join('') +
    '</svg>'

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * 絵そのものではなく「どの絵か」だけを覚えておくための住所。
 *
 * 日記が持つのは画像の置き場所（path）で、中身ではない。
 * サンプルも同じ形にしておくと、本物と同じ道を通れる。
 * 絵は画面に出す直前に組み立てるので、日記を開かない人は
 * 1枚ぶんの容量も払わない。
 */
const PATH_HEAD = 'demo:chart?'

export function demoChartPath(o: DemoChartOptions): string {
  const q = new URLSearchParams({ seed: String(o.seed) })
  if (o.symbol) q.set('sym', o.symbol)
  if (o.timeframe) q.set('tf', o.timeframe)
  if (o.bias) q.set('bias', String(o.bias))
  if (o.side) q.set('side', o.side)
  if (o.levels === false) q.set('lv', '0')
  return PATH_HEAD + q.toString()
}

export function isDemoChartPath(path: string): boolean {
  return typeof path === 'string' && path.startsWith(PATH_HEAD)
}

/** 一度組み立てた絵は取っておく。同じ日記を開き直すたびに作り直さない */
const cache = new Map<string, string>()

/** 住所から絵を組み立てる。サンプルの住所でなければ null */
export function demoChartFromPath(path: string): string | null {
  if (!isDemoChartPath(path)) return null
  const hit = cache.get(path)
  if (hit) return hit

  const q = new URLSearchParams(path.slice(PATH_HEAD.length))
  const url = demoChart({
    seed: Number(q.get('seed')) || 1,
    symbol: q.get('sym') ?? undefined,
    timeframe: q.get('tf') ?? undefined,
    bias: Number(q.get('bias')) || 0,
    side: q.get('side') === 'sell' ? 'sell' : 'buy',
    levels: q.get('lv') !== '0',
  })
  cache.set(path, url)
  return url
}

/** 小数を詰める。文字数がそのまま容量になるので、1桁で十分 */
function round(n: number): number {
  return Math.round(n * 10) / 10
}

/** SVG に入れてはいけない文字を逃がす */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
