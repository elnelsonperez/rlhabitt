import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useCommunication, useApproveCommunication } from '../hooks/queries/useCommunications';
import { BookingCommunicationWithRelations } from '../lib/api/commsClient';

// Helper function to format dates
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper function to get status badge classes
const getStatusBadgeClasses = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'approved':
      return 'bg-blue-100 text-blue-800';
    case 'sent':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Helper to get status text in Spanish
const getStatusText = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'approved':
      return 'Aprobado';
    case 'sent':
      return 'Enviado';
    case 'failed':
      return 'Fallido';
    default:
      return status;
  }
};

export function CommunicationDetailPage() {
  const { communicationId } = useParams({ from: '/layout/communications/$communicationId' });
  
  // Local state for form
  const [excludedBookingIds, setExcludedBookingIds] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<boolean>(false);
  
  // Fetch communication data
  const { data, isLoading, error } = useCommunication(communicationId);
  
  // Approve mutation
  const approveMutation = useApproveCommunication();
  
  // Toggle booking exclusion
  const toggleBookingExclusion = (bookingId: string) => {
    setExcludedBookingIds(prev => 
      prev.includes(bookingId)
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  };
  
  // Handle approve button click
  const handleApprove = () => {
    if (!communicationId) return;
    
    approveMutation.mutate({
      id: communicationId,
      excludedBookingIds,
      customMessage: customMessage.trim() || undefined
    });
  };
  
  // Calculate financial summary
  const calculateSummary = () => {
    if (!data?.bookings) return { totalAmount: 0, includedAmount: 0 };
    
    const totalAmount = data.bookings.reduce((sum, item) => {
      return sum + (item.booking?.total_amount || 0);
    }, 0);
    
    const includedAmount = data.bookings.reduce((sum, item) => {
      if (excludedBookingIds.includes(item.booking_id)) return sum;
      return sum + (item.booking?.total_amount || 0);
    }, 0);
    
    return { totalAmount, includedAmount };
  };
  
  const { totalAmount, includedAmount } = calculateSummary();
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Detalle de Comunicación</h1>
        <Link
          to="/communications"
          className="text-blue-500 hover:underline"
        >
          Volver a Comunicaciones
        </Link>
      </div>
      
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="flex justify-center">
            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="mt-2 text-gray-600">Cargando información...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center text-red-500">
            Error al cargar la información
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Communication info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold">{data.communication.subject}</h2>
                <p className="text-gray-500 mt-1">
                  ID: {data.communication.id}
                </p>
              </div>
              <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadgeClasses(data.communication.status)}`}>
                {getStatusText(data.communication.status)}
              </span>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Propietario</h3>
                <p className="mt-1">{data.communication.owner?.name}</p>
                <p className="text-sm text-gray-500">{data.communication.recipient_email}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Fechas</h3>
                <p className="mt-1">Creado: {formatDate(data.communication.created_at)}</p>
                {data.communication.approved_at && (
                  <p className="mt-1">Aprobado: {formatDate(data.communication.approved_at)}</p>
                )}
                {data.communication.last_retry_at && (
                  <p className="mt-1">Último reintento: {formatDate(data.communication.last_retry_at)}</p>
                )}
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Periodo del Reporte</h3>
                <p className="mt-1">
                  {data.communication.report_period_start && data.communication.report_period_end
                    ? `${formatDate(data.communication.report_period_start)} - ${formatDate(data.communication.report_period_end)}`
                    : 'No especificado'
                  }
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Detalles</h3>
                <p className="mt-1">Estado: {getStatusText(data.communication.status)}</p>
                {data.communication.status === 'approved' && (
                  <p className="mt-1">Aprobado por: {data.communication.approver?.email || 'Desconocido'}</p>
                )}
                {data.communication.status === 'failed' && (
                  <p className="mt-1">Reintentos: {data.communication.retry_count}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Bookings */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Reservas Incluidas</h3>
              <p className="mt-1 text-sm text-gray-500">
                {data.communication.status === 'pending' 
                  ? 'Puede excluir reservas antes de aprobar esta comunicación.' 
                  : 'Lista de reservas incluidas en esta comunicación.'}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {data.communication.status === 'pending' && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Incluir
                      </th>
                    )}
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
                      Importe
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.bookings.length === 0 ? (
                    <tr>
                      <td colSpan={data.communication.status === 'pending' ? 6 : 5} className="px-6 py-4 text-center text-gray-500">
                        No hay reservas asociadas
                      </td>
                    </tr>
                  ) : (
                    data.bookings.map((bookingComm: BookingCommunicationWithRelations) => {
                      const isExcluded = excludedBookingIds.includes(bookingComm.booking_id) || bookingComm.excluded;
                      
                      return (
                        <tr 
                          key={bookingComm.booking_id}
                          className={isExcluded ? 'bg-gray-50 text-gray-400' : ''}
                        >
                          {data.communication.status === 'pending' && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={!excludedBookingIds.includes(bookingComm.booking_id)}
                                onChange={() => toggleBookingExclusion(bookingComm.booking_id)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {bookingComm.booking?.apartment?.code || 'Desconocido'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {bookingComm.booking?.guest?.name || 'Desconocido'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {bookingComm.booking?.check_in ? formatDate(bookingComm.booking.check_in) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {bookingComm.booking?.check_out ? formatDate(bookingComm.booking.check_out) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            ${bookingComm.booking?.total_amount?.toFixed(2) || '0.00'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={data.communication.status === 'pending' ? 5 : 4} className="px-6 py-4 text-right font-medium">
                      Total:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      ${includedAmount.toFixed(2)} / ${totalAmount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          {/* Custom message and preview (for pending communications) */}
          {data.communication.status === 'pending' && (
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
                <p className="mt-1 text-sm text-gray-500">
                  Este mensaje se incluirá en el correo enviado al propietario.
                </p>
              </div>
              
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={() => setPreviewHtml(!previewHtml)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {previewHtml ? 'Ocultar Vista Previa' : 'Ver Vista Previa HTML'}
                </button>
                
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
                >
                  {approveMutation.isPending ? 'Aprobando...' : 'Aprobar Comunicación'}
                </button>
              </div>
              
              {approveMutation.isError && (
                <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
                  Error al aprobar la comunicación: {approveMutation.error.message}
                </div>
              )}
              
              {approveMutation.isSuccess && (
                <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
                  Comunicación aprobada exitosamente.
                </div>
              )}
            </div>
          )}
          
          {/* Email HTML preview */}
          {previewHtml && data.communication.content && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Vista Previa del Email</h3>
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <iframe
                  srcDoc={data.communication.content}
                  title="Email Preview"
                  className="w-full min-h-[500px] border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}