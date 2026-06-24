import { useState } from 'react';
import { LIGHTING_PRESETS, type Lighting } from '@/viewport/lighting';

interface LightsControlProps {
  lighting: Lighting;
  onChange: (lighting: Lighting) => void;
}

/** Viewport lighting control: preset + ambient/key intensity + background color. */
export function LightsControl({ lighting, onChange }: LightsControlProps) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Lighting>) => onChange({ ...lighting, ...patch });

  return (
    <div className="lights">
      <button className={open ? 'is-active' : ''} onClick={() => setOpen((v) => !v)} title="Lighting">
        Lights
      </button>
      {open && (
        <div className="lights__pop" onPointerDown={(e) => e.stopPropagation()}>
          <label className="lights__row">
            <span>Preset</span>
            <select
              value=""
              onChange={(e) => {
                const p = LIGHTING_PRESETS.find((x) => x.id === e.target.value);
                if (p) onChange(p.lighting);
                e.target.value = '';
              }}
            >
              <option value="" disabled>
                Choose…
              </option>
              {LIGHTING_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="lights__row">
            <span>Ambient</span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={lighting.ambient}
              onChange={(e) => set({ ambient: Number(e.target.value) })}
            />
          </label>

          <label className="lights__row">
            <span>Key light</span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={lighting.key}
              onChange={(e) => set({ key: Number(e.target.value) })}
            />
          </label>

          <label className="lights__row">
            <span>Background</span>
            <input
              type="color"
              value={lighting.background}
              onChange={(e) => set({ background: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
