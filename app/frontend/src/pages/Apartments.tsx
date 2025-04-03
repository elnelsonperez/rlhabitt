import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useInfiniteApartments, ApartmentFilters, ApartmentWithRelations } from '../hooks/queries/useApartments';
import { useBuildings } from '../hooks/queries/useBuildings';

export function ApartmentsPage() {
  const navigate = useNavigate({from: '/apartments'});
  const search = useSearch({ from: '/layout/apartments' });
  
  // Local state for filters
  const [buildingId, setBuildingId] = useState<string>(search.buildingId || '');
  const [searchTerm, setSearchTerm] = useState<string>(search.search || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(search.search || '');
  
  // Fetch buildings for the filter dropdown
  const { data: buildings, isLoading: isLoadingBuildings } = useBuildings();
  
  // Fetch apartments data with infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteApartments({
    buildingId: buildingId || undefined,
    search: debouncedSearch || undefined
  });
  
  // Debounce search input to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Update URL when filters change
  useEffect(() => {
    const newSearch: ApartmentFilters = {};
    
    if (buildingId) {
      newSearch.buildingId = buildingId;
    }
    
    if (debouncedSearch) {
      newSearch.search = debouncedSearch;
    }
    
    navigate({
      search: newSearch,
      replace: true
    });
  }, [buildingId, debouncedSearch, navigate]);
  
  // Handle building filter change
  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBuildingId(e.target.value);
  };
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle load more button click
  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Apartamentos</h1>
        <Link
          to="/reservations"
          className="text-blue-500 hover:underline"
        >
          Volver a Reservaciones
        </Link>
      </div>
      
      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Building Filter */}
          <div className="w-full md:w-64">
            <label htmlFor="building-filter" className="text-xs font-medium text-gray-700">
              Edificio
            </label>
            <select
              id="building-filter"
              value={buildingId}
              onChange={handleBuildingChange}
              className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los edificios</option>
              {isLoadingBuildings ? (
                <option disabled>Cargando...</option>
              ) : (
                buildings?.map(building => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))
              )}
            </select>
          </div>
          
          {/* Search Input */}
          <div className="w-full md:w-80">
            <label htmlFor="search-input" className="text-xs font-medium text-gray-700">
              Buscar por código, descripción o propietario
            </label>
            <input
              id="search-input"
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Ej: Marcelo, A02"
              className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      {/* Apartments Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Código
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Edificio
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Propietario
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Comisión Admin (%)
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
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-red-500">
                    Error al cargar apartamentos
                  </td>
                </tr>
              ) : data?.apartments?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No se encontraron apartamentos
                  </td>
                </tr>
              ) : (
                data?.apartments?.map((apartment: ApartmentWithRelations) => (
                  <tr 
                    key={apartment.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      navigate({ 
                        to: '/apartments/$apartmentId',
                        params: { apartmentId: apartment.id }
                      });
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        <Link
                          to="/apartments/$apartmentId"
                          params={{ apartmentId: apartment.id }}
                        >
                          {apartment.code || 'Sin código'}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {apartment.building?.name || 'No asignado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {apartment.owner ? (
                        <Link
                          to="/owners/$ownerId"
                          params={{ ownerId: apartment.owner.id }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {apartment.owner.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-500">Sin propietario</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {apartment.admin_fee_percentage.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {apartment.bookings_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          apartment.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {apartment.active ? 'Activo' : 'Inactivo'}
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