// Photos ko chhota karke JPEG dataURL banata hai.
// Kyun? Phone ki photo 4-8 MB hoti hai: storage bharega aur AI ko bhejna mehenga/slow hoga.

export async function fileToDataUrl(file, maxSide = 1280, quality = 0.85) {
  const bitmap = await createImageBitmap(file)
  return bitmapToDataUrl(bitmap, maxSide, quality)
}

export function bitmapToDataUrl(source, maxSide = 1280, quality = 0.85, mirror = false) {
  const w = source.videoWidth || source.width
  const h = source.videoHeight || source.height
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (mirror) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

// Ek already-bani dataURL ko aur chhota karna (AI ko bhejne se pehle)
export async function shrinkDataUrl(dataUrl, maxSide = 1024, quality = 0.8) {
  const img = await loadImage(dataUrl)
  return bitmapToDataUrl(img, maxSide, quality)
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// "data:image/jpeg;base64,AAAA..." -> { mediaType: 'image/jpeg', data: 'AAAA...' }
export function splitDataUrl(dataUrl) {
  const [head, data] = dataUrl.split(',')
  const mediaType = head.slice(5, head.indexOf(';'))
  return { mediaType, data }
}

export function dataUrlToBlob(dataUrl) {
  const { mediaType, data } = splitDataUrl(dataUrl)
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: mediaType })
}
