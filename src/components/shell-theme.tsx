'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/** 대시보드('/')에서만 One UI 라이트 테마 적용, 다른 페이지는 기존 다크 유지. */
export function ShellTheme({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const theme = pathname === '/' ? 'oneui-light' : undefined

  return (
    <div className="shell" data-theme={theme}>
      {children}
    </div>
  )
}
