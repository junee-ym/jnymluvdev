// JPEG EXIF에서 촬영일자(DateTimeOriginal, 없으면 DateTime)만 뽑아낸다.
// 앨범 업로드 시 "날짜" 기본값을 오늘이 아니라 실제 찍은 날로 채우기 위한 용도라
// 태그 하나만 필요해서 라이브러리 없이 직접 파싱한다 (exifr 등 의존성 추가 대신).
export async function getExifDate(file: File): Promise<string | null> {
  if (file.type !== 'image/jpeg') return null

  const buf = await file.slice(0, 256 * 1024).arrayBuffer()
  const view = new DataView(buf)
  if (view.getUint16(0) !== 0xffd8) return null // JPEG SOI 아님

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    const size = view.getUint16(offset + 2)
    if (marker === 0xffe1) return parseExifSegment(view, offset + 4)
    if ((marker & 0xff00) !== 0xff00) break
    offset += 2 + size
  }
  return null
}

function parseExifSegment(view: DataView, start: number): string | null {
  if (view.getUint32(start) !== 0x45786966) return null // "Exif"
  const tiffStart = start + 6
  const little = view.getUint16(tiffStart) === 0x4949
  const ifd0Offset = tiffStart + view.getUint32(tiffStart + 4, little)

  const ifd0 = readIfd(view, tiffStart, ifd0Offset, little)
  const exifIfdOffset = ifd0.get(0x8769)
  const fromExifIfd = typeof exifIfdOffset === 'number'
    ? readIfd(view, tiffStart, tiffStart + exifIfdOffset, little).get(0x9003)
    : undefined

  const raw = fromExifIfd ?? ifd0.get(0x0132)
  if (typeof raw !== 'string') return null

  // "YYYY:MM:DD HH:MM:SS" -> "YYYY-MM-DD"
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// IFD 하나를 읽어 태그->값 맵으로 반환. 필요한 타입(ASCII, LONG)만 지원.
function readIfd(view: DataView, tiffStart: number, ifdOffset: number, little: boolean): Map<number, string | number> {
  const result = new Map<number, string | number>()
  if (ifdOffset + 2 > view.byteLength) return result
  const count = view.getUint16(ifdOffset, little)
  for (let i = 0; i < count; i++) {
    const entryOffset = ifdOffset + 2 + i * 12
    if (entryOffset + 12 > view.byteLength) break
    const tag = view.getUint16(entryOffset, little)
    const type = view.getUint16(entryOffset + 2, little)
    const numValues = view.getUint32(entryOffset + 4, little)
    const valueOffsetField = entryOffset + 8

    if (type === 2) {
      // ASCII
      const dataOffset = numValues <= 4 ? valueOffsetField : tiffStart + view.getUint32(valueOffsetField, little)
      if (dataOffset + numValues > view.byteLength) continue
      let str = ''
      for (let j = 0; j < numValues - 1; j++) str += String.fromCharCode(view.getUint8(dataOffset + j))
      result.set(tag, str)
    } else if (type === 4) {
      // LONG
      result.set(tag, view.getUint32(valueOffsetField, little))
    }
  }
  return result
}
