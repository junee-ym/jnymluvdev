'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { logout } from '@/app/(family)/actions'
import type { Profile } from '@/lib/types'

export function Topbar({ profile }: { profile: Profile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  return (
    <div className="top-strip">
      <div className="topbar-left">
        <label htmlFor="mobile-nav-toggle" className="icon-btn hamburger-btn" aria-label="메뉴 열기">☰</label>
        <Link href="/" className="icon-btn" aria-label="홈으로">⌂</Link>
        <button type="button" className="icon-btn" onClick={() => router.back()} aria-label="뒤로가기">←</button>
      </div>
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
