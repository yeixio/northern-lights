import { api } from "./api";

export interface Uploaded {
  url: string;
  type: "image" | "video";
}

/** Uploads photos/videos and returns their URLs. They stay private until used somewhere public. */
export async function uploadFiles(files: File[]): Promise<Uploaded[]> {
  if (files.length === 0) return [];
  const form = new FormData();
  for (const f of files) form.append("file", f);
  return api.post<Uploaded[]>("/api/uploads", form);
}
