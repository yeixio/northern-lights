import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "./config.js";

export interface Storage {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements Storage {
  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }
  private file(key: string) {
    return path.join(this.dir, path.basename(key));
  }
  async put(key: string, data: Buffer) {
    await fs.promises.writeFile(this.file(key), data);
  }
  async get(key: string) {
    const file = this.file(key);
    if (!fs.existsSync(file)) return null;
    return Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  }
  async remove(key: string) {
    await fs.promises.rm(this.file(key), { force: true });
  }
}

class S3Storage implements Storage {
  private client: Promise<typeof import("@aws-sdk/client-s3") & { s3: import("@aws-sdk/client-s3").S3Client }>;
  constructor(private opts: typeof config.storage.s3) {
    this.client = import("@aws-sdk/client-s3").then((sdk) => ({
      ...sdk,
      s3: new sdk.S3Client({
        region: opts.region,
        endpoint: opts.endpoint,
        forcePathStyle: opts.forcePathStyle,
        credentials: opts.accessKeyId && opts.secretAccessKey
          ? { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey }
          : undefined,
      }),
    }));
  }
  async put(key: string, data: Buffer, mime: string) {
    const { s3, PutObjectCommand } = await this.client;
    await s3.send(new PutObjectCommand({ Bucket: this.opts.bucket, Key: this.opts.prefix + key, Body: data, ContentType: mime }));
  }
  async get(key: string) {
    const { s3, GetObjectCommand } = await this.client;
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: this.opts.prefix + key }));
      return (res.Body?.transformToWebStream() as ReadableStream | undefined) ?? null;
    } catch {
      return null;
    }
  }
  async remove(key: string) {
    const { s3, DeleteObjectCommand } = await this.client;
    await s3.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: this.opts.prefix + key }));
  }
}

export function createStorage(): Storage {
  if (config.storage.driver === "s3") {
    if (!config.storage.s3.bucket) throw new Error("STORAGE=s3 requires S3_BUCKET");
    return new S3Storage(config.storage.s3);
  }
  return new LocalStorage(config.storage.localDir);
}
