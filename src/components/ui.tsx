import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** A row of mutually exclusive options. */
export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: readonly (readonly [T, ReactNode])[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-ink-100 p-1">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
            v === value ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium text-ink-800">{label}</div>
        {hint && <div className="text-xs text-ink-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onClose]);
}

/** A panel that slides in from the right, leaving the page visible for live previews. */
export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-ink-200 bg-surface shadow-2xl">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink-200 px-5">
        <h2 className="font-semibold">{title}</h2>
        <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">{children}</div>
    </aside>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`card w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** An on/off switch with a label and an optional hint. */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 ${
          checked ? "bg-primary-600" : "bg-ink-300"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </label>
  );
}
