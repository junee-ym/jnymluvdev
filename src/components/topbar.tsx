'use client'

import { useEffect, useState } from 'react'
import { logout } from '@/app/(family)/actions'
import type { Profile } from '@/lib/types'

export function Topbar({ profile }: { profile: Profile }) {
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setDark(isDark)
  }, [])

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
