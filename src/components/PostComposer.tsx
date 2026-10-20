import { useState } from "react";
import { Globe, Lock, X } from "lucide-react";
import { api, errorText } from "../lib/api";
import { uploadFiles } from "../lib/storage";
import { useAuth } from "../auth/AuthProvider";
import Avatar from "./Avatar";
import ImagePicker from "./ImagePicker";

export default function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(files);
      await api.post("/api/posts", { content, media_urls: uploaded.map((u) => u.url), is_public: isPublic });
      setContent("");
      setFiles([]);
      setIsPublic(false);
      onPosted();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="flex gap-3">
        <Avatar profile={user} />
        <textarea
          className="input min-h-20 resize-y"
          placeholder={`What's on your mind, ${user?.first_name || "friend"}?`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative">
              {f.type.startsWith("video/")
                ? <video src={URL.createObjectURL(f)} className="h-20 w-20 rounded-lg object-cover" />
                : <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 rounded-lg object-cover" />}
              <button
                type="button"
                className="absolute -top-2 -right-2 rounded-full bg-slate-800 p-0.5 text-white"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <ImagePicker multiple onPick={(picked) => setFiles([...files, ...picked])} />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setIsPublic(!isPublic)}
          title={isPublic ? "Shown on the public page" : "Only members can see this"}
        >
          {isPublic ? <Globe size={16} /> : <Lock size={16} />}
          {isPublic ? "Public" : "Members only"}
        </button>
        <button className="btn-primary ml-auto" disabled={busy}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
