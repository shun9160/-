import { useId } from 'react'

interface Props {
  size?: number
  /** 名前も一緒に出す */
  withName?: boolean
  /** 下に一言そえる */
  withTagline?: boolean
  className?: string
}

/** ブランドの色。紫から青へ */
const FROM = '#6D4AFF'
const TO = '#2F6BFF'

/**
 * ひらいた本。
 *
 * 左右のページと、その下に重なったページの束。
 * ロゴの「OO」の位置に入るので、横長にしてある。
 */
const BOOK_PATHS = [
  // 左ページ
  'M14.2 5C10.8 2.6 6.2 1.6 1.2 2.2V16.4C6.2 15.8 10.8 16.8 14.2 19.2Z',
  // 左ページの束
  'M1.2 17.6C6.2 17 10.8 18 14.2 20.4V22.2C10.8 19.8 6.2 18.8 1.2 19.4Z',
  // 右ページ
  'M15.8 5C19.2 2.6 23.8 1.6 28.8 2.2V16.4C23.8 15.8 19.2 16.8 15.8 19.2Z',
  // 右ページの束
  'M28.8 17.6C23.8 17 19.2 18 15.8 20.4V22.2C19.2 19.8 23.8 18.8 28.8 19.4Z',
]

/**
 * 本だけのマーク。
 * 小さく置いても読めるよう、角丸の四角にのせて白抜きにしている。
 */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor={FROM} />
          <stop offset="1" stopColor={TO} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <g transform="translate(5 7.7) scale(0.733)" fill="#FFFFFF">
        {BOOK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}

/** 文字の中に入れる本。色はグラデーション */
function BookGlyph({ height }: { height: number }) {
  const id = useId()
  return (
    <svg
      height={height}
      viewBox="0 0 30 23"
      fill="none"
      aria-hidden="true"
      style={{ width: (height * 30) / 23 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="30" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor={FROM} />
          <stop offset="1" stopColor={TO} />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`}>
        {BOOK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}

/**
 * 文字のロゴ。「BOOK」の OO のところが本になっている。
 *
 * 画像ではなく文字と図形で組んでいるので、
 * どの大きさでもぼやけないし、色も配色に合わせて変えられる。
 */
export function Wordmark({
  size = 18,
  className = '',
  /** 暗い背景に置くとき */
  onDark = false,
}: {
  size?: number
  className?: string
  onDark?: boolean
}) {
  const ink = onDark ? 'text-white' : 'text-ink'
  return (
    <span
      className={`inline-flex items-center font-display font-bold leading-none tracking-tight ${className}`}
      style={{ fontSize: size }}
      // 読み上げと検索には、ふつうの文字列として伝える
      role="img"
      aria-label="MyFX BOOK"
    >
      <span className={ink} aria-hidden="true">
        My
      </span>
      <span
        aria-hidden="true"
        className="bg-gradient-to-r from-[#6D4AFF] to-[#2F6BFF] bg-clip-text text-transparent"
      >
        FX
      </span>
      <span className={ink} aria-hidden="true" style={{ marginLeft: size * 0.2 }}>
        B
      </span>
      <span
        aria-hidden="true"
        className="inline-flex"
        style={{
          marginInline: size * 0.05,
          // 大文字の高さに合わせる（行の中心より少し下）
          transform: `translateY(${size * 0.025}px)`,
        }}
      >
        <BookGlyph height={size * 0.79} />
      </span>
      <span className={ink} aria-hidden="true">
        K
      </span>
    </span>
  )
}

export default function Logo({
  size = 32,
  withName = true,
  withTagline = false,
  className = '',
}: Props) {
  if (!withName) return <LogoMark size={size} className={className} />

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <span className="inline-flex items-center gap-2.5">
        <LogoMark size={size} />
        <Wordmark size={size * 0.62} />
      </span>
      {withTagline && (
        <span className="text-[11px] text-ink3">トレードを記録し、成長を積み重ねる</span>
      )}
    </span>
  )
}
