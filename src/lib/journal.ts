/**
 * 日記（記事）の中身の形。
 *
 * 本文は「文章」と「画像」が順番に並んだもの。
 * 1つの長い文字列にしないのは、途中に画像を挟めるようにするため。
 *
 * 画像そのものはここに入れない。Storage の置き場所（path）だけを持つ。
 * 画像を文字にして持つと、1枚で数百KBになり、日記を開くたびに
 * それを全部読むことになるため。
 */

export type Block =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'image'; path: string; caption?: string }

/** そのとき何を感じていたか。並び順はそのまま画面に出る順 */
export const EMOTIONS = [
  { key: 'calm', emoji: '😌', label: '落ち着いていた' },
  { key: 'confident', emoji: '🙂', label: '自信があった' },
  { key: 'neutral', emoji: '😐', label: '普通' },
  { key: 'anxious', emoji: '😰', label: '不安だった' },
  { key: 'rushed', emoji: '😣', label: '焦っていた' },
  { key: 'fomo', emoji: '🔥', label: '乗り遅れたくなかった' },
  { key: 'revenge', emoji: '😡', label: '取り返したかった' },
] as const

export type EmotionKey = (typeof EMOTIONS)[number]['key']

export function emotionOf(key: string) {
  return EMOTIONS.find((e) => e.key === key) ?? null
}

/** 一日ぶんの日記 */
export interface DayEntry {
  day: string
  title: string
  blocks: Block[]
  emotions: string[]
  emotionWhy: string
  good: string
  improve: string
  nextTime: string
  lesson: string
}

export function emptyEntry(day: string): DayEntry {
  return {
    day,
    title: '',
    blocks: [newText()],
    emotions: [],
    emotionWhy: '',
    good: '',
    improve: '',
    nextTime: '',
    lesson: '',
  }
}

let seq = 0
/** 並べ替えても取り違えない印。保存にも残るので、作り直さないこと */
export function blockId(): string {
  seq += 1
  return `b${Date.now().toString(36)}${seq.toString(36)}`
}

export function newText(text = ''): Block {
  return { id: blockId(), kind: 'text', text }
}

export function newImage(path: string, caption = ''): Block {
  return { id: blockId(), kind: 'image', path, caption }
}

/**
 * 本文の文字だけを取り出す。
 *
 * 一覧の下書きや、これまでの note 列に写しておくために使う。
 * 画像のところは説明文があればそれを使う。
 */
export function plainText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.kind === 'text' ? b.text : (b.caption ?? '')))
    .filter((t) => t.trim())
    .join('\n\n')
}

/** 何か書いてあるか。空の日記を保存しないための判定 */
export function isEmpty(e: DayEntry): boolean {
  return (
    !e.title.trim() &&
    !e.emotions.length &&
    !e.emotionWhy.trim() &&
    !e.good.trim() &&
    !e.improve.trim() &&
    !e.nextTime.trim() &&
    !e.lesson.trim() &&
    e.blocks.every((b) => (b.kind === 'text' ? !b.text.trim() : false))
  )
}

/**
 * 保存されている形から読み直す。
 *
 * body_blocks がまだ無い日は、これまでの note を本文として引き継ぐ。
 * 過去に書いたものが消えたように見えるのがいちばん困るため。
 */
export function parseEntry(
  day: string,
  row: {
    title?: string | null
    body_blocks?: unknown
    note?: string | null
    emotions?: string[] | null
    emotion_why?: string | null
    good?: string | null
    improve?: string | null
    next_time?: string | null
    lesson?: string | null
  } | null,
): DayEntry {
  if (!row) return emptyEntry(day)

  const blocks = parseBlocks(row.body_blocks)
  return {
    day,
    title: row.title ?? '',
    blocks: blocks ?? (row.note ? [newText(row.note)] : [newText()]),
    emotions: row.emotions ?? [],
    emotionWhy: row.emotion_why ?? '',
    good: row.good ?? '',
    improve: row.improve ?? '',
    nextTime: row.next_time ?? '',
    lesson: row.lesson ?? '',
  }
}

/** 壊れた形が入っていても落ちないようにする */
function parseBlocks(raw: unknown): Block[] | null {
  if (!Array.isArray(raw)) return null
  const out: Block[] = []
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue
    const o = b as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : blockId()
    if (o.kind === 'image' && typeof o.path === 'string') {
      out.push({ id, kind: 'image', path: o.path, caption: str(o.caption) })
    } else if (typeof o.text === 'string') {
      out.push({ id, kind: 'text', text: o.text })
    }
  }
  return out.length ? out : null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
