import './globals.css'

export const metadata = {
  title: 'Harim Team Nexus',
  description: 'Enterprise Team Management Platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}