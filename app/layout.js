import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Harim Nexus | Future Workspace',
  description: '팀 협업의 새로운 차원',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="dark">
      <body>
        <div className="aurora-bg" /> {/* 환상적인 배경 레이어 */}
        <div className="relative z-10 min-h-screen text-slate-200">
          {children}
        </div>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(30, 41, 59, 0.8)',
              backdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
            },
          }}
        />
      </body>
    </html>
  )
}