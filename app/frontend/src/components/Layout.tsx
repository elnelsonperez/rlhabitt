import { Outlet } from '@tanstack/react-router'
import { Header } from './Header'
import { NotificationsBar } from './NotificationsBar'
import { useAuthStore } from '../store/auth'
import { useEffect } from 'react'

// Add global styles for fullscreen mode
const fullscreenStyles = `
  body.fullscreen-mode header,
  body.fullscreen-mode .notification-bar {
    display: none;
  }
  
  body.fullscreen-mode main {
    padding: 0 !important;
  }
`

export function AppLayout() {
  const { isLoading } = useAuthStore()
  
  // Add the fullscreen style to the document head
  useEffect(() => {
    const styleTag = document.createElement('style')
    styleTag.innerHTML = fullscreenStyles
    document.head.appendChild(styleTag)
    
    return () => {
      document.head.removeChild(styleTag)
      document.body.classList.remove('fullscreen-mode')
    }
  }, [])
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-700">
          <div className="flex items-center justify-center mb-4">
            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          Loading...
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Header />
      <NotificationsBar pollingInterval={120000} />
      <main className="flex-1 p-4 pt-6 mt-[64px]">
        <div className="pt-2"> {/* Extra padding when notification bar is present */}
          <Outlet />
        </div>
      </main>
    </div>
  )
}