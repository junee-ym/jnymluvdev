import type { ReactNode } from 'react'
import { requireProfile } from '@/lib/auth/session'
import { NavSidebar } from '@/components/nav-sidebar'
import { Topbar } from '@/components/topbar'
import { ToastProvider } from '@/components/toast-provider'

export default async function FamilyLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile()

  return (
    <ToastProvider>
      <div className="shell">
        <NavSidebar profile={profile} />
        <main className="main">
          <Topbar profile={profile} />
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}
