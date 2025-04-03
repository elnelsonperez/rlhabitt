import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useInfiniteCommunications, useUpdateCommunicationsStatus } from '../hooks/queries/useCommunications';
import { CommunicationWithRelations } from '../lib/api/commsClient';
import { Database } from '../lib/supabase/database.types';

// Helper function to format dates
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
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

// Helper to get communication type text in Spanish
const getCommTypeText = (type: string) => {
  switch (type) {
    case 'new_booking':
      return 'Nueva reserva';
    case 'monthly_report':
      return 'Reporte Mensual';
    default:
      return type;
  }
};

export function CommunicationsPage() {
  const navigate = useNavigate();
  
  // State for filters
  const [statusFilter, setStatusFilter] = useState<Database['public']['Enums']['communication_status'] | ''>('');
  const [typeFilter, setTypeFilter] = useState<Database['public']['Enums']['communication_type'] | ''>('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // State for row selection
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  
  // Mutation for updating status
  const updateStatusMutation = useUpdateCommunicationsStatus();
  
  // Fetch communications data with infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteCommunications({
    status: statusFilter ? (statusFilter as any) : undefined,
    type: typeFilter ? (typeFilter as any) : undefined,
    sortBy: sortField,
    sortOrder
  });
  
  // Handle status filter change
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as Database['public']['Enums']['communication_status'] | '');
  };
  
  // Handle type filter change
  const handleTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(e.target.value as Database['public']['Enums']['communication_type'] | '');
  };
  
  // Handle sort field change
  const handleSortFieldChange = (field: string) => {
    if (field === sortField) {
      // Toggle sort order if clicking the same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to desc for new sort field
      setSortField(field);
      setSortOrder('desc');
    }
  };
  
  // Handle load more button click
  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };
  
  // Toggle selection of a single row
  const toggleRowSelection = (e: any, id: string) => {
    e.stopPropagation(); // Prevent row click navigation
    
    setSelectedRows(prev => {
      if (prev.includes(id)) {
        return prev.filter(rowId => rowId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  // Toggle select all rows
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedRows([]);
    } else {
      const allIds = data?.communications?.map(comm => comm.id) || [];
      setSelectedRows(allIds);
    }
    setSelectAll(!selectAll);
  };
  
  // Handle bulk status update
  const handleStatusChange = (newStatus: Database['public']['Enums']['communication_status']) => {
    if (selectedRows.length === 0) return;
    
    updateStatusMutation.mutate({
      communicationIds: selectedRows,
      newStatus
    }, {
      onSuccess: () => {
        // Clear selections after successful update
        setSelectedRows([]);
        setSelectAll(false);
        setBulkActionOpen(false);
      }
    });
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Comunicaciones a Propietarios</h1>
        <Link
          to="/reservations"
          className="text-blue-500 hover:underline"
        >
          Volver a Reservaciones
        </Link>
      </div>
      
      {/* Filters and Actions Bar */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap justify-between items-center">
          {/* Left side - Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="status-filter" className="text-xs font-medium text-gray-700">
                Estado
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="approved">Aprobado</option>
                <option value="sent">Enviado</option>
                <option value="failed">Fallido</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="type-filter" className="text-xs font-medium text-gray-700">
                Tipo
              </label>
              <select
                id="type-filter"
                value={typeFilter}
                onChange={handleTypeFilterChange}
                className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="new_booking">Nueva reserva</option>
                <option value="monthly_report">Reporte Mensual</option>
              </select>
            </div>
          </div>
          
          {/* Right side - Bulk Actions (only shown when rows are selected) */}
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <span className="text-sm font-medium text-gray-700">
                {selectedRows.length} seleccionadas
              </span>
              <div className="relative">
                <button
                  onClick={() => setBulkActionOpen(!bulkActionOpen)}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cambiar Estado {bulkActionOpen ? '▲' : '▼'}
                </button>
                
                {bulkActionOpen && (
                  <div className="absolute right-0 z-10 mt-1 w-48 bg-white rounded-md shadow-lg">
                    <div className="py-1">
                      <button
                        onClick={() => handleStatusChange('pending')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Pendiente
                      </button>
                      <button
                        onClick={() => handleStatusChange('approved')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Aprobado
                      </button>
                      <button
                        onClick={() => handleStatusChange('sent')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Enviado
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {updateStatusMutation.isPending && (
                <span className="text-sm text-blue-600">Actualizando...</span>
              )}
              
              {updateStatusMutation.isSuccess && (
                <span className="text-sm text-green-600">¡Actualizado con éxito!</span>
              )}
              
              {updateStatusMutation.isError && (
                <span className="text-sm text-red-600">Error: {updateStatusMutation.error.message}</span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Communications table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="pl-6 pr-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortFieldChange('created_at')}
                >
                  <div className="flex items-center">
                    Fecha
                    {sortField === 'created_at' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortFieldChange('owner_id')}
                >
                  <div className="flex items-center">
                    Propietario
                    {sortField === 'owner_id' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Asunto
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Tipo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Reservas
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Importe Total
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortFieldChange('status')}
                >
                  <div className="flex items-center">
                    Estado
                    {sortField === 'status' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-red-500">
                    Error al cargar las comunicaciones
                  </td>
                </tr>
              ) : data?.communications?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No se encontraron comunicaciones
                  </td>
                </tr>
              ) : (
                data?.communications?.map((comm: CommunicationWithRelations) => (
                  <tr 
                    key={comm.id}
                    className={`hover:bg-gray-50 cursor-pointer ${selectedRows.includes(comm.id) ? 'bg-blue-50' : ''}`}
                    onClick={(e) => {
                      // Only navigate if it's a left click and not on a checkbox or link element
                      if (e.button === undefined && 
                          e.target && 
                          !(e.target as Element).closest('input') && 
                          !(e.target as Element).closest('a')) {
                        navigate({ 
                          to: '/communications/$communicationId',
                          params: { communicationId: comm.id }
                        });
                      }
                    }}
                  >
                    <td className="pl-6 pr-3 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(comm.id)}
                        onChange={(e) => toggleRowSelection(e, comm.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(comm.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {comm.owner?.name || 'Desconocido'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {comm.recipient_email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to="/communications/$communicationId"
                        params={{ communicationId: comm.id }}
                        className="text-sm text-blue-600 hover:text-blue-800 truncate max-w-xs block"
                      >
                        {comm.subject}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getCommTypeText(comm.comm_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {comm.booking_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${comm.total_amount ? (comm.total_amount as number).toFixed(2) : '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClasses(comm.status)}`}>
                        {getStatusText(comm.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Load more button */}
        {hasNextPage && (
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={handleLoadMore}
              disabled={isFetchingNextPage}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isFetchingNextPage ? 'Cargando más...' : 'Cargar más'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}