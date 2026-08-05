interface Props {
  size?: number
  /** 名前も一緒に出す */
  withName?: boolean
  className?: string
}

/**
 * ロゴ。
 * 「edge（優位性）＝右肩上がりの一辺」と「book（記録）＝重なるページ」を
 * ひとつの図形にしている。装飾を足さず、線の太さと角度だけで作る。
 */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" className="fill-brand" />
      {/* 記録（ページの背） */}
      <path
        d="M9 23V10.5A1.5 1.5 0 0 1 10.5 9H13"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 優位性（右肩上がりの一辺） */}
      <path
        d="M9 23h14M13 19.5l4-5 3 3 4.5-7"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="10.5" r="2" fill="white" />
    </svg>
  )
}

export default function Logo({ size = 32, withName = true, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withName && (
        <span
          className="font-display font-semibold tracking-tight text-ink"
          style={{ fontSize: size * 0.56 }}
        >
          Edgebook
        </span>
      )}
    </span>
  )
}
