import { useRef, useState } from 'react'
import { fileToDownscaledDataUrl } from '../lib/image'
import { friendlyError } from '../lib/errors'
import { dropDuplicates, hashDataUrl } from '../lib/imageHash'
import Icon from './Icon'

// チャートは細い線と数字を見るので、スクショより大きめ・高画質で残す。
export const CHART_MAX_DIM = 1600
export const CHART_QUALITY = 0.82

interface Props {
  /** いま選んでいる画像 (data URL) */
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  /** 説明文を出すか。並べて置くときは省く */
  hint?: boolean
}

/**
 * 取引を登録する前に、チャート画像を選んでおくための欄。
 *
 * 画像はまだ保存せず、この場に持っておく。
 * 取引が出来てから、その取引に貼り付ける。
 */
export default function ChartPicker({ value, onChange, disabled, hint }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (fileRef.current) fileRef.current.value = ''
    if (!files.length) return
    setBusy(true)
    setErr(null)
    try {
      const shrunk = await Promise.all(
        files.map((f) => fileToDownscaledDataUrl(f, CHART_MAX_DIM, CHART_QUALITY)),
      )

      // 同じ画像を二重に貼らない。すでに選んだものとも見比べる。
      const known = new Set(await Promise.all(value.map(hashDataUrl)))
      const incoming = await Promise.all(
        shrunk.map(async (image) => ({ image, hash: await hashDataUrl(image) })),
      )
      const { keepIndexes, duplicates } = await dropDuplicates(incoming, known)

      if (keepIndexes.length) onChange([...value, ...keepIndexes.map((i) => incoming[i].image)])
      if (duplicates > 0) {
        setErr(
          keepIndexes.length
            ? `${duplicates}枚は同じ画像だったので追加していません`
            : `同じ画像です。すでに追加されています`,
        )
      }
    } catch (e2) {
      setErr(friendlyError(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="label">チャート（任意）</span>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
        >
          <Icon name="chart" size={15} />
          {busy ? '取り込み中…' : value.length ? '追加' : 'チャートを選ぶ'}
        </button>
      </div>

      {hint && value.length === 0 && (
        <p className="text-xs text-ink3">
          エントリーや決済のチャートを一緒に登録できます。何枚でも選べます。
        </p>
      )}

      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((src, i) => (
            <li key={i} className="relative">
              <img
                src={src}
                alt={`チャート ${i + 1}`}
                className="h-20 w-full rounded-lg border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={`チャート ${i + 1} を外す`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white"
              >
                <Icon name="close" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {err && <p className="mt-1.5 text-sm text-down">{err}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPick}
      />
    </div>
  )
}
