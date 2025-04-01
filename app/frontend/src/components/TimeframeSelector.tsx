import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Props interface
interface TimeframeSelectorProps {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

// Get month name in Spanish
const getMonthName = (month: number): string => {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  return monthNames[month - 1]
}

export function TimeframeSelector({ month, year, onMonthChange, onYearChange }: TimeframeSelectorProps) {
  // State for dropdown visibility
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  
  // Refs for positioning dropdowns
  const monthButtonRef = useRef<HTMLButtonElement>(null);
  const yearButtonRef = useRef<HTMLButtonElement>(null);
  
  // Navigate to previous month
  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(12);
      onYearChange(year - 1);
    } else {
      onMonthChange(month - 1);
    }
  };

  // Navigate to next month
  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(1);
      onYearChange(year + 1);
    } else {
      onMonthChange(month + 1);
    }
  };
  
  // Handle month selection
  const handleMonthSelect = (m: number) => {
    onMonthChange(m);
    setMonthDropdownOpen(false);
  }
  
  // Handle year selection
  const handleYearSelect = (y: number) => {
    onYearChange(y);
    setYearDropdownOpen(false);
  }
  
  // Toggle month dropdown
  const toggleMonthDropdown = () => {
    setMonthDropdownOpen(prev => !prev);
    setYearDropdownOpen(false);
  };

  // Toggle year dropdown
  const toggleYearDropdown = () => {
    setYearDropdownOpen(prev => !prev);
    setMonthDropdownOpen(false);
  };
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthButtonRef.current && 
          !monthButtonRef.current.contains(event.target as Node) && 
          !document.getElementById('month-dropdown')?.contains(event.target as Node)) {
        setMonthDropdownOpen(false);
      }
      
      if (yearButtonRef.current && 
          !yearButtonRef.current.contains(event.target as Node) && 
          !document.getElementById('year-dropdown')?.contains(event.target as Node)) {
        setYearDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Get current date for year range
  const now = new Date();
  
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-sm font-medium text-gray-700 mb-2">Período</h2>
      <div className="flex items-center border border-gray-300 rounded-md overflow-hidden shadow-sm">
        {/* Previous month button */}
        <button 
          onClick={handlePrevMonth}
          className="p-2 bg-gray-50 hover:bg-gray-100 border-r border-gray-300 focus:outline-none"
          title="Mes anterior"
          aria-label="Mes anterior"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        {/* Current month/year display with separate dropdowns */}
        <div className="w-48 flex justify-center items-center px-4 py-2 font-medium">
          <div className="flex gap-2 items-center">
            {/* Month display and dropdown */}
            <div className="relative">
              <button 
                ref={monthButtonRef}
                className="text-lg font-medium hover:text-blue-600 focus:outline-none focus:text-blue-600 transition-colors"
                type="button"
                onClick={toggleMonthDropdown}
                aria-haspopup="true"
                aria-expanded={monthDropdownOpen}
              >
                {getMonthName(month)}
              </button>
              
              {/* Month selection dropdown (in portal) */}
              {monthDropdownOpen && monthButtonRef.current && createPortal(
                <div
                  id="month-dropdown"
                  className="absolute z-50 mt-1 bg-white shadow-lg rounded-md border border-gray-200 w-48"
                  style={{
                    top: monthButtonRef.current.getBoundingClientRect().bottom + window.scrollY,
                    left: monthButtonRef.current.getBoundingClientRect().left + window.scrollX,
                  }}
                >
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-500 mb-1 px-2">Mes</p>
                    <div className="grid grid-cols-3 gap-1">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <button
                          key={m}
                          onClick={() => handleMonthSelect(m)}
                          className={`text-xs p-1 rounded ${month === m ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'}`}
                        >
                          {getMonthName(m).substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
            
            {/* Year display and dropdown */}
            <div className="relative">
              <button 
                ref={yearButtonRef}
                className="text-lg font-medium hover:text-blue-600 focus:outline-none focus:text-blue-600 transition-colors"
                type="button"
                onClick={toggleYearDropdown}
                aria-haspopup="true"
                aria-expanded={yearDropdownOpen}
              >
                {year}
              </button>
              
              {/* Year selection dropdown (in portal) */}
              {yearDropdownOpen && yearButtonRef.current && createPortal(
                <div
                  id="year-dropdown"
                  className="absolute z-50 mt-1 bg-white shadow-lg rounded-md border border-gray-200 w-24"
                  style={{
                    top: yearButtonRef.current.getBoundingClientRect().bottom + window.scrollY,
                    left: yearButtonRef.current.getBoundingClientRect().left + window.scrollX,
                  }}
                >
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-500 mb-1 px-1">Año</p>
                    <div className="flex flex-col gap-1">
                      {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
                        <button
                          key={y}
                          onClick={() => handleYearSelect(y)}
                          className={`text-xs p-1 rounded ${year === y ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'}`}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>
        
        {/* Next month button */}
        <button 
          onClick={handleNextMonth}
          className="p-2 bg-gray-50 hover:bg-gray-100 border-l border-gray-300 focus:outline-none"
          title="Mes siguiente"
          aria-label="Mes siguiente"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}