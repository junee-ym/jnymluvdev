'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastContextValue = { showToast: (message: string) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast는 ToastProvider 내부에서만 사용할 수 있어요')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setMessage(null), 2200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${message ? ' show' : ''}`}>{message}</div>
    </ToastContext.Provider>
  )
}
