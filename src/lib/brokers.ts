/**
 * ブローカーの見た目（公式アイコンと色）。
 *
 * アイコンは、そのブローカー自身のサイトにある favicon を読む。
 * 画像をこのアプリに同梱すると各社の商標を配布することになるため、
 * ブラウザがサイトのアイコンを表示するのと同じやり方にしている。
 * 読めなかったときは、頭文字の入った色つきの印に切り替わる。
 */

interface Brand {
  /** 表記ゆれを拾うための判定 */
  match: RegExp
  /** 公式サイト。ここから favicon を読む */
  domain: string
  /** 読めなかったときに使う色 */
  color: string
}

// ドメインが確かなものだけを載せる。
// 当てずっぽうで載せると、まったく別の会社のアイコンが出てしまう。
const BRANDS: Brand[] = [
  { match: /three\s*trader|スリートレーダー/i, domain: 'threetrader.com', color: '#0F4C81' },
  { match: /exness|エクスネス/i, domain: 'exness.com', color: '#FFD100' },
  { match: /xm\s*trading|^xm$|エックスエム/i, domain: 'xmtrading.com', color: '#D91E2A' },
  { match: /titan\s*fx|タイタン/i, domain: 'titanfx.com', color: '#0A1A2F' },
  { match: /axiory|アキシオリー/i, domain: 'axiory.com', color: '#1D4ED8' },
  { match: /fxgt/i, domain: 'fxgt.com', color: '#00B0A0' },
  { match: /hfm|hot\s*forex/i, domain: 'hfm.com', color: '#E4002B' },
  { match: /ic\s*markets/i, domain: 'icmarkets.com', color: '#0A2F5A' },
  { match: /pepperstone|ペッパーストーン/i, domain: 'pepperstone.com', color: '#E4002B' },
  { match: /vantage/i, domain: 'vantagemarkets.com', color: '#0B2A5B' },
  { match: /big\s*boss/i, domain: 'bigboss-financial.com', color: '#111827' },
  { match: /myfx\s*markets/i, domain: 'myfxmarkets.com', color: '#1E3A8A' },
  { match: /m4\s*markets/i, domain: 'm4markets.com', color: '#0EA5E9' },
  { match: /easy\s*markets/i, domain: 'easymarkets.com', color: '#E11D48' },
  { match: /^fbs$/i, domain: 'fbs.com', color: '#0B57D0' },
  { match: /oanda|オアンダ/i, domain: 'oanda.jp', color: '#0F2B46' },
  { match: /ig証券|^ig$/i, domain: 'ig.com', color: '#E4002B' },
  { match: /gmo|クリック証券/i, domain: 'click-sec.com', color: '#0B57A4' },
  { match: /dmm/i, domain: 'fx.dmm.com', color: '#E60012' },
  { match: /sbi/i, domain: 'sbifxt.co.jp', color: '#00559E' },
  { match: /楽天/i, domain: 'rakuten-sec.co.jp', color: '#BF0000' },
  { match: /ヒロセ|hirose|lion\s*fx/i, domain: 'hirose-fx.co.jp', color: '#C8102E' },
  { match: /外為どっとコム|gaitame/i, domain: 'gaitame.com', color: '#0057B8' },
  { match: /みんなのfx|トレイダーズ/i, domain: 'min-fx.jp', color: '#0068B7' },
  { match: /^jfx$/i, domain: 'jfx.co.jp', color: '#1B3E94' },
  { match: /マネーパートナーズ|money\s*partners/i, domain: 'moneypartners.co.jp', color: '#004098' },
  { match: /松井/i, domain: 'matsui.co.jp', color: '#E60012' },
  { match: /auカブコム|kabu\.com/i, domain: 'kabu.com', color: '#EB5505' },
]

/** 名前が分からないときに使う、落ち着いた色の並び */
const FALLBACK_COLORS = ['#6D4AFF', '#0F766E', '#B45309', '#9333EA', '#0369A1', '#B42318']

export interface BrokerLook {
  /** 公式アイコンの場所。分からなければ null */
  iconUrl: string | null
  /** 印の色 */
  color: string
  /** その色の上で読める文字色 */
  textColor: string
  /** 印に出す頭文字 */
  initials: string
}

export function brokerLook(broker: string | null | undefined): BrokerLook {
  const name = (broker ?? '').trim()
  const hit = name ? BRANDS.find((b) => b.match.test(name)) : undefined
  const color = hit ? hit.color : FALLBACK_COLORS[hashOf(name) % FALLBACK_COLORS.length]

  return {
    iconUrl: hit ? `https://${hit.domain}/favicon.ico` : null,
    color,
    // Exness の黄色のように明るい色があるので、文字色は明るさで決める
    textColor: isLight(color) ? '#18171F' : '#FFFFFF',
    initials: initialsOf(name),
  }
}

/** その色が「明るい」か。白文字だと読めない色を見分ける */
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  // 相対輝度。白との対比が 4.5:1 を切るあたりで暗い文字に切り替える
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return (1.05) / (luminance + 0.05) < 4.5
}

/** 「ThreeTrader」→「TT」、「みんなのFX」→「みん」のように短くする */
function initialsOf(name: string): string {
  if (!name) return '?'
  // 英数字なら単語の頭文字を2つまで
  const words = name.split(/[\s._-]+/).filter(Boolean)
  if (/^[\x20-\x7e]+$/.test(name)) {
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
    // ThreeTrader のような続けた表記は、大文字の変わり目で切る
    const humps = name.match(/[A-Z][a-z]*/g)
    if (humps && humps.length >= 2) return (humps[0][0] + humps[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return name.slice(0, 2)
}

/** 同じ名前なら必ず同じ色になるようにする */
function hashOf(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
