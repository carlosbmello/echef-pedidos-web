// src/components/common/LoadingSpinner.tsx
import React from 'react';

const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "Carregando..." }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
      {message && <p className="mt-4 text-lg text-gray-600">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;