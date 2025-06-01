
import React from 'react';

interface RefreshButtonProps {
  onRefresh: () => void;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({ onRefresh }) => {
  return (
    <button
      onClick={onRefresh}
      className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition-colors"
      title="Reset Level"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2M9 15h4.581" />
      </svg>
    </button>
  );
};
    