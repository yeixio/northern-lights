import { supabase } from "./supabase";

const BUCKET = "media";

/** Uploads a file to the media bucket under `folder` and returns its public URL. */
export async function uploadMedia(folder: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Best-effort removal of a file previously returned by uploadMedia. */
export async function removeMedia(publicUrl: string) {
  const marker = `/object/public/${BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  if (i === -1) return;
  await supabase.storage.from(BUCKET).remove([publicUrl.slice(i + marker.length)]);
}
