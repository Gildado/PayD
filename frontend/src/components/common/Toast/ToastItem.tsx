import React, { useEffect, useState } from 'react';
import { Toast } from '../../../types/toast';

interface ToastItemProps {
  toast: Toast;
  removeToast: (id: string) => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, removeToast }) => {
  const [isClosing, setIsClosing] = useState(false);
  const duration = toast.duration || 5000;

  useEffect(() => {
    if (duration !== Infinity) {
      const timer = setTimeout(() => handleClose(), duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => removeToast(toast.id), 300);
  };

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-white border-gray-200 text-gray-800';
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`max-w-sm w-full shadow-lg rounded-lg border p-4 transition-all duration-300 transform flex flex-col ${getBgColor()} ${
        isClosing ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {toast.title && <h3 className="font-semibold text-sm mb-1">{toast.title}</h3>}
          <p className="text-sm">{toast.message}</p>
        </div>
        <button
          onClick={handleClose}
          className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
          aria-label="Close notification"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      {toast.action && (
        <div className="mt-3">
          <button
            onClick={() => {
              toast.action?.onClick();
              handleClose();
            }}
            className="text-sm font-medium hover:underline focus:outline-none"
          >
            {toast.action.label}
          </button>
        </div>
      )}
    </div>
  );
};
