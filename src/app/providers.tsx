'use client'

import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/lib/auth-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            style: { background: '#dcfce7', color: '#166534' },
          },
          error: {
            style: { background: '#fee2e2', color: '#991b1b' },
          },
        }}
      />
      {children}
    </AuthProvider>
  )
}
