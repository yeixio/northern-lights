// Test fixtures: a tiny zip writer and a fake Facebook export. Not used by the app.
import { deflateRawSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Buffer) => {
  let c = 0xffffffff;
  for (const b of data) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Build a zip in memory. `zip64` writes Zip64 records the way large archives have them. */
export function makeZip(files: Record<string, string | Buffer>, opts: { zip64?: boolean } = {}) {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const deflate = name.endsWith(".json");
    const body = deflate ? deflateRawSync(data) : data;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, body);

    const extra = Buffer.alloc(opts.zip64 ? 28 : 0);
    if (opts.zip64) {
      extra.writeUInt16LE(0x0001, 0);
      extra.writeUInt16LE(24, 2);
      extra.writeBigUInt64LE(BigInt(data.length), 4);
      extra.writeBigUInt64LE(BigInt(body.length), 12);
      extra.writeBigUInt64LE(BigInt(offset), 20);
    }
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(45, 4);
    cd.writeUInt16LE(45, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(deflate ? 8 : 0, 10);
    cd.writeUInt32LE(crc32(data), 16);
    cd.writeUInt32LE(opts.zip64 ? 0xffffffff : body.length, 20);
    cd.writeUInt32LE(opts.zip64 ? 0xffffffff : data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(extra.length, 30);
    cd.writeUInt32LE(opts.zip64 ? 0xffffffff : offset, 42);
    central.push(cd, nameBuf, extra);
    offset += local.length + nameBuf.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const count = Object.keys(files).length;
  const tail: Buffer[] = [];
  if (opts.zip64) {
    const z = Buffer.alloc(56);
    z.writeUInt32LE(0x06064b50, 0);
    z.writeBigUInt64LE(44n, 4);
    z.writeBigUInt64LE(BigInt(count), 24);
    z.writeBigUInt64LE(BigInt(count), 32);
    z.writeBigUInt64LE(BigInt(cdBuf.length), 40);
    z.writeBigUInt64LE(BigInt(offset), 48);
    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0);
    loc.writeBigUInt64LE(BigInt(offset + cdBuf.length), 8);
    loc.writeUInt32LE(1, 16);
    tail.push(z, loc);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(opts.zip64 ? 0xffff : count, 8);
  end.writeUInt16LE(opts.zip64 ? 0xffff : count, 10);
  end.writeUInt32LE(opts.zip64 ? 0xffffffff : cdBuf.length, 12);
  end.writeUInt32LE(opts.zip64 ? 0xffffffff : offset, 16);
  return new Blob([new Uint8Array(Buffer.concat([...parts, cdBuf, ...tail, end]))]);
}

const jpeg = (n: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, n]);

/** A two-part Facebook export in the 2024+ layout. */
export function facebookExport(opts: { zip64?: boolean } = {}) {
  const root = "facebook-mike-2026-10-20-abc";
  const media = "your_facebook_activity/posts/media";
  const json = (v: unknown) => JSON.stringify(v);
  const part1 = makeZip({
    [`${root}/your_facebook_activity/posts/album/0.json`]: json({
      name: "CafÃ© summer", // Facebook's escaped UTF-8 for "Café summer"
      description: "Lake days",
      last_modified_timestamp: 1720000000,
      photos: [
        { uri: `${media}/Summer_1234/2_n.jpg`, creation_timestamp: 1719000500, description: "Second" },
        {
          uri: `${media}/Summer_1234/1_n.jpg`, creation_timestamp: 1719999999, description: "Sunset ð\u009f\u008c\u0085",
          media_metadata: { photo_metadata: { exif_data: [{ taken_timestamp: 1719000000 }] } },
        },
        { uri: `${media}/Summer_1234/notes.srt`, creation_timestamp: 1719000000 },
      ],
    }),
    [`${root}/your_facebook_activity/posts/your_uncategorized_photos.json`]: json({
      other_photos_v2: [{ uri: `${media}/Other/3_n.jpg`, creation_timestamp: 1600000000 }],
    }),
    [`${root}/your_facebook_activity/posts/your_videos.json`]: json({
      videos_v2: [{ uri: `${media}/Videos/5.mp4`, creation_timestamp: 1610000000 }, { uri: `${media}/Videos/gone.mp4` }],
    }),
    [`${root}/your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json`]: json([
      {
        timestamp: 1719500000,
        data: [{ post: "At the lake" }],
        attachments: [{ data: [{ media: { uri: `${media}/Summer_1234/1_n.jpg` } }, { media: { uri: `${media}/Posts/4_n.jpg` } }] }],
      },
      { timestamp: 1700000000, attachments: [{ data: [{ external_context: { url: "https://example.com/story" } }] }] },
      { timestamp: 1690000000, title: "Mike updated his status." },
    ]),
    [`${root}/your_facebook_activity/messages/inbox/sam_1/message_1.json`]: json({
      participants: [{ name: "Sam" }], messages: [{ photos: [{ uri: `${media}/Other/3_n.jpg` }] }],
    }),
    [`${root}/${media}/Summer_1234/1_n.jpg`]: jpeg(1),
    [`${root}/${media}/Summer_1234/2_n.jpg`]: jpeg(2),
    [`${root}/${media}/Other/3_n.jpg`]: jpeg(3),
  }, opts);
  // Facebook splits big exports; media can land in a different zip than the JSON.
  const part2 = makeZip({
    [`${root}/${media}/Posts/4_n.jpg`]: jpeg(4),
    [`${root}/${media}/Videos/5.mp4`]: Buffer.from("fake mp4"),
  }, opts);
  return [part1, part2];
}
