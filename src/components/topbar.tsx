'use client'

import { useState } from 'react'
import { logout } from '@/app/(family)/actions'
import type { Profile } from '@/lib/types'

export function Topbar({ profile }: { profile: Profile }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="top-strip">
      <div className="topbar-left" />
      <div className="topbar-right">
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
