import { useAuth } from "../../auth/AuthProvider";
import { useSite } from "../../lib/site";
import { PRESETS, type Mode, type Preferences } from "../../lib/theme";
import { PresetGrid } from "../../components/ThemePanel";
import { Field, Segmented } from "../../components/ui";

/** A member's own colors and light/dark choice for the private area. */
export default function Appearance() {
  const { user, savePreferences } = useAuth();
  const { theme } = useSite();
  const prefs: Preferences = user?.preferences ?? { preset: null, primary: null, mode: null };
  const save = (patch: Partial<Preferences>) => void savePreferences({ ...prefs, ...patch });
  const fallback = prefs.preset ? PRESETS[prefs.preset].primary : theme.primary ?? PRESETS[theme.preset].primary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
        <p className="mt-1 text-ink-500">How the members' area looks for you. Your choices are saved to your account and don't change the site for anyone else.</p>
      </div>
      <section className="card max-w-xl space-y-6 p-6">
        <Field label="Mode">
          <Segmented
            value={prefs.mode ?? "site"}
            onChange={(m) => save({ mode: m === "site" ? null : (m as Mode) })}
            options={[["site", "Site default"], ["light", "Light"], ["dark", "Dark"], ["system", "Auto"]]}
          />
        </Field>
        <Field label="Color scheme" hint={`"Site" uses the colors the site admin chose.`}>
          <PresetGrid
            value={prefs.preset}
            onChange={(preset) => save({ preset, primary: null })}
            siteOption="Site"
            siteColors={[theme.primary ?? PRESETS[theme.preset].primary, theme.accent ?? PRESETS[theme.preset].accent]}
          />
        </Field>
        <Field label="Custom color" hint="Pick any color for buttons and highlights.">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={prefs.primary ?? fallback}
              onChange={(e) => save({ primary: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded-md border border-ink-200 bg-surface p-1"
              aria-label="Custom color"
            />
            <span className="font-mono text-xs text-ink-500">{prefs.primary ?? "Not set"}</span>
            {prefs.primary && <button className="text-xs text-ink-500 hover:underline" onClick={() => save({ primary: null })}>Reset</button>}
          </div>
        </Field>
      </section>
    </div>
  );
}
