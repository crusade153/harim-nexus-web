import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Harim Nexus | Workspace',
  description: '팀 협업 워크스페이스',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen text-slate-800">
          {children}
        </div>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#334155',
              color: '#fff',
              fontSize: '14px',
            },
          }}
        />
      </body>
    </html>
  )
}