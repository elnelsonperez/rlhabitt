import { useAuthStore } from '../store/auth'

export function HomePage() {
  const { user } = useAuthStore()
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to RL HABITT</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
        
        <div className="bg-gray-100 p-4 rounded mb-4">
          <p className="font-medium">Logged in as: {user?.email}</p>
        </div>
        
        <p className="text-gray-700">
          This is a placeholder dashboard page. Real functionality will be implemented in future updates.
        </p>
      </div>
    </div>
  )
}