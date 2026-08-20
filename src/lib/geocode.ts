// Nominatim(OpenStreetMap) reverse geocoding 응답에서 주소 문자열만 뽑아낸다.
// 좌표가 바다/미지원 지역이면 { error } 응답을 준다 — 그럴 땐 null.
export function formatNominatimAddress(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const displayName = (data as { display_name?: unknown }).display_name
  return typeof displayName === 'string' && displayName.length > 0 ? displayName : null
}

// 실패(네트워크 오류, rate limit 등)해도 사진 저장 자체는 막지 않도록 null을 반환한다.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`
  try {
    const res = await fetch(url, {
      // Nominatim 사용 정책상 User-Agent 필수.
      headers: { 'User-Agent': 'jnymluvdev-family-hub (evilet12@gmail.com)' },
    })
    if (!res.ok) return null
    return formatNominatimAddress(await res.json())
  } catch {
    return null
  }
}
