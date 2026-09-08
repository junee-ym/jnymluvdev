// 앨범 업로드 시 목록용 썸네일을 브라우저에서 미리 만든다. 원본을 그대로
// 목록에 내려주면 볼 때마다 풀사이즈 egress가 나가서(Supabase 무료 티어
// 한도를 이걸로 다 씀), canvas로 축소한 JPEG을 별도 오브젝트로 같이 올린다.
const THUMB_MAX_DIM = 480
const THUMB_QUALITY = 0.72

export async function createThumbnail(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null // 디코딩 못 하는 포맷이면 썸네일 없이 원본만 쓴다.
  }

  const scale = Math.min(1, THUMB_MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', THUMB_QUALITY))
}
