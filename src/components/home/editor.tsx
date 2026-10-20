import type { ReactNode } from "react";
import {
  ArrowDown, ArrowUp, Copy, Eye, EyeOff, GalleryHorizontalEnd, Image, LayoutGrid, Megaphone, Newspaper, PanelTop,
  Plus, Settings2, SquareSplitHorizontal, Trash2, Type,
} from "lucide-react";
import { SECTION_INFO, type Background, type Section, type SectionType, type Width } from "../../lib/home";
import { Field, Modal, Segmented } from "../ui";

export const SECTION_ICONS: Record<SectionType, typeof Type> = {
  hero: PanelTop, text: Type, split: SquareSplitHorizontal, cards: LayoutGrid, image: Image,
  gallery: GalleryHorizontalEnd, updates: Newspaper, cta: Megaphone,
};

/** Outline and toolbar around a section while editing. */
export function SectionFrame({ s, index, count, onMove, onSettings, onDuplicate, onToggle, onDelete, children }: {
  s: Section;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onSettings: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const tool = "flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/15 disabled:opacity-30";
  return (
    <div className="group/section relative">
      <div className={s.hidden ? "opacity-40 grayscale" : ""}>{children}</div>
      <div className="pointer-events-none absolute inset-0 z-10 ring-2 ring-transparent transition ring-inset group-focus-within/section:ring-primary-500/60 group-hover/section:ring-primary-500/60" />
      <div className="absolute top-3 right-3 z-20 flex items-center gap-0.5 rounded-lg bg-[#0b0f17]/90 p-1 text-white opacity-0 shadow-xl backdrop-blur transition group-focus-within/section:opacity-100 group-hover/section:opacity-100 max-md:opacity-100">
        <span className="px-2 text-xs font-medium text-white/70">{SECTION_INFO[s.type].name}</span>
        <button className={tool} title="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}><ArrowUp size={16} /></button>
        <button className={tool} title="Move down" disabled={index === count - 1} onClick={() => onMove(index + 1)}><ArrowDown size={16} /></button>
        <button className={tool} title="Section settings" onClick={onSettings}><Settings2 size={16} /></button>
        <button className={tool} title="Duplicate" onClick={onDuplicate}><Copy size={16} /></button>
        <button className={tool} title={s.hidden ? "Show to visitors" : "Hide from visitors"} onClick={onToggle}>
          {s.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button className={`${tool} hover:bg-rose-500/80`} title="Delete" onClick={onDelete}><Trash2 size={16} /></button>
      </div>
      {s.hidden && (
        <div className="absolute top-3 left-3 z-20 rounded-full bg-[#0b0f17]/90 px-3 py-1 text-xs font-medium text-white">Hidden from visitors</div>
      )}
    </div>
  );
}

/** The "+" between sections. */
export function InsertPoint({ onClick, always = false }: { onClick: () => void; always?: boolean }) {
  return (
    <div className={`group/insert relative z-20 flex h-0 items-center justify-center ${always ? "my-10 h-auto" : ""}`}>
      <div className={`absolute inset-x-0 h-0.5 bg-primary-500/60 transition ${always ? "hidden" : "opacity-0 group-hover/insert:opacity-100"}`} />
      <button
        onClick={onClick}
        className={`relative inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-on-primary shadow-lg transition hover:scale-105 ${
          always ? "" : "opacity-0 group-hover/insert:opacity-100 focus:opacity-100"
        }`}
      >
        <Plus size={14} /> Add section
      </button>
    </div>
  );
}

export function AddSectionDialog({ onPick, onClose }: { onPick: (t: SectionType) => void; onClose: () => void }) {
  return (
    <Modal title="Add a section" onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(SECTION_INFO) as SectionType[]).map((t) => {
          const Icon = SECTION_ICONS[t];
          return (
            <button key={t} onClick={() => onPick(t)} className="flex items-start gap-3 rounded-xl border border-ink-200 p-4 text-left transition hover:border-primary-400 hover:bg-primary-50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700"><Icon size={20} /></span>
              <span>
                <span className="block font-medium">{SECTION_INFO[t].name}</span>
                <span className="block text-sm text-ink-500">{SECTION_INFO[t].blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/** Layout options for one section, shown in the side drawer. */
export function SectionSettings({ s, set }: { s: Section; set: (patch: Partial<Section>) => void }) {
  const bgs: [Background, string][] = [["plain", "Plain"], ["muted", "Muted"], ["tint", "Tinted"], ["bold", "Bold"]];
  const widths: [Width, string][] = [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]];
  return (
    <>
      {s.type === "hero" && (
        <>
          <Field label="Style">
            <Segmented value={s.look} onChange={(look) => set({ look } as Partial<Section>)} options={[["aurora", "Aurora"], ["image", "Photo"], ["soft", "Soft"]]} />
          </Field>
          {s.look === "image" && !s.image && <p className="-mt-3 text-xs text-ink-500">Use "Add background" on the header to pick a photo.</p>}
          <Field label="Height">
            <Segmented value={s.height} onChange={(height) => set({ height } as Partial<Section>)} options={[["compact", "Compact"], ["tall", "Tall"], ["full", "Full screen"]]} />
          </Field>
        </>
      )}
      {s.type !== "hero" && (
        <Field label="Background">
          <Segmented value={s.bg ?? "plain"} onChange={(bg) => set({ bg })} options={bgs} />
        </Field>
      )}
      {s.type !== "hero" && (
        <Field label="Width">
          <Segmented value={s.width ?? "normal"} onChange={(width) => set({ width })} options={widths} />
        </Field>
      )}
      {(s.type === "hero" || s.type === "text" || s.type === "cards") && (
        <Field label="Text alignment">
          <Segmented value={s.align ?? (s.type === "text" ? "left" : "center")} onChange={(align) => set({ align })} options={[["left", "Left"], ["center", "Center"]]} />
        </Field>
      )}
      {s.type === "split" && (
        <Field label="Photo side">
          <Segmented value={s.side} onChange={(side) => set({ side } as Partial<Section>)} options={[["left", "Left"], ["right", "Right"]]} />
        </Field>
      )}
      {s.type === "cards" && (
        <Field label="Columns">
          <Segmented value={s.columns} onChange={(columns) => set({ columns } as Partial<Section>)} options={[[2, "2"], [3, "3"], [4, "4"]]} />
        </Field>
      )}
      {(s.type === "gallery" || s.type === "updates") && (
        <Field label={s.type === "gallery" ? "Albums to show" : "Posts to show"}>
          <Segmented value={s.limit} onChange={(limit) => set({ limit } as Partial<Section>)} options={[[3, "3"], [6, "6"], [9, "9"], [12, "12"]]} />
        </Field>
      )}
      <Field label="Visibility">
        <Segmented value={s.hidden ? "hidden" : "shown"} onChange={(v) => set({ hidden: v === "hidden" })} options={[["shown", "Shown"], ["hidden", "Hidden"]]} />
      </Field>
    </>
  );
}
