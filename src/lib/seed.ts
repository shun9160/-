import type { TradeInput } from './types'
import { parseMt5DateTime } from './timezone'

// アップロードいただいたスクショ (画像1・2) の 2 トレードを初期データ化。
// 時刻はドバイ時間 (UTC+4) として解釈し、内部では UTC 瞬間で保持する。
// 表示・集計時に日本時間 (UTC+9, ドバイ+5h) へ変換される。
//
//  画像2リスト:
//   XAUUSD.raw sell 0.02  4042.66 → 4036.13  2026.08.03 16:20:05  profit 2,044
//   XAUUSD.raw buy  0.02  4033.89 → 4036.50  2026.08.03 17:35:36  profit   817
//  画像2詳細 (#19235918 buy):
//   17:23:23 → 17:35:36  S/L 4034.14  T/P -  charges -8
//  合計: profit 2,861 / commission -16 / balance 2,845 → 各トレード commission -8

export const seedTrades: TradeInput[] = [
  {
    ticket: 'SEED-SELL-4042',
    symbol: 'XAUUSD.raw',
    side: 'sell',
    volume: 0.02,
    open_price: 4042.66,
    close_price: 4036.13,
    sl: null,
    tp: null,
    // スクショに開始時刻がないため、表示されている時刻を採用
    open_time: parseMt5DateTime('2026.08.03 16:20:05')!.toISOString(),
    close_time: parseMt5DateTime('2026.08.03 16:20:05')!.toISOString(),
    commission: -8,
    swap: 0,
    profit: 2044,
    currency: 'JPY',
    note: 'スクショ(画像2)より取込。売り。SL/TP未記録。',
    source: 'seed',
  },
  {
    ticket: '19235918',
    symbol: 'XAUUSD.raw',
    side: 'buy',
    volume: 0.02,
    open_price: 4033.89,
    close_price: 4036.5,
    sl: 4034.14,
    tp: null,
    open_time: parseMt5DateTime('2026.08.03 17:23:23')!.toISOString(),
    close_time: parseMt5DateTime('2026.08.03 17:35:36')!.toISOString(),
    commission: -8,
    swap: 0,
    profit: 817,
    currency: 'JPY',
    note: 'スクショ(画像2)より取込。買い #19235918。TP未設定、SLは建値付近(4034.14)へ移動。',
    source: 'seed',
  },
]
