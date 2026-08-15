import { supabase } from './supabase'
import { demoChartFromPath } from './demoChart'

/**
 * 画像の置き場（Supabase Storage）。
 *
 * これまで画像はデータベースの中に「文字にして」入れていた。
 * 文字にすると容量が約1.33倍に膨らむうえ、データベースの保管料は
 * ファイル置き場よりずっと高い。人が増えると真っ先に効いてくる。
 *
 * 置き場所は必ず `{自分のユーザーID}/...` で始める。
 * Storage 側の権限が「1階層目が自分のID」で判定しているので、
 * ここを崩すと保存も表示もできなくなる。
 */

export const BUCKET = 'trade-images'

/** 表示用URLの有効時間。長すぎるとURLが出回ったときに困る */
const SIGNED_TTL = 60 * 60

const NO_CLIENT = 'Supabaseに接続できていません'

/** data URL かどうか。移行中は両方が混ざる */
export function isDataUrl(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.startsWith('data:')
}

async function userId(): Promise<string> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('ログインが切れています。入り直してください')
  return id
}

/** 重ならない名前。時刻を頭に付けて、置いた順が名前からも分かるようにする */
function fileName(ext: string): string {
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${stamp}-${rand}.${ext}`
}

function extOf(type: string): string {
  if (type === 'image/webp') return 'webp'
  if (type === 'image/png') return 'png'
  return 'jpg'
}

/**
 * 画像を1枚置いて、置き場所（住所）を返す。
 * 住所にはバケット名を含めない。あとでバケット名を変えても直さずに済む。
 */
export async function uploadImage(blob: Blob, folder = 'misc'): Promise<string> {
  if (!supabase) throw new Error(NO_CLIENT)
  const uid = await userId()
  // フォルダ名に紛れ込むと階層がずれるので、使える文字だけに絞る
  const safe = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'misc'
  const path = `${uid}/${safe}/${fileName(extOf(blob.type))}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/webp',
    // 同じ名前は作らない作りなので、上書きは許さない
    upsert: false,
  })
  if (error) throw error
  return path
}

/**
 * 表示用の時限URLをまとめて作る。
 * 1枚ずつ問い合わせると枚数ぶん往復するので、必ずまとめて取る。
 */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const list: string[] = []

  for (const p of [...new Set(paths.filter(Boolean))]) {
    // サンプルのチャート。置き場所には無いので、その場で組み立てる
    const demo = demoChartFromPath(p)
    if (demo) {
      out[p] = demo
      continue
    }
    // 移行前に残っている、そのまま出せる形。問い合わせても意味がない
    if (isDataUrl(p) || p.startsWith('http')) {
      out[p] = p
      continue
    }
    list.push(p)
  }

  if (!supabase || list.length === 0) return out

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(list, SIGNED_TTL)
  if (error) return out
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) out[row.path] = row.signedUrl
  }
  return out
}

/** 1枚ぶん。中身はまとめ取りと同じ */
export async function signedUrl(path: string): Promise<string | null> {
  const m = await signedUrls([path])
  return m[path] ?? null
}

/**
 * 置いた画像を消す。
 * 消し忘れると、画面から消えても容量だけ残り続ける。
 * 消せなくても本体の削除は止めたくないので、ここでは投げない。
 */
export async function removeImages(paths: (string | null | undefined)[]): Promise<void> {
  if (!supabase) return
  const list = paths.filter((p): p is string => !!p)
  if (list.length === 0) return
  try {
    await supabase.storage.from(BUCKET).remove(list)
  } catch {
    /* 残っても実害は容量だけ。本体の削除を優先する */
  }
}
