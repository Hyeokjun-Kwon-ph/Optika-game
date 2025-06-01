
import React from 'react';
import type { PaletteMirrorTemplate } from '../types';
import { MIRROR_COLOR } from '../constants';

interface MirrorPaletteProps {
  mirrors: PaletteMirrorTemplate[];
  canPlaceMoreMirrors: boolean;
}

interface PaletteMirrorItemProps {
  template: PaletteMirrorTemplate;
  isDisabled: boolean;
}

const PaletteMirrorItem: React.FC<PaletteMirrorItemProps> = ({ template, isDisabled }) => {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', template.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable={!isDisabled}
      onDragStart={handleDragStart}
      className={`p-3 mb-3 bg-white border border-slate-300 rounded-md shadow hover:shadow-md transition-all duration-150 ease-in-out 
                  ${isDisabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-grab active:cursor-grabbing hover:border-slate-400'}`}
      aria-disabled={isDisabled}
      title={isDisabled ? "Maximum number of mirrors placed" : template.description}
    >
      <div className="flex items-center space-x-3">
        <svg width="50" height="30" viewBox="0 0 50 30" className="flex-shrink-0">
          <line 
            x1="5" y1="15" x2="45" y2="15" 
            stroke={MIRROR_COLOR} 
            strokeWidth="4" 
            strokeLinecap="round"
            transform={`rotate(${template.defaultAngle || 0} 25 15)`}
          />
        </svg>
        <p className="text-sm text-slate-600">{template.description}</p>
      </div>
    </div>
  );
};

export const MirrorPalette: React.FC<MirrorPaletteProps> = ({ mirrors, canPlaceMoreMirrors }) => {
  return (
    <div className="space-y-2">
      {mirrors.map(template => (
        <PaletteMirrorItem 
          key={template.id} 
          template={template} 
          isDisabled={!canPlaceMoreMirrors} 
        />
      ))}
    </div>
  );
};