
import React, { forwardRef } from 'react';

interface TrashCanProps {
  isHot: boolean;
}

export const TrashCan = forwardRef<HTMLDivElement, TrashCanProps>(({ isHot }, ref) => {
  return (
    <div
      ref={ref}
      className={`absolute bottom-4 right-4 w-16 h-20 sm:w-20 sm:h-24 p-2 border-2 rounded-lg shadow-lg flex flex-col items-center justify-center transition-all duration-200 ease-in-out
                  ${isHot ? 'bg-red-400 border-red-600 scale-110' : 'bg-slate-200 border-slate-400 hover:bg-slate-300'}`}
      aria-label={isHot ? "Drop component here to delete" : "Trash can for deleting optical components"}
      role="region" // Using region as it's a drop target, not directly interactive via click for this purpose
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors duration-200 ease-in-out ${isHot ? 'text-white' : 'text-slate-600'}`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span className={`mt-1 text-xs sm:text-sm font-medium transition-colors duration-200 ease-in-out ${isHot ? 'text-white' : 'text-slate-700'}`}>
        {isHot ? "Delete" : "Trash"}
      </span>
    </div>
  );
});

TrashCan.displayName = "TrashCan";
