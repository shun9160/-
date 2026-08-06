interface Props {
  email: string | null
  size?: number
}

/**
 * 利用者の印。
 * まだ写真を持たない仕組みなので、メールの頭文字を出す。
 */
export default function Avatar({ email, size = 32 }: Props) {
  const letter = (email ?? '?').trim().slice(0, 1).toUpperCase()
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold leading-none text-brand"
      aria-hidden="true"
    >
      {letter}
    </span>
  )
}
