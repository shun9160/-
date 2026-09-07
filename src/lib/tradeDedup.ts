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
}

/**
 * 同じ取引かどうかを見分けるための鍵。
 * 銘柄・売買・エントリー時刻・ロットが揃って同じなら、同じ取引とみなす。
 *
 * 揃わないもの（読み取れなかった項目がある）は判定しない。
 * 曖昧なまま「同じ」と言うと、別の取引を消させてしまう。
 */
export function tradeKey(p: TradeKeyParts): string | null {
  const symbol = (p.symbol ?? '').trim().toUpperCase()
  const side = (p.side ?? '').trim().toLowerCase()
  if (!symbol || !side) return null

  const t = p.openTime instanceof Date ? p.openTime : p.openTime ? new Date(p.openTime) : null
  if (!t || Number.isNaN(t.getTime())) return null

  const volume = Number(p.volume)
  if (!Number.isFinite(volume) || volume <= 0) return null

  // ロットは 0.02 と 0.020 が同じものとして並ぶようにそろえる
  return `${symbol}|${side}|${t.getTime()}|${volume.toFixed(2)}`
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
