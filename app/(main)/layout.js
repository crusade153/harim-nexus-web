import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <Sidebar />
      <main className="flex-1 lg:ml-[240px] flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  )
}