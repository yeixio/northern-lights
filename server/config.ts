import fs from "node:fs";
import path from "node:path";

// Read settings from .env when present (real environment variables win).
if (fs.existsSync(".env")) process.loadEnvFile(".env");

const env = process.env;

const dataDir = path.resolve(env.DATA_DIR ?? "./data");

export const config = {
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? "0.0.0.0",
  dataDir,
  /**
   * sqlite:<path> (default) or postgres://user:pass@host/db.
   * A bare file path is treated as SQLite.
   */
  databaseUrl: env.DATABASE_URL ?? `sqlite:${path.join(dataDir, "northern-lights.db")}`,
  /** Public URL of the site, used in emailed links. Falls back to the request's origin. */
  appUrl: env.APP_URL?.replace(/\/$/, ""),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : (env.APP_URL ?? "").startsWith("https://"),
  sessionDays: Number(env.SESSION_DAYS ?? 30),
  inviteDays: Number(env.INVITE_DAYS ?? 14),
  maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024,
  storage: {
    driver: (env.STORAGE ?? "local") as "local" | "s3",
    localDir: path.resolve(env.UPLOADS_DIR ?? path.join(dataDir, "uploads")),
    s3: {
      bucket: env.S3_BUCKET ?? "",
      region: env.S3_REGION ?? "us-east-1",
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    },
  },
  mail: {
    /** e.g. smtps://user:pass@smtp.example.com:465. Without it, invite links are shown to the inviter instead. */
    smtpUrl: env.SMTP_URL,
    from: env.MAIL_FROM ?? "Northern Lights <no-reply@localhost>",
  },
  clientDir: path.resolve(env.CLIENT_DIR ?? "./dist/client"),
};
