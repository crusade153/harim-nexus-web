import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Harim Team Nexus | 통합 워크스페이스',
  description: '하림 팀 협업 플랫폼 - 업무관리, 게시판, 일정관리',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning>
        {children}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(17, 24, 39, 0.95)',
              color: '#fff',
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              padding: '16px',
            },
          }}
        />
      </body>
    </html>
  )
}