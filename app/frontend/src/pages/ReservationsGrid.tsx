import { useState } from 'react'
import { useBuildings, useReservations } from '../hooks/queries/useReservations'
import { ReservationCell } from '../components/ReservationCell'

export function ReservationsGridPage() {
  // State for selected building and month/year
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('')
  
  // Default to current month and year
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // JavaScript months are 0-indexed
  
  // Fetch buildings for the dropdown
  const { data: buildings, isLoading: isLoadingBuildings } = useBuildings()
  
  // Fetch reservations for the selected building and month
  const { 
    data: reservationsData, 
    isLoading: isLoadingReservations,
    error 
  } = useReservations(selectedBuildingId, year, month)
  
  // Handle building selection
  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBuildingId(e.target.value)
  }
  
  // Handle month change
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMonth(parseInt(e.target.value))
  }
  
  // Handle year change
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setYear(parseInt(e.target.value))
  }
  
  // Generate array of dates for the selected month/year
  const getDaysInMonth = (year: number, month: number): Date[] => {
    const days = []
    const daysInMonth = new Date(year, month, 0).getDate()
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month - 1, day))
    }
    
    return days
  }
  
  const daysInMonth = getDaysInMonth(year, month)
  
  // Format date as YYYY-MM-DD for lookup in reservationsByDay
  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Cuadrícula de Reservaciones</h1>
      
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Building selector */}
        <div className="w-full md:w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Edificio
          </label>
          <select
            value={selectedBuildingId}
            onChange={handleBuildingChange}
            className="w-full p-2 border border-gray-300 rounded-md"
            disabled={isLoadingBuildings}
          >
            <option value="">Seleccionar un edificio</option>
            {buildings?.map(building => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Month selector */}
        <div className="w-full md:w-1/4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mes
          </label>
          <select
            value={month}
            onChange={handleMonthChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value={1}>Enero</option>
            <option value={2}>Febrero</option>
            <option value={3}>Marzo</option>
            <option value={4}>Abril</option>
            <option value={5}>Mayo</option>
            <option value={6}>Junio</option>
            <option value={7}>Julio</option>
            <option value={8}>Agosto</option>
            <option value={9}>Septiembre</option>
            <option value={10}>Octubre</option>
            <option value={11}>Noviembre</option>
            <option value={12}>Diciembre</option>
          </select>
        </div>
        
        {/* Year selector */}
        <div className="w-full md:w-1/4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Año
          </label>
          <select
            value={year}
            onChange={handleYearChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {(error as Error).message}
        </div>
      )}
      
      {/* Loading state */}
      {isLoadingReservations && selectedBuildingId && (
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Cargando reservaciones...</div>
        </div>
      )}
      
      {/* No building selected message */}
      {!selectedBuildingId && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Por favor seleccione un edificio para ver las reservaciones.
        </div>
      )}
      
      {/* Reservations grid */}
      {reservationsData && (
        <div className="overflow-auto max-h-[70vh] border border-gray-200 rounded-lg" style={{ position: 'relative' }}>
          <table className="min-w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {/* Apartment column header */}
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px] border-r border-b border-gray-200 bg-gray-50"
                  style={{ 
                    position: 'sticky', 
                    left: 0, 
                    top: 0, 
                    zIndex: 30,
                    boxShadow: 'inset -8px 0 8px -8px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  Apartamento
                </th>
                
                {/* Date column headers */}
                {daysInMonth.map(date => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <th 
                      key={date.toISOString()} 
                      className={`p-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-[80px] ${isWeekend ? 'bg-gray-100' : 'bg-gray-50'}`}
                      style={{ position: 'sticky', top: 0, zIndex: 20 }}
                    >
                      <div className="font-bold">{date.getDate()}</div>
                      <div>
                        {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            
            <tbody>
              {reservationsData.building.apartments.map(apartment => (
                <tr key={apartment.id}>
                  {/* Apartment cell */}
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-b border-gray-200 bg-white"
                    style={{ 
                      position: 'sticky', 
                      left: 0, 
                      zIndex: 20,
                      boxShadow: '4px 0 6px -2px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {apartment.code || apartment.raw_text}
                  </td>
                  
                  {/* Reservation cells for each day */}
                  {daysInMonth.map(date => {
                    const dateKey = formatDateKey(date)
                    const reservation = reservationsData.reservationsByDay[dateKey]?.[apartment.id]
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    
                    return (
                      <td 
                        key={`${apartment.id}-${dateKey}`} 
                        className={`p-0 text-sm text-center border-b border-gray-200 ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}
                      >
                        <ReservationCell 
                          reservation={reservation} 
                          date={date}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}