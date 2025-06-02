
import React from 'react';

interface MusicToggleButtonProps {
  onToggle: () => void;
  isPlaying: boolean;
}

export const MusicToggleButton: React.FC<MusicToggleButtonProps> = ({ onToggle, isPlaying }) => {
  const title = isPlaying ? "Mute background music" : "Play background music";
  const ariaLabel = isPlaying ? "Mute background music" : "Unmute background music, currently muted";

  return (
    <button
      onClick={onToggle}
      className="p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75 transition-colors"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={isPlaying}
    >
      {isPlaying ? (
        // Speaker Wave Icon (Music On) - Heroicons
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      ) : (
        // Speaker X Mark Icon (Music Off) - Heroicons
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25-2.25M19.5 12l2.25 2.25M19.5 12l-2.25 2.25M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      )}
    </button>
  );
};
