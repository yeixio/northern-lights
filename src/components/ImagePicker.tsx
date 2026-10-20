import { useRef } from "react";
import { ImagePlus } from "lucide-react";

export default function ImagePicker({ onPick, multiple = false, label = "Add photos" }: {
  onPick: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => ref.current?.click()}>
        <ImagePlus size={16} /> {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*,video/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          onPick(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );
}
