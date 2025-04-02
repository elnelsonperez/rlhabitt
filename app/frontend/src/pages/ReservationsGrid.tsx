import { useState, useEffect } from 'react'
import { useReservations } from '../hooks/queries/useReservations'
import { useBuildings } from '../hooks/queries/useBuildings'
import { ReservationCell } from '../components/ReservationCell'
import { TimeframeSelector } from '../components/TimeframeSelector'
import { useNavigate, useSearch } from '@tanstack/react-router'


// Default to current month and year
const now = new Date()

export function ReservationsGridPage() {
  const navigate = useNavigate({from: '/reservations'})
  const search = useSearch({from: '/layout/reservations'})

  // State for full screen mode
  const [isFullScreen, setIsFullScreen] = useState(false)
  
  // Toggle full screen mode
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen)
  }

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
  
  // Select first building by default when buildings load and none is already selected
  useEffect(() => {
    if (buildings?.length && !selectedBuildingId && !search.buildingId) {
      setSelectedBuildingId(buildings[0].id)
    }
  }, [buildings, selectedBuildingId, search.buildingId])
  
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
  
  // Effect to add/remove full-screen class to body
  useEffect(() => {
    if (isFullScreen) {
      document.body.classList.add('fullscreen-mode')
    } else {
      document.body.classList.remove('fullscreen-mode')
    }
    
    return () => {
      document.body.classList.remove('fullscreen-mode')
    }
  }, [isFullScreen])

  return (
    <div className={`${isFullScreen ? 'fixed inset-0 z-50 bg-white' : 'container mx-auto p-4'}`}>
      {/* Controls container - Time Period and Buildings side by side */}
      <div className={`flex flex-wrap justify-between items-center gap-4 ${isFullScreen ? 'p-3' : 'mb-4'}`}>
        <div className="flex gap-2 items-center">
          {/* Time Period Controls */}
          <TimeframeSelector
            month={month}
            year={year}
            onMonthChange={setMonth}
            onYearChange={setYear}
          />
          
          {/* Full Screen Toggle Button */}
          <button
            onClick={toggleFullScreen}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 focus:outline-none"
            title={isFullScreen ? "Exit Full Screen" : "Full Screen Mode"}
          >
            {isFullScreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Building selector - Cards */}
        <div className="flex flex-wrap gap-2">
          {isLoadingBuildings ? (
            <div className="p-2 text-gray-500">Cargando edificios...</div>
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
        <div 
          className={`overflow-auto border border-gray-200 rounded-lg ${isFullScreen ? 'absolute inset-x-0 bottom-0 top-[60px]' : 'max-h-[75vh]'}`} 
          style={{ position: 'relative', paddingBottom: '16px' }}
        >
          <table className="min-w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {/* Apartment column header */}
                <th 
                  className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px] border-b border-gray-200 bg-gray-50"
                  style={{ 
                    position: 'sticky', 
                    left: 0, 
                    top: 0,
                    zIndex: 30,
                    boxShadow: 'rgb(0 0 0 / 35%) -8px 0px 3px -8px inset, rgba(0, 0, 0, 0.08) 3px 0px 5px -8px'
                  }}
                >
                  <div className="text-xs">Apartamento</div>
                  <div className="text-[9px] font-normal text-gray-400">Propietario</div>
                </th>

                {/* Date column headers */}
                {daysInMonth.map(date => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <th
                      key={date.toISOString()}
                      className={`p-0.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-[60px] ${isWeekend ? 'bg-gray-100' : 'bg-gray-50'}`}
                      style={{ position: 'sticky', top: 0, zIndex: 20 }}
                    >
                      <div className="font-bold text-xs">{date.getDate()}</div>
                      <div className="text-[9px]">
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
                    className="z-20 px-2 py-1 whitespace-normal text-xs font-medium text-gray-900 border-b border-gray-200 bg-white"
                    style={{
                      position: 'sticky',
                      left: 0,
                      height: '50px',
                      boxShadow: 'rgb(0 0 0 / 35%) -8px 0px 3px -8px inset, rgba(0, 0, 0, 0.08) 3px 0px 5px -8px'
                    }}
                  >
                    <div className="font-medium">
                      {apartment.code || apartment.raw_text}
                    </div>
                    {apartment.owners && apartment.owners.name !== (apartment.code || apartment.raw_text) && (
                      <div className="text-[9px] text-gray-500 truncate">
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