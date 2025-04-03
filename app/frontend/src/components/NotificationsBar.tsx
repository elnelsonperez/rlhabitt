import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useInfiniteCommunications } from '../hooks/queries/useCommunications';
import { useNotificationStore } from '../store/notificationStore';

interface NotificationsBarProps {
  pollingInterval?: number; // in milliseconds, default 60 seconds
}

export function NotificationsBar({ pollingInterval = 60000 }: NotificationsBarProps) {
  // State to track if user dismissed the notification
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Access notification store
  const { setPendingCommunicationsCount } = useNotificationStore();
  
  // Query for pending communications
  const { 
    data, 
    isLoading, 
    isError, 
    refetch 
  } = useInfiniteCommunications({ 
    status: 'pending',
  }, 1); // Only fetch 1 result for the notification

  // Update store when count changes
  useEffect(() => {
    if (data) {
      setPendingCommunicationsCount(data.totalCount);
    }
  }, [data?.totalCount, setPendingCommunicationsCount]);

  // Reset dismissed state when new notifications arrive or count changes
  useEffect(() => {
    if (data && data.totalCount > 0) {
      // If count changes, reset dismissed status
      setIsDismissed(false);
    }
  }, [data?.totalCount]);

  // Set up polling to check for new communications
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetch();
    }, pollingInterval);
    
    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, [refetch, pollingInterval]);

  // Don't show anything if loading or error or no pending communications or dismissed
  if (isLoading || isError || !data || data.totalCount === 0 || isDismissed) {
    return null;
  }

  return (
    <div className="notification-bar bg-amber-100 border-b border-amber-200">
      <div className="container mx-auto py-2 px-4 flex items-center justify-between">
        <Link 
          to="/communications" 
          className="flex items-center text-amber-800 hover:text-amber-900 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          
          <span className="font-medium">
            {data.totalCount === 1 
              ? 'Hay 1 comunicación pendiente de revisión' 
              : `Hay ${data.totalCount} comunicaciones pendientes de revisión`}
          </span>
          
          <span className="ml-2 text-amber-700 underline">
            Ver todas
          </span>
        </Link>
        
        <button 
          onClick={() => setIsDismissed(true)}
          className="text-amber-700 hover:text-amber-900 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500"
          aria-label="Cerrar notificación"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}