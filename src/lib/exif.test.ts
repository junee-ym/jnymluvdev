import { describe, expect, it } from 'vitest'
import { getExifGps } from './exif'

// 최소 JPEG + EXIF GPS IFD 버퍼를 손으로 구성한다.
// 구조: SOI(2) + APP1 마커(2) + size(2) + "Exif\0\0"(6) + TIFF(little-endian, 128B)
//   TIFF: 헤더(8) + IFD0(1개 항목: GPS IFD 포인터, 18B) + GPS IFD(4개 항목: LatRef/Lat/LngRef/Lng, 54B)
//         + Lat rational 3쌍(24B) + Lng rational 3쌍(24B)
function buildJpegWithGps(): File {
  const buf = new ArrayBuffer(140)
  const v = new DataView(buf)
  const LE = true

  v.setUint16(0, 0xffd8) // SOI
  v.setUint16(2, 0xffe1) // APP1 마커
  v.setUint16(4, 0x0088) // size = 136 (size 필드 자신 + payload)
  // "Exif\0\0"
  v.setUint32(6, 0x45786966)
  v.setUint16(10, 0x0000)

  const tiffStart = 12
  v.setUint8(tiffStart, 0x49) // "II" little-endian
  v.setUint8(tiffStart + 1, 0x49)
  v.setUint16(tiffStart + 2, 0x002a, LE)
  v.setUint32(tiffStart + 4, 8, LE) // IFD0 offset (tiffStart 기준)

  // IFD0: 항목 1개 (GPS IFD 포인터, tag 0x8825)
  const ifd0 = tiffStart + 8
  v.setUint16(ifd0, 1, LE) // count
  v.setUint16(ifd0 + 2, 0x8825, LE) // tag
  v.setUint16(ifd0 + 4, 4, LE) // type = LONG
  v.setUint32(ifd0 + 6, 1, LE) // count = 1
  v.setUint32(ifd0 + 10, 26, LE) // value: GPS IFD offset (tiffStart 기준)
  v.setUint32(ifd0 + 14, 0, LE) // next IFD offset

  // GPS IFD: 항목 4개
  const gps = tiffStart + 26
  v.setUint16(gps, 4, LE) // count
  const entry = (i: number) => gps + 2 + i * 12

  v.setUint16(entry(0), 0x0001, LE) // GPSLatitudeRef
  v.setUint16(entry(0) + 2, 2, LE) // ASCII
  v.setUint32(entry(0) + 4, 2, LE) // count = 2 ("N\0")
  v.setUint8(entry(0) + 8, 0x4e) // 'N'

  v.setUint16(entry(1), 0x0002, LE) // GPSLatitude
  v.setUint16(entry(1) + 2, 5, LE) // RATIONAL
  v.setUint32(entry(1) + 4, 3, LE) // count = 3
  v.setUint32(entry(1) + 8, 80, LE) // 값 오프셋(tiffStart 기준)

  v.setUint16(entry(2), 0x0003, LE) // GPSLongitudeRef
  v.setUint16(entry(2) + 2, 2, LE)
  v.setUint32(entry(2) + 4, 2, LE)
  v.setUint8(entry(2) + 8, 0x45) // 'E'

  v.setUint16(entry(3), 0x0004, LE) // GPSLongitude
  v.setUint16(entry(3) + 2, 5, LE)
  v.setUint32(entry(3) + 4, 3, LE)
  v.setUint32(entry(3) + 8, 104, LE)

  v.setUint32(gps + 50, 0, LE) // next IFD offset

  // Latitude 37˚33'59.4"N = 37.5665
  const lat = tiffStart + 80
  v.setUint32(lat, 37, LE); v.setUint32(lat + 4, 1, LE)
  v.setUint32(lat + 8, 33, LE); v.setUint32(lat + 12, 1, LE)
  v.setUint32(lat + 16, 594, LE); v.setUint32(lat + 20, 10, LE)

  // Longitude 126˚58'40.8"E = 126.978
  const lng = tiffStart + 104
  v.setUint32(lng, 126, LE); v.setUint32(lng + 4, 1, LE)
  v.setUint32(lng + 8, 58, LE); v.setUint32(lng + 12, 1, LE)
  v.setUint32(lng + 16, 408, LE); v.setUint32(lng + 20, 10, LE)

  return new File([buf], 'test.jpg', { type: 'image/jpeg' })
}

describe('getExifGps', () => {
  it('GPS IFD에서 위도/경도를 십진수로 변환한다', async () => {
    const gps = await getExifGps(buildJpegWithGps())
    expect(gps).not.toBeNull()
    expect(gps!.lat).toBeCloseTo(37.5665, 4)
    expect(gps!.lng).toBeCloseTo(126.978, 4)
  })

  it('JPEG가 아니면 null을 반환한다', async () => {
    const file = new File([new ArrayBuffer(10)], 'test.png', { type: 'image/png' })
    expect(await getExifGps(file)).toBeNull()
  })

  it('GPS 태그가 없는 JPEG면 null을 반환한다', async () => {
    // SOI만 있는 빈 JPEG
    const buf = new ArrayBuffer(2)
    new DataView(buf).setUint16(0, 0xffd8)
    const file = new File([buf], 'plain.jpg', { type: 'image/jpeg' })
    expect(await getExifGps(file)).toBeNull()
  })
})
