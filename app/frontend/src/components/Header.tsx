import { Link } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'

export function Header() {
  const { user, logout } = useAuthStore()
  
  return (
    <header className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <div className="text-xl font-bold">RL HABITT</div>
          
          {/* Navigation Links */}
          {user && (
            <nav className="flex space-x-4">
              <Link
                to="/reservations"
                search={{}}
                activeProps={{ className: 'font-bold text-white' }}
                inactiveProps={{ className: 'text-gray-300 hover:text-white' }}
              >
                Tabla de Reservas
              </Link>
              <Link
                to="/import"
                activeProps={{ className: 'font-bold text-white' }}
                inactiveProps={{ className: 'text-gray-300 hover:text-white' }}
              >
                Importar Datos
              </Link>
              <Link
                to="/communications"
                activeProps={{ className: 'font-bold text-white' }}
                inactiveProps={{ className: 'text-gray-300 hover:text-white' }}
              >
                Comunicaciones
              </Link>
            </nav>
          )}
        </div>
        
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">{user.email}</span>
            <button 
              onClick={() => logout()} 
              className="text-gray-400 hover:text-gray-200 text-sm px-2 py-1 rounded-md border border-gray-700 hover:border-gray-600 transition-colors"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}