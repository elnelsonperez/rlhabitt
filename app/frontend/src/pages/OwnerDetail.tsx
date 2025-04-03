import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useOwner, useUpdateOwner, useUpdateApartmentFee } from '../hooks/queries/useOwners';

export function OwnerDetailPage() {
  const params = useParams({ from: '/layout/owners/$ownerId' });
  const ownerId = params.ownerId;
  
  // Fetch owner data
  const { data: owner, isLoading, error } = useOwner(ownerId);
  
  // State for editing owner details
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [editedActive, setEditedActive] = useState(true);
  
  // State for editing apartment admin fee
  const [editingApartmentId, setEditingApartmentId] = useState<string | null>(null);
  const [editedAdminFee, setEditedAdminFee] = useState(0);
  
  // Mutations for updating
  const updateOwnerMutation = useUpdateOwner();
  const updateAdminFeeMutation = useUpdateApartmentFee();
  
  // Start editing owner
  const startEditing = () => {
    setEditedName(owner?.name || '');
    setEditedEmail(owner?.email || '');
    setEditedPhone(owner?.phone || '');
    setEditedNotes(owner?.notes || '');
    setEditedActive(owner?.active || false);
    setIsEditing(true);
  };
  
  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
  };
  
  // Save edited owner
  const saveOwner = async () => {
    if (!owner) return;
    
    await updateOwnerMutation.mutateAsync({
      id: owner.id,
      name: editedName,
      email: editedEmail,
      phone: editedPhone,
      notes: editedNotes,
      active: editedActive
    });
    
    setIsEditing(false);
  };
  
  // Start editing apartment admin fee
  const startEditingApartment = (apartmentId: string, currentFee: number) => {
    setEditingApartmentId(apartmentId);
    setEditedAdminFee(currentFee);
  };
  
  // Cancel editing apartment admin fee
  const cancelEditingApartment = () => {
    setEditingApartmentId(null);
  };
  
  // Save apartment admin fee
  const saveApartmentFee = async (apartmentId: string) => {
    await updateAdminFeeMutation.mutateAsync({
      apartmentId,
      adminFeePercentage: editedAdminFee
    });
    
    setEditingApartmentId(null);
  };
  
  // If loading or error
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <p className="text-gray-500">Cargando detalles del propietario...</p>
        </div>
      </div>
    );
  }
  
  if (error || !owner) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <p className="text-red-500">Error al cargar el propietario</p>
          <Link to="/apartments" className="text-blue-500 hover:underline mt-2 inline-block">
            Volver a la lista de propietarios
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Detalles del Propietario</h1>
        <Link
          to="/apartments"
          className="text-blue-500 hover:underline"
        >
          Volver a Propietarios
        </Link>
      </div>
      
      {/* Owner Details Card */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold text-gray-800">{owner.name}</h2>
            <div>
              {isEditing ? (
                <div className="flex space-x-2">
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveOwner}
                    disabled={updateOwnerMutation.isPending}
                    className="px-3 py-1 border border-transparent rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm"
                  >
                    {updateOwnerMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditing}
                  className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 text-sm"
                >
                  Editar
                </button>
              )}
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="mb-4">
            <span 
              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                owner.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {owner.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          
          {/* Owner Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{owner.name}</p>
                )}
              </div>
              
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedEmail || ''}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{owner.email || 'No disponible'}</p>
                )}
              </div>
              
              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedPhone || ''}
                    onChange={(e) => setEditedPhone(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{owner.phone || 'No disponible'}</p>
                )}
              </div>
            </div>
            
            {/* Right Column */}
            <div className="space-y-4">
              {/* Active Status */}
              {isEditing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={editedActive ? 'true' : 'false'}
                    onChange={(e) => setEditedActive(e.target.value === 'true')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                {isEditing ? (
                  <textarea
                    value={editedNotes || ''}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    rows={4}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{owner.notes || 'Sin notas'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Apartments List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Apartamentos</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Edificio
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comisión Admin (%)
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {owner.apartments && owner.apartments.length > 0 ? (
                owner.apartments.map((apartment) => (
                  <tr key={apartment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {apartment.code || 'Sin código'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {apartment.building?.name || 'Desconocido'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingApartmentId === apartment.id ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={editedAdminFee}
                          onChange={(e) => setEditedAdminFee(parseFloat(e.target.value))}
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        `${apartment.admin_fee_percentage.toFixed(1)}%`
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingApartmentId === apartment.id ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={cancelEditingApartment}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => saveApartmentFee(apartment.id)}
                            disabled={updateAdminFeeMutation.isPending}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {updateAdminFeeMutation.isPending ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingApartment(apartment.id, apartment.admin_fee_percentage)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Editar Comisión
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    El propietario no tiene apartamentos asignados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}