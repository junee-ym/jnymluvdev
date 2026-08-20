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

export type GpsCoords = { lat: number; lng: number }

// JPEG EXIF에서 GPS 위도/경도(십진수)만 뽑아낸다. 구조는 getExifDate와 동일.
export async function getExifGps(file: File): Promise<GpsCoords | null> {
  if (file.type !== 'image/jpeg') return null

  const buf = await file.slice(0, 256 * 1024).arrayBuffer()
  const view = new DataView(buf)
  if (view.getUint16(0) !== 0xffd8) return null // JPEG SOI 아님

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    const size = view.getUint16(offset + 2)
    if (marker === 0xffe1) return parseExifGpsSegment(view, offset + 4)
    if ((marker & 0xff00) !== 0xff00) break
    offset += 2 + size
  }
  return null
}

function parseExifGpsSegment(view: DataView, start: number): GpsCoords | null {
  if (view.getUint32(start) !== 0x45786966) return null // "Exif"
  const tiffStart = start + 6
  const little = view.getUint16(tiffStart) === 0x4949
  const ifd0Offset = tiffStart + view.getUint32(tiffStart + 4, little)

  const ifd0 = readIfd(view, tiffStart, ifd0Offset, little)
  const gpsIfdOffset = ifd0.get(0x8825) // GPSInfo IFD 포인터
  if (typeof gpsIfdOffset !== 'number') return null

  const gpsIfd = readIfd(view, tiffStart, tiffStart + gpsIfdOffset, little)
  const lat = toDecimalDegrees(gpsIfd.get(0x0002), gpsIfd.get(0x0001))
  const lng = toDecimalDegrees(gpsIfd.get(0x0004), gpsIfd.get(0x0003))
  return lat !== null && lng !== null ? { lat, lng } : null
}

// GPSLatitude/Longitude는 [도, 분, 초] RATIONAL 3개 + N/S/E/W 기준 태그로 온다.
// 위치 서비스를 끄고 찍은 사진(삼성 갤럭시 등)은 GPS IFD 자체는 남기되 태그값을
// 전부 0(ref도 널문자)으로 채워서 준다 — ref가 N/S/E/W가 아니면 그 placeholder이므로
// (0, 0)으로 잘못 지오코딩하지 말고 "GPS 없음"으로 취급한다.
function toDecimalDegrees(dms: unknown, ref: unknown): number | null {
  if (!Array.isArray(dms) || dms.length !== 3 || typeof ref !== 'string') return null
  if (ref !== 'N' && ref !== 'S' && ref !== 'E' && ref !== 'W') return null
  const [deg, min, sec] = dms as number[]
  const value = deg + min / 60 + sec / 3600
  return ref === 'S' || ref === 'W' ? -value : value
}

// IFD 하나를 읽어 태그->값 맵으로 반환. 필요한 타입(ASCII, LONG, RATIONAL)만 지원.
function readIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  little: boolean
): Map<number, string | number | number[]> {
  const result = new Map<number, string | number | number[]>()
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
    } else if (type === 5) {
      // RATIONAL: (분자, 분모) uint32 쌍, 값이 4바이트를 넘어 항상 외부 오프셋에 있다.
      const dataOffset = tiffStart + view.getUint32(valueOffsetField, little)
      if (dataOffset + numValues * 8 > view.byteLength) continue
      const values: number[] = []
      for (let j = 0; j < numValues; j++) {
        const num = view.getUint32(dataOffset + j * 8, little)
        const den = view.getUint32(dataOffset + j * 8 + 4, little)
        values.push(den === 0 ? 0 : num / den)
      }
      result.set(tag, values)
    }
  }
  return result
}
