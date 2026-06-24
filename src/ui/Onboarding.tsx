import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TOUR_STEPS } from './tour';

/** First-run welcome dialog — entry point into the guided tour. */
export function WelcomeModal({
  onStartTour,
  onClose,
}: {
  onStartTour: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="welcome" onClick={(e) => e.stopPropagation()}>
        <div className="welcome__glow" />
        <svg className="welcome__logo" viewBox="0 0 24 24" width="64" height="64" aria-hidden="true">
          <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="none" stroke="#6ea8fe" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M12 2v20M3 7l9 5 9-5" fill="none" stroke="#6ea8fe" strokeWidth="1.1" opacity="0.65" />
        </svg>
        <h1 className="welcome__title">Welcome to Procedural 3D Modeler</h1>
        <p className="welcome__sub">
          Design parametric models with a visual node graph and export clean, ready-to-run
          three.js, React Three Fiber, or glTF. You build generators — not baked assets.
        </p>
        <div className="welcome__actions">
          <button className="welcome__primary" onClick={onStartTour}>
            Take the 60-second tour
          </button>
          <button className="welcome__ghost" onClick={onClose}>
            Skip — I’ll explore
          </button>
        </div>
        <p className="welcome__hint">You can restart the tour anytime from the ? button in the header.</p>
      </div>
    </div>
  );
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function rectOf(selector?: string): Box | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const PAD = 6;
const POP_W = 320;

/** Guided coachmark tour: dims the UI and spotlights one area at a time. */
export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = TOUR_STEPS[i]!;
  const isLast = i === TOUR_STEPS.length - 1;

  // Recompute the spotlight rect when the step changes or the window resizes.
  useLayoutEffect(() => {
    const recompute = () => setBox(rectOf(step.target));
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [step.target]);

  // Esc closes; arrows navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(TOUR_STEPS.length - 1, n + 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const next = () => (isLast ? onClose() : setI((n) => n + 1));
  const prev = () => setI((n) => Math.max(0, n - 1));

  // Popover position: beside the spotlight, else centered.
  const pop = popoverPosition(box, step.placement);

  return createPortal(
    <div className="tour">
      <div className={`tour__veil${box ? '' : ' is-dim'}`} onClick={onClose} />
      {box && (
        <div
          className="tour__spot"
          style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }}
        />
      )}
      <div className="tour__pop" style={pop}>
        <div className="tour__count">
          Step {i + 1} of {TOUR_STEPS.length}
        </div>
        <h3 className="tour__title">{step.title}</h3>
        <p className="tour__body">{step.body}</p>
        <div className="tour__dots">
          {TOUR_STEPS.map((_, n) => (
            <span key={n} className={`tour__dot${n === i ? ' is-on' : ''}`} />
          ))}
        </div>
        <div className="tour__actions">
          <button className="tour__skip" onClick={onClose}>
            Skip
          </button>
          <div className="tour__nav">
            {i > 0 && (
              <button className="tour__btn" onClick={prev}>
                Back
              </button>
            )}
            <button className="tour__btn tour__btn--primary" onClick={next}>
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Place the popover next to the spotlight per placement, clamped to the viewport. */
function popoverPosition(box: Box | null, placement?: string): React.CSSProperties {
  const margin = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!box) {
    return { left: (vw - POP_W) / 2, top: vh * 0.4 };
  }
  let left: number;
  let top: number;
  switch (placement) {
    case 'left':
      left = box.left - POP_W - margin;
      top = box.top;
      break;
    case 'top':
      left = box.left + box.width / 2 - POP_W / 2;
      top = box.top - margin - 200;
      break;
    case 'bottom':
      left = box.left + box.width / 2 - POP_W / 2;
      top = box.top + box.height + margin;
      break;
    case 'right':
    default:
      left = box.left + box.width + margin;
      top = box.top;
      break;
  }
  left = Math.max(margin, Math.min(left, vw - POP_W - margin));
  top = Math.max(margin, Math.min(top, vh - 220 - margin));
  return { left, top, width: POP_W };
}
