import { Reservation } from '../hooks/queries/useReservations'
import { useNavigate } from '@tanstack/react-router'
import { useTooltip } from './CustomTooltip'

interface ReservationCellProps {
  reservation: Reservation | undefined
  date: Date
}

export function ReservationCell({ reservation, date }: ReservationCellProps) {
  const navigate = useNavigate()
  const { Tooltip, tooltipHandlers } = useTooltip(100) // 100ms delay
  
  // Weekend styling (Saturday or Sunday)
  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  
  // Base cell styling
  const cellStyle: React.CSSProperties = {
    position: 'relative',
    height: '80px',
    width: '80px',
    padding: '4px',
    backgroundColor: isWeekend ? '#f9fafb' : 'white', // Light gray for weekends
    borderColor: isWeekend ? '#e5e7eb' : '#e5e7eb', // Slightly darker border for weekends
    borderWidth: '1px',
    borderStyle: 'solid',
    overflow: 'hidden',
  }
  
  // Color triangle styling (positioned diagonally in the corner)
  const triangleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderWidth: '0 80px 80px 0', // Creates a triangle in the top-right corner
    borderColor: `transparent ${reservation?.color_hex || 'transparent'} transparent transparent`,
    zIndex: 0,
    opacity: 0.9, // Slightly transparent for better text visibility
  }
  
  // Format the rate for display
  const formatRate = (rate: number) => {
    if (rate <= 0) return '';
    return `$${rate}`;
  }
  
  // Handle click to navigate to reservation detail
  const handleClick = () => {
    if (reservation) {
      navigate({ to: `/reservations/${reservation.id}` })
    }
  }
  
  // Modify base cell style for interactive behavior
  const interactiveCellStyle: React.CSSProperties = {
    ...cellStyle,
    cursor: reservation ? 'pointer' : 'default',
  }
  
  return (
    <>
      <div 
        style={interactiveCellStyle}
        onClick={reservation ? handleClick : undefined}
        onKeyDown={(e) => {
          if (reservation && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            handleClick()
          }
        }}
        tabIndex={reservation ? 0 : -1}
        role={reservation ? 'button' : undefined}
        aria-label={reservation ? `View reservation for ${date.toDateString()}` : undefined}
      >
        {/* Color triangle in corner */}
        {reservation?.color_hex && <div style={triangleStyle}></div>}
        
        {/* Date indicator in top-left corner */}
        <div className="absolute top-1 left-1 text-xs font-medium text-gray-700 z-10">
          {date.getDate()}
        </div>
        
        {/* Rate display */}
        {reservation && reservation.rate > 0 && (
          <div className="absolute bottom-1 right-1 font-medium text-sm text-right z-10">
            <span className="bg-white bg-opacity-80 px-1 py-0.5 rounded">
              {formatRate(reservation.rate)}
            </span>
          </div>
        )}
        
        {/* Comment indicator with custom tooltip */}
        {reservation?.comment && (
          <div 
            className="absolute bottom-1 left-1 text-xs z-10"
            onMouseEnter={(e) => tooltipHandlers.onMouseEnter(e, reservation.comment || '')}
            onMouseLeave={tooltipHandlers.onMouseLeave}
            onFocus={(e) => tooltipHandlers.onFocus(e, reservation.comment || '')}
            onBlur={tooltipHandlers.onBlur}
          >
            <span 
              className="cursor-help hover:bg-gray-100 rounded-full inline-block w-5 h-5 text-center" 
            >
              💬
            </span>
          </div>
        )}
      </div>
      {Tooltip}
    </>
  )
}