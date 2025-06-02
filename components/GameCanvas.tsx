
import React from 'react';
import type { Point, PlacedMirror, Obstacle, LaserSegment, DetectorType, LineObstacle, RectangleObstacle, CircleObstacle, TrackedLaserSource, MirrorType } from '../types';
import { 
  LASER_COLOR, MIRROR_COLOR, MIRROR_HANDLE_COLOR, MIRROR_BACKING_COLOR, MIRROR_EDGE_HIGHLIGHT_COLOR,
  BEAM_SPLITTER_COLOR, BEAM_SPLITTER_FILL_OPACITY, BEAM_SPLITTER_EDGE_COLOR,
  DIFFRACTION_GRATING_COLOR, DIFFRACTION_GRATING_FILL_OPACITY, DIFFRACTION_GRATING_EDGE_COLOR, DIFFRACTION_GRATING_LINE_COLOR,
  DETECTOR_BASE_COLOR, DETECTOR_APERTURE_COLOR, DETECTOR_ARROW_COLOR, DETECTOR_HIT_COLOR, 
  SOURCE_EMITTER_BODY_COLOR, SOURCE_EMITTER_APERTURE_COLOR, SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT, SOURCE_EMITTER_APERTURE_RADIUS,
  OBSTACLE_COLOR, OBSTACLE_RECT_FILL_COLOR, OBSTACLE_CIRCLE_FILL_COLOR,
  DETECTOR_APERTURE_RADIUS, DETECTOR_ARROWHEAD_SIZE,
  FRAME_COLOR, FRAME_THICKNESS, GAME_WIDTH, GAME_HEIGHT
} from '../constants';
import { subtractPoints, addPoints, scaleVector, normalizeVector, distance } from '../utils/geometry';

interface GameCanvasProps {
  svgRef: React.RefObject<SVGSVGElement>;
  width: number;
  height: number;
  trackedLaserSources: TrackedLaserSource[];
  detectors: DetectorType[];
  placedMirrors: PlacedMirror[];
  obstacles: Obstacle[];
  overallSuccess: boolean;
  globallyHitDetectorIds: Set<string>; 
  onDropMirror: (templateId: string, x: number, y: number) => void;
  onMouseDownOnMirrorPoint: (mirrorId: string, pointType: 'p1' | 'p2') => void;
  onMouseDownOnMirrorBody: (mirrorId: string, event: React.MouseEvent<SVGElement> | React.TouchEvent<SVGElement>) => void;
  getSVGCoordinates: (clientX: number, clientY: number) => Point | null;
}

const RenderDetector: React.FC<{detector: DetectorType, isHit: boolean}> = ({ detector, isHit }) => {
  const renderDetectorArrow = () => {
    const { x, y, width: detWidth, height: detHeight, angle } = detector;
    const cx = x + detWidth / 2;
    const cy = y + detHeight / 2;
    
    let startX = cx, startY = cy; 
    let lineEndX = cx, lineEndY = cy; 

    if (angle === 0) { 
        startX = x; startY = cy; lineEndX = x + detWidth * 0.6; lineEndY = cy;
    } else if (angle === 180) { 
        startX = x + detWidth; startY = cy; lineEndX = x + detWidth * 0.4; lineEndY = cy;
    } else if (angle === 90) { 
        startX = cx; startY = y; lineEndX = cx; lineEndY = y + detHeight * 0.6;
    } else if (angle === 270) { 
        startX = cx; startY = y + detHeight; lineEndX = cx; lineEndY = y + detHeight * 0.4;
    }
    
    const arrowPath = `M ${startX} ${startY} L ${lineEndX} ${lineEndY}`;
    let ahP1x, ahP1y, ahP2x, ahP2y, ahP3x, ahP3y;
    const ahs = DETECTOR_ARROWHEAD_SIZE; 

    if (angle === 0) { 
        ahP1x = lineEndX; ahP1y = lineEndY; ahP2x = lineEndX - ahs; ahP2y = lineEndY - ahs/2; ahP3x = lineEndX - ahs; ahP3y = lineEndY + ahs/2;
    } else if (angle === 180) { 
        ahP1x = lineEndX; ahP1y = lineEndY; ahP2x = lineEndX + ahs; ahP2y = lineEndY - ahs/2; ahP3x = lineEndX + ahs; ahP3y = lineEndY + ahs/2;
    } else if (angle === 90) { 
        ahP1x = lineEndX; ahP1y = lineEndY; ahP2x = lineEndX - ahs/2; ahP2y = lineEndY - ahs; ahP3x = lineEndX + ahs/2; ahP3y = lineEndY - ahs;
    } else { 
        ahP1x = lineEndX; ahP1y = lineEndY; ahP2x = lineEndX - ahs/2; ahP2y = lineEndY + ahs; ahP3x = lineEndX + ahs/2; ahP3y = lineEndY + ahs;
    }

    return (
      <g className="pointer-events-none">
        <path d={arrowPath} stroke={isHit ? "white" : DETECTOR_ARROW_COLOR} strokeWidth="2.5" strokeLinecap="round" />
        <polygon points={`${ahP1x},${ahP1y} ${ahP2x},${ahP2y} ${ahP3x},${ahP3y}`} fill={isHit ? "white" : DETECTOR_ARROW_COLOR} />
      </g>
    );
  };

  return (
    <g role="img" aria-label={`Target detector ID ${detector.id}, requires light entry from ${detector.angle} degrees. Currently ${isHit ? 'active' : 'inactive'}.`}>
      <rect
        x={detector.x}
        y={detector.y}
        width={detector.width}
        height={detector.height}
        fill={isHit ? DETECTOR_HIT_COLOR : DETECTOR_BASE_COLOR}
        stroke={isHit ? "white" : "rgba(0,0,0,0.3)"}
        strokeWidth="1.5"
        rx="3" 
        ry="3"
      />
      <circle 
        cx={detector.x + detector.width / 2} 
        cy={detector.y + detector.height / 2} 
        r={DETECTOR_APERTURE_RADIUS}
        fill={isHit ? "lightyellow" : DETECTOR_APERTURE_COLOR}
        stroke={isHit ? DETECTOR_HIT_COLOR : DETECTOR_BASE_COLOR}
        strokeWidth="1"
      />
      {renderDetectorArrow()}
    </g>
  );
};

const RenderPlacedMirror: React.FC<{ mirror: PlacedMirror }> = ({ mirror }) => {
  const { p1, p2, type } = mirror;
  const mirrorVec = subtractPoints(p2, p1);
  const len = distance(p1, p2);
  if (len < 1) return null; // Avoid division by zero or tiny mirrors
  const dir = normalizeVector(mirrorVec);
  const perpDir = { x: -dir.y, y: dir.x };

  const visualElements: JSX.Element[] = [];

  if (type === 'default') {
    const backingOffset = 2;
    const p1Back = addPoints(p1, scaleVector(perpDir, -backingOffset));
    const p2Back = addPoints(p2, scaleVector(perpDir, -backingOffset));
    visualElements.push(
      <line
        key={`${mirror.id}-backing`}
        x1={p1Back.x} y1={p1Back.y} x2={p2Back.x} y2={p2Back.y}
        stroke={MIRROR_BACKING_COLOR} strokeWidth="5" strokeLinecap="round"
      />,
      <line
        key={`${mirror.id}-surface`}
        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={MIRROR_COLOR} strokeWidth="4" strokeLinecap="round"
      />,
       <line
        key={`${mirror.id}-highlight`}
        x1={p1.x + perpDir.x * 1.5} y1={p1.y + perpDir.y * 1.5} 
        x2={p2.x + perpDir.x * 1.5} y2={p2.y + perpDir.y * 1.5}
        stroke={MIRROR_EDGE_HIGHLIGHT_COLOR} strokeWidth="1" strokeLinecap="round" opacity="0.7"
      />
    );
  } else if (type === 'beam-splitter') {
    const thickness = 8;
    const halfThick = thickness / 2;
    const c1 = addPoints(p1, scaleVector(perpDir, halfThick));
    const c2 = addPoints(p2, scaleVector(perpDir, halfThick));
    const c3 = addPoints(p2, scaleVector(perpDir, -halfThick));
    const c4 = addPoints(p1, scaleVector(perpDir, -halfThick));
    visualElements.push(
      <polygon
        key={`${mirror.id}-glass`}
        points={`${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y} ${c4.x},${c4.y}`}
        fill={BEAM_SPLITTER_COLOR}
        fillOpacity={BEAM_SPLITTER_FILL_OPACITY}
        stroke={BEAM_SPLITTER_EDGE_COLOR}
        strokeWidth="1"
      />
    );
  } else if (type === 'diffraction-grating') {
    const thickness = 6;
    const halfThick = thickness / 2;
    const gc1 = addPoints(p1, scaleVector(perpDir, halfThick));
    const gc2 = addPoints(p2, scaleVector(perpDir, halfThick));
    const gc3 = addPoints(p2, scaleVector(perpDir, -halfThick));
    const gc4 = addPoints(p1, scaleVector(perpDir, -halfThick));
    visualElements.push(
      <polygon
        key={`${mirror.id}-base`}
        points={`${gc1.x},${gc1.y} ${gc2.x},${gc2.y} ${gc3.x},${gc3.y} ${gc4.x},${gc4.y}`}
        fill={DIFFRACTION_GRATING_COLOR}
        fillOpacity={DIFFRACTION_GRATING_FILL_OPACITY}
        stroke={DIFFRACTION_GRATING_EDGE_COLOR}
        strokeWidth="1"
      />
    );
    const numGratingLines = Math.max(5, Math.floor(len / 5)); // Ensure at least a few lines
    for (let i = 0; i <= numGratingLines; i++) {
      const linePos = i / numGratingLines;
      const lineCenter = addPoints(p1, scaleVector(dir, linePos * len));
      const lineStart = addPoints(lineCenter, scaleVector(perpDir, halfThick * 0.8));
      const lineEnd = addPoints(lineCenter, scaleVector(perpDir, -halfThick * 0.8));
      visualElements.push(
        <line
          key={`${mirror.id}-gratingline-${i}`}
          x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y}
          stroke={DIFFRACTION_GRATING_LINE_COLOR} strokeWidth="0.75"
        />
      );
    }
  }
  return <g>{visualElements}</g>;
};


export const GameCanvas: React.FC<GameCanvasProps> = ({
  svgRef,
  width,
  height,
  trackedLaserSources,
  detectors,
  placedMirrors,
  obstacles,
  globallyHitDetectorIds, 
  onDropMirror,
  onMouseDownOnMirrorPoint,
  onMouseDownOnMirrorBody,
  getSVGCoordinates
}) => {
  const handleDragOver = (event: React.DragEvent<SVGSVGElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<SVGSVGElement>) => {
    event.preventDefault();
    const templateId = event.dataTransfer.getData('text/plain');
    const coords = getSVGCoordinates(event.clientX, event.clientY);
    if (templateId && coords) {
      onDropMirror(templateId, coords.x, coords.y);
    }
  };
  
  const getSourceRotationAngle = (direction: Point): number => {
    if (typeof direction.x !== 'number' || typeof direction.y !== 'number' || (direction.x === 0 && direction.y === 0)) {
        return 0; 
    }
    const angleRad = Math.atan2(direction.y, direction.x);
    return angleRad * (180 / Math.PI);
  };

  const getHandleStrokeColor = (type: MirrorType): string => {
    switch (type) {
      case 'beam-splitter':
        return BEAM_SPLITTER_EDGE_COLOR;
      case 'diffraction-grating':
        return DIFFRACTION_GRATING_EDGE_COLOR;
      case 'default':
      default:
        return MIRROR_BACKING_COLOR; // Use a darker color for contrast with handle fill
    }
  };


  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="bg-white border border-slate-300 shadow-lg rounded"
      style={{ overflow: 'visible' }} // Allow rendering outside bounds
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label="Optical bench for laser reflection game"
    >
      <desc>Interactive game canvas for positioning mirrors and obstacles to reflect laser beams to target detectors.</desc>
      
      {/* Reflective Frame */}
      <line x1="0" y1="0" x2={GAME_WIDTH} y2="0" stroke={FRAME_COLOR} strokeWidth={FRAME_THICKNESS} />
      <line x1="0" y1={GAME_HEIGHT} x2={GAME_WIDTH} y2={GAME_HEIGHT} stroke={FRAME_COLOR} strokeWidth={FRAME_THICKNESS} />
      <line x1="0" y1="0" x2="0" y2={GAME_HEIGHT} stroke={FRAME_COLOR} strokeWidth={FRAME_THICKNESS} />
      <line x1={GAME_WIDTH} y1="0" x2={GAME_WIDTH} y2={GAME_HEIGHT} stroke={FRAME_COLOR} strokeWidth={FRAME_THICKNESS} />

      {trackedLaserSources.map(tls => {
        const rotationAngle = getSourceRotationAngle(tls.source.initialDirection);
        const apertureLocalCx = SOURCE_EMITTER_WIDTH / 2 - SOURCE_EMITTER_APERTURE_RADIUS * 0.8; 
        const apertureLocalCy = 0;

        return (
            <g 
                key={tls.source.id} 
                role="img" 
                aria-label={`Laser source emitter ID ${tls.source.id}`}
                transform={`translate(${tls.source.position.x}, ${tls.source.position.y}) rotate(${rotationAngle})`}
            >
              <rect 
                x={-SOURCE_EMITTER_WIDTH / 2} 
                y={-SOURCE_EMITTER_HEIGHT / 2}
                width={SOURCE_EMITTER_WIDTH}
                height={SOURCE_EMITTER_HEIGHT}
                fill={SOURCE_EMITTER_BODY_COLOR}
                rx="2" ry="2"
                stroke="rgba(0,0,0,0.2)" strokeWidth="1"
              />
              <circle 
                  cx={apertureLocalCx} 
                  cy={apertureLocalCy}
                  r={SOURCE_EMITTER_APERTURE_RADIUS} 
                  fill={SOURCE_EMITTER_APERTURE_COLOR} 
              />
               <circle 
                  cx={apertureLocalCx}
                  cy={apertureLocalCy}
                  r={SOURCE_EMITTER_APERTURE_RADIUS * 0.5} 
                  fill="white" 
                  opacity="0.7"
              />
            </g>
        );
      })}

      {detectors.map(detector => (
         <RenderDetector 
            key={detector.id} 
            detector={detector} 
            isHit={globallyHitDetectorIds.has(detector.id)} 
        />
      ))}

      {obstacles.map(o => {
        if (o.shape === 'line') {
          const lineObstacle = o as LineObstacle;
          return (
            <line
              key={o.id}
              x1={lineObstacle.p1.x}
              y1={lineObstacle.p1.y}
              x2={lineObstacle.p2.x}
              y2={lineObstacle.p2.y}
              stroke={OBSTACLE_COLOR}
              strokeWidth="8" 
              strokeLinecap="round"
              role="img"
              aria-label="Line obstacle, static"
            />
          );
        } else if (o.shape === 'rectangle') {
          const rectObstacle = o as RectangleObstacle;
          return (
            <rect
              key={o.id}
              x={rectObstacle.x}
              y={rectObstacle.y}
              width={rectObstacle.width}
              height={rectObstacle.height}
              fill={OBSTACLE_RECT_FILL_COLOR}
              stroke={OBSTACLE_COLOR}
              strokeWidth="2"
              rx="2" ry="2"
              role="img"
              aria-label="Rectangular obstacle, static"
            />
          );
        } else if (o.shape === 'circle') {
            const circleObstacle = o as CircleObstacle;
            return (
                <circle
                    key={o.id}
                    cx={circleObstacle.cx}
                    cy={circleObstacle.cy}
                    r={circleObstacle.radius}
                    fill={OBSTACLE_CIRCLE_FILL_COLOR}
                    stroke={OBSTACLE_COLOR}
                    strokeWidth="2"
                    role="img"
                    aria-label="Circular obstacle, static"
                />
            );
        }
        return null;
      })}

      {placedMirrors.map(m => (
        <g key={m.id} role="application" aria-label={`Mirror type ${m.type}, draggable. From (${Math.round(m.p1.x)}, ${Math.round(m.p1.y)}) to (${Math.round(m.p2.x)}, ${Math.round(m.p2.y)})`}>
          {/* Visual representation of the mirror */}
          <RenderPlacedMirror mirror={m} />
          
          {/* Invisible line for interaction */}
          <line
            x1={m.p1.x}
            y1={m.p1.y}
            x2={m.p2.x}
            y2={m.p2.y}
            stroke="transparent"
            strokeWidth="12" // Increased width for easier grabbing
            strokeLinecap="round"
            className="cursor-move active:cursor-grabbing" 
            onMouseDown={(e) => { e.stopPropagation(); onMouseDownOnMirrorBody(m.id, e);}}
            onTouchStart={(e) => { e.stopPropagation(); onMouseDownOnMirrorBody(m.id, e);}}
          />
          <circle
            cx={m.p1.x}
            cy={m.p1.y}
            r="8" 
            fill={MIRROR_HANDLE_COLOR}
            stroke={getHandleStrokeColor(m.type)}
            strokeWidth="1.5"
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => { e.stopPropagation(); onMouseDownOnMirrorPoint(m.id, 'p1');}}
            onTouchStart={(e) => { e.stopPropagation(); onMouseDownOnMirrorPoint(m.id, 'p1');}} 
            aria-label={`Mirror start point control at (${Math.round(m.p1.x)}, ${Math.round(m.p1.y)})`}
            tabIndex={0} 
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onMouseDownOnMirrorPoint(m.id, 'p1');}}}

          />
          <circle
            cx={m.p2.x}
            cy={m.p2.y}
            r="8" 
            fill={MIRROR_HANDLE_COLOR}
            stroke={getHandleStrokeColor(m.type)}
            strokeWidth="1.5"
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => { e.stopPropagation(); onMouseDownOnMirrorPoint(m.id, 'p2');}}
            onTouchStart={(e) => { e.stopPropagation(); onMouseDownOnMirrorPoint(m.id, 'p2');}} 
            aria-label={`Mirror end point control at (${Math.round(m.p2.x)}, ${Math.round(m.p2.y)})`}
            tabIndex={0} 
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onMouseDownOnMirrorPoint(m.id, 'p2');}}}
          />
        </g>
      ))}

      {trackedLaserSources.map(tls => (
        tls.laserPath.map((segment, i) => (
          <line
            key={`laser-${tls.id}-${i}-${Math.random()}`} 
            x1={segment.start.x}
            y1={segment.start.y}
            x2={segment.end.x}
            y2={segment.end.y}
            stroke={LASER_COLOR}
            strokeWidth="2.5"
            strokeLinecap="round"
            role="graphics-symbol"
            aria-label={`Laser segment ${i+1} for source ${tls.id}`}
          />
        ))
      ))}
      <defs>
      </defs>
    </svg>
  );
};
