import { useState, useEffect } from 'react'
import { useBuildings, useReservations } from '../hooks/queries/useReservations'
import { ReservationCell } from '../components/ReservationCell'
import { TimeframeSelector } from '../components/TimeframeSelector'
import { useNavigate, useSearch } from '@tanstack/react-router'

export function ReservationsGridPage() {
  const navigate = useNavigate({from: '/reservations'})
  const search = useSearch({from: '/layout/reservations'})
  
  // Default to current month and year
  const now = new Date()
  
  // Initialize state from URL params or defaults
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    search.buildingId || ''
  )
  
  const [year, setYear] = useState<number>(
    search.year ? parseInt(search.year) : now.getFullYear()
  )
  
  const [month, setMonth] = useState<number>(
    search.month ? parseInt(search.month) : now.getMonth() + 1
  )
  
  // Fetch buildings for the dropdown
  const { data: buildings, isLoading: isLoadingBuildings } = useBuildings()
  
  // Fetch reservations for the selected building and month
  const { 
    data: reservationsData, 
    isLoading: isLoadingReservations,
    error 
  } = useReservations(selectedBuildingId, year, month)
  
  // Update URL when parameters change
  useEffect(() => {
    navigate({
      search: {
        buildingId: selectedBuildingId || undefined,
        year: year.toString(),
        month: month.toString(),
      },
      replace: true
    });
  }, [selectedBuildingId, year, month, navigate]);
  
  // Handle building selection
  const handleBuildingChange = (buildingId: string) => {
    setSelectedBuildingId(buildingId)
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
      {/* Time Period Controls - Centered at the top */}
      <div className="flex justify-center mb-6">
        <TimeframeSelector
          month={month}
          year={year}
          onMonthChange={setMonth}
          onYearChange={setYear}
        />
      </div>
      
      {/* Building selector - Cards */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2 text-center">Edificios</h2>
        <div className="flex flex-wrap gap-2 justify-center">
          {isLoadingBuildings ? (
            <div className="w-full p-4 text-center text-gray-500">Cargando edificios...</div>
          ) : (
            <>
              {/* Individual building cards */}
              {buildings?.map(building => (
                <button
                  key={building.id}
                  onClick={() => handleBuildingChange(building.id)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${selectedBuildingId === building.id 
                      ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                      : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'}
                  `}
                >
                  <span>{building.name}</span>
                </button>
              ))}
            </>
          )}
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
        <div className="overflow-auto max-h-[75vh] border border-gray-200 rounded-lg" style={{ position: 'relative' }}>
          <table className="min-w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {/* Apartment column header */}
                <th 
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px] border-b border-gray-200 bg-gray-50"
                  style={{ 
                    position: 'sticky', 
                    left: 0, 
                    top: 0,
                    zIndex: 30,
                    boxShadow: 'rgb(0 0 0 / 35%) -8px 0px 3px -8px inset, rgba(0, 0, 0, 0.08) 3px 0px 5px -8px'
                  }}
                >
                  <div>Apartamento</div>
                  <div className="text-[10px] font-normal text-gray-400">Propietario</div>
                </th>

                {/* Date column headers */}
                {daysInMonth.map(date => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <th
                      key={date.toISOString()}
                      className={`p-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-[60px] ${isWeekend ? 'bg-gray-100' : 'bg-gray-50'}`}
                      style={{ position: 'sticky', top: 0, zIndex: 20 }}
                    >
                      <div className="font-bold">{date.getDate()}</div>
                      <div className="text-[10px]">
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
                    className="z-20 px-4 py-2 whitespace-normal text-sm font-medium text-gray-900 border-b border-gray-200 bg-white"
                    style={{
                      position: 'sticky',
                      left: 0,
                      boxShadow: 'rgb(0 0 0 / 35%) -8px 0px 3px -8px inset, rgba(0, 0, 0, 0.08) 3px 0px 5px -8px'
                    }}
                  >
                    <div className="font-medium">
                      {apartment.code || apartment.raw_text}
                    </div>
                    {apartment.owners && apartment.owners.name !== (apartment.code || apartment.raw_text) && (
                      <div className="text-xs text-gray-500 truncate">
                        {apartment.owners.name}
                      </div>
                    )}
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