import { supabase } from './supabase'
import { dataUrlToBlob } from './image'
import { isDataUrl, removeImages, signedUrl, signedUrls, uploadImage } from './storage'
import type { Account, DayNote, Settings, Trade, TradeImage, TradeInput } from './types'

const NO_CLIENT = 'Supabase が未設定です (.env / Netlify の環境変数を確認してください)'
const NO_USER = 'ログインが必要です'
const WRITE_BLOCKED = '保存できませんでした (day_notes の権限設定をご確認ください)'

/** 重複判定に使える索引が無いときのエラーか */
function isMissingConflictTarget(e: unknown): boolean {
  const o = e as { code?: string; message?: string }
  return (
    o?.code === '42P10' ||
    /no unique or exclusion constraint matching the ON CONFLICT/i.test(o?.message ?? '')
  )
}

/** ログイン中の利用者ID。データは利用者ごとに分かれている。 */
async function requireUserId(): Promise<string> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const id = data.user?.id
  if (!id) throw new Error(NO_USER)
  return id
}

// 一覧取得では重い screenshot 列を除外して転送量を抑える。
const LIST_COLUMNS =
  'id,account_id,ticket,symbol,side,volume,open_price,close_price,sl,tp,open_time,close_time,commission,swap,profit,currency,note,source,created_at'

export async function fetchTrades(): Promise<Trade[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('trades')
    .select(LIST_COLUMNS)
    .order('open_time', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Trade[]
}

// ---------------------------------------------------------------
// 口座
// ---------------------------------------------------------------

const ACCOUNT_COLUMNS =
  'id,broker,login,nickname,currency,lot_size,broker_utc_offset,initial_capital,capital_note,is_default,created_at'

export async function fetchAccounts(): Promise<Account[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('accounts')
    .select(ACCOUNT_COLUMNS)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Account[]
}

export type AccountInput = Partial<Omit<Account, 'id' | 'created_at'>>

export async function createAccount(patch: AccountInput): Promise<Account> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()

  // 最初の1件は自動的に既定の口座にする
  const { count, error: cErr } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (cErr) throw cErr

  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...patch, user_id: userId, is_default: patch.is_default ?? (count ?? 0) === 0 })
    .select(ACCOUNT_COLUMNS)
    .single()
  if (error) throw error
  return data as Account
}

export async function updateAccount(id: string, patch: AccountInput): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('accounts').update(patch).eq('id', id)
  if (error) throw error
}

/** その口座を記録先の初期値にする。ほかの口座の既定は外す。 */
export async function setDefaultAccount(id: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { error: offErr } = await supabase
    .from('accounts')
    .update({ is_default: false })
    .eq('user_id', userId)
  if (offErr) throw offErr
  const { error } = await supabase.from('accounts').update({ is_default: true }).eq('id', id)
  if (error) throw error
}

/** 口座を削除する。その口座の取引もまとめて消える。 */
export async function deleteAccount(id: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

/** 口座の原資まわりを保存。screenshot は undefined なら据え置き。 */
export async function saveAccountCapital(
  id: string,
  patch: { initial_capital: number; capital_note: string | null; capital_screenshot?: string | null },
): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const row: Record<string, unknown> = {
    initial_capital: patch.initial_capital,
    capital_note: patch.capital_note,
  }
  if (patch.capital_screenshot !== undefined) {
    // 中身ではなく置き場所を書く。置けなければ今までどおり中身を入れる
    row.capital_screenshot_path =
      typeof patch.capital_screenshot === 'string'
        ? await toStored(patch.capital_screenshot, 'capital')
        : null
  }
  const { error } = await supabase.from('accounts').update(row).eq('id', id)
  if (error) throw error
}

/** 口座の原資スクショ (data URL)。無ければ null。 */
export async function getAccountCapitalScreenshot(id: string): Promise<string | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('accounts')
    .select('capital_screenshot_path')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  const row = data as { capital_screenshot_path: string | null } | null
  return row?.capital_screenshot_path ? await signedUrl(row.capital_screenshot_path) : null
}

/** 個別トレードの添付スクショ (data URL) を取得。無ければ null。 */
export async function getTradeScreenshot(id: string): Promise<string | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('trades')
    .select('screenshot_path')
    .eq('id', id)
    .single()
  if (error) throw error
  const row = data as { screenshot_path: string | null } | null
  return row?.screenshot_path ? await signedUrl(row.screenshot_path) : null
}

/** 既存トレードの項目を更新する。patch に含めたキーだけ更新。 */
export async function updateTrade(
  id: string,
  patch: Partial<TradeInput>,
): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const row: Record<string, unknown> = { ...patch }
  // スクショが新しく差し替えられたら、中身ではなく置き場所を書く
  if (typeof patch.screenshot === 'string' && isDataUrl(patch.screenshot)) {
    const path = await toStored(patch.screenshot, id)
    delete row.screenshot
    row.screenshot_path = path
  }
  const { error } = await supabase.from('trades').update(row).eq('id', id)
  if (error) throw error
}

/** 保存できた取引。あとからチャート画像を貼るために id を返す */
export interface SavedTrade {
  id: string
  ticket: string | null
}

/**
 * 取引を挿入。ticket があるものは upsert (重複取込を防止)。
 * ticket が無いものは insert。
 *
 * 返り値は保存できた取引。件数だけ欲しいときは length を見る。
 * チャート画像は取引が出来てからでないと貼れないので、id を返している。
 */
export async function insertTrades(
  rows: TradeInput[],
  accountId?: string | null,
): Promise<SavedTrade[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  if (rows.length === 0) return []

  const userId = await requireUserId()
  const owned = rows.map((r) => ({
    ...r,
    user_id: userId,
    // 明示された記録先を優先。無ければ元データの口座をそのまま使う。
    account_id: accountId !== undefined ? accountId : (r.account_id ?? null),
  }))

  const withTicket = owned.filter((r) => r.ticket)
  const withoutTicket = owned.filter((r) => !r.ticket)
  const saved: SavedTrade[] = []

  if (withTicket.length) {
    // ブローカーが違えば同じ取引番号がありうるので、口座も含めて重複を判定する。
    const { data, error } = await supabase
      .from('trades')
      .upsert(withTicket, { onConflict: 'user_id,account_id,ticket' })
      .select('id,ticket')

    if (error) {
      // 重複判定用の索引が無い環境でも保存できるようにする。
      // 既に入っている取引番号を調べ、まだ無いものだけ登録する。
      if (isMissingConflictTarget(error)) {
        const tickets = withTicket.map((r) => r.ticket as string)
        let q = supabase
          .from('trades')
          .select('ticket')
          .eq('user_id', userId)
          .in('ticket', tickets)
        // 同じ口座の中だけを見る（別口座の同じ番号は別物）
        const target = withTicket[0].account_id ?? null
        q = target == null ? q.is('account_id', null) : q.eq('account_id', target)
        const { data: existing, error: readErr } = await q
        if (readErr) throw readErr

        const already = new Set((existing ?? []).map((r) => (r as { ticket: string }).ticket))
        const fresh = withTicket.filter((r) => !already.has(r.ticket as string))
        if (fresh.length) {
          const { data: added, error: insErr } = await supabase
            .from('trades')
            .insert(fresh)
            .select('id,ticket')
          if (insErr) throw insErr
          saved.push(...((added ?? []) as SavedTrade[]))
        }
      } else {
        throw error
      }
    } else {
      saved.push(...((data ?? []) as SavedTrade[]))
    }
  }
  if (withoutTicket.length) {
    const { data, error } = await supabase
      .from('trades')
      .insert(withoutTicket)
      .select('id,ticket')
    if (error) throw error
    saved.push(...((data ?? []) as SavedTrade[]))
  }
  return saved
}

export async function updateTradeNote(id: string, note: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('trades').update({ note }).eq('id', id)
  if (error) throw error
}

export async function deleteTrade(id: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllTrades(): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { error } = await supabase.from('trades').delete().eq('user_id', userId)
  if (error) throw error
}

export async function fetchDayNotes(): Promise<DayNote[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase.from('day_notes').select('*')
  if (error) throw error
  return (data ?? []) as DayNote[]
}

export async function upsertDayNote(day: string, note: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const row = { user_id: userId, day, note, updated_at: new Date().toISOString() }

  const { data, error } = await supabase
    .from('day_notes')
    .upsert(row, { onConflict: 'user_id,day' })
    .select('day')

  // 1行でも書けていれば成功。
  if (!error && (data?.length ?? 0) > 0) return
  // 想定外のエラーはそのまま伝える（索引が無いだけなら下で救済する）。
  if (error && !isMissingConflictTarget(error)) throw error

  // 重複判定用の索引が無い環境向け。
  // その日の行があれば書き換え、無ければ新しく作る。
  const { data: existing, error: readErr } = await supabase
    .from('day_notes')
    .select('day')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle()
  if (readErr) throw readErr

  if (existing) {
    const { data: updated, error: upErr } = await supabase
      .from('day_notes')
      .update({ note, updated_at: row.updated_at })
      .eq('user_id', userId)
      .eq('day', day)
      .select('day')
    if (upErr) throw upErr
    if (!updated?.length) throw new Error(WRITE_BLOCKED)
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('day_notes')
      .insert(row)
      .select('day')
    if (insErr) throw insErr
    if (!inserted?.length) throw new Error(WRITE_BLOCKED)
  }
}

// ---------------------------------------------------------------
// 取引ごとのチャート画像
// ---------------------------------------------------------------


// ---------------------------------------------------------------
// 画像の置き場所（Storage）との橋渡し
//
// 画面側は今までどおり「image に入っている文字を <img src> に入れる」だけ。
// それが data URL でも、Storage の時限URLでも、扱いは変わらない。
// おかげで、置き場所を変えても画面側のコードは1行も直さずに済む。
// ---------------------------------------------------------------

/** DBから読んだそのままの形。image と image_path のどちらかが入っている */
type StoredImage = TradeImage & { image_path?: string | null }

/**
 * 置き場所から表示用の時限URLを作り、image に入れて返す。
 * 画面側は image をそのまま <img src> に入れるだけでよい。
 */
async function resolveImages(rows: StoredImage[]): Promise<TradeImage[]> {
  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p)
  // 1枚ずつ問い合わせると枚数ぶん往復するので、まとめて作る
  const urls = paths.length ? await signedUrls(paths) : {}
  return rows.map((r) => ({ ...r, image: (r.image_path && urls[r.image_path]) || '' }))
}

/**
 * data URL を Storage へ送り、置き場所を返す。
 *
 * 以前は「送れなければDBに入れる」逃げ道を持っていたが、
 * 画像を入れる列そのものを無くしたので、その道はもう無い。
 * 黙って握りつぶすと「保存できたのに画像が無い」状態になるため、
 * ここでははっきり失敗させて、画面にエラーを出す。
 */
async function toStored(dataUrl: string, folder: string): Promise<string | null> {
  if (!isDataUrl(dataUrl)) return null
  return await uploadImage(await dataUrlToBlob(dataUrl), folder)
}

/** その取引に貼ってあるチャート画像を、貼った順に取得する */
export async function fetchTradeImages(tradeId: string): Promise<TradeImage[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { data, error } = await supabase
    .from('trade_images')
    .select('id,trade_id,image_path,image_hash,caption,created_at')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return resolveImages((data ?? []) as StoredImage[])
}

/**
 * 最近貼ったチャート画像。日記の「最近のスクリーンショット」に出す。
 * 表がまだ作られていないこともあるので、失敗しても空で返す。
 */
export async function fetchRecentTradeImages(limit = 6): Promise<TradeImage[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('trade_images')
      .select('id,trade_id,image_path,caption,created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return await resolveImages((data ?? []) as StoredImage[])
  } catch {
    return []
  }
}

/**
 * どの取引に何枚貼ってあるかだけを数える。
 * 一覧に枚数を出すために使うので、重い画像そのものは読まない。
 */
export async function fetchTradeImageCounts(): Promise<Record<string, number>> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('trade_images')
    .select('trade_id')
    .eq('user_id', userId)
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const r of (data ?? []) as { trade_id: string }[]) {
    counts[r.trade_id] = (counts[r.trade_id] ?? 0) + 1
  }
  return counts
}

/** チャート画像を追加する。返り値は追加できた行。 */
export async function addTradeImages(
  tradeId: string,
  images: { image: string; caption?: string | null; hash?: string | null }[],
): Promise<TradeImage[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  if (images.length === 0) return []
  const userId = await requireUserId()

  // 画像そのものは Storage へ。DBには置き場所だけを書く
  const rows = await Promise.all(
    images.map(async (x) => {
      return {
        user_id: userId,
        trade_id: tradeId,
        image_path: await toStored(x.image, tradeId),
        caption: x.caption ?? null,
        image_hash: x.hash ?? null,
      }
    }),
  )
  const { data, error } = await supabase
    .from('trade_images')
    .insert(rows)
    .select('id,trade_id,image_path,image_hash,caption,created_at')
  if (error) {
    // 行を作れなかったら、置いた画像は捨てる。残すと容量だけ食う
    await removeImages(rows.map((r) => r.image_path))
    throw error
  }
  return resolveImages((data ?? []) as StoredImage[])
}

// ---------------------------------------------------------------
// 同じ画像を二度取り込まないための照合
// ---------------------------------------------------------------

/**
 * 指紋の列がまだ無いデータベースでも、アプリを止めない。
 * その場合は「過去との照合はできない」＝空を返す。
 */
function isMissingColumn(e: unknown): boolean {
  const o = e as { code?: string; message?: string }
  return o?.code === '42703' || /column .* does not exist|schema cache/i.test(o?.message ?? '')
}

async function lookupHashes(
  table: 'trade_images' | 'trades',
  column: 'image_hash' | 'screenshot_hash',
  hashes: string[],
): Promise<Set<string>> {
  const found = new Set<string>()
  if (!supabase || hashes.length === 0) return found
  const userId = await requireUserId()

  // 過去との照合はあくまで補助。
  // ここで失敗しても、画像の登録そのものは止めない。
  // （指紋の列がまだ無い、通信が途切れた、など）
  try {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .eq('user_id', userId)
      .in(column, hashes)
    if (error) {
      if (!isMissingColumn(error)) console.warn('画像の照合に失敗しました', error)
      return found
    }
    for (const r of (data ?? []) as Record<string, string | null>[]) {
      const v = r[column]
      if (v) found.add(v)
    }
  } catch (e) {
    console.warn('画像の照合に失敗しました', e)
  }
  return found
}

/** すでに登録済みのチャート画像の指紋を返す */
export function findSavedImageHashes(hashes: string[]): Promise<Set<string>> {
  return lookupHashes('trade_images', 'image_hash', hashes)
}

/** すでに取り込み済みのスクショの指紋を返す */
export function findSavedScreenshotHashes(hashes: string[]): Promise<Set<string>> {
  return lookupHashes('trades', 'screenshot_hash', hashes)
}

/** チャート画像の説明を書き換える */
export async function updateTradeImageCaption(id: string, caption: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase
    .from('trade_images')
    .update({ caption: caption || null })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTradeImage(id: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  // 先に置き場所を控える。行を消したあとでは分からなくなる
  const { data } = await supabase
    .from('trade_images')
    .select('image_path')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('trade_images').delete().eq('id', id)
  if (error) throw error
  // 画面から消えても、置き場に残っていると容量を食い続ける
  await removeImages([(data as { image_path?: string | null } | null)?.image_path])
}

// ---------------------------------------------------------------
// 設定（原資）
// ---------------------------------------------------------------

/** 設定を取得。未登録なら null。重いスクショ列は含めない。 */
export async function fetchSettings(): Promise<Settings | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('settings')
    .select(
      'user_id,initial_capital,capital_note,account_currency,lot_size,broker_utc_offset,main_symbol,onboarded_at,updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as Settings | null) ?? null
}

/** 初期設定（オンボーディング）の内容を保存する */
export async function saveOnboarding(values: {
  initial_capital: number
  account_currency: string
  lot_size: number
  broker_utc_offset: number
  main_symbol: string | null
}): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { error } = await supabase.from('settings').upsert(
    {
      user_id: userId,
      ...values,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

/** 原資のスクショ (data URL) を取得。無ければ null。 */
export async function getCapitalScreenshot(): Promise<string | null> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('settings')
    .select('capital_screenshot')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.capital_screenshot as string | null) ?? null
}

/** 原資を保存。screenshot は undefined なら据え置き、null なら削除。 */
export async function saveCapital(patch: {
  initial_capital: number
  capital_note: string | null
  capital_screenshot?: string | null
}): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const row: Record<string, unknown> = {
    user_id: userId,
    initial_capital: patch.initial_capital,
    capital_note: patch.capital_note,
    updated_at: new Date().toISOString(),
  }
  if (patch.capital_screenshot !== undefined) {
    row.capital_screenshot = patch.capital_screenshot
  }
  const { error } = await supabase.from('settings').upsert(row, { onConflict: 'user_id' })
  if (error) throw error
}

// ---------------------------------------------------------------
// 連携コード（MT5のEAなどから書き込むための鍵）
// ---------------------------------------------------------------

export interface IngestToken {
  token: string
  label: string | null
  created_at: string
  last_used_at: string | null
}

export async function fetchIngestTokens(): Promise<IngestToken[]> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('ingest_tokens')
    .select('token,label,created_at,last_used_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as IngestToken[]
}

/** 連携コードを新しく発行する */
export async function createIngestToken(label = 'MT5'): Promise<IngestToken> {
  if (!supabase) throw new Error(NO_CLIENT)
  const userId = await requireUserId()
  const token = generateToken()
  const { data, error } = await supabase
    .from('ingest_tokens')
    .insert({ token, user_id: userId, label })
    .select('token,label,created_at,last_used_at')
    .single()
  if (error) throw error
  return data as IngestToken
}

export async function deleteIngestToken(token: string): Promise<void> {
  if (!supabase) throw new Error(NO_CLIENT)
  const { error } = await supabase.from('ingest_tokens').delete().eq('token', token)
  if (error) throw error
}

/** 読み間違えにくい文字だけで連携コードを作る */
function generateToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // I,O,0,1 は除外
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 5 === 0) out += '-'
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out // 例: ABCDE-FGHJK-LMNPQ-RSTUV
}

// ---------------------------------------------------------------
// 既存の画像を Storage へ引っ越す
//
// これまでDBの中に入れていた画像を、ファイル置き場へ移す。
// 少しずつ進められるようにして、途中で止めても壊れないようにする。
// （移し終わった行から順に、置き場所を書いて中身を消していく）
// ---------------------------------------------------------------

export interface MigrationProgress {
  /** まだDBの中に残っている枚数 */
  remaining: number
  /** この回で移せた枚数 */
  moved: number
  /** この回で移せなかった枚数 */
  failed: number
}

/** 1回に移す枚数。多いと端末が固まるので、少しずつ */
const MIGRATE_BATCH = 5

/**
 * まだ移していない画像の枚数を数える。
 *
 * 画像は3か所に入っている。数え漏らすと「移し終わった」ように見えて、
 * 実際にはデータベースに残り続けるので、必ず全部を見る。
 *   trade_images.image            … 取引に貼ったチャート画像
 *   trades.screenshot             … スクショ登録で取り込んだ画像
 *   accounts.capital_screenshot   … 原資の証拠
 */
export async function countUnmigratedImages(): Promise<number> {
  if (!supabase) return 0
  const counts = await Promise.all(
    SOURCES.map(async (src) => {
      try {
        const { count } = await supabase!
          .from(src.table)
          .select('id', { count: 'exact', head: true })
          .is(src.pathCol, null)
          .not(src.dataCol, 'is', null)
        return count ?? 0
      } catch {
        return 0
      }
    }),
  )
  return counts.reduce((a, b) => a + b, 0)
}

/** 画像が入っている場所。増えたらここに足す */
const SOURCES = [
  { table: 'trade_images', dataCol: 'image', pathCol: 'image_path', folder: 'chart' },
  { table: 'trades', dataCol: 'screenshot', pathCol: 'screenshot_path', folder: 'trade' },
  {
    table: 'accounts',
    dataCol: 'capital_screenshot',
    pathCol: 'capital_screenshot_path',
    folder: 'capital',
  },
] as const

/**
 * まだ移していない画像を、少しだけ移す。
 * 呼ぶたびに MIGRATE_BATCH 枚ずつ進む。remaining が 0 になれば完了。
 */
export async function migrateImagesToStorage(): Promise<MigrationProgress> {
  if (!supabase) return { remaining: 0, moved: 0, failed: 0 }

  let moved = 0
  let failed = 0

  // 先頭の場所から順に片づける。1回の呼び出しで MIGRATE_BATCH 枚まで
  for (const src of SOURCES) {
    if (moved + failed >= MIGRATE_BATCH) break
    const room = MIGRATE_BATCH - (moved + failed)

    const { data, error } = await supabase
      .from(src.table)
      .select(`id,${src.dataCol}`)
      .is(src.pathCol, null)
      .not(src.dataCol, 'is', null)
      .limit(room)
    // その表がまだ無い環境でも、ほかの表の引っ越しは続ける
    if (error) continue

    for (const row of (data ?? []) as Record<string, string>[]) {
      const path = await toStored(row[src.dataCol], src.folder)
      if (!path) {
        failed += 1
        continue
      }
      // 置き場所を書いてから中身を消す。順番が逆だと、
      // 途中で失敗したときに画像が消えたまま残る
      const { error: upErr } = await supabase
        .from(src.table)
        .update({ [src.pathCol]: path, [src.dataCol]: null })
        .eq('id', row.id)
      if (upErr) {
        // DBに書けなかったら、置いた画像は捨てる
        await removeImages([path])
        failed += 1
        continue
      }
      moved += 1
    }
  }

  return { remaining: await countUnmigratedImages(), moved, failed }
}
