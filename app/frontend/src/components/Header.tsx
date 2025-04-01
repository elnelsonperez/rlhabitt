import { useAuthStore } from '../store/auth'

export function Header() {
  const { user, logout } = useAuthStore()
  
  return (
    <header className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold">RL HABITT</div>
        
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