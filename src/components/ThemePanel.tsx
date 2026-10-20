import { Check } from "lucide-react";
import { FONTS, MODES, PRESETS, RADII, type PresetId, type SiteTheme } from "../lib/theme";
import { Field, Segmented } from "./ui";

/** Palette swatches; `null` is an extra "use the site's" choice when `siteOption` is given. */
export function PresetGrid({ value, onChange, siteOption, siteColors }: {
  value: PresetId | null;
  onChange: (p: PresetId | null) => void;
  siteOption?: string;
  siteColors?: [string, string];
}) {
  const choices: (PresetId | null)[] = [...(siteOption ? [null] : []), ...(Object.keys(PRESETS) as PresetId[])];
  return (
    <div className="grid grid-cols-3 gap-2">
      {choices.map((id) => {
        const p = id ? PRESETS[id] : siteColors ? { name: siteOption, primary: siteColors[0], accent: siteColors[1] } : null;
        const selected = value === id;
        return (
          <button
            key={id ?? "site"}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={selected}
            className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition ${
              selected ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500" : "border-ink-200 hover:border-ink-300 hover:bg-ink-50"
            }`}
          >
            {p ? (
              <span className="flex -space-x-1.5">
                <span className="h-6 w-6 rounded-full ring-2 ring-surface" style={{ background: p.primary }} />
                <span className="h-6 w-6 rounded-full ring-2 ring-surface" style={{ background: p.accent }} />
              </span>
            ) : (
              <span className="h-6 w-6 rounded-full border-2 border-dashed border-ink-300" />
            )}
            {p?.name ?? siteOption}
            {selected && <Check size={12} className="absolute top-1.5 right-1.5 text-primary-600" />}
          </button>
        );
      })}
    </div>
  );
}

function ColorInput({ label, value, fallback, onChange }: {
  label: string;
  value: string | null | undefined;
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value ?? fallback}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded-md border border-ink-200 bg-surface p-1"
        aria-label={label}
      />
      <div className="flex-1 text-sm">
        <div className="font-medium">{label}</div>
        <div className="font-mono text-xs text-ink-500">{value ?? `${fallback} (from palette)`}</div>
      </div>
      {value && <button type="button" className="text-xs text-ink-500 hover:underline" onClick={() => onChange(null)}>Reset</button>}
    </div>
  );
}

/** Everything an admin can change about how the site looks. */
export default function ThemePanel({ value, onChange }: { value: SiteTheme; onChange: (t: SiteTheme) => void }) {
  const preset = PRESETS[value.preset];
  const set = (patch: Partial<SiteTheme>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-6">
      <Field label="Palette" hint="Sets the colors for buttons, links and the aurora.">
        <PresetGrid value={value.preset} onChange={(p) => set({ preset: p ?? value.preset, primary: null, accent: null })} />
      </Field>
      <Field label="Custom colors" hint="Fine-tune the palette with your own colors.">
        <div className="space-y-3">
          <ColorInput label="Main color" value={value.primary} fallback={preset.primary} onChange={(primary) => set({ primary })} />
          <ColorInput label="Accent color" value={value.accent} fallback={preset.accent} onChange={(accent) => set({ accent })} />
        </div>
      </Field>
      <Field label="Light or dark" hint="Auto follows each visitor's device setting.">
        <Segmented value={value.mode} onChange={(mode) => set({ mode })} options={Object.entries(MODES) as [SiteTheme["mode"], string][]} />
      </Field>
      <Field label="Type">
        <Segmented
          value={value.font}
          onChange={(font) => set({ font })}
          options={(Object.entries(FONTS) as [SiteTheme["font"], string][]).map(([k, label]) => [k, label] as const)}
        />
      </Field>
      <Field label="Corners">
        <Segmented value={value.radius} onChange={(radius) => set({ radius })} options={Object.entries(RADII) as [SiteTheme["radius"], string][]} />
      </Field>
    </div>
  );
}
