import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useApartment, useApartmentBookings, useUpdateApartmentFee } from '../hooks/queries/useApartments';

// Format date to DD/MM/YYYY
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export function ApartmentDetailPage() {
  const params = useParams({ from: '/layout/apartments/$apartmentId' });
  const apartmentId = params.apartmentId;
  
  // Fetch apartment data
  const { 
    data: apartment, 
    isLoading: isLoadingApartment, 
    error: apartmentError 
  } = useApartment(apartmentId);
  
  // Fetch bookings for this apartment
  const { 
    data: bookings, 
    isLoading: isLoadingBookings, 
    error: bookingsError 
  } = useApartmentBookings(apartmentId);
  
  // State for editing admin fee
  const [isEditing, setIsEditing] = useState(false);
  const [adminFee, setAdminFee] = useState(apartment?.admin_fee_percentage || 25);
  
  // Mutation for updating admin fee
  const updateFeeMutation = useUpdateApartmentFee();
  
  // Handle start editing
  const handleStartEditing = () => {
    setAdminFee(apartment?.admin_fee_percentage || 25);
    setIsEditing(true);
  };
  
  // Handle cancel editing
  const handleCancelEditing = () => {
    setIsEditing(false);
  };
  
  // Handle save admin fee
  const handleSaveAdminFee = async () => {
    if (!apartment) return;
    
    await updateFeeMutation.mutateAsync({
      apartmentId: apartment.id,
      adminFeePercentage: adminFee
    });
    
    setIsEditing(false);
  };
  
  // Show loading state
  if (isLoadingApartment) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <p className="text-gray-500">Cargando información del apartamento...</p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (apartmentError || !apartment) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <p className="text-red-500">Error al cargar el apartamento</p>
          <Link to="/apartments" className="text-blue-500 hover:underline mt-2 inline-block">
            Volver a la lista de apartamentos
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Detalles del Apartamento</h1>
        <Link to="/apartments" className="text-blue-500 hover:underline">
          Volver a Apartamentos
        </Link>
      </div>
      
      {/* Apartment Details Card */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              {apartment.code || 'Apartamento sin código'}
            </h2>
            
            {/* Status Badge */}
            <span 
              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                apartment.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {apartment.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          
          {/* Apartment Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Edificio
                </label>
                <p className="text-gray-900">
                  {apartment.building?.name || 'No asignado'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Propietario
                </label>
                {apartment.owner ? (
                  <Link
                    to="/owners/$ownerId"
                    params={{ ownerId: apartment.owner.id }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {apartment.owner.name}
                  </Link>
                ) : (
                  <p className="text-gray-500">Sin propietario</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email de contacto
                </label>
                <p className="text-gray-900">
                  {apartment.owner?.email || 'No disponible'}
                </p>
              </div>
            </div>
            
            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comisión Administrativa (%)
                  </label>
                  {!isEditing && (
                    <button
                      onClick={handleStartEditing}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                    >
                      Editar
                    </button>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={adminFee}
                      onChange={(e) => setAdminFee(parseFloat(e.target.value))}
                      className="block w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">%</span>
                    <div className="flex space-x-2 ml-2">
                      <button
                        onClick={handleCancelEditing}
                        className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveAdminFee}
                        disabled={updateFeeMutation.isPending}
                        className="px-3 py-1 border border-transparent rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm"
                      >
                        {updateFeeMutation.isPending ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium">
                    {apartment.admin_fee_percentage.toFixed(1)}%
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <p className="text-gray-900">
                  {apartment.description || 'Sin descripción'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bookings Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Reservas</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Huésped
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Llegada
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Salida
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Referencia
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoadingBookings ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Cargando reservas...
                  </td>
                </tr>
              ) : bookingsError ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-red-500">
                    Error al cargar las reservas
                  </td>
                </tr>
              ) : bookings?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No hay reservas para este apartamento
                  </td>
                </tr>
              ) : (
                bookings?.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {booking.guest?.name || 'Sin nombre'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(booking.check_in)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(booking.check_out)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {booking.reference_code || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${booking.total_amount?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}