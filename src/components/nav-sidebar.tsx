'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { createInvite, type InviteState } from '@/app/(family)/invite/actions'
import { isOperatorOrAdmin } from '@/lib/auth/permissions'
import { useToast } from './toast-provider'
import type { Profile } from '@/lib/types'

// One UI List 컴포넌트 가이드: "관련 항목을 시각적으로 묶을 때 subheader 사용" —
// 실사용 가능한 메뉴와 준비중인 메뉴를 subheader로 분리해 나열(docs/design/DESIGN-samsung.md 참고).
const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: '▦' },
  { href: '/calendar', label: '달력', icon: '📅' },
  { href: '/album', label: '앨범', icon: '🖼' },
]
const NAV_ITEMS_SOON = [
  { href: '/budget', label: '가계부', icon: '💳' },
  { href: '/fridge', label: '냉장고', icon: '❄︎' },
  { href: '/trip', label: '여행일기', icon: '✈' },
  { href: '/board', label: '게시판', icon: '🗒' },
]

const initialInviteState: InviteState = { error: null, success: null }

export function NavSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const { showToast } = useToast()
  const [state, formAction, pending] = useActionState(createInvite, initialInviteState)

  useEffect(() => {
    if (state.success) showToast(state.success)
    if (state.error) showToast(state.error)
  }, [state, showToast])

  return (
    <aside className="side">
      <div className="brand">
        <div className="brand-mark">우</div>
        <div>
          <div className="brand-name">우리집</div>
          <div className="brand-sub">가족 일상 기록</div>
        </div>
      </div>

      <nav>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${pathname === item.href ? ' active' : ''}`}
            onClick={() => {
              const toggle = document.getElementById('mobile-nav-toggle') as HTMLInputElement | null
              if (toggle) toggle.checked = false
            }}
          >
            <span className="ic">{item.icon}</span> {item.label}
          </Link>
        ))}
        <div className="nav-subheader">준비중</div>
        {NAV_ITEMS_SOON.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${pathname === item.href ? ' active' : ''}`}
            onClick={() => {
              const toggle = document.getElementById('mobile-nav-toggle') as HTMLInputElement | null
              if (toggle) toggle.checked = false
            }}
          >
            <span className="ic">{item.icon}</span> {item.label}
            <span className="nav-soon">준비중</span>
          </Link>
        ))}
      </nav>

      {isOperatorOrAdmin(profile.role) && (
        <div className="side-foot">
          <form action={formAction} className="invite-card">
            <b>가족 초대하기</b>
            이메일로 초대 메일을 보내요.
            <input type="email" name="email" placeholder="이메일" required style={{ marginTop: 8, width: '100%' }} />
            <select name="role" defaultValue="USER" style={{ marginTop: 6, width: '100%' }}>
              <option value="USER">사용자</option>
              <option value="OPERATOR">운영자</option>
            </select>
            <button type="submit" className="invite-btn" disabled={pending}>
              {pending ? '보내는 중...' : '초대 링크 만들기'}
            </button>
          </form>
        </div>
      )}
    </aside>
  )
}
