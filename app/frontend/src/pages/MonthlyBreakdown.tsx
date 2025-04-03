import { useState, useEffect } from 'react';
import { Link, useSearch, useNavigate } from '@tanstack/react-router';
import { 
  useOwnerMonthlyBookings, 
  useCreateMonthlyBreakdown,
  useBookingReservations
} from '../hooks/queries/useCommunications';
import { BookingForMonthlyBreakdown } from '../lib/api/commsClient';

// Helper function to format dates
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Individual booking row for owner summary
interface BookingRowProps {
  booking: BookingForMonthlyBreakdown;
  isChecked: boolean;
  onToggleSelection: (bookingId: string) => void;
}

const BookingRow = ({ booking, isChecked, onToggleSelection }: BookingRowProps) => {
  // Fetch reservation rates for this booking to show accurate amount
  const { data: reservations } = useBookingReservations(booking.id);
  
  // Calculate the total rate from reservations - only when we have data
  const calculatedRate = reservations?.reduce((sum, res) => sum + (parseFloat(String(res.rate)) || 0), 0) || 0;
  
  return (
    <tr className={isChecked ? '' : 'bg-gray-50 text-gray-400'}>
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleSelection(booking.id)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {booking.apartment?.code || 'Desconocido'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {booking.guest?.name || 'Desconocido'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {booking.check_in ? formatDate(booking.check_in) : 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {booking.check_out ? formatDate(booking.check_out) : 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {booking.nights || 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap relative">
        {/* Show the sum of reservation rates */}
        {reservations ? (
          <div className="flex items-center">
            <span className="font-medium">${calculatedRate.toFixed(2)}</span>
            {reservations.length > 0 && (
              <span className="ml-1 text-xs text-green-600">({reservations.length} reservas)</span>
            )}
          </div>
        ) : (
          <span className="italic text-gray-400">Cargando...</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap relative">
        <span className="font-medium">${booking.total_amount?.toFixed(2) || '0.00'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {booking.has_communication ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Enviado
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Pendiente
          </span>
        )}
      </td>
    </tr>
  );
};

export function MonthlyBreakdownPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/layout/monthly-breakdown' });
  
  // Parse search params
  const ownerId = search.ownerId as string;
  const year = parseInt(search.year as string || new Date().getFullYear().toString());
  const month = parseInt(search.month as string || (new Date().getMonth() + 1).toString());
  
  // Local state
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState<string>('');
  
  // Fetch owner's bookings for the month
  const { 
    data, 
    isLoading, 
    error 
  } = useOwnerMonthlyBookings(ownerId, year, month);
  
  // Create monthly breakdown mutation
  const createMutation = useCreateMonthlyBreakdown();
  
  // Initialize selected bookings when data loads (pre-select all non-communicated bookings)
  useEffect(() => {
    if (data?.bookings) {
      const nonCommunicatedBookingIds = data.bookings
        .filter(booking => !booking.has_communication)
        .map(booking => booking.id);
      
      setSelectedBookingIds(nonCommunicatedBookingIds);
    }
  }, [data]);
  
  // Toggle booking selection
  const toggleBookingSelection = (bookingId: string) => {
    setSelectedBookingIds(prev => 
      prev.includes(bookingId)
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  };
  
  // Handle select/deselect all
  const handleSelectAll = () => {
    if (!data?.bookings) return;
    
    const allBookingIds = data.bookings.map(booking => booking.id);
    setSelectedBookingIds(allBookingIds);
  };
  
  const handleDeselectAll = () => {
    setSelectedBookingIds([]);
  };
  
  // Create monthly breakdown
  const handleCreateBreakdown = () => {
    if (!data?.owner || selectedBookingIds.length === 0) return;
    
    // Create date range for the report period
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    createMutation.mutate({
      ownerId: data.owner.id,
      bookingIds: selectedBookingIds,
      customMessage: customMessage.trim() || undefined,
      reportPeriod: {
        start: startDate,
        end: endDate
      }
    }, {
      onSuccess: (result) => {
        // Navigate to the communication detail page
        navigate({
          to: '/communications/$communicationId',
          params: { communicationId: result.communicationId }
        });
      }
    });
  };
  
  // Get month name for display
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Resumen Mensual para Propietario: {data?.owner?.name || 'Cargando...'}
        </h1>
        <Link
          to="/reservations"
          className="text-blue-500 hover:underline"
        >
          Volver a Reservas
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            Reservas para {monthName} {year}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Seleccione las reservas que desea incluir en el resumen para este propietario.
          </p>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div>
            <p className="mt-2 text-gray-600">Cargando reservas...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  Error al cargar las reservas: {(error as Error).message}
                </p>
              </div>
            </div>
          </div>
        ) : data?.bookings.length === 0 ? (
          <div className="text-center py-8 border border-gray-200 rounded-md">
            <p className="text-gray-500">No hay reservas para este propietario en el periodo seleccionado.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between mb-4">
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                >
                  Seleccionar todo
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                >
                  Deseleccionar todo
                </button>
              </div>
              <p className="text-sm text-gray-500">
                {selectedBookingIds.length} de {data?.bookings?.length || 0} reservas seleccionadas
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Incluir
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Apartamento
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Huésped
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entrada
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Salida
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Noches
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Importe
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pagado por cliente
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.bookings?.map(booking => (
                    <BookingRow 
                      key={booking.id}
                      booking={booking}
                      isChecked={selectedBookingIds.includes(booking.id)}
                      onToggleSelection={toggleBookingSelection}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      
      {/* Custom message and create button */}
      {data?.bookings && data.bookings.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <label htmlFor="custom-message" className="block text-sm font-medium text-gray-700 mb-1">
              Mensaje Personalizado (opcional)
            </label>
            <textarea
              id="custom-message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Añadir mensaje personalizado a esta comunicación..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
            <p className="mt-2 text-sm text-gray-500">
              Este mensaje se incluirá en el correo enviado al propietario.
            </p>
          </div>
          
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreateBreakdown}
              disabled={selectedBookingIds.length === 0 || createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {createMutation.isPending ? 'Creando...' : 'Crear Resumen Mensual'}
            </button>
          </div>
          
          {createMutation.isError && (
            <div className="mt-4 p-3 bg-red-100 text-red-600 rounded-md">
              Error al crear el resumen: {(createMutation.error as Error).message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}