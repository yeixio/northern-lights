import zlib from "node:zlib";

// Paints the demo photos in code, so the demo needs no downloads and contains
// no real people or places. Each picture is a stylized landscape (sky, an
// aurora or sun, mountain ridges, maybe a lake), encoded as PNG.

type RGB = [number, number, number];

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const smooth = (t: number) => t * t * (3 - 2 * t);

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf: Buffer) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Encode 8-bit RGB pixels as a PNG. */
export function encodePng(width: number, height: number, rgb: Uint8Array) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export interface Scene {
  sky: [string, string]; // top, horizon
  ridges: string[]; // far to near
  aurora?: [string, string];
  sun?: { color: string; x: number; y: number; r: number };
  stars?: boolean;
  lake?: boolean;
  horizon?: number; // 0..1 from the top
}

export const SCENES: Record<string, Scene> = {
  aurora: { sky: ["#050b1f", "#123047"], ridges: ["#1b2d40", "#111f2e", "#0a131d"], aurora: ["#3cf0a0", "#8b5cf6"], stars: true, lake: true, horizon: 0.66 },
  fjord: { sky: ["#6fb3e0", "#e3f1f7"], ridges: ["#8aa6bd", "#5c7d96", "#3b5a70"], sun: { color: "#fff7d6", x: 0.75, y: 0.22, r: 0.05 }, lake: true, horizon: 0.62 },
  sunset: { sky: ["#3b2c6b", "#f59e6b"], ridges: ["#6b3f63", "#47294a", "#2a1730"], sun: { color: "#ffd59a", x: 0.35, y: 0.55, r: 0.09 }, lake: true, horizon: 0.64 },
  forest: { sky: ["#9fd3c7", "#f1f7e8"], ridges: ["#6e9f7d", "#3f7353", "#21452f"], sun: { color: "#fffbe8", x: 0.2, y: 0.18, r: 0.06 }, horizon: 0.7 },
  winter: { sky: ["#a9c4e4", "#f4f7fb"], ridges: ["#dfe8f2", "#b9c9db", "#8ea4bd"], sun: { color: "#ffffff", x: 0.62, y: 0.28, r: 0.05 }, horizon: 0.7 },
  dusk: { sky: ["#141b3d", "#c46b8a"], ridges: ["#4a3561", "#2f2447", "#1a1530"], aurora: ["#f472b6", "#60a5fa"], stars: true, horizon: 0.7 },
  meadow: { sky: ["#7cc4f2", "#fdf2d0"], ridges: ["#a4c47c", "#7ea85a", "#55813a"], sun: { color: "#fff3c4", x: 0.82, y: 0.2, r: 0.07 }, horizon: 0.6 },
  coast: { sky: ["#f7b787", "#fde8c8"], ridges: ["#c98a6e", "#9b5f4b"], sun: { color: "#fff1d0", x: 0.5, y: 0.5, r: 0.07 }, lake: true, horizon: 0.58 },
};

/** Paint one landscape. Different seeds give different ridges and auroras. */
export function landscape(scene: Scene, seed: number, width = 1200, height = 800) {
  const rand = rng(seed);
  const px = new Uint8Array(width * height * 3);
  const horizon = Math.round((scene.horizon ?? 0.66) * height);
  const skyTop = hex(scene.sky[0]);
  const skyBottom = hex(scene.sky[1]);

  // Ridge heights: a few sine waves per ridge with random phases.
  const ridges = scene.ridges.map((color, i) => {
    const waves = Array.from({ length: 4 }, (_, k) => ({
      f: (1.5 + rand() * 2) * (k + 1), p: rand() * Math.PI * 2, a: 1 / (k + 1.2),
    }));
    const base = horizon - height * (0.28 - i * 0.07);
    const amp = height * (0.11 - i * 0.02);
    const top = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      let h = 0;
      for (const w of waves) h += Math.sin((x / width) * w.f * Math.PI + w.p) * w.a;
      top[x] = Math.min(horizon, base - h * amp);
    }
    return { color: hex(color), top };
  });

  const curtains = scene.aurora && Array.from({ length: 3 }, () => ({
    y: 0.18 + rand() * 0.22, f: 1 + rand() * 2, p: rand() * 6, w: 0.05 + rand() * 0.05, s: 30 + rand() * 50,
  }));
  const stars = new Set<number>();
  if (scene.stars) for (let i = 0; i < width * height * 0.0006; i++) stars.add(Math.floor(rand() * width * horizon));

  const skyAt = (x: number, y: number): RGB => {
    let c = mix(skyTop, skyBottom, smooth(Math.min(1, y / horizon)));
    if (stars.has(y * width + x)) c = mix(c, [255, 255, 255], 0.5 + 0.5 * ((x * 7 + y * 13) % 10) / 10);
    if (scene.sun) {
      const sx = scene.sun.x * width, sy = scene.sun.y * height, r = scene.sun.r * height;
      const d = Math.hypot(x - sx, y - sy);
      const sun = hex(scene.sun.color);
      if (d < r) c = sun;
      else c = mix(c, sun, Math.max(0, 0.45 * Math.exp(-(d - r) / (r * 2.5))));
    }
    if (scene.aurora && curtains) {
      const [a, b] = scene.aurora.map(hex);
      for (const k of curtains) {
        const cy = (k.y + 0.05 * Math.sin((x / width) * k.f * Math.PI * 2 + k.p)) * height;
        const dy = (y - cy) / (k.w * height);
        // Bright lower edge, long fading rays upward.
        const glow = dy > 0 ? Math.exp(-dy * dy * 4) : Math.exp(dy * 0.6);
        const rays = 0.55 + 0.45 * Math.sin(x / k.s + Math.sin(x / (k.s * 3)) * 2);
        const t = Math.max(0, glow * rays) * 0.75;
        const tint = mix(a, b, Math.min(1, Math.max(0, -dy * 0.25)));
        c = [c[0] + tint[0] * t, c[1] + tint[1] * t, c[2] + tint[2] * t];
      }
    }
    return c;
  };

  const landAt = (x: number, y: number): RGB | null => {
    for (let i = ridges.length - 1; i >= 0; i--) {
      if (y >= ridges[i].top[x]) {
        // A little haze toward the top of each ridge.
        const t = Math.min(1, (y - ridges[i].top[x]) / (height * 0.25));
        return mix(mix(ridges[i].color, skyBottom, 0.18), ridges[i].color, t);
      }
    }
    return null;
  };

  const ground = mix(ridges[ridges.length - 1].color, [0, 0, 0], 0.25);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let c: RGB;
      if (y < horizon) {
        c = landAt(x, y) ?? skyAt(x, y);
      } else if (scene.lake) {
        // Mirror the scene, shifted sideways a little for ripples.
        const depth = (y - horizon) / (height - horizon);
        const rx = Math.min(width - 1, Math.max(0, x + Math.round(Math.sin(y * 0.45) * (1 + depth * 5))));
        const ry = 2 * horizon - y - 1;
        const mirrored = ry >= 0 ? landAt(rx, ry) ?? skyAt(rx, ry) : skyTop;
        c = mix(mirrored, [10, 20, 35], 0.2 + 0.3 * depth);
      } else {
        c = mix(ground, [0, 0, 0], 0.4 * ((y - horizon) / (height - horizon)));
      }
      const o = (y * width + x) * 3;
      px[o] = clamp(c[0]); px[o + 1] = clamp(c[1]); px[o + 2] = clamp(c[2]);
    }
  }
  return encodePng(width, height, px);
}
