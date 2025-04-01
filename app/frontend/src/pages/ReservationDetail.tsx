import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase/client'
import { useAuthStore } from '../store/auth'

interface ReservationDetailData {
  reservation: {
    id: string
    date: string
    rate: number
    color_hex: string | null
    comment: string | null
  } | null
  booking: {
    id: string
    check_in: string
    check_out: string | null
    nights: number | null
    total_amount: number | null
    payment_status: string | null
    reference_code: string | null
  } | null
  apartment: {
    id: string
    code: string | null
    raw_text: string
    building_id: string
  } | null
  building: {
    id: string
    name: string
  } | null
  owner: {
    id: string
    name: string
    email: string | null
  } | null
  guest: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
  payment_source: {
    id: string
    name: string
  } | null
}

export function ReservationDetailPage() {
  const { isAuthenticated } = useAuthStore()
  const { reservationId } = useParams({ from: '/layout/reservations/$reservationId' })
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async () => {
      if (!isAuthenticated) {
        throw new Error('Authentication required')
      }
      
      // Fetch reservation with all related data
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, date, rate, color_hex, comment,
          booking:booking_id(
            id, check_in, check_out, nights, total_amount, payment_status, reference_code,
            guest:guest_id(id, name, email, phone),
            payment_source:payment_source_id(id, name)
          ),
          apartment:apartment_id(
            id, code, raw_text, building_id,
            building:building_id(id, name),
            owner:owner_id(id, name, email)
          )
        `)
        .eq('id', reservationId)
        .single()
        
      if (error) {
        throw error
      }
      
      // Format data for easier consumption
      const formattedData: ReservationDetailData = {
        reservation: {
          id: data.id,
          date: data.date,
          rate: data.rate,
          color_hex: data.color_hex,
          comment: data.comment
        },
        booking: data.booking,
        apartment: data.apartment,
        building: data.apartment?.building,
        owner: data.apartment?.owner,
        guest: data.booking?.guest,
        payment_source: data.booking?.payment_source
      }
      
      return formattedData
    },
    enabled: isAuthenticated && !!reservationId
  })
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Cargando detalles de la reservación...</div>
        </div>
      </div>
    )
  }
  
  if (error || !data) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {(error as Error)?.message || 'No se pudieron cargar los detalles de la reservación'}
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
        Detalles de la Reservación
      </h1>
      
      {/* Main details card */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div 
          className="p-4 border-b"
          style={{ backgroundColor: data.reservation?.color_hex || undefined }}
        >
          <div className="bg-white bg-opacity-90 p-4 rounded">
            <h2 className="text-xl font-bold mb-2">
              {data.apartment?.code || data.apartment?.raw_text} - {formatDate(data.reservation?.date || '')}
            </h2>
            <p className="text-gray-600">
              {data.building?.name}
            </p>
          </div>
        </div>
        
        {/* Reservation details */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Reservación</h3>
              <dl className="grid grid-cols-1 gap-2">
                <div className="py-2 grid grid-cols-3 border-b">
                  <dt className="text-gray-500">Fecha</dt>
                  <dd className="col-span-2">{formatDate(data.reservation?.date || '')}</dd>
                </div>
                <div className="py-2 grid grid-cols-3 border-b">
                  <dt className="text-gray-500">Tarifa</dt>
                  <dd className="col-span-2">${data.reservation?.rate}</dd>
                </div>
                {data.reservation?.comment && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Comentario</dt>
                    <dd className="col-span-2 whitespace-pre-wrap">{data.reservation.comment}</dd>
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
                {data.booking?.payment_status && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Estado de Pago</dt>
                    <dd className="col-span-2">{data.booking.payment_status}</dd>
                  </div>
                )}
                {data.booking?.reference_code && (
                  <div className="py-2 grid grid-cols-3 border-b">
                    <dt className="text-gray-500">Código de Referencia</dt>
                    <dd className="col-span-2">{data.booking.reference_code}</dd>
                  </div>
                )}
              </dl>
              
              {data.guest && (
                <>
                  <h3 className="text-lg font-semibold mt-6 mb-3">Huésped</h3>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}