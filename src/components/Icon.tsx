// 絵文字の代わりに使う線画アイコン。currentColor を継ぐので配色に馴染む。

export type IconName =
  | 'home'
  | 'calendar'
  | 'plus'
  | 'chart'
  | 'book'
  | 'camera'
  | 'pencil'
  | 'trash'
  | 'upload'
  | 'refresh'
  | 'left'
  | 'right'
  | 'back'
  | 'check'
  | 'close'
  | 'wallet'
  | 'trendUp'
  | 'trendDown'
  | 'percent'
  | 'scale'
  | 'clock'
  | 'target'
  | 'flame'
  | 'star'
  | 'bulb'
  | 'rocket'
  | 'down'
  | 'info'
  | 'shield'
  | 'sparkle'
  | 'search'

const PATHS: Record<IconName, JSX.Element> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  shield: <path d="M12 3l7 2.5v5.8c0 4.2-2.8 7.9-7 9.2-4.2-1.3-7-5-7-9.2V5.5z" />,
  sparkle: (
    <>
      <path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9z" />
      <path d="M18.5 16.5 19.2 18.8 21.5 19.5 19.2 20.2 18.5 22.5 17.8 20.2 15.5 19.5 17.8 18.8z" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v14.5" />
      <path d="M6 17h14v4H6a2 2 0 0 1-2-2V4.5" />
      <path d="M8 7.5h8M8 11h5" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.7l1.2-2h6.2l1.2 2h2.7A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="11.75" cy="12.5" r="3.25" />
    </>
  ),
  pencil: (
    <>
      <path d="m4 20 .8-3.6L16.2 5A2 2 0 0 1 19 7.8L7.6 19.2 4 20Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.2a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  left: <path d="m14.5 5-7 7 7 7" />,
  right: <path d="m9.5 5 7 7-7 7" />,
  back: (
    <>
      <path d="M20 12H4" />
      <path d="m10 6-6 6 6 6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  down: <path d="m6 9.5 6 6 6-6" />,
  trendUp: (
    <>
      <path d="M4 17.5 10 11l3.5 3.5L20 7" />
      <path d="M15 7h5v5" />
    </>
  ),
  trendDown: (
    <>
      <path d="M4 6.5 10 13l3.5-3.5L20 17" />
      <path d="M15 17h5v-5" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10M4 9h16" />
      <path d="M4 9 1.5 15h5zM20 9l-2.5 6h5z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  flame: <path d="M12 3s4.5 3.6 4.5 8a4.5 4.5 0 0 1-9 0c0-1.4.6-2.6 1.3-3.5.2 1.2.9 2 1.7 2 1 0 1.5-.9 1.5-2.3 0-1.6-.5-3-1-4.2z" />,
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4 5.6-.8z" />,
  bulb: (
    <>
      <path d="M9 17h6M10 20.5h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1h6c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3z" />
    </>
  ),
  rocket: (
    <>
      <path d="M13.5 4.5C16.5 5.5 19 8 20 11l-6.5 6.5-3-1.5-1.5-3z" />
      <path d="M8 16c-1.5 1.5-1.5 4-1.5 4s2.5 0 4-1.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16.5 14.5h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8v.4" />
    </>
  ),
}

interface Props {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.75 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
