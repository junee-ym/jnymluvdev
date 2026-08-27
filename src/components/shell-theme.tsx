import type { ReactNode } from 'react'

/** 전 페이지에 One UI 라이트 테마 적용 (예전엔 대시보드/달력만 — 이제 다크 버전 쓰는 페이지 없음). */
export function ShellTheme({ children }: { children: ReactNode }) {
  return (
    <div className="shell" data-theme="oneui-light">
      {children}
    </div>
  )
}
