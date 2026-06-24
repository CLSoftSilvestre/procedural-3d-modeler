/** "About" modal — brand, credits, and tech. Opened from the header logo/title. */
export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="about" onClick={(e) => e.stopPropagation()}>
        <div className="about__hero">
          <div className="about__glow" />
          <svg className="about__logo" viewBox="0 0 24 24" width="76" height="76">
            <path
              d="M12 2 21 7v10l-9 5-9-5V7z"
              fill="none"
              stroke="#6ea8fe"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M12 2v20M3 7l9 5 9-5" fill="none" stroke="#6ea8fe" strokeWidth="1.1" opacity="0.65" />
          </svg>
          <h1 className="about__name">Procedural 3D Modeler</h1>
          <p className="about__tagline">Node-based procedural geometry → production three.js code</p>
          <div className="about__badges">
            <span className="about__badge">Early Access</span>
            <span className="about__version">v{__APP_VERSION__}</span>
          </div>
        </div>

        <div className="about__body">
          <p className="about__desc">
            Design parametric 3D models with a visual node graph and export clean,
            runtime-configurable three.js — vanilla, React Three Fiber, or glTF. Build
            generators, not baked assets.
          </p>

          <div className="about__credits">
            <div className="about__credit">
              <span className="about__credit-label">Crafted by</span>
              <span className="about__credit-value">Celso Silvestre</span>
            </div>
            <div className="about__credit">
              <span className="about__credit-label">A product of</span>
              <a
                className="about__credit-value about__link"
                href="https://azordev.pt"
                target="_blank"
                rel="noopener noreferrer"
              >
                Azordev.pt ↗
              </a>
            </div>
          </div>

          <div className="about__tech">
            {['three.js', 'React', 'TypeScript', 'Vite'].map((t) => (
              <span className="about__chip" key={t}>
                {t}
              </span>
            ))}
          </div>

          <div className="about__footer">
            <span className="about__copy">© {new Date().getFullYear()} Azordev</span>
            <button className="about__close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
