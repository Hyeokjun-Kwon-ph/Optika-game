
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { MirrorPalette } from './components/MirrorPalette';
import { RefreshButton } from './components/RefreshButton';
import { MusicToggleButton } from './components/MusicToggleButton'; // Added import
import type { Point, PlacedMirror, Obstacle, LaserSegment, DetectorType, GameGoal, LaserSource, LineObstacle, RectangleObstacle, CircleObstacle, BoundaryObject } from './types';
import { 
    GAME_WIDTH, GAME_HEIGHT, MAX_REFLECTIONS, 
    DETECTOR_ACCEPTANCE_ANGLE_DEGREES, DETECTOR_WIDTH, DETECTOR_HEIGHT, MAX_PLACED_MIRRORS, 
    INITIAL_PALETTE_MIRRORS, MAX_LASER_DETECTOR_PAIRS, 
    SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT, OBSTACLE_COLLISION_BUFFER, GAME_BOUNDARY_PADDING,
    MIN_OBSTACLE_LINE_LENGTH, OBSTACLE_LINE_LENGTH_VARIANCE,
    MIN_OBSTACLE_DIMENSION, MAX_OBSTACLE_DIMENSION_VARIANCE,
    MIN_OBSTACLE_RADIUS, MAX_OBSTACLE_RADIUS_VARIANCE
} from './constants';
import { calculateReflection, findClosestIntersection, subtractPoints, normalizeVector, addPoints, scaleVector, dotProduct, distance, getBoundingBoxForItem, doBoundingBoxesOverlap } from './utils/geometry';

type DraggingMirrorInfo =
  | { mirror: PlacedMirror; type: 'endpoint'; pointType: 'p1' | 'p2' } 
  | { mirror: PlacedMirror; type: 'body'; dragStartMousePosition: Point; originalP1: Point; originalP2: Point };

const App: React.FC = () => {
  const [gameGoals, setGameGoals] = useState<GameGoal[]>([]);
  const [placedMirrors, setPlacedMirrors] = useState<PlacedMirror[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [overallSuccess, setOverallSuccess] = useState<boolean>(false);
  const [levelSeed, setLevelSeed] = useState<number>(0);

  const [draggingMirrorInfo, setDraggingMirrorInfo] = useState<DraggingMirrorInfo | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  useEffect(() => {
    if (!audioRef.current) {
        audioRef.current = new Audio('/assets/background-music.mp3'); 
        audioRef.current.loop = true;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const toggleMusic = useCallback(() => {
    if (audioRef.current) {
      if (isMusicPlaying) { // If currently playing, attempt to pause
        audioRef.current.pause();
        setIsMusicPlaying(false); // Update state to reflect paused
      } else { // If currently paused/stopped, attempt to play
        audioRef.current.play()
          .then(() => {
            setIsMusicPlaying(true); // Update state to reflect playing, only if play() promise resolves
          })
          .catch(error => {
            console.warn("Audio play was prevented. Ensure the file '/assets/background-music.mp3' exists or check browser policies.", error);
            // Ensure state remains false (or is set to false) if play fails
            setIsMusicPlaying(false); 
          });
      }
    }
  }, [isMusicPlaying]);


  const generateId = useCallback(() => Date.now().toString(36) + Math.random().toString(36).substring(2), []);

  const getSVGCoordinates = useCallback((clientX: number, clientY: number): Point | null => {
    if (svgRef.current) {
      const pt = svgRef.current.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
      return { x: svgP.x, y: svgP.y };
    }
    return null;
  }, []);

  const resetLevel = useCallback(() => {
    const newPlacedMirrors: PlacedMirror[] = [];
    setPlacedMirrors(newPlacedMirrors);
    setDraggingMirrorInfo(null);
    
    const numPairs = 1 + Math.floor(Math.random() * MAX_LASER_DETECTOR_PAIRS);
    const tempNewGoals: Omit<GameGoal, 'laserPath' | 'isHit'>[] = []; 
    
    const availableSourceEdges: ('left' | 'top' | 'bottom')[] = ['left', 'top', 'bottom'];
    const availableDetectorEdges: ('right' | 'top' | 'bottom')[] = ['right', 'top', 'bottom'];

    const usedSourcePositions: Point[] = [];
    const usedDetectorPositions: Point[] = [];

    for (let i = 0; i < numPairs; i++) {
        const goalId = `goal-${generateId()}-${i}`;
        const sourceId = `source-${generateId()}-${i}`;
        const detectorId = `detector-${generateId()}-${i}`;

        let sourcePos: Point;
        let sourceInitialDirection: Point;
        
        const sourceEdge = availableSourceEdges[Math.floor(Math.random() * availableSourceEdges.length)];
        let attempts = 0;
        do {
            const randomY = GAME_BOUNDARY_PADDING + SOURCE_EMITTER_HEIGHT / 2 + Math.random() * (GAME_HEIGHT - 2 * GAME_BOUNDARY_PADDING - SOURCE_EMITTER_HEIGHT);
            const randomX = GAME_BOUNDARY_PADDING + SOURCE_EMITTER_HEIGHT / 2 + Math.random() * (GAME_WIDTH - 2 * GAME_BOUNDARY_PADDING - SOURCE_EMITTER_HEIGHT);
            
            let directions: Point[];
            switch(sourceEdge) {
                case 'top':
                    sourcePos = { x: randomX, y: GAME_BOUNDARY_PADDING + SOURCE_EMITTER_WIDTH / 2 }; 
                    directions = [{x:0, y:1}, {x:0.707, y:0.707}, {x:-0.707, y:0.707}]; 
                    break;
                case 'bottom':
                    sourcePos = { x: randomX, y: GAME_HEIGHT - (GAME_BOUNDARY_PADDING + SOURCE_EMITTER_WIDTH / 2) };
                    directions = [{x:0, y:-1}, {x:0.707, y:-0.707}, {x:-0.707, y:-0.707}]; 
                    break;
                case 'left':
                default:
                    sourcePos = { x: GAME_BOUNDARY_PADDING + SOURCE_EMITTER_WIDTH / 2, y: randomY };
                    directions = [{x:1, y:0}, {x:0.707, y:0.707}, {x:0.707, y:-0.707}]; 
                    break;
            }
            sourceInitialDirection = normalizeVector(directions[Math.floor(Math.random() * directions.length)]);
            attempts++;
        } while (usedSourcePositions.some(p => distance(p, sourcePos) < Math.max(SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT) * 1.5) && attempts < 10);
        usedSourcePositions.push(sourcePos);

        let detectorPos: Point;
        const detectorEdge = availableDetectorEdges[Math.floor(Math.random() * availableDetectorEdges.length)];
        attempts = 0;
        do {
            const randomYDet = GAME_BOUNDARY_PADDING + DETECTOR_HEIGHT/2 + Math.random() * (GAME_HEIGHT - 2 * GAME_BOUNDARY_PADDING - DETECTOR_HEIGHT);
            const randomXDet = GAME_BOUNDARY_PADDING + DETECTOR_WIDTH/2 + Math.random() * (GAME_WIDTH - 2* GAME_BOUNDARY_PADDING - DETECTOR_WIDTH);
            switch(detectorEdge) {
                case 'top':
                    detectorPos = { x: randomXDet, y: GAME_BOUNDARY_PADDING };
                    break;
                case 'bottom':
                    detectorPos = { x: randomXDet, y: GAME_HEIGHT - GAME_BOUNDARY_PADDING - DETECTOR_HEIGHT };
                    break;
                case 'right':
                default:
                    detectorPos = { x: GAME_WIDTH - GAME_BOUNDARY_PADDING - DETECTOR_WIDTH, y: randomYDet };
                    break;
            }
            attempts++;
        } while (usedDetectorPositions.some(p => distance(p, {x: detectorPos.x + DETECTOR_WIDTH/2, y: detectorPos.y + DETECTOR_HEIGHT/2 }) < DETECTOR_HEIGHT * 1.5) && attempts < 10);
        usedDetectorPositions.push({x: detectorPos.x + DETECTOR_WIDTH/2, y: detectorPos.y + DETECTOR_HEIGHT/2 });
        
        const possibleAngles = [0, 90, 180, 270];
        const randomAngle = possibleAngles[Math.floor(Math.random() * possibleAngles.length)];

        tempNewGoals.push({
            id: goalId,
            source: { id: sourceId, position: sourcePos, initialDirection: sourceInitialDirection },
            detector: { 
                id: detectorId, 
                x: detectorPos.x, 
                y: detectorPos.y,
                width: DETECTOR_WIDTH, 
                height: DETECTOR_HEIGHT, 
                angle: randomAngle 
            },
        });
    }
    
    const newObstaclesList: Obstacle[] = [];
    const numObstaclesToGenerate = 15 + Math.floor(Math.random() * 16); 
    const MAX_ATTEMPTS_PER_OBSTACLE = 20;

    const itemsToAvoidCollisionWith: (Obstacle | LaserSource | DetectorType)[] = [];
    tempNewGoals.forEach(goal => {
        itemsToAvoidCollisionWith.push(goal.source);
        itemsToAvoidCollisionWith.push(goal.detector);
    });

    const obsPlacementXMin = GAME_BOUNDARY_PADDING + Math.max(SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT) + 30; 
    const obsPlacementXMax = GAME_WIDTH - (GAME_BOUNDARY_PADDING + DETECTOR_WIDTH + 30);
    const obsPlacementYMin = GAME_BOUNDARY_PADDING + Math.max(SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT) + 30;
    const obsPlacementYMax = GAME_HEIGHT - (GAME_BOUNDARY_PADDING + Math.max(SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT) + 30);

    for (let i = 0; i < numObstaclesToGenerate; i++) {
        let placedObstacleSuccessfully = false;
        for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_OBSTACLE; attempt++) {
            let candidateObstacle: Obstacle;
            const shapeOptions: ('line' | 'rectangle' | 'circle')[] = ['line', 'rectangle', 'circle'];
            const shape = shapeOptions[Math.floor(Math.random() * shapeOptions.length)];
            const id = `obs-${generateId()}-${i}-${attempt}`;

            if (shape === 'line') {
                let p1: Point, p2: Point; let lineAttempts = 0;
                do {
                    p1 = { x: obsPlacementXMin + Math.random() * (obsPlacementXMax - obsPlacementXMin), y: obsPlacementYMin + Math.random() * (obsPlacementYMax - obsPlacementYMin) };
                    const angle = Math.random() * 2 * Math.PI; const length = MIN_OBSTACLE_LINE_LENGTH + Math.random() * OBSTACLE_LINE_LENGTH_VARIANCE;
                    p2 = { x: p1.x + Math.cos(angle) * length, y: p1.y + Math.sin(angle) * length };
                    lineAttempts++;
                } while ((p2.x < GAME_BOUNDARY_PADDING || p2.x > GAME_WIDTH - GAME_BOUNDARY_PADDING || p2.y < GAME_BOUNDARY_PADDING || p2.y > GAME_HEIGHT - GAME_BOUNDARY_PADDING || p1.x < GAME_BOUNDARY_PADDING || p1.x > GAME_WIDTH - GAME_BOUNDARY_PADDING || p1.y < GAME_BOUNDARY_PADDING || p1.y > GAME_HEIGHT - GAME_BOUNDARY_PADDING) && lineAttempts < 10);
                if (lineAttempts === 10) continue; 
                p1.x = Math.max(GAME_BOUNDARY_PADDING, Math.min(GAME_WIDTH - GAME_BOUNDARY_PADDING, p1.x)); p1.y = Math.max(GAME_BOUNDARY_PADDING, Math.min(GAME_HEIGHT - GAME_BOUNDARY_PADDING, p1.y));
                p2.x = Math.max(GAME_BOUNDARY_PADDING, Math.min(GAME_WIDTH - GAME_BOUNDARY_PADDING, p2.x)); p2.y = Math.max(GAME_BOUNDARY_PADDING, Math.min(GAME_HEIGHT - GAME_BOUNDARY_PADDING, p2.y));
                if (distance(p1, p2) < MIN_OBSTACLE_LINE_LENGTH / 2) continue;
                candidateObstacle = { id, shape: 'line', p1, p2 };
            } else if (shape === 'rectangle') {
                const width = MIN_OBSTACLE_DIMENSION + Math.random() * MAX_OBSTACLE_DIMENSION_VARIANCE; const height = MIN_OBSTACLE_DIMENSION + Math.random() * MAX_OBSTACLE_DIMENSION_VARIANCE;
                const x = obsPlacementXMin + Math.random() * (obsPlacementXMax - obsPlacementXMin - width); const y = obsPlacementYMin + Math.random() * (obsPlacementYMax - obsPlacementYMin - height);
                if (x < GAME_BOUNDARY_PADDING || x + width > GAME_WIDTH - GAME_BOUNDARY_PADDING || y < GAME_BOUNDARY_PADDING || y + height > GAME_HEIGHT - GAME_BOUNDARY_PADDING) continue;
                candidateObstacle = { id, shape: 'rectangle', x, y, width, height };
            } else { 
                const radius = MIN_OBSTACLE_RADIUS + Math.random() * MAX_OBSTACLE_RADIUS_VARIANCE;
                const cx = obsPlacementXMin + radius + Math.random() * (Math.max(0, obsPlacementXMax - obsPlacementXMin - 2 * radius)); const cy = obsPlacementYMin + radius + Math.random() * (Math.max(0, obsPlacementYMax - obsPlacementYMin - 2 * radius));
                if (cx - radius < GAME_BOUNDARY_PADDING || cx + radius > GAME_WIDTH - GAME_BOUNDARY_PADDING || cy - radius < GAME_BOUNDARY_PADDING || cy + radius > GAME_HEIGHT - GAME_BOUNDARY_PADDING) continue;
                candidateObstacle = {id, shape: 'circle', cx, cy, radius};
            }

            const candidateBox = getBoundingBoxForItem(candidateObstacle, SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT);
            let isOverlapping = false;
            for (const existingItem of itemsToAvoidCollisionWith) {
                const existingBox = getBoundingBoxForItem(existingItem, SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT);
                if (doBoundingBoxesOverlap(candidateBox, existingBox, OBSTACLE_COLLISION_BUFFER)) { isOverlapping = true; break; }
            }
            if (!isOverlapping) { newObstaclesList.push(candidateObstacle); itemsToAvoidCollisionWith.push(candidateObstacle); placedObstacleSuccessfully = true; break; }
        }
    }
    setObstacles(newObstaclesList);

    const allDetectorsForNewGoals = tempNewGoals.map(g => g.detector);
    const finalNewGoals = tempNewGoals.map(tempGoal => {
        const pathSegments: LaserSegment[] = [];
        let currentRayOrigin = tempGoal.source.position;
        let currentRayDirection = tempGoal.source.initialDirection;
        let goalIsHit = false;

        for (let i = 0; i < MAX_REFLECTIONS; i++) {
            const intersection = findClosestIntersection(currentRayOrigin, currentRayDirection, newPlacedMirrors, newObstaclesList, allDetectorsForNewGoals);
            if (!intersection) {
                const farPoint = addPoints(currentRayOrigin, scaleVector(currentRayDirection, Math.max(GAME_WIDTH, GAME_HEIGHT) * 2));
                pathSegments.push({ start: currentRayOrigin, end: farPoint });
                break;
            }
            pathSegments.push({ start: currentRayOrigin, end: intersection.point });
            currentRayOrigin = intersection.point;

            if (intersection.type === 'detector') {
                const hitDetector = intersection.object as DetectorType;
                if (hitDetector.id === tempGoal.detector.id) { 
                    const lastSegment = pathSegments[pathSegments.length - 1];
                    const laserIncidentDirection = normalizeVector(subtractPoints(lastSegment.end, lastSegment.start));
                    let requiredEntryDirection: Point;
                    if (tempGoal.detector.angle === 0) requiredEntryDirection = { x: 1, y: 0 }; 
                    else if (tempGoal.detector.angle === 90) requiredEntryDirection = { x: 0, y: 1 }; 
                    else if (tempGoal.detector.angle === 180) requiredEntryDirection = { x: -1, y: 0 };
                    else requiredEntryDirection = { x: 0, y: -1 }; 
                    const dot = dotProduct(laserIncidentDirection, requiredEntryDirection);
                    const acceptanceThresholdCosine = Math.cos((DETECTOR_ACCEPTANCE_ANGLE_DEGREES * Math.PI) / 180);
                    if (dot > acceptanceThresholdCosine) { goalIsHit = true; }
                }
                break; 
            } else if (intersection.type === 'obstacle') {
                break;
            } else if (intersection.type === 'mirror') { 
                const mirror = intersection.object as PlacedMirror; 
                const segmentVector = subtractPoints(mirror.p2, mirror.p1);
                let normal = normalizeVector({ x: -(segmentVector.y), y: segmentVector.x });
                const incidentVector = scaleVector(currentRayDirection, -1); 
                if (dotProduct(incidentVector, normal) < 0) { normal = scaleVector(normal, -1); }
                currentRayDirection = calculateReflection(currentRayDirection, normal);
            } else if (intersection.type === 'boundary') {
                const boundary = intersection.object as BoundaryObject;
                currentRayDirection = calculateReflection(currentRayDirection, boundary.normal);
            }
        }
        return { ...tempGoal, laserPath: pathSegments, isHit: goalIsHit };
    });

    setGameGoals(finalNewGoals);
    setOverallSuccess(false);
  }, [generateId]);

  useEffect(() => {
    resetLevel();
  }, [levelSeed, resetLevel]); 


  useEffect(() => {
    if (gameGoals.length === 0) {
      if(overallSuccess) setOverallSuccess(false);
      return;
    }

    const allDetectors = gameGoals.map(g => g.detector);
    const goalsWithNewPaths = gameGoals.map(goal => {
      const currentSource = goal.source;
      const currentDetector = goal.detector;

      const pathSegments: LaserSegment[] = [];
      let currentRayOrigin = currentSource.position;
      let currentRayDirection = currentSource.initialDirection;
      let goalIsHit = false;

      for (let i = 0; i < MAX_REFLECTIONS; i++) {
        const intersection = findClosestIntersection(currentRayOrigin, currentRayDirection, placedMirrors, obstacles, allDetectors);

        if (!intersection) {
          const farPoint = addPoints(currentRayOrigin, scaleVector(currentRayDirection, Math.max(GAME_WIDTH, GAME_HEIGHT) * 2));
          pathSegments.push({ start: currentRayOrigin, end: farPoint });
          break;
        }

        pathSegments.push({ start: currentRayOrigin, end: intersection.point });
        currentRayOrigin = intersection.point;

        if (intersection.type === 'detector') {
          const hitDetector = intersection.object as DetectorType;
          if (hitDetector.id === currentDetector.id) { 
            const lastSegment = pathSegments[pathSegments.length - 1];
            const laserIncidentDirection = normalizeVector(subtractPoints(lastSegment.end, lastSegment.start));
            
            let requiredEntryDirection: Point;
            if (currentDetector.angle === 0) requiredEntryDirection = { x: 1, y: 0 }; 
            else if (currentDetector.angle === 90) requiredEntryDirection = { x: 0, y: 1 }; 
            else if (currentDetector.angle === 180) requiredEntryDirection = { x: -1, y: 0 };
            else requiredEntryDirection = { x: 0, y: -1 }; 

            const dot = dotProduct(laserIncidentDirection, requiredEntryDirection);
            const acceptanceThresholdCosine = Math.cos((DETECTOR_ACCEPTANCE_ANGLE_DEGREES * Math.PI) / 180);
            
            if (dot > acceptanceThresholdCosine) {
              goalIsHit = true;
            }
          }
          break; 
        } else if (intersection.type === 'obstacle') {
          break;
        } else if (intersection.type === 'mirror') {
          const mirror = intersection.object as PlacedMirror;
          const segmentVector = subtractPoints(mirror.p2, mirror.p1);
          let normal = normalizeVector({ x: -(segmentVector.y), y: segmentVector.x });
          
          const incidentVector = scaleVector(currentRayDirection, -1); 
          if (dotProduct(incidentVector, normal) < 0) {
              normal = scaleVector(normal, -1);
          }
          currentRayDirection = calculateReflection(currentRayDirection, normal);
        } else if (intersection.type === 'boundary') {
            const boundary = intersection.object as BoundaryObject;
            currentRayDirection = calculateReflection(currentRayDirection, boundary.normal);
        }
      }
      return { ...goal, laserPath: pathSegments, isHit: goalIsHit }; 
    });
    
    let pathsOrHitsChanged = false;
    if (goalsWithNewPaths.length !== gameGoals.length) {
        pathsOrHitsChanged = true; 
    } else {
        for (let i = 0; i < goalsWithNewPaths.length; i++) {
            if (goalsWithNewPaths[i].isHit !== gameGoals[i].isHit ||
                JSON.stringify(goalsWithNewPaths[i].laserPath) !== JSON.stringify(gameGoals[i].laserPath)
            ) {
                pathsOrHitsChanged = true;
                break;
            }
        }
    }

    if (pathsOrHitsChanged) {
        setGameGoals(goalsWithNewPaths);
    }
    
  }, [gameGoals, placedMirrors, obstacles, overallSuccess]);

  useEffect(() => {
    if (gameGoals.length > 0 && gameGoals.every(g => g.isHit)) {
        if(!overallSuccess) setOverallSuccess(true);
    } else {
        if(overallSuccess) setOverallSuccess(false);
    }
  }, [gameGoals, overallSuccess]);


  const handleDropMirror = useCallback((templateId: string, dropX: number, dropY: number) => {
    if (placedMirrors.length >= MAX_PLACED_MIRRORS) {
        console.warn("Max mirrors placed.");
        return;
    }
    const template = INITIAL_PALETTE_MIRRORS.find(t => t.id === templateId);
    if (!template) return;

    const newMirrorId = generateId();
    let p1: Point, p2: Point;
    const length = template.defaultLength;

    if (template.defaultAngle !== undefined) {
        const angleRad = template.defaultAngle * (Math.PI / 180);
        p1 = { x: dropX - (length / 2) * Math.cos(angleRad), y: dropY - (length / 2) * Math.sin(angleRad) };
        p2 = { x: dropX + (length / 2) * Math.cos(angleRad), y: dropY + (length / 2) * Math.sin(angleRad) };
    } else { 
        p1 = { x: dropX - length / 2, y: dropY };
        p2 = { x: dropX + length / 2, y: dropY };
    }
    
    const newMirror: PlacedMirror = { id: newMirrorId, p1, p2, type: template.type };
    setPlacedMirrors(prev => [...prev, newMirror]);
  }, [generateId, placedMirrors.length]);

  const handleMouseDownOnMirrorPoint = (mirrorId: string, pointType: 'p1' | 'p2') => {
    const mirror = placedMirrors.find(m => m.id === mirrorId);
    if (mirror) {
        setDraggingMirrorInfo({ mirror, type: 'endpoint', pointType });
    }
  };
  
  const handleMouseDownOnMirrorBody = (mirrorId: string, event: React.MouseEvent<SVGElement> | React.TouchEvent<SVGElement>) => {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const coords = getSVGCoordinates(clientX, clientY);
    const mirror = placedMirrors.find(m => m.id === mirrorId);

    if (mirror && coords) {
        setDraggingMirrorInfo({ mirror, type: 'body', dragStartMousePosition: coords, originalP1: mirror.p1, originalP2: mirror.p2 });
    }
  };

  const handleMouseMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const coords = getSVGCoordinates(clientX, clientY);
    if (!coords || !draggingMirrorInfo) return;
    event.preventDefault();

    let potentialNewP1: Point, potentialNewP2: Point;
    const { mirror } = draggingMirrorInfo;

    if (draggingMirrorInfo.type === 'body') {
        const { dragStartMousePosition, originalP1, originalP2 } = draggingMirrorInfo;
        const deltaX = coords.x - dragStartMousePosition.x;
        const deltaY = coords.y - dragStartMousePosition.y;
        potentialNewP1 = { x: originalP1.x + deltaX, y: originalP1.y + deltaY };
        potentialNewP2 = { x: originalP2.x + deltaX, y: originalP2.y + deltaY };
    } else if (draggingMirrorInfo.type === 'endpoint') {
        const { pointType } = draggingMirrorInfo;
        const fixedPoint = pointType === 'p1' ? mirror.p2 : mirror.p1;
        const originalLength = distance(mirror.p1, mirror.p2);
        if (originalLength < 0.001) { potentialNewP1 = fixedPoint; potentialNewP2 = fixedPoint; } 
        else {
            const vectorToMouse = subtractPoints(coords, fixedPoint);
            const normalizedVectorToMouse = normalizeVector(vectorToMouse);
            const newOffset = scaleVector(normalizedVectorToMouse, originalLength);
            const newDraggedPointPosition = addPoints(fixedPoint, newOffset);
            if (pointType === 'p1') { potentialNewP1 = newDraggedPointPosition; potentialNewP2 = mirror.p2; } 
            else { potentialNewP1 = mirror.p1; potentialNewP2 = newDraggedPointPosition; }
        }
    } else { return; }

    const updatedMirror: PlacedMirror = { ...mirror, p1: potentialNewP1, p2: potentialNewP2 };
    setPlacedMirrors(prevMirrors => prevMirrors.map(m => (m.id === mirror.id ? updatedMirror : m)));
    setDraggingMirrorInfo(prev => {
        if (!prev) return null;
        return { ...prev, mirror: updatedMirror };
    });
  }, [draggingMirrorInfo, getSVGCoordinates]);

  const handleMouseUpOrTouchEnd = useCallback(() => {
    setDraggingMirrorInfo(null);
  }, []);

  return (
    <div 
        className="flex flex-col h-screen bg-stone-100 text-stone-800 select-none" 
        onMouseUp={handleMouseUpOrTouchEnd}
        onTouchEnd={handleMouseUpOrTouchEnd}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
      >
        <header className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white p-3 sm:p-4 shadow-xl flex justify-between items-center">
          <h1 
            className="text-4xl sm:text-6xl font-serif font-extrabold tracking-wider"
            style={{textShadow: '0 0 5px rgba(255,255,255,0.3), 0 0 10px rgba(75, 85, 99, 0.5), 2px 2px 2px rgba(0,0,0,0.7)'}}
          >
            Optika
          </h1>
          <div className="flex items-center space-x-2">
            <MusicToggleButton onToggle={toggleMusic} isPlaying={isMusicPlaying} />
            <RefreshButton onRefresh={() => setLevelSeed(s => s + 1)} />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 p-4 overflow-auto flex justify-center items-center">
            <GameCanvas
              svgRef={svgRef}
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
              gameGoals={gameGoals}
              placedMirrors={placedMirrors}
              obstacles={obstacles}
              overallSuccess={overallSuccess}
              onDropMirror={handleDropMirror}
              onMouseDownOnMirrorPoint={handleMouseDownOnMirrorPoint}
              onMouseDownOnMirrorBody={handleMouseDownOnMirrorBody}
              getSVGCoordinates={getSVGCoordinates}
            />
          </main>
          <aside className="w-1/4 max-w-xs p-4 bg-slate-100 border-l border-slate-300 shadow-inner overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">Mirrors</h2>
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              Place up to {MAX_PLACED_MIRRORS} mirrors. <br/>
              Used: {placedMirrors.length}/{MAX_PLACED_MIRRORS}
            </div>
            <MirrorPalette mirrors={INITIAL_PALETTE_MIRRORS} canPlaceMoreMirrors={placedMirrors.length < MAX_PLACED_MIRRORS} />
            {overallSuccess && (
              <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded-lg shadow-lg text-center">
                <h3 className="text-2xl font-bold text-green-700">Target Hit!</h3>
                <p className="text-green-600">Congratulations! All lasers reached their detectors.</p>
              </div>
            )}
          </aside>
        </div>
    </div>
  );
};

export default App;
