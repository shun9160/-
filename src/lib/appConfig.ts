/**
 * 初期設定で決まる、アプリ全体で使う値。
 *
 * 画面の奥まで props で引き回すと煩雑になるうえ、
 * 「表示のたびに変わる値」ではないので、ここに保持して各所から読む。
 * 設定を読み込んだ時とオンボーディング完了時に更新する。
 */

interface AppConfig {
  /** MT5サーバーの時差（UTCから何時間か）。既定はドバイ時間 */
  brokerUtcOffset: number
  /** 口座の通貨 */
  accountCurrency: string
  /** 1ロットの通貨量 */
  lotSize: number
  /** 入力欄の初期値に使う銘柄 */
  defaultSymbol: string
}

const config: AppConfig = {
  brokerUtcOffset: 4,
  accountCurrency: 'JPY',
  lotSize: 100000,
  defaultSymbol: 'XAUUSD',
}

export function updateAppConfig(patch: Partial<AppConfig>): void {
  const target = config as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) {
    if (v != null && v !== '') target[k] = v
  }
}

export function getAppConfig(): Readonly<AppConfig> {
  return config
}

/** 通貨の表示（金額のうしろに付ける） */
export function currencyLabel(): string {
  switch (config.accountCurrency) {
    case 'JPY':
      return '円'
    case 'USD':
      return 'ドル'
    case 'EUR':
      return 'ユーロ'
    default:
      return config.accountCurrency
  }
}
