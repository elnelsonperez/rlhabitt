interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  html: string;
}

export function EmailPreviewModal({ isOpen, onClose, title, html }: EmailPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-50">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl max-h-screen flex flex-col w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <span className="sr-only">Close</span>
            <svg 
              className="h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4 overflow-auto flex-1">
          <iframe
            srcDoc={html}
            title="Email Preview"
            className="w-full h-full border-0 min-h-[70vh]"
            sandbox="allow-same-origin"
          />
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-md text-gray-800 hover:bg-gray-300 focus:outline-none"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}