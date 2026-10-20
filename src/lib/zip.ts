// A small read-only zip reader that works on a File or Blob without loading it
// into memory: it reads the central directory, then slices out and inflates
// one entry at a time. Handles Zip64, so multi-gigabyte exports work.

export interface ArchiveEntry {
  /** Path inside the archive (or folder), with forward slashes. */
  path: string;
  /** Uncompressed size in bytes. */
  size: number;
  blob(): Promise<Blob>;
}

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

async function bytes(file: Blob, start: number, end: number) {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

const u64 = (v: DataView, at: number) => Number(v.getBigUint64(at, true));

export async function readZip(file: Blob): Promise<ArchiveEntry[]> {
  // The end-of-central-directory record is in the last 22 bytes plus an optional comment.
  const tailStart = Math.max(0, file.size - 22 - 0xffff - 20);
  const tail = await bytes(file, tailStart, file.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This doesn't look like a zip file");

  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);
  if (eocd >= 20 && tail.getUint32(eocd - 20, true) === ZIP64_LOCATOR) {
    const z64 = await bytes(file, u64(tail, eocd - 12), u64(tail, eocd - 12) + 56);
    if (z64.getUint32(0, true) !== ZIP64_EOCD) throw new Error("Damaged zip file");
    count = u64(z64, 32);
    cdSize = u64(z64, 40);
    cdOffset = u64(z64, 48);
  }

  const cd = await bytes(file, cdOffset, cdOffset + cdSize);
  const decoder = new TextDecoder();
  const entries: ArchiveEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== CENTRAL) throw new Error("Damaged zip file");
    const flags = cd.getUint16(p + 8, true);
    const method = cd.getUint16(p + 10, true);
    let compressed = cd.getUint32(p + 20, true);
    let size = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let offset = cd.getUint32(p + 42, true);
    const path = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));

    // Zip64 extra field: 64-bit values for whichever fields overflowed, in this order.
    for (let e = p + 46 + nameLen; e + 4 <= p + 46 + nameLen + extraLen;) {
      const id = cd.getUint16(e, true);
      const len = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) { size = u64(cd, q); q += 8; }
        if (compressed === 0xffffffff) { compressed = u64(cd, q); q += 8; }
        if (offset === 0xffffffff) offset = u64(cd, q);
      }
      e += 4 + len;
    }
    p += 46 + nameLen + extraLen + commentLen;

    if (path.endsWith("/")) continue;
    entries.push({
      path,
      size,
      async blob() {
        if (flags & 1) throw new Error(`${path} is encrypted`);
        const local = await bytes(file, offset, offset + 30);
        if (local.getUint32(0, true) !== LOCAL) throw new Error("Damaged zip file");
        const start = offset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
        const raw = file.slice(start, start + compressed);
        if (method === 0) return raw;
        if (method !== 8) throw new Error(`${path} uses an unsupported compression method`);
        return new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
      },
    });
  }
  return entries;
}

/** Files picked with a folder chooser (`webkitdirectory`), as archive entries. */
export function folderEntries(files: File[]): ArchiveEntry[] {
  return files.map((f) => ({
    path: (f.webkitRelativePath || f.name).replace(/\\/g, "/"),
    size: f.size,
    blob: async () => f,
  }));
}
