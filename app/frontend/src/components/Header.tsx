import { useState, useRef, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'

export function Header() {
  const { user, logout } = useAuthStore()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  
  return (
    <header className="bg-gray-800 text-white p-4 fixed top-0 left-0 right-0 z-50 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <div className="text-xl font-bold">RL HABITT</div>
          
          {/* Navigation Links */}
          {user && (
            <nav className="flex space-x-2">
              <Link
                to="/reservations"
                search={{}}
                activeProps={{ 
                  className: 'flex items-center bg-blue-700 text-white rounded-md p-2 overflow-hidden transition-all duration-300 ease-in-out w-[9.5rem] group'
                }}
                inactiveProps={{ 
                  className: 'flex items-center bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-md p-2 overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-[9.5rem] group'
                }}
                children={({ isActive }) => (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className={`ml-2 whitespace-nowrap transition-opacity duration-300 ease-in-out ${isActive ? 'opacity-100 w-auto' : 'opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto'}`}>
                      Reservas
                    </span>
                  </>
                )}
              />
              
              <Link
                to="/communications"
                activeProps={{ 
                  className: 'flex items-center bg-blue-700 text-white rounded-md p-2 overflow-hidden transition-all duration-300 ease-in-out w-[12rem] group'
                }}
                inactiveProps={{ 
                  className: 'flex items-center bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-md p-2 overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-[12rem] group'
                }}
                children={({ isActive }) => (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className={`ml-2 whitespace-nowrap transition-opacity duration-300 ease-in-out ${isActive ? 'opacity-100 w-auto' : 'opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto'}`}>
                      Comunicaciones
                    </span>
                  </>
                )}
              />
              
              <Link
                to="/apartments"
                activeProps={{ 
                  className: 'flex items-center bg-blue-700 text-white rounded-md p-2 overflow-hidden transition-all duration-300 ease-in-out w-[11rem] group'
                }}
                inactiveProps={{ 
                  className: 'flex items-center bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-md p-2 overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-[11rem] group'
                }}
                children={({ isActive }) => (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className={`ml-2 whitespace-nowrap transition-opacity duration-300 ease-in-out ${isActive ? 'opacity-100 w-auto' : 'opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto'}`}>
                      Apartamentos
                    </span>
                  </>
                )}
              />
            </nav>
          )}
          
        </div>
        
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">{user.email}</span>
            
            {/* Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setShowMenu(!showMenu)} 
                className="text-gray-400 hover:text-gray-200 text-sm px-2 py-1 rounded-md border border-gray-700 hover:border-gray-600 transition-colors"
                title="Opciones"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                  />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 mt-2 py-2 w-48 bg-white rounded-md shadow-lg z-50">
                  <Link
                    to="/import"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMenu(false)}
                  >
                    Importar Datos
                  </Link>
                  <hr className="my-1 border-gray-200" />
                  <button
                    onClick={() => {
                      logout();
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}