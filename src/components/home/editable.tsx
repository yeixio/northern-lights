import { createContext, useContext, useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { uploadFiles } from "../../lib/storage";
import { errorText } from "../../lib/api";
import { safeHref, type LinkButton } from "../../lib/home";

/** True while an admin is editing the home page. */
export const EditingContext = createContext(false);
export const useEditing = () => useContext(EditingContext);

/**
 * Text that is plain when viewing and edited in place when editing.
 * Empty text disappears for visitors and shows its placeholder to the editor.
 */
export function EditText({ value, onChange, as = "p", className = "", placeholder = "Type something…", multiline = false }: {
  value: string | undefined;
  onChange: (v: string) => void;
  as?: ElementType;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const editing = useEditing();
  const ref = useRef<HTMLElement>(null);
  const Tag = as;

  // Uncontrolled while focused so the caret doesn't jump; synced otherwise.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== (value ?? "")) el.innerText = value ?? "";
  }, [value, editing]);

  if (!editing) return value ? <Tag className={`${className} ${multiline ? "whitespace-pre-line" : ""}`}>{value}</Tag> : null;
  return (
    <Tag
      ref={ref}
      className={`${className} ${multiline ? "whitespace-pre-line" : ""}`}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const text = e.currentTarget.innerText.replace(/\n{3,}/g, "\n\n").trim();
        if (text !== (value ?? "")) onChange(text);
        // An emptied element keeps a stray <br>; clear it so the placeholder shows.
        if (!text) e.currentTarget.innerHTML = "";
      }}
    />
  );
}

/** Upload / remove buttons for an image, shown only while editing. */
export function ImageControls({ value, onChange, className = "", label = "photo" }: {
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
  label?: string;
}) {
  const editing = useEditing();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!editing) return null;

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const [up] = await uploadFiles([file]);
      onChange(up.url);
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const chip = "inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-black/80";
  return (
    <div className={`z-10 flex gap-2 ${className}`}>
      <button type="button" className={chip} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
        {value ? `Replace ${label}` : `Add ${label}`}
      </button>
      {value && (
        <button type="button" className={chip} onClick={() => onChange(null)} aria-label={`Remove ${label}`}>
          <Trash2 size={14} />
        </button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

/** A link that stays in the app for site paths. */
export function SmartLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const to = safeHref(href);
  if (to.startsWith("/")) return <Link to={to} className={className}>{children}</Link>;
  return <a href={to} className={className} {...(/^https?:/.test(to) && { target: "_blank", rel: "noreferrer" })}>{children}</a>;
}

/**
 * Buttons styles for the three kinds of backgrounds a section can have.
 * "night" is the always-dark aurora, "bold" is the theme color.
 */
export type Surface = "page" | "night" | "bold";
const styles: Record<Surface, Record<"primary" | "secondary", string>> = {
  page: { primary: "btn-primary", secondary: "btn-secondary" },
  night: {
    primary: "btn bg-white text-[#0b0f17] shadow-lg hover:bg-white/90",
    secondary: "btn border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20",
  },
  bold: {
    primary: "btn bg-white text-[#0b0f17] shadow-lg hover:bg-white/90",
    secondary: "btn border border-current/30 text-current hover:bg-white/10",
  },
};

export function Buttons({ buttons, onChange, surface = "page", className = "" }: {
  buttons: LinkButton[];
  onChange: (b: LinkButton[]) => void;
  surface?: Surface;
  className?: string;
}) {
  const editing = useEditing();
  const [open, setOpen] = useState<number | null>(null);
  if (!editing && buttons.length === 0) return null;
  const big = "px-5 py-2.5 text-[0.95rem]";

  const update = (i: number, patch: Partial<LinkButton>) => onChange(buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {buttons.map((b, i) => {
        const cls = `${styles[surface][b.style ?? "primary"]} ${big}`;
        if (!editing) return <SmartLink key={i} href={b.href} className={cls}>{b.label}</SmartLink>;
        return (
          <div key={i} className="relative">
            <button type="button" className={`${cls} ring-2 ring-transparent ring-offset-2 ring-offset-transparent hover:ring-primary-400/70`} onClick={() => setOpen(open === i ? null : i)}>
              {b.label || "Button"}
            </button>
            {open === i && (
              <div className="absolute top-full left-1/2 z-30 mt-2 w-72 -translate-x-1/2 space-y-3 rounded-xl border border-ink-200 bg-surface p-4 text-left text-ink-900 shadow-2xl">
                <label className="block space-y-1 text-xs font-medium">
                  <span>Label</span>
                  <input className="input" value={b.label} autoFocus onChange={(e) => update(i, { label: e.target.value })} />
                </label>
                <label className="block space-y-1 text-xs font-medium">
                  <span>Link</span>
                  <input className="input font-mono" value={b.href} placeholder="/gallery or https://…" onChange={(e) => update(i, { href: e.target.value })} />
                </label>
                <div className="flex items-center justify-between gap-2">
                  <select className="input w-auto" value={b.style ?? "primary"} onChange={(e) => update(i, { style: e.target.value as LinkButton["style"] })}>
                    <option value="primary">Solid</option>
                    <option value="secondary">Outline</option>
                  </select>
                  <div className="flex gap-1">
                    <button type="button" className="btn-ghost px-2 text-rose-600" onClick={() => { onChange(buttons.filter((_, j) => j !== i)); setOpen(null); }} aria-label="Remove button">
                      <Trash2 size={16} />
                    </button>
                    <button type="button" className="btn-primary px-3 py-1.5" onClick={() => setOpen(null)}>Done</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {editing && buttons.length < 3 && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-current/40 px-3 py-2 text-sm opacity-70 hover:opacity-100"
          onClick={() => {
            onChange([...buttons, { label: "New button", href: "/gallery", style: buttons.length ? "secondary" : "primary" }]);
            setOpen(buttons.length);
          }}
        >
          <Plus size={14} /> Button
        </button>
      )}
    </div>
  );
}
