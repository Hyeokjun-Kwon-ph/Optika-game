
import type { Point, PlacedMirror, Obstacle, DetectorType, IntersectionDetail, LineObstacle, RectangleObstacle, CircleObstacle, LaserSource, BoundingBox, BoundaryObject } from '../types';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants'; // Import game dimensions

const EPSILON = 0.000001; // Small tolerance for floating point comparisons

export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const subtractPoints = (p1: Point, p2: Point): Point => {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
};

export const addPoints = (p1: Point, p2: Point): Point => {
  return { x: p1.x + p2.x, y: p1.y + p2.y };
};

export const scaleVector = (v: Point, s: number): Point => {
  return { x: v.x * s, y: v.y * s };
};

export const normalizeVector = (v: Point): Point => {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag < EPSILON) return { x: 0, y: 0 }; 
  return { x: v.x / mag, y: v.y / mag };
};

export const dotProduct = (v1: Point, v2: Point): number => {
  return v1.x * v2.x + v1.y * v2.y;
};

// Checks if ray (originating at rayOrigin, going in rayDirection) intersects segment (s1, s2)
export const raySegmentIntersection = (rayOrigin: Point, rayDirection: Point, s1: Point, s2: Point): Point | null => {
    const v1 = subtractPoints(rayOrigin, s1); // Vector from s1 to rayOrigin
    const v2 = subtractPoints(s2, s1);       // Vector representing segment s1s2
    const v3 = { x: -rayDirection.y, y: rayDirection.x }; // Perpendicular to rayDirection

    const dot_v2_v3 = dotProduct(v2, v3);
    if (Math.abs(dot_v2_v3) < EPSILON) return null; // Parallel lines or collinear

    const t1 = (v2.x * v1.y - v2.y * v1.x) / dot_v2_v3; // Parameter for ray: P = rayOrigin + t1 * rayDirection
    const t2 = dotProduct(v1, v3) / dot_v2_v3;         // Parameter for segment: P = s1 + t2 * v2

    if (t1 >= -EPSILON && t2 >= -EPSILON && t2 <= 1.0 + EPSILON) { 
        return addPoints(rayOrigin, scaleVector(rayDirection, t1));
    }
    return null;
};

export const rayCircleIntersection = (rayOrigin: Point, rayDirection: Point, circleCenter: Point, radius: number): Point | null => {
    const L = subtractPoints(circleCenter, rayOrigin); 
    const tca = dotProduct(L, rayDirection); 
    
    const d2 = dotProduct(L, L) - tca * tca; 
    if (d2 > radius * radius) return null; 

    const thc = Math.sqrt(radius * radius - d2); 
    let t0 = tca - thc;
    let t1 = tca + thc;

    if (t0 > t1) [t0, t1] = [t1, t0]; 

    if (t0 < EPSILON) { 
        t0 = t1; 
        if (t0 < EPSILON) return null; 
    }
    
    return addPoints(rayOrigin, scaleVector(rayDirection, t0));
};


export const calculateReflection = (incidentDirection: Point, normal: Point): Point => {
  const dNorm = normalizeVector(incidentDirection);
  const nNorm = normalizeVector(normal); 
  const dotVal = dotProduct(dNorm, nNorm);
  return normalizeVector({
    x: dNorm.x - 2 * dotVal * nNorm.x,
    y: dNorm.y - 2 * dotVal * nNorm.y,
  });
};

export const getBoundingBoxForItem = (
    item: Obstacle | LaserSource | DetectorType,
    sourceEmitterWidth: number, 
    sourceEmitterHeight: number
): BoundingBox => {
    if ('shape' in item) { // Obstacle
        const obstacle = item as Obstacle;
        if (obstacle.shape === 'line') {
            return {
                minX: Math.min(obstacle.p1.x, obstacle.p2.x),
                minY: Math.min(obstacle.p1.y, obstacle.p2.y),
                maxX: Math.max(obstacle.p1.x, obstacle.p2.x),
                maxY: Math.max(obstacle.p1.y, obstacle.p2.y),
            };
        } else if (obstacle.shape === 'rectangle') {
            return {
                minX: obstacle.x,
                minY: obstacle.y,
                maxX: obstacle.x + obstacle.width,
                maxY: obstacle.y + obstacle.height,
            };
        } else if (obstacle.shape === 'circle') {
            return {
                minX: obstacle.cx - obstacle.radius,
                minY: obstacle.cy - obstacle.radius,
                maxX: obstacle.cx + obstacle.radius,
                maxY: obstacle.cy + obstacle.radius,
            };
        }
    } else if ('initialDirection' in item) { // LaserSource
        const source = item as LaserSource;
        const dir = source.initialDirection; 
        
        const halfW = sourceEmitterWidth / 2;  
        const halfH = sourceEmitterHeight / 2; 

        const localCorners: Point[] = [
            { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
            { x: halfW, y: halfH },   { x: -halfW, y: halfH }
        ];
        
        const worldCorners = localCorners.map(lc => {
            // General rotation formula:
            // rotatedX = lc.x * cos(angle) - lc.y * sin(angle)
            // rotatedY = lc.x * sin(angle) + lc.y * cos(angle)
            // Since dir is normalized, dir.x = cos(angle), dir.y = sin(angle)
            const rotatedX = lc.x * dir.x - lc.y * dir.y;
            const rotatedY = lc.x * dir.y + lc.y * dir.x;

            return {
                x: source.position.x + rotatedX,
                y: source.position.y + rotatedY
            };
        });

        let minX = worldCorners[0].x, maxX = worldCorners[0].x;
        let minY = worldCorners[0].y, maxY = worldCorners[0].y;

        for (let i = 1; i < worldCorners.length; i++) {
            minX = Math.min(minX, worldCorners[i].x);
            maxX = Math.max(maxX, worldCorners[i].x);
            minY = Math.min(minY, worldCorners[i].y);
            maxY = Math.max(maxY, worldCorners[i].y);
        }
        return { minX, minY, maxX, maxY };

    } else { // DetectorType
        const detector = item as DetectorType;
        return {
            minX: detector.x,
            minY: detector.y,
            maxX: detector.x + detector.width,
            maxY: detector.y + detector.height,
        };
    }
    // Should not be reached if types are handled
    console.error("Unknown item type in getBoundingBoxForItem", item);
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
};

export const doBoundingBoxesOverlap = (boxA: BoundingBox, boxB: BoundingBox, buffer: number = 0): boolean => {
  if (boxA.maxX + buffer < boxB.minX - buffer || boxB.maxX + buffer < boxA.minX - buffer) {
    return false;
  }
  if (boxA.maxY + buffer < boxB.minY - buffer || boxB.maxY + buffer < boxA.minY - buffer) {
    return false;
  }
  return true; 
};

const gameBoundaries: BoundaryObject[] = [
    { p1: {x:0, y:0}, p2: {x:GAME_WIDTH, y:0}, normal: {x:0, y:1}, name: 'top_boundary'},
    { p1: {x:0, y:GAME_HEIGHT}, p2: {x:GAME_WIDTH, y:GAME_HEIGHT}, normal: {x:0, y:-1}, name: 'bottom_boundary'},
    { p1: {x:0, y:0}, p2: {x:0, y:GAME_HEIGHT}, normal: {x:1, y:0}, name: 'left_boundary'},
    { p1: {x:GAME_WIDTH, y:0}, p2: {x:GAME_WIDTH, y:GAME_HEIGHT}, normal: {x:-1, y:0}, name: 'right_boundary'}
];

export const findClosestIntersection = (
  rayOrigin: Point,
  rayDirection: Point,
  mirrors: PlacedMirror[],
  obstacles: Obstacle[],
  detectors: DetectorType[] 
): IntersectionDetail | null => {
  let closestIntersection: IntersectionDetail | null = null;
  let minDistance = Infinity;

  const updateClosest = (point: Point, object: PlacedMirror | Obstacle | DetectorType | BoundaryObject, type: IntersectionDetail['type']) => {
    const dist = distance(rayOrigin, point);
    if (dist > EPSILON && dist < minDistance) { 
      minDistance = dist;
      closestIntersection = { point, distance: dist, object, type };
    }
  };

  for (const boundary of gameBoundaries) {
    const intersectionPoint = raySegmentIntersection(rayOrigin, rayDirection, boundary.p1, boundary.p2);
    if (intersectionPoint) {
        updateClosest(intersectionPoint, boundary, 'boundary');
    }
  }

  for (const mirror of mirrors) {
    const intersectionPoint = raySegmentIntersection(rayOrigin, rayDirection, mirror.p1, mirror.p2);
    if (intersectionPoint) {
      updateClosest(intersectionPoint, mirror, 'mirror');
    }
  }

  for (const obstacle of obstacles) {
    if (obstacle.shape === 'line') {
      const lineObstacle = obstacle as LineObstacle;
      const intersectionPoint = raySegmentIntersection(rayOrigin, rayDirection, lineObstacle.p1, lineObstacle.p2);
      if (intersectionPoint) {
        updateClosest(intersectionPoint, lineObstacle, 'obstacle');
      }
    } else if (obstacle.shape === 'rectangle') {
      const rectObstacle = obstacle as RectangleObstacle;
      const { x, y, width, height } = rectObstacle;
      const rectPoints: Point[] = [
        { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }
      ];
      for (let i = 0; i < 4; i++) {
        const p1 = rectPoints[i];
        const p2 = rectPoints[(i + 1) % 4];
        const intersectionPoint = raySegmentIntersection(rayOrigin, rayDirection, p1, p2);
        if (intersectionPoint) {
          updateClosest(intersectionPoint, rectObstacle, 'obstacle');
        }
      }
    } else if (obstacle.shape === 'circle') {
        const circleObstacle = obstacle as CircleObstacle;
        const intersectionPoint = rayCircleIntersection(rayOrigin, rayDirection, {x: circleObstacle.cx, y: circleObstacle.cy}, circleObstacle.radius);
        if (intersectionPoint) {
            updateClosest(intersectionPoint, circleObstacle, 'obstacle');
        }
    }
  }

  for (const detector of detectors) {
    const { x, y, width, height } = detector;
    const detectorPoints: Point[] = [
      { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }
    ];
    for (let i = 0; i < 4; i++) {
      const p1 = detectorPoints[i];
      const p2 = detectorPoints[(i + 1) % 4];
      const intersectionPoint = raySegmentIntersection(rayOrigin, rayDirection, p1, p2);
      if (intersectionPoint) {
        updateClosest(intersectionPoint, detector, 'detector');
      }
    }
  }
  
  return closestIntersection;
};