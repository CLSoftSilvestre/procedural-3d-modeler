import { useStore } from '@/state/store';
import { MATERIAL_PRESETS, getMaterialPreset, type MaterialPreset } from '@/material/presets';

/** A quick-start dropdown shown on the Material node — applies a preset to its inputs. */
export function MaterialPresetPicker({ nodeId }: { nodeId: string }) {
  const setNodeValues = useStore((s) => s.setNodeValues);

  const groups = MATERIAL_PRESETS.reduce<Record<string, MaterialPreset[]>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  return (
    <label className="preset">
      <span className="preset__label">Preset</span>
      <select
        className="preset__select"
        value=""
        onChange={(e) => {
          const preset = getMaterialPreset(e.target.value);
          if (preset) setNodeValues(nodeId, preset.values);
          e.target.value = '';
        }}
      >
        <option value="" disabled>
          Apply a material…
        </option>
        {Object.entries(groups).map(([group, presets]) => (
          <optgroup key={group} label={group}>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
