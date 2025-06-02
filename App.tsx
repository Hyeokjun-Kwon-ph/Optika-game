
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { MirrorPalette } from './components/MirrorPalette';
import { RefreshButton } from './components/RefreshButton';
import { TrashCan } from './components/TrashCan';
import type { Point, PlacedMirror, Obstacle, LaserSegment, DetectorType, LaserSource, LineObstacle, RectangleObstacle, CircleObstacle, BoundaryObject, MirrorType, TrackedLaserSource } from './types';
import { 
    GAME_WIDTH, GAME_HEIGHT, MAX_REFLECTIONS, 
    DETECTOR_ACCEPTANCE_ANGLE_DEGREES, DETECTOR_WIDTH, DETECTOR_HEIGHT, MAX_PLACED_MIRRORS, 
    INITIAL_PALETTE_MIRRORS, MAX_DETECTECTORS, MAX_LASER_SOURCES,
    SOURCE_EMITTER_WIDTH, SOURCE_EMITTER_HEIGHT, OBSTACLE_COLLISION_BUFFER, GAME_BOUNDARY_PADDING,
    MIN_OBSTACLE_LINE_LENGTH, OBSTACLE_LINE_LENGTH_VARIANCE,
    MIN_OBSTACLE_DIMENSION, MAX_OBSTACLE_DIMENSION_VARIANCE,
    MIN_OBSTACLE_RADIUS, MAX_OBSTACLE_RADIUS_VARIANCE,
    GRATING_K_CONSTANT 
} from './constants';
import { calculateReflection, findClosestIntersection, subtractPoints, normalizeVector, addPoints, scaleVector, dotProduct, distance, getBoundingBoxForItem, doBoundingBoxesOverlap } from './utils/geometry';

type DraggingMirrorInfo =
  | { mirror: PlacedMirror; type: 'endpoint'; pointType: 'p1' | 'p2' } 
  | { mirror: PlacedMirror; type: 'body'; dragStartMousePosition: Point; originalP1: Point; originalP2: Point };


// Calculates laser paths for a given source and identifies all detectors hit correctly by this source.
const calculateLaserPathsForSource = (
    source: LaserSource,
    placedMirrors: PlacedMirror[],
    obstacles: Obstacle[],
    allDetectorsOnBoard: DetectorType[] 
): { segments: LaserSegment[], allCorrectlyHitDetectorIdsFromThisSource: Set<string> } => {
    const activeRays: Array<{ origin: Point, direction: Point, remainingInteractions: number }> = [
        { origin: source.position, direction: source.initialDirection, remainingInteractions: MAX_REFLECTIONS }
    ];
    const allSegmentsForThisSource: LaserSegment[] = [];
    const correctlyHitDetectorIdsThisSource = new Set<string>();
    const processedRayStarts = new Set<string>();

    while (activeRays.length > 0) {
        const currentRayState = activeRays.shift();
        if (!currentRayState || currentRayState.remainingInteractions <= 0) continue;

        const { origin: rayOrigin, direction: rayDirection, remainingInteractions } = currentRayState;
        
        const rayKey = `${rayOrigin.x.toFixed(3)},${rayOrigin.y.toFixed(3)}-${rayDirection.x.toFixed(3)},${rayDirection.y.toFixed(3)}-${remainingInteractions}`;
        if (processedRayStarts.has(rayKey)) continue;
        processedRayStarts.add(rayKey);

        const intersection = findClosestIntersection(rayOrigin, rayDirection, placedMirrors, obstacles, allDetectorsOnBoard);

        if (!intersection) {
            const farPoint = addPoints(rayOrigin, scaleVector(rayDirection, Math.max(GAME_WIDTH, GAME_HEIGHT) * 2));
            allSegmentsForThisSource.push({ start: rayOrigin, end: farPoint });
            continue; 
        }

        allSegmentsForThisSource.push({ start: rayOrigin, end: intersection.point });
        const nextOrigin = intersection.point;

        if (intersection.type === 'detector') {
            const hitDetector = intersection.object as DetectorType;
            const laserIncidentDirection = normalizeVector(subtractPoints(nextOrigin, rayOrigin));
            let requiredEntryDirection: Point;
            if (hitDetector.angle === 0) requiredEntryDirection = { x: 1, y: 0 }; 
            else if (hitDetector.angle === 90) requiredEntryDirection = { x: 0, y: 1 }; 
            else if (hitDetector.angle === 180) requiredEntryDirection = { x: -1, y: 0 };
            else requiredEntryDirection = { x: 0, y: -1 }; 
            
            const dotVal = dotProduct(laserIncidentDirection, requiredEntryDirection);
            const acceptanceThresholdCosine = Math.cos((DETECTOR_ACCEPTANCE_ANGLE_DEGREES * Math.PI) / 180);

            if (dotVal > acceptanceThresholdCosine) {
              correctlyHitDetectorIdsThisSource.add(hitDetector.id);
            }
        } else if (intersection.type === 'obstacle') {
            // Stop this branch
        } else if (intersection.type === 'boundary') {
            const boundary = intersection.object as BoundaryObject;
            const reflectedDir = calculateReflection(rayDirection, boundary.normal);
            if (remainingInteractions - 1 > 0) {
                activeRays.push({ origin: nextOrigin, direction: reflectedDir, remainingInteractions: remainingInteractions - 1 });
            }
        } else if (intersection.type === 'mirror') { 
            const mirror = intersection.object as PlacedMirror; 
            const segmentVector = subtractPoints(mirror.p2, mirror.p1); 
            
            if (mirror.type === 'default' || mirror.type === 'beam-splitter') {
                let surfaceNormalForReflection = normalizeVector({ x: -(segmentVector.y), y: segmentVector.x }); 
                const incidentVectorForNormalCheck = scaleVector(rayDirection, -1); 
                if (dotProduct(incidentVectorForNormalCheck, surfaceNormalForReflection) < 0) { 
                    surfaceNormalForReflection = scaleVector(surfaceNormalForReflection, -1); 
                }
                const reflectedDir = calculateReflection(rayDirection, surfaceNormalForReflection);
                if (remainingInteractions - 1 > 0) {
                    activeRays.push({ origin: nextOrigin, direction: reflectedDir, remainingInteractions: remainingInteractions - 1 });
                }
                if (mirror.type === 'beam-splitter') { 
                    if (remainingInteractions - 1 > 0) {
                        activeRays.push({ origin: nextOrigin, direction: rayDirection, remainingInteractions: remainingInteractions - 1 });
                    }
                }
            } else if (mirror.type === 'diffraction-grating') {
                if (remainingInteractions - 1 > 0) {
                    activeRays.push({ 
                        origin: nextOrigin, 
                        direction: rayDirection, 
                        remainingInteractions: remainingInteractions - 1 
                    });
                }

                const gratingSegmentVec = subtractPoints(mirror.p2, mirror.p1);
                const N_base = normalizeVector({ x: -gratingSegmentVec.y, y: gratingSegmentVec.x });

                let normal_for_incidence = N_base;
                let angle_normal_for_incidence = Math.atan2(N_base.y, N_base.x);

                const incident_dot_base_normal = dotProduct(rayDirection, N_base);
                if (incident_dot_base_normal > 0) { 
                    normal_for_incidence = scaleVector(N_base, -1);
                    angle_normal_for_incidence = Math.atan2(normal_for_incidence.y, normal_for_incidence.x);
                }
                
                const normal_for_diffraction = scaleVector(normal_for_incidence, -1); 
                const angle_normal_for_diffraction = Math.atan2(normal_for_diffraction.y, normal_for_diffraction.x);
                
                const angle_incident_ray_global = Math.atan2(rayDirection.y, rayDirection.x);
                const theta_i_signed = angle_incident_ray_global - angle_normal_for_incidence; 

                const orders = [1, -1];
                for (const m of orders) {
                    const sin_theta_m_signed = Math.sin(theta_i_signed) - m * GRATING_K_CONSTANT;

                    if (Math.abs(sin_theta_m_signed) <= 1.0) {
                        const theta_m_signed_principal = Math.asin(sin_theta_m_signed); 
                        
                        const angleDiffractedRayGlobal = angle_normal_for_diffraction + theta_m_signed_principal;
                        
                        const diffractedDirection = normalizeVector({
                            x: Math.cos(angleDiffractedRayGlobal),
                            y: Math.sin(angleDiffractedRayGlobal)
                        });

                        if (remainingInteractions - 1 > 0) {
                            activeRays.push({ 
                                origin: nextOrigin, 
                                direction: diffractedDirection, 
                                remainingInteractions: remainingInteractions - 1 
                            });
                        }
                    }
                }
            }
        }
    }
    return { segments: allSegmentsForThisSource, allCorrectlyHitDetectorIdsFromThisSource: correctlyHitDetectorIdsThisSource };
};


const App: React.FC = () => {
  const [trackedLaserSources, setTrackedLaserSources] = useState<TrackedLaserSource[]>([]);
  const [detectors, setDetectors] = useState<DetectorType[]>([]);
  const [placedMirrors, setPlacedMirrors] = useState<PlacedMirror[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [overallSuccess, setOverallSuccess] = useState<boolean>(false);
  const [levelSeed, setLevelSeed] = useState<number>(0);
  const [masterCorrectlyHitDetectorIds, setMasterCorrectlyHitDetectorIds] = useState<Set<string>>(new Set());

  const [draggingMirrorInfo, setDraggingMirrorInfo] = useState<DraggingMirrorInfo | null>(null);
  const [isPointerOverTrash, setIsPointerOverTrash] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const trashCanRef = useRef<HTMLDivElement>(null);


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
    setPlacedMirrors([]);
    setDraggingMirrorInfo(null);
    setMasterCorrectlyHitDetectorIds(new Set());
    setIsPointerOverTrash(false);
    
    const numSourcesToGenerate = 1 + Math.floor(Math.random() * MAX_LASER_SOURCES);
    
    let numDetectorsToGenerate = numSourcesToGenerate + 1; 
    if (numDetectorsToGenerate < MAX_DETECTECTORS) {
        const maxCanAdd = MAX_DETECTECTORS - numDetectorsToGenerate;
        numDetectorsToGenerate += Math.floor(Math.random() * (maxCanAdd + 1));
    }
    numDetectorsToGenerate = Math.min(MAX_DETECTECTORS, numDetectorsToGenerate);
    numDetectorsToGenerate = Math.max(numSourcesToGenerate + 1, numDetectorsToGenerate);


    const tempNewSources: LaserSource[] = [];
    const tempNewDetectors: DetectorType[] = [];
    
    const availableSourceEdges: ('left' | 'top' | 'bottom')[] = ['left', 'top', 'bottom'];
    const availableDetectorEdges: ('right' | 'top' | 'bottom')[] = ['right', 'top', 'bottom'];

    const usedSourcePositions: Point[] = [];
    const usedDetectorPositions: Point[] = [];

    for (let i = 0; i < numSourcesToGenerate; i++) {
        const sourceId = `source-${generateId()}-${i}`;
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
        tempNewSources.push({ id: sourceId, position: sourcePos, initialDirection: sourceInitialDirection });
    }

    for (let i = 0; i < numDetectorsToGenerate; i++) {
        const detectorId = `detector-${generateId()}-${i}`;
        let detectorPos: Point;
        const detectorEdge = availableDetectorEdges[Math.floor(Math.random() * availableDetectorEdges.length)];
        let attempts = 0;
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
        
        let detectorAngle: number;
        switch(detectorEdge) {
            case 'top': detectorAngle = 270; break; 
            case 'bottom': detectorAngle = 90; break; 
            case 'right': default: detectorAngle = 0; break; 
        }
        tempNewDetectors.push({ 
            id: detectorId, 
            x: detectorPos.x, 
            y: detectorPos.y,
            width: DETECTOR_WIDTH, 
            height: DETECTOR_HEIGHT, 
            angle: detectorAngle
        });
    }
    
    const newObstaclesList: Obstacle[] = [];
    const numObstaclesToGenerate = 10 + Math.floor(Math.random() * 11); 
    const MAX_ATTEMPTS_PER_OBSTACLE = 20;

    const itemsToAvoidCollisionWith: (Obstacle | LaserSource | DetectorType)[] = [];
    tempNewSources.forEach(s => itemsToAvoidCollisionWith.push(s));
    tempNewDetectors.forEach(d => itemsToAvoidCollisionWith.push(d));

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
    setDetectors(tempNewDetectors);
    setTrackedLaserSources(tempNewSources.map(s => ({ id: s.id, source: s, laserPath: [] })));
    setOverallSuccess(false); 
  }, [generateId]);

  useEffect(() => {
    resetLevel();
  }, [levelSeed, resetLevel]); 


  useEffect(() => {
    if (trackedLaserSources.length === 0 || detectors.length === 0) {
      if(overallSuccess) setOverallSuccess(false);
      return;
    }

    const newMasterCorrectlyHitDetectorIds = new Set<string>();

    const newTrackedLaserSourcesWithPaths = trackedLaserSources.map(trackedSrc => {
        const {segments, allCorrectlyHitDetectorIdsFromThisSource } = 
            calculateLaserPathsForSource(
                trackedSrc.source, 
                placedMirrors, 
                obstacles, 
                detectors 
            );
        
        allCorrectlyHitDetectorIdsFromThisSource.forEach(id => newMasterCorrectlyHitDetectorIds.add(id));
        
        return { ...trackedSrc, laserPath: segments }; 
    });
    
    let pathsChanged = false;
    if (newTrackedLaserSourcesWithPaths.length !== trackedLaserSources.length) {
        pathsChanged = true; 
    } else {
        for (let i = 0; i < newTrackedLaserSourcesWithPaths.length; i++) {
            if (JSON.stringify(newTrackedLaserSourcesWithPaths[i].laserPath) !== JSON.stringify(trackedLaserSources[i].laserPath) ) {
                pathsChanged = true;
                break;
            }
        }
    }

    if (pathsChanged) {
        setTrackedLaserSources(newTrackedLaserSourcesWithPaths);
    }
    
    if (newMasterCorrectlyHitDetectorIds.size !== masterCorrectlyHitDetectorIds.size || 
        ![...newMasterCorrectlyHitDetectorIds].every(id => masterCorrectlyHitDetectorIds.has(id))) {
        setMasterCorrectlyHitDetectorIds(newMasterCorrectlyHitDetectorIds);
    }
    
    const currentOverallSuccess = detectors.length > 0 && 
                                  detectors.every(d => newMasterCorrectlyHitDetectorIds.has(d.id));

    if (currentOverallSuccess !== overallSuccess) {
        setOverallSuccess(currentOverallSuccess);
    }
    
  }, [trackedLaserSources, detectors, placedMirrors, obstacles, overallSuccess, masterCorrectlyHitDetectorIds]);

  const deletePlacedMirror = useCallback((mirrorId: string) => {
    setPlacedMirrors(prev => prev.filter(m => m.id !== mirrorId));
    setDraggingMirrorInfo(null); // Ensure dragging state is cleared
  }, []);

  const handleDropMirror = useCallback((templateId: string, dropX: number, dropY: number) => {
    if (placedMirrors.length >= MAX_PLACED_MIRRORS) {
        console.warn("Max optical components placed.");
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
    
    const newMirror: PlacedMirror = { id: newMirrorId, p1, p2, type: template.type as MirrorType };
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
    
    if (draggingMirrorInfo && trashCanRef.current) {
      const trashRect = trashCanRef.current.getBoundingClientRect();
      const isOver = clientX >= trashRect.left && clientX <= trashRect.right &&
                     clientY >= trashRect.top && clientY <= trashRect.bottom;
      setIsPointerOverTrash(isOver);
    } else {
      setIsPointerOverTrash(false);
    }

    const coords = getSVGCoordinates(clientX, clientY);
    if (!coords || !draggingMirrorInfo) return;
    // Don't preventDefault if pointer is over trash, to allow drop events on trashcan if it were an HTML drop target
    // However, with custom logic, we might still want to prevent default to stop text selection etc.
    // For now, we will update mirror position even if over trash, deletion happens on mouseUp.
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
        return { ...prev, mirror: updatedMirror }; // Ensure draggingMirrorInfo is updated with new positions
    });
  }, [draggingMirrorInfo, getSVGCoordinates]);

  const handleMouseUpOrTouchEnd = useCallback(() => {
    if (draggingMirrorInfo && isPointerOverTrash) {
      deletePlacedMirror(draggingMirrorInfo.mirror.id);
    }
    setDraggingMirrorInfo(null);
    setIsPointerOverTrash(false);
  }, [draggingMirrorInfo, isPointerOverTrash, deletePlacedMirror]);

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
            <RefreshButton onRefresh={() => setLevelSeed(s => s + 1)} />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 p-4 overflow-auto flex justify-center items-center relative"> {/* Added relative positioning */}
            <GameCanvas
              svgRef={svgRef}
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
              trackedLaserSources={trackedLaserSources}
              detectors={detectors}
              placedMirrors={placedMirrors}
              obstacles={obstacles}
              overallSuccess={overallSuccess} 
              globallyHitDetectorIds={masterCorrectlyHitDetectorIds} 
              onDropMirror={handleDropMirror}
              onMouseDownOnMirrorPoint={handleMouseDownOnMirrorPoint}
              onMouseDownOnMirrorBody={handleMouseDownOnMirrorBody}
              getSVGCoordinates={getSVGCoordinates}
            />
            {placedMirrors.length > 0 && (
                <TrashCan 
                    ref={trashCanRef} 
                    isHot={isPointerOverTrash && !!draggingMirrorInfo} 
                />
            )}
          </main>
          <aside className="w-1/4 max-w-xs p-4 bg-slate-100 border-l border-slate-300 shadow-inner overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">Optical Components</h2>
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              Place up to {MAX_PLACED_MIRRORS} optical components. <br/>
              Used: {placedMirrors.length}/{MAX_PLACED_MIRRORS}
            </div>
            <MirrorPalette mirrors={INITIAL_PALETTE_MIRRORS} canPlaceMoreMirrors={placedMirrors.length < MAX_PLACED_MIRRORS} />
            {overallSuccess && (
              <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded-lg shadow-lg text-center">
                <h3 className="text-2xl font-bold text-green-700">All Targets Hit!</h3>
                <p className="text-green-600">Congratulations! All lasers reached their detectors.</p>
              </div>
            )}
          </aside>
        </div>
    </div>
  );
};

export default App;
