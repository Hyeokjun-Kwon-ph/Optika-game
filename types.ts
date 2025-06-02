export interface Point {
  x: number;
  y: number;
}

export type MirrorType = 'default' | 'beam-splitter' | 'diffraction-grating';

export interface PaletteMirrorTemplate {
  id: string;
  type: MirrorType;
  defaultLength: number;
  defaultAngle?: number; // degrees, 0 is horizontal right
  description: string;
}

export interface PlacedMirror {
  id: string;
  p1: Point;
  p2: Point;
  type: MirrorType;
}

export type ObstacleShape = 'line' | 'rectangle' | 'circle';

export interface LineObstacle {
  id: string;
  shape: 'line';
  p1: Point;
  p2: Point;
}

export interface RectangleObstacle {
  id: string;
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleObstacle {
  id: string;
  shape: 'circle';
  cx: number;
  cy: number;
  radius: number;
}

export type Obstacle = LineObstacle | RectangleObstacle | CircleObstacle;


export interface DetectorType {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // Angle in degrees (0 right, 90 down, 180 left, 270 up) indicating required entry direction of light
}

export interface LaserSegment {
  start: Point;
  end: Point;
}

export interface BoundaryObject {
  p1: Point;
  p2: Point;
  normal: Point;
  name: string; // e.g., 'top_boundary'
}

export interface IntersectionDetail {
  point: Point;
  distance: number;
  object: PlacedMirror | Obstacle | DetectorType | BoundaryObject;
  type: 'mirror' | 'obstacle' | 'detector' | 'boundary';
}

export interface LaserSource {
  id: string;
  position: Point;
  initialDirection: Point;
}

export interface TrackedLaserSource {
  id: string;
  source: LaserSource;
  laserPath: LaserSegment[];
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}