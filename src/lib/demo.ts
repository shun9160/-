import type { Side, Trade } from './types'

// Supabase 未設定時に UI を体感するためのデモデータ。
// 直近約45日ぶんの XAUUSD トレードを決定論的に生成する。
// （本番運用では使われません。設定が済むと実データに置き換わります）

// 小さな決定論的 RNG (LCG)
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export function demoTrades(): Trade[] {
  const rng = makeRng(20260803)
  const out: Trade[] = []
  const now = Date.now()
  const N = 34

  for (let i = 0; i < N; i++) {
    const dayOffset = Math.floor(rng() * 45)
    const dt = new Date(now - dayOffset * 86400_000)
    const weekday = dt.getDay()
    if (weekday === 0 || weekday === 6) continue // 土日は除外

    const side: Side = rng() > 0.5 ? 'buy' : 'sell'
    const dir = side === 'buy' ? 1 : -1
    const volume = [0.02, 0.05, 0.1][Math.floor(rng() * 3)]
    const entry = 3900 + rng() * 200

    // リスク幅とRR
    const risk = 1.5 + rng() * 3 // 価格幅
    const rr = 1.2 + rng() * 1.8
    const sl = entry - dir * risk
    const tp = entry + dir * risk * rr

    // 勝率 ~52%、勝ちは TP 付近、負けは SL 付近、一部は途中決済
    const win = rng() < 0.52
    let close: number
    if (win) {
      const captured = 0.6 + rng() * 0.5 // 目標の 60〜110%
      close = entry + dir * risk * rr * Math.min(captured, 1)
    } else {
      const cut = 0.7 + rng() * 0.4 // SL の 70〜110%
      close = entry - dir * risk * Math.min(cut, 1)
    }

    // JPY 建て概算損益: XAU 1.0lot で 1$ ≒ 15,000円 と仮定
    const priceMove = (close - entry) * dir
    const profit = Math.round(priceMove * volume * 15000)
    const commission = -Math.round(volume * 400)

    // 時刻: JST でいろいろな時間帯に散らす → UTC 保存 (JST-9h)
    const jstHour = Math.floor(rng() * 20) + 4 // 4〜23時
    const openUtc = new Date(dt)
    openUtc.setUTCHours(jstHour - 9, Math.floor(rng() * 60), 0, 0)
    const closeUtc = new Date(openUtc.getTime() + (5 + rng() * 90) * 60_000)

    out.push({
      id: `demo-${i}`,
      ticket: `DEMO-${1000 + i}`,
      symbol: 'XAUUSD.raw',
      side,
      volume,
      open_price: round2(entry),
      close_price: round2(close),
      sl: round2(sl),
      tp: round2(tp),
      open_time: openUtc.toISOString(),
      close_time: closeUtc.toISOString(),
      commission,
      swap: 0,
      profit,
      currency: 'JPY',
      note: i % 7 === 0 ? 'デモ: 押し目でエントリー。想定通り。' : null,
      source: 'demo',
    })
  }
  return out
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
