/** First-run onboarding state + the interactive tour script. */

const SEEN_KEY = 'p3m.onboarded.v1';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export interface TourStep {
  /** CSS selector for the element to spotlight. Omit for a centered, target-less step. */
  target?: string;
  title: string;
  body: string;
  /** Preferred popover placement relative to the target. */
  placement?: 'right' | 'left' | 'top' | 'bottom';
}

/**
 * The coachmark tour. Targets reference stable `data-tour` anchors in the app shell so the
 * steps don't break when class names change. Steps whose target is missing/hidden (e.g. a
 * collapsed panel) fall back to a centered card.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="palette"]',
    title: 'The node palette',
    body: 'Drag any node onto the canvas — or click the + to drop one in. Hover a node to see a visual preview and its key properties.',
    placement: 'right',
  },
  {
    target: '[data-tour="graph"]',
    title: 'The node graph',
    body: 'This is where you build. Wire a node’s output handle into another’s input. Connect geometry into the Output node to see it render.',
    placement: 'top',
  },
  {
    target: '[data-tour="inspector"]',
    title: 'Properties',
    body: 'Select a node to edit its values here. Primitives include a built-in Transform group, and you can “expose” any input as a runtime parameter.',
    placement: 'left',
  },
  {
    target: '[data-tour="viewport"]',
    title: 'Live viewport',
    body: 'Your model renders here in real time. Toggle wireframe and grid, tune the lights, and press Play to preview animations.',
    placement: 'top',
  },
  {
    target: '[data-tour="export"]',
    title: 'Export your work',
    body: 'Generate clean three.js or React Three Fiber code, export glTF/GLB, or save the graph as JSON to reload later.',
    placement: 'bottom',
  },
];
