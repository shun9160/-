import { useEffect, useState } from 'react'
import { brokerLook } from '../lib/brokers'

interface Props {
  broker: string | null | undefined
  size?: number
  /** ラベル代わりに読み上げられる文字 */
  alt?: string
}

/**
 * ブローカーの印。
 * 分かっている会社は公式サイトのアイコンを出し、
 * 出せないときは頭文字の入った色つきの印にする。
 */
export default function BrokerMark({ broker, size = 32, alt }: Props) {
  const look = brokerLook(broker)
  const [failed, setFailed] = useState(false)

  // 別の会社に切り替わったら、もう一度アイコンを試す
  useEffect(() => setFailed(false), [broker])

  const box = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.28),
  }

  if (look.iconUrl && !failed) {
    return (
      <span
        style={box}
        className="flex shrink-0 items-center justify-center overflow-hidden border border-line bg-surface"
      >
        <img
          src={look.iconUrl}
          alt={alt ?? broker ?? ''}
          width={Math.round(size * 0.7)}
          height={Math.round(size * 0.7)}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="object-contain"
        />
      </span>
    )
  }

  return (
    <span
      style={{ ...box, backgroundColor: look.color, color: look.textColor }}
      className="flex shrink-0 items-center justify-center text-[11px] font-bold leading-none"
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
    >
      {look.initials}
    </span>
  )
}
