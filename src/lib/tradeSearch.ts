import type { EnrichedTrade } from './types'
import { fmtJst, SESSION_LABELS } from './timezone'

/**
 * 取引一覧の絞り込み。
 *
 * ひとつの入力欄で、通貨ペア・メモ・口座名・日付・終わり方などを
 * まとめて探せるようにする。項目ごとに検索窓を分けると、
 * 「どこに何を入れるか」を覚えないと使えなくなるため。
 *
 * 探し方の決まりごと:
 *  - 大文字小文字は区別しない
 *  - 全角と半角は同じものとして扱う（ＸＡＵ でも xau でも当たる）
 *  - 空白で区切ると「どちらも含む」で絞る（例: usdjpy 買い）
 */

/** 全角・大文字の違いを吸収する */
function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase()
}

/** その取引が持っている「探せる文字」を全部つなげる */
function haystack(t: EnrichedTrade, accountName?: string | null): string {
  const parts: (string | null | undefined)[] = [
    t.symbol,
    t.side === 'buy' ? '買い buy ロング' : '売り sell ショート',
    t.note,
    accountName,
    t.ticket,
    outcomeWord(t),
    SESSION_LABELS[t.session],
    // 日付は書き方が人によって違うので、よくある形をひと通り入れておく
    fmtJst(t.open_time, 'yyyy-MM-dd'),
    fmtJst(t.open_time, 'M/d'),
    fmtJst(t.open_time, 'M月d日'),
    fmtJst(t.open_time, 'HH:mm'),
    // 「+2104」でも「2104」でも当たるようにする
    String(Math.round(t.netProfit)),
  ]
  return norm(parts.filter(Boolean).join(' '))
}

/** 終わり方。一覧に出ている言葉と同じにする */
function outcomeWord(t: EnrichedTrade): string {
  if (t.tpHit) return '利確ライン'
  if (t.slHit) return '損切りライン'
  return t.win ? '手動で利確' : '手動で損切り'
}

/** 入力を、空白で区切った語の並びにする。空なら空配列 */
export function searchTerms(query: string): string[] {
  return norm(query).split(/\s+/).filter(Boolean)
}

export function matchesQuery(
  t: EnrichedTrade,
  terms: string[],
  accountName?: string | null,
): boolean {
  if (terms.length === 0) return true
  const hay = haystack(t, accountName)
  return terms.every((w) => hay.includes(w))
}

/**
 * 絞り込んだ一覧を返す。
 * 入力が空のときは、元の配列をそのまま返す（作り直さない）。
 */
export function searchTrades(
  trades: EnrichedTrade[],
  query: string,
  accountNameOf?: (id?: string | null) => string | null,
): EnrichedTrade[] {
  const terms = searchTerms(query)
  if (terms.length === 0) return trades
  return trades.filter((t) => matchesQuery(t, terms, accountNameOf?.(t.account_id)))
}
