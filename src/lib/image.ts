// スクショ画像をブラウザ内で縮小し、data URL(JPEG) に変換する。
// DBに保存してもDB/通信が重くなりすぎないよう、長辺と画質を抑える。

const MAX_DIM = 1200
const QUALITY = 0.72

export async function fileToDownscaledDataUrl(
  file: File,
  maxDim = MAX_DIM,
  quality = QUALITY,
): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl // フォールバック(縮小なし)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画像を読み込めませんでした'))
    img.src = src
  })
}

// ---------------------------------------------------------------
// Storage へ送るための、ファイルそのもの（Blob）を作る
//
// data URL は文字なので、そのままだと容量が約1.33倍になる。
// Storage へは中身のまま送りたいので、Blob を作る道を用意する。
// ---------------------------------------------------------------

/** 置き場に送る形式。WebP は同じ見た目で JPEG より2〜3割小さい */
const STORE_TYPE = 'image/webp'

/** 縮小して Blob にする。WebP が使えない端末では JPEG に落ちる */
export async function fileToDownscaledBlob(
  file: File,
  maxDim = MAX_DIM,
  quality = QUALITY,
): Promise<Blob> {
  const img = await loadImage(await readAsDataUrl(file))
  return drawToBlob(img, maxDim, quality)
}

/** すでにDBに入っている data URL を、置き場に送れる形に変える（引っ越し用） */
export async function dataUrlToBlob(
  dataUrl: string,
  maxDim = MAX_DIM,
  quality = QUALITY,
): Promise<Blob> {
  const img = await loadImage(dataUrl)
  return drawToBlob(img, maxDim, quality)
}

async function drawToBlob(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を変換できませんでした')
  ctx.drawImage(img, 0, 0, w, h)

  const blob = await toBlob(canvas, STORE_TYPE, quality)
  // 古い端末は WebP を作れず null が返る。そのときは JPEG で送る
  if (blob && blob.type === STORE_TYPE) return blob
  const jpeg = await toBlob(canvas, 'image/jpeg', quality)
  if (!jpeg) throw new Error('画像を変換できませんでした')
  return jpeg
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}
