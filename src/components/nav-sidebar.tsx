'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { createInvite, type InviteState } from '@/app/(family)/invite/actions'
import { isOperatorOrAdmin } from '@/lib/auth/permissions'
import { useToast } from './toast-provider'
import type { Profile } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: '▦' },
  { href: '/calendar', label: '달력', icon: '📅' },
  { href: '/album', label: '앨범', icon: '🖼' },
  { href: '/budget', label: '가계부', icon: '💳', soon: true },
  { href: '/fridge', label: '냉장고', icon: '❄︎', soon: true },
  { href: '/trip', label: '여행일기', icon: '✈', soon: true },
  { href: '/board', label: '게시판', icon: '🗒', soon: true },
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
          >
            <span className="ic">{item.icon}</span> {item.label}
            {item.soon && <span className="nav-soon">준비중</span>}
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
