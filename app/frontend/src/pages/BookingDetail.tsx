import {useParams, Link} from '@tanstack/react-router'
import { useBookingDetail } from '../hooks/queries/useBookingDetail'

export function BookingDetailPage() {
  const { bookingId } = useParams({ from: '/layout/bookings/$bookingId' })
  const { data, isLoading, error } = useBookingDetail(bookingId)

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Cargando detalles de la reserva...</div>
        </div>
      </div>
    )
  }
  
  if (error || !data) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {(error as Error)?.message || 'No se pudieron cargar los detalles de la reserva'}
        </div>
        <Link to="/reservations" className="text-blue-500 hover:underline">
          &larr; Volver a Reservaciones
        </Link>
      </div>
    )
  }
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link to="/reservations" className="text-blue-500 hover:underline">
          &larr; Volver a Reservaciones
        </Link>
      </div>
      
      <h1 className="text-2xl font-bold mb-6">
        Detalles de la Reserva
      </h1>
      
      {/* Main details card */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-4 border-b bg-blue-100">
          <div className="bg-white bg-opacity-90 p-4 rounded">
            <h2 className="text-xl font-bold mb-2">
              {data.apartment?.code || data.apartment?.raw_text} - {formatDate(data.booking?.check_in || '')}
            </h2>
            <p className="text-gray-600">
              {data.building?.name}
            </p>
          </div>
        </div>
        
        {/* Booking details */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Reserva</h3>
              <dl className="grid grid-cols-1 gap-2">
                {data.booking?.check_in && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Entrada</dt>
                    <dd className="col-span-2">{formatDate(data.booking.check_in)}</dd>
                  </div>
                )}
                {data.booking?.check_out && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Salida</dt>
                    <dd className="col-span-2">{formatDate(data.booking.check_out)}</dd>
                  </div>
                )}
                {data.booking?.nights && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Noches</dt>
                    <dd className="col-span-2">{data.booking.nights}</dd>
                  </div>
                )}
                {data.booking?.total_amount && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Monto Total</dt>
                    <dd className="col-span-2">${data.booking.total_amount}</dd>
                  </div>
                )}
                {data.booking?.reference_code && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Código de Referencia</dt>
                    <dd className="col-span-2">{data.booking.reference_code}</dd>
                  </div>
                )}
                {data.booking?.comment && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Comentario</dt>
                    <dd className="col-span-2 whitespace-pre-wrap">{data.booking.comment}</dd>
                  </div>
                )}
              </dl>
              
              <h3 className="text-lg font-semibold mt-6 mb-3">Apartamento</h3>
              <dl className="grid grid-cols-1 gap-2">
                <div className="py-2 grid grid-cols-3 border-b">
                  <dt className="text-gray-500">Edificio</dt>
                  <dd className="col-span-2">{data.building?.name}</dd>
                </div>
                <div className="py-2 grid grid-cols-3 border-b">
                  <dt className="text-gray-500">Apartamento</dt>
                  <dd className="col-span-2">{data.apartment?.code || data.apartment?.raw_text}</dd>
                </div>
                {data.owner && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Propietario</dt>
                    <dd className="col-span-2">{data.owner.name}</dd>
                  </div>
                )}
              </dl>
            </div>
            
            <div>
              {data.guest && (
                <>
                  <h3 className="text-lg font-semibold mb-3">Huésped</h3>
                  <dl className="grid grid-cols-1 gap-2">
                    <div className="py-2 grid grid-cols-3 border-b">
                      <dt className="text-gray-500">Nombre</dt>
                      <dd className="col-span-2">{data.guest.name}</dd>
                    </div>
                    {data.guest.email && (
                      <div className="py-2 grid grid-cols-3 border-b">
                        <dt className="text-gray-500">Correo</dt>
                        <dd className="col-span-2">{data.guest.email}</dd>
                      </div>
                    )}
                    {data.guest.phone && (
                      <div className="py-2 grid grid-cols-3 border-b">
                        <dt className="text-gray-500">Teléfono</dt>
                        <dd className="col-span-2">{data.guest.phone}</dd>
                      </div>
                    )}
                  </dl>
                </>
              )}
              
              {data.payment_source && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Fuente de Pago</h3>
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Fuente</dt>
                    <dd className="col-span-2">{data.payment_source.name}</dd>
                  </div>
                </div>
              )}
              
              {/* Reservation rates table */}
              {data.reservations && data.reservations.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Tarifa por día</h3>
                  <div className="overflow-hidden border rounded-lg">
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Fecha
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Tarifa
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.reservations.map(reservation => (
                            <tr key={reservation.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(reservation.date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                ${reservation.rate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}