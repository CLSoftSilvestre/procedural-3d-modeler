import type { LiteralValue, SocketSpec } from '@/graph/types';

interface ValueControlProps {
  control: SocketSpec['control'];
  value: LiteralValue | undefined;
  onChange: (value: LiteralValue) => void;
  disabled?: boolean;
}

/**
 * Renders the editing widget for a literal value, driven by its control hint.
 * Shared by the Inspector (node inputs) and the Params panel (exposed params).
 */
export function ValueControl({ control, value, onChange, disabled }: ValueControlProps) {
  const kind = control?.kind ?? 'number';

  if (kind === 'slider') {
    return (
      <div className="ctrl__row">
        <input
          type="range"
          min={control?.min}
          max={control?.max}
          step={control?.step}
          value={Number(value ?? 0)}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          min={control?.min}
          max={control?.max}
          step={control?.step}
          value={Number(value ?? 0)}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  }
  if (kind === 'number') {
    return (
      <input
        type="number"
        min={control?.min}
        max={control?.max}
        step={control?.step}
        value={Number(value ?? 0)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }
  if (kind === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }
  if (kind === 'color') {
    return (
      <input
        type="color"
        value={String(value ?? '#ffffff')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (kind === 'select') {
    return (
      <select
        value={String(value ?? control?.options?.[0]?.value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {control?.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={String(value ?? '')}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
