/**
 * 画像が「同じもの」かを見分けるための指紋。
 *
 * 中身そのものから作るので、ファイル名を変えても同じ指紋になる。
 * 逆に、撮り直した別の写真は（見た目が似ていても）別の指紋になる。
 */

/** data URL から指紋を作る */
export async function hashDataUrl(dataUrl: string): Promise<string> {
  return digest(new TextEncoder().encode(dataUrl))
}

/** 選んだファイルの中身から指紋を作る（縮小前に使えるので速い） */
export async function hashFile(file: File): Promise<string> {
  return digest(new Uint8Array(await file.arrayBuffer()))
}

async function digest(bytes: Uint8Array): Promise<string> {
  // https 上では標準の SHA-256 が使える
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return fallbackHash(bytes)
}

/**
 * 暗号用の仕組みが使えない環境むけの控え。
 * 32bitを2本ぶん回して、取り違えが起きにくいようにする。
 */
function fallbackHash(bytes: Uint8Array): string {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < bytes.length; i++) {
    a = Math.imul(a ^ bytes[i], 0x01000193) >>> 0
    b = Math.imul(b + bytes[i] + i, 0x85ebca6b) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0') + ':' + bytes.length
}

/**
 * 追加しようとしている画像から、すでに持っているものと
 * 重なるぶんを取り除く。
 *
 * @returns keep 追加してよいもの / duplicates 同じだったものの数
 */
export async function dropDuplicates(
  incoming: { hash: string }[],
  known: Set<string>,
): Promise<{ keepIndexes: number[]; duplicates: number }> {
  const keepIndexes: number[] = []
  const seen = new Set(known)
  let duplicates = 0
  incoming.forEach((x, i) => {
    if (seen.has(x.hash)) {
      duplicates++
      return
    }
    seen.add(x.hash)
    keepIndexes.push(i)
  })
  return { keepIndexes, duplicates }
}
