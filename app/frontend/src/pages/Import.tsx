import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTriggerImport, useImportStatus } from '../hooks/queries/useImport';

export function ImportPage() {
  // Default fileId from environment variable
  const defaultFileId = import.meta.env.VITE_ONEDRIVE_FILE_ID || '';
  
  const [fileId, setFileId] = useState(defaultFileId);
  const [months, setMonths] = useState<number>(2);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  
  // Mutations and queries
  const triggerImportMutation = useTriggerImport();
  const { 
    data: importStatus, 
    isLoading: isLoadingStatus,
    error: statusError
  } = useImportStatus(correlationId);
  
  // Start a new import
  const handleStartImport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fileId.trim()) {
      alert('Please enter a file ID');
      return;
    }
    
    try {
      const result = await triggerImportMutation.mutateAsync({ 
        fileId: fileId.trim(), 
        months 
      });
      setCorrelationId(result.correlation_id);
    } catch (error) {
      console.error('Failed to start import:', error);
    }
  };
  
  // Reset the form to start a new import
  const handleReset = () => {
    setCorrelationId(null);
    triggerImportMutation.reset();
  };
  
  // Removed progress calculation as it's no longer needed
  
  // Calculate status color based on status
  const getStatusColor = () => {
    if (!importStatus) return 'bg-gray-200';
    
    switch (importStatus.status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'partial': return 'bg-yellow-500';
      case 'processing':
      case 'downloading':
      case 'in_progress': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Get human-readable status text in Spanish
  const getStatusText = () => {
    if (!importStatus) return 'Desconocido';
    
    switch (importStatus.status) {
      case 'downloading': return 'Descargando archivo...';
      case 'processing': return 'Procesando datos...';
      case 'in_progress': return 'Importando datos...';
      case 'completed': return 'Importación completada exitosamente';
      case 'partial': return 'Importación parcialmente completada';
      case 'failed': return `Error en la importación: ${importStatus.error || 'Error desconocido'}`;
      default: return importStatus.status;
    }
  };
  
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Importar Datos de Reservaciones</h1>
        <Link 
          to="/reservations" 
          className="text-blue-500 hover:underline"
        >
          Volver a Reservaciones
        </Link>
      </div>
      
      {!correlationId ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleStartImport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID de Archivo OneDrive
              </label>
              <input
                type="text"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                placeholder="Ingrese el ID del archivo OneDrive"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                {defaultFileId ? 
                  "Pre-configurado desde variables de entorno. Puede cambiarlo si es necesario." : 
                  "Ingrese el ID del archivo Excel de OneDrive que contiene los datos de reservaciones"}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meses a Importar
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={months}
                  onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-600">mes(es)</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Cantidad de meses recientes a importar (1-12)
              </p>
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={triggerImportMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {triggerImportMutation.isPending ? 'Iniciando importación...' : 'Iniciar Importación'}
              </button>
            </div>
            
            {triggerImportMutation.isError && (
              <div className="mt-4 p-2 bg-red-100 text-red-700 rounded-md">
                Error: {triggerImportMutation.error?.message || 'Error al iniciar la importación'}
              </div>
            )}
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium">Estado de la Importación</h2>
              <span className="text-sm text-gray-500">ID: {correlationId}</span>
            </div>
            
            {/* Status information */}
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="flex items-center mb-2">
                <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor()}`}></div>
                <div className="font-medium">{getStatusText()}</div>
              </div>
              
              {importStatus && (
                <div className="space-y-2">
                  {/* Status details */}
                  {importStatus.total_sheets !== undefined && (
                    <div className="text-sm text-gray-600">
                      Estado: {importStatus.completed_sheets || 0} de {importStatus.total_sheets} hojas procesadas
                      {importStatus.failed_sheets ? ` (${importStatus.failed_sheets} fallidas)` : ''}
                    </div>
                  )}
                  
                  {/* Error message */}
                  {importStatus.error && (
                    <div className="text-sm text-red-600 mt-2">
                      Error: {importStatus.error}
                    </div>
                  )}
                </div>
              )}
              
              {isLoadingStatus && !importStatus && (
                <div className="text-sm text-gray-600">Verificando estado...</div>
              )}
              
              {statusError && (
                <div className="text-sm text-red-600 mt-2">
                  Error: {(statusError as Error).message || 'Error al cargar el estado'}
                </div>
              )}
            </div>
            
            {/* Buttons */}
            <div className="flex justify-between">
              {/* Only show reset button when not in a loading state */}
              {!isLoadingStatus && importStatus && !['downloading', 'processing', 'in_progress'].includes(importStatus.status) && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Iniciar Nueva Importación
                </button>
              )}
              
              {importStatus?.status === 'completed' && (
                <Link
                  to="/reservations"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Ver Reservaciones
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Help information */}
      <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h2 className="text-lg font-medium text-blue-800 mb-2">Cómo encontrar el ID de Archivo de OneDrive</h2>
        <ol className="list-decimal pl-5 space-y-2 text-blue-900">
          <li>Abra OneDrive en su navegador</li>
          <li>Navegue hasta el archivo Excel que desea importar</li>
          <li>Haga clic en el archivo para abrir sus detalles o vista previa</li>
          <li>Observe la URL en la barra de direcciones de su navegador</li>
          <li>El ID del archivo suele ser una cadena larga en la URL después de "id="</li>
          <li>Copie este ID y péguelo en el formulario de arriba</li>
        </ol>
        <p className="mt-3 text-sm text-blue-800">
          Ejemplo: Para la URL "https://onedrive.live.com/?id=ABCD1234&cid=5678", el ID del archivo es "ABCD1234"
        </p>
      </div>
    </div>
  );
}