/**
 * 取引番号が読み取れなかった取引の、二重登録を見つける。
 *
 * 画像そのものの重なりは指紋（imageHash）で弾ける。
 * 取引番号があるものは、記録するときに番号で上書きされるので増えない。
 * 残るのが「番号が読み取れず、別の写真から二度取り込んだ取引」で、
 * これだけは何も言わないと静かに2件になる。
 *
 * ここでやるのは印を付けるところまで。消しはしない。
 * 同じ銘柄・同じ向きを同じ時刻に2つ持つ人はいるので、
 * 機械が決めてしまうと、その人の記録が理由も無く減る。
 */

export interface TradeKeyParts {
  symbol?: string | null
  side?: string | null
  /** エントリー時刻。ISO文字列でも Date でもよい */
  openTime?: string | Date | null
  volume?: number | string | null
  /** 決済時刻 */
  closeTime?: string | Date | null
  /** 建値と決済価格 */
  openPrice?: number | string | null
  closePrice?: number | string | null
  /** 損益（手数料を引く前。データベースに入っているのと同じもの） */
  profit?: number | string | null
}

/**
 * 同じ取引かどうかを見分けるための鍵。
 *
 * 見るのは、銘柄・売買・ロット・時刻（建てと決済）・値段（建てと決済）・損益。
 *
 * はじめは銘柄・売買・ロット・エントリー時刻だけで見ていたが、それでは足りない。
 * 同じ秒に同じ向きを何本も持つ人がいて、
 *   sell 0.05  4393.87 → 4392.23  10:42:16  +1262
 *   sell 0.05  4393.97 → 4392.23  10:42:16  +1339
 * のように、値段と損益だけが違う別の取引が並ぶ。
 * ここを見ないと、その2本目を「同じ取引」と言って外してしまう。
 *
 * 反対に、読み取れなかった項目は「読めなかった」という値として鍵に混ぜる。
 * 分からないものを勝手に0や空とみなして揃えると、
 * 中身の違う取引が同じ鍵になってしまう。
 *
 * 銘柄・売買・ロット・エントリー時刻のどれかが読めていなければ、
 * そもそも判定しない（null）。曖昧なまま「同じ」と言うと、別の取引を外させる。
 */
export function tradeKey(p: TradeKeyParts): string | null {
  const symbol = (p.symbol ?? '').trim().toUpperCase()
  const side = (p.side ?? '').trim().toLowerCase()
  if (!symbol || !side) return null

  const open = time(p.openTime)
  if (open == null) return null

  const volume = Number(p.volume)
  if (!Number.isFinite(volume) || volume <= 0) return null

  return [
    symbol,
    side,
    // ロットは 0.02 と 0.020 が同じものとして並ぶようにそろえる
    volume.toFixed(2),
    open,
    time(p.closeTime) ?? '?',
    num(p.openPrice),
    num(p.closePrice),
    num(p.profit),
  ].join('|')
}

/** 時刻を数（ミリ秒）に。書き方が違っても、指している時刻が同じなら同じ数になる */
function time(v: string | Date | null | undefined): number | null {
  const t = v instanceof Date ? v : v ? new Date(v) : null
  return t && !Number.isNaN(t.getTime()) ? t.getTime() : null
}

/**
 * 数を、書き方の違いに左右されない形に。
 * 「4402.60」も「4402.6」も同じ。読めなかったものは "?" にして、
 * 読めた0（損益ちょうど0）と区別する。
 */
function num(v: number | string | null | undefined): string {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return '?'
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : '?'
}

/**
 * 重なりそうなものが何番目かを返す。
 *
 * すでに入っているぶん（known）だけでなく、
 * いま並べたものどうしの重なりも見る。
 * 同じ取引が写った写真を2枚選ぶことがあるため。
 *
 * @param keys 1件ぶんずつの鍵。判定できないものは null
 * @param known すでに記録されている取引の鍵
 */
export function duplicateIndexes(keys: (string | null)[], known: Set<string>): number[] {
  const seen = new Set(known)
  const out: number[] = []
  keys.forEach((k, i) => {
    if (!k) return
    if (seen.has(k)) {
      out.push(i)
      return
    }
    seen.add(k)
  })
  return out
}
