
import React from 'react';
import type { PaletteMirrorTemplate, MirrorType } from '../types';
import { 
  MIRROR_COLOR, MIRROR_BACKING_COLOR, MIRROR_EDGE_HIGHLIGHT_COLOR,
  BEAM_SPLITTER_COLOR, BEAM_SPLITTER_FILL_OPACITY, BEAM_SPLITTER_EDGE_COLOR,
  DIFFRACTION_GRATING_COLOR, DIFFRACTION_GRATING_FILL_OPACITY, DIFFRACTION_GRATING_EDGE_COLOR, DIFFRACTION_GRATING_LINE_COLOR
} from '../constants';

interface MirrorPaletteProps {
  mirrors: PaletteMirrorTemplate[];
  canPlaceMoreMirrors: boolean;
}

interface PaletteMirrorItemProps {
  template: PaletteMirrorTemplate;
  isDisabled: boolean;
}

const PaletteItemVisual: React.FC<{ type: MirrorType, angle?: number }> = ({ type, angle = 0 }) => {
  const svgWidth = 50;
  const svgHeight = 30;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const lineLength = 36; // Shorter line for palette
  const halfLine = lineLength / 2;

  // Points for the line before rotation
  const p1_local = { x: -halfLine, y: 0 };
  const p2_local = { x: halfLine, y: 0 };

  const visualElements: JSX.Element[] = [];

  if (type === 'default') {
    visualElements.push(
      <line key="backing" x1={p1_local.x} y1={p1_local.y -1} x2={p2_local.x} y2={p2_local.y -1} stroke={MIRROR_BACKING_COLOR} strokeWidth="3.5" strokeLinecap="round" />,
      <line key="surface" x1={p1_local.x} y1={p1_local.y} x2={p2_local.x} y2={p2_local.y} stroke={MIRROR_COLOR} strokeWidth="3" strokeLinecap="round" />,
      <line key="highlight" x1={p1_local.x} y1={p1_local.y + 0.5} x2={p2_local.x} y2={p2_local.y + 0.5} stroke={MIRROR_EDGE_HIGHLIGHT_COLOR} strokeWidth="0.5" strokeLinecap="round" opacity="0.7"/>
    );
  } else if (type === 'beam-splitter') {
    const thickness = 6;
    visualElements.push(
      <rect 
        key="glass"
        x={-halfLine} y={-thickness/2} 
        width={lineLength} height={thickness} 
        fill={BEAM_SPLITTER_COLOR} 
        fillOpacity={BEAM_SPLITTER_FILL_OPACITY} 
        stroke={BEAM_SPLITTER_EDGE_COLOR} 
        strokeWidth="0.75" 
        rx="1"
      />
    );
  } else if (type === 'diffraction-grating') {
    const thickness = 5;
    visualElements.push(
      <rect 
        key="base"
        x={-halfLine} y={-thickness/2} 
        width={lineLength} height={thickness} 
        fill={DIFFRACTION_GRATING_COLOR} 
        fillOpacity={DIFFRACTION_GRATING_FILL_OPACITY} 
        stroke={DIFFRACTION_GRATING_EDGE_COLOR} 
        strokeWidth="0.75"
        rx="1"
      />
    );
    const numGratingLines = 7;
    for (let i = 0; i <= numGratingLines; i++) {
      const xPos = -halfLine + (i / numGratingLines) * lineLength;
      visualElements.push(
        <line 
          key={`grating-${i}`}
          x1={xPos} y1={-thickness/2 * 0.8} 
          x2={xPos} y2={thickness/2 * 0.8} 
          stroke={DIFFRACTION_GRATING_LINE_COLOR} 
          strokeWidth="0.5" 
        />
      );
    }
  }

  return (
    <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="flex-shrink-0">
      <g transform={`translate(${centerX} ${centerY}) rotate(${angle})`}>
        {visualElements}
      </g>
    </svg>
  );
};


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
      title={isDisabled ? "Maximum number of optical components placed" : template.description}
    >
      <div className="flex items-center space-x-3">
        <PaletteItemVisual type={template.type} angle={template.defaultAngle} />
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
