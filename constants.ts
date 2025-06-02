
import type { Point, Obstacle, PaletteMirrorTemplate } from './types';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const PALETTE_WIDTH = 200;

export const LASER_COLOR = "red";

// Standard Mirror
export const MIRROR_COLOR = "rgb(51 65 85)"; // slate-700 (Front reflective surface)
export const MIRROR_BACKING_COLOR = "rgb(30 41 59)"; // slate-800 (Backing of the mirror)
export const MIRROR_EDGE_HIGHLIGHT_COLOR = "rgb(100 116 139)"; // slate-500 (Subtle edge)

// Beam Splitter
export const BEAM_SPLITTER_COLOR = "rgb(0 191 255)"; // Deep Sky Blue
export const BEAM_SPLITTER_FILL_OPACITY = 0.4;
export const BEAM_SPLITTER_EDGE_COLOR = "rgb(0 150 200)"; // Darker blue for edge

// Diffraction Grating
export const DIFFRACTION_GRATING_COLOR = "rgb(153 50 204)"; // Dark Orchid
export const DIFFRACTION_GRATING_FILL_OPACITY = 0.5;
export const DIFFRACTION_GRATING_EDGE_COLOR = "rgb(120 40 160)"; // Darker purple for edge
export const DIFFRACTION_GRATING_LINE_COLOR = "rgba(255, 255, 255, 0.6)"; // Light lines on grating

export const MIRROR_HANDLE_COLOR = "rgb(203 213 225)"; // slate-300

export const FRAME_COLOR = "rgb(0 0 0)"; // black
export const FRAME_THICKNESS = 2;


export const DETECTOR_BASE_COLOR = "rgb(71 85 105)"; // slate-600
export const DETECTOR_APERTURE_COLOR = "rgb(30 41 59)"; // slate-800
export const DETECTOR_ARROW_COLOR = "rgb(226 232 240)"; // slate-200
export const DETECTOR_HIT_COLOR = "rgb(34 197 94)"; // green-500

export const SOURCE_COLOR = "rgb(239 68 68)"; // red-500
export const SOURCE_EMITTER_BODY_COLOR = "rgb(51 65 85)"; // slate-700
export const SOURCE_EMITTER_APERTURE_COLOR = SOURCE_COLOR;
// Note: SOURCE_EMITTER_WIDTH is effectively the length along the emission axis after rotation.
// SOURCE_EMITTER_HEIGHT is the dimension perpendicular to emission.
export const SOURCE_EMITTER_WIDTH = 20; // Length of the emitter body
export const SOURCE_EMITTER_HEIGHT = 12; // Thickness of the emitter body
export const SOURCE_EMITTER_APERTURE_RADIUS = 3;


export const OBSTACLE_COLOR = "rgb(100 116 139)"; // slate-500
export const OBSTACLE_RECT_FILL_COLOR = "rgb(100 116 139 / 0.8)"; // slate-500 with opacity
export const OBSTACLE_CIRCLE_FILL_COLOR = "rgb(100 116 139 / 0.8)"; // slate-500 with opacity


export const MAX_REFLECTIONS = 10; // Max interactions for any single path branch
export const MAX_PLACED_MIRRORS = 5;
export const MAX_DETECTECTORS = 5; 
export const MAX_LASER_SOURCES = 3;

export const DETECTOR_WIDTH = 30;
export const DETECTOR_HEIGHT = 30;
export const DETECTOR_APERTURE_RADIUS = 6;
export const DETECTOR_ARROW_LENGTH = 12; // Length of the arrow shaft + arrowhead
export const DETECTOR_ARROWHEAD_SIZE = 6; // Width and height of the arrowhead triangle base
export const DETECTOR_ACCEPTANCE_ANGLE_DEGREES = 10;

// Constant for diffraction grating physics (lambda / d)
// A value of 0.35 means that for normal incidence (theta_i = 0),
// the first order (m=1) diffracts at asin(-0.35) approx -20.48 degrees.
// and (m=-1) diffracts at asin(0.35) approx 20.48 degrees.
export const GRATING_K_CONSTANT = 0.35;


export const OBSTACLE_COLLISION_BUFFER = 15; // Pixels of space between bounding boxes of obstacles/sources/detectors
export const GAME_BOUNDARY_PADDING = 10; // Min distance from game edge for any part of an obstacle/source/detector

// Obstacle dimension ranges
export const MIN_OBSTACLE_LINE_LENGTH = 40;
export const OBSTACLE_LINE_LENGTH_VARIANCE = 80; // Max additional length over min

export const MIN_OBSTACLE_DIMENSION = 25; // For rectangle width/height
export const MAX_OBSTACLE_DIMENSION_VARIANCE = 55; // Max additional size over min for rectangle sides

export const MIN_OBSTACLE_RADIUS = 15;
export const MAX_OBSTACLE_RADIUS_VARIANCE = 25; // Max additional radius over min


// Initial obstacles are now more for example, resetLevel generates dynamic ones.
export const INITIAL_OBSTACLES_EXAMPLE: Obstacle[] = [
  { id: 'obs1', shape: 'line', p1: { x: 250, y: 100 }, p2: { x: 250, y: GAME_HEIGHT - 250 } },
  { id: 'obs2', shape: 'rectangle', x: 450, y: 150, width: 60, height: GAME_HEIGHT - 300 },
  { id: 'obs3', shape: 'circle', cx: 350, cy: GAME_HEIGHT / 2, radius: 40 }
];

export const INITIAL_PALETTE_MIRRORS: PaletteMirrorTemplate[] = [
  { id: 'pm1', type: 'default', defaultLength: 80, defaultAngle: 0, description: 'Standard Mirror (80px)' },
  { id: 'pm-bs', type: 'beam-splitter', defaultLength: 80, defaultAngle: 45, description: 'Beam Splitter (80px)' },
  { id: 'pm-dg', type: 'diffraction-grating', defaultLength: 80, defaultAngle: 0, description: 'Diffraction Grating (80px)' },
];
