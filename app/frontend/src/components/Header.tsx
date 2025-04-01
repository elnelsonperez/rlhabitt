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
                to="/"
                activeProps={{ className: 'font-bold text-white' }}
                inactiveProps={{ className: 'text-gray-300 hover:text-white' }}
              >
                Dashboard
              </Link>
              <Link
                to="/reservations"
                activeProps={{ className: 'font-bold text-white' }}
                inactiveProps={{ className: 'text-gray-300 hover:text-white' }}
              >
                Reservations
              </Link>
            </nav>
          )}
        </div>
        
        {user && (
          <div className="flex items-center gap-4">
            <span>{user.email}</span>
            <button 
              onClick={() => logout()} 
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}