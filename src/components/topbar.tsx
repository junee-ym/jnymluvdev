'use client'

import { useState } from 'react'
import { logout } from '@/app/(family)/actions'
import type { Profile } from '@/lib/types'

export function Topbar({ profile }: { profile: Profile }) {
  // 하이드레이션 전에 <html>에 'dark' 클래스를 붙이는 코드가 없으므로 마운트 시
  // 읽어봐야 항상 false다. (읽어서 setState 하는 useEffect는 react-hooks/set-state-in-effect
  // 위반이기도 했다.) 토글 핸들러가 DOM 클래스와 이 상태를 함께 갱신한다.
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  function toggleDark() {
    document.documentElement.classList.toggle('dark')
    setDark(document.documentElement.classList.contains('dark'))
  }

  return (
    <div className="top-strip">
      <div className="topbar-left" />
      <div className="topbar-right">
        <button className="icon-btn" onClick={toggleDark} title="다크 모드">
          {dark ? '☀' : '☾'}
        </button>
        <button className="avatar" onClick={() => setMenuOpen((v) => !v)}>
          {profile.name.slice(-2)}
        </button>
      </div>
      {menuOpen && (
        <div className="user-menu open">
          <div className="who">{profile.name} · {profile.role}</div>
          <form action={logout}>
            <button type="submit">로그아웃</button>
          </form>
        </div>
      )}
    </div>
  )
}
