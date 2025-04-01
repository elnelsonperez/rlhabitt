import { useReservations } from '../hooks/queries/useReservations'
import { ReservationCell } from './ReservationCell'
import { useEffect, useRef } from 'react'
import './MonthGrid.css'

interface MonthGridProps {
  buildingId: string
  year: number
  month: number
  // Callback for virtualization
  onLoad: (height: number) => void
}

export function MonthGrid({ buildingId, year, month, onLoad }: MonthGridProps) {
  // Fetch reservations for this month
  const { 
    data: reservationsData, 
    isLoading, 
    error 
  } = useReservations(buildingId, year, month)
  
  // Generate array of dates for the month
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
  
  // Get month name in Spanish
  const getMonthName = (month: number): string => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return monthNames[month - 1]
  }
  
  // Use a ref for the grid container
  const gridRef = useRef<HTMLDivElement>(null)
  
  // Report height after rendering
  useEffect(() => {
    // Add a small delay to ensure layout calculation is complete
    const timeoutId = setTimeout(() => {
      const node = gridRef.current
      if (node && !isLoading && reservationsData) {
        // Report initial height
        onLoad(node.getBoundingClientRect().height)
      }
    }, 50)
    
    return () => clearTimeout(timeoutId)
  }, [isLoading, reservationsData, onLoad])
  
  // Set up ResizeObserver to track grid height changes during interaction
  useEffect(() => {
    const node = gridRef.current
    if (node && !isLoading && reservationsData) {
      // Set up ResizeObserver to track size changes
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          onLoad(entry.contentRect.height)
        }
      })
      
      resizeObserver.observe(node)
      
      // Cleanup observer on unmount
      return () => {
        resizeObserver.disconnect()
      }
    }
  }, [isLoading, reservationsData, onLoad])
  
  if (isLoading) {
    return (
      <div className="month-grid-container" ref={gridRef}>
        <h2 className="text-xl font-bold mb-3">{getMonthName(month)} {year}</h2>
        <div className="h-48 flex justify-center items-center border border-gray-200 rounded-lg">
          <div className="text-gray-500 flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Cargando reservaciones...
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="month-grid-container" ref={gridRef}>
        <h2 className="text-xl font-bold mb-3">{getMonthName(month)} {year}</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {(error as Error).message}
        </div>
      </div>
    )
  }
  
  if (!reservationsData) {
    return (
      <div className="month-grid-container" ref={gridRef}>
        <h2 className="text-xl font-bold mb-3">{getMonthName(month)} {year}</h2>
        <div className="h-48 flex justify-center items-center border border-gray-200 rounded-lg">
          <div className="text-gray-500">No hay datos disponibles</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="month-grid-container" ref={gridRef}>
      <h2 className="text-xl font-bold mb-3">{getMonthName(month)} {year}</h2>
      
      <div className="month-grid-scrollable">
        <div className="inline-block min-w-full">
          <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table className="month-grid-table divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Apartment column header */}
                  <th className="sticky-header">
                    Apartamento
                  </th>
                  
                  {/* Date column headers */}
                  {daysInMonth.map(date => {
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th 
                        key={date.toISOString()} 
                        className={`p-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px] ${isWeekend ? 'bg-gray-100' : ''}`}
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
              
              <tbody className="bg-white divide-y divide-gray-200">
                {reservationsData.building.apartments.map(apartment => (
                  <tr key={apartment.id}>
                    {/* Apartment cell */}
                    <td className="sticky-cell">
                      {apartment.code || apartment.raw_text}
                    </td>
                    
                    {/* Reservation cells for each day */}
                    {daysInMonth.map(date => {
                      const dateKey = formatDateKey(date)
                      const reservation = reservationsData.reservationsByDay[dateKey]?.[apartment.id]
                      
                      return (
                        <td 
                          key={`${apartment.id}-${dateKey}`} 
                          className="p-0 text-sm text-center border-0"
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
        </div>
      </div>
    </div>
  )
}