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
  
  // Base cell styling - width adjusted for rate text
  const cellStyle: React.CSSProperties = {
    position: 'relative',
    height: '50px',
    width: '60px',
    padding: '3px',
    backgroundColor: isWeekend ? '#f9fafb' : 'white', // Light gray for weekends
    borderColor: isWeekend ? '#e5e7eb' : '#e5e7eb', // Slightly darker border for weekends
    borderWidth: '1px',
    borderStyle: 'solid',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  }
  
  // Color triangle styling (positioned diagonally in the corner)
  const triangleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderWidth: '0 60px 50px 0', // Creates a triangle in the top-right corner - adjusted for cell dimensions
    borderColor: `transparent ${reservation?.color_hex || 'transparent'} transparent transparent`,
    zIndex: 0,
    opacity: 0.9, // Slightly transparent for better text visibility
  }
  
  // Format the rate for display
  const formatRate = (rate: number) => {
    if (rate <= 0) return '';
    return `$${rate}`;
  }
  
  // Handle click to navigate to booking detail
  const handleClick = () => {
    if (reservation && reservation.booking_id) {
      navigate({
        to: '/bookings/$bookingId',
        params: { bookingId: reservation.booking_id },
      })
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
        className="group"
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
        
        {/* Date indicator in top-left corner - visible only on hover */}
        <div className="absolute top-1 left-1 text-xs font-medium z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="bg-white px-1 py-0.5 rounded-sm text-gray-700 shadow-sm">
            {date.getDate()}
          </span>
        </div>
        
        {/* Envelope icon for bookings with communications */}
        {reservation?.has_communication && (
          <div className="absolute top-3.5 left-1 text-xs font-medium z-10">
            <span className="p-0.5 rounded-sm text-gray-600 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
        )}
        
        {/* Rate display with tooltip for comments */}
        {reservation && reservation.rate > 0 && (
          <div 
            className="absolute bottom-1 right-1 font-medium text-xs text-right z-10"
            {...(reservation.comment ? {
              onMouseEnter: (e) => tooltipHandlers.onMouseEnter(e, reservation.comment || ''),
              onMouseLeave: tooltipHandlers.onMouseLeave,
              onFocus: (e) => tooltipHandlers.onFocus(e, reservation.comment || ''),
              onBlur: tooltipHandlers.onBlur
            } : {})}
          >
            <span className={`bg-white bg-opacity-80 px-1 py-0.5 rounded ${reservation.comment ? 'cursor-help border-b border-dotted border-gray-400' : ''}`}>
              {formatRate(reservation.rate)}
            </span>
          </div>
        )}
      </div>
      {Tooltip}
    </>
  )
}