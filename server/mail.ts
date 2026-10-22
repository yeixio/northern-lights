import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";
import { config } from "./config.js";
import type { DB } from "./db/index.js";
import { parseJson } from "./appearance.js";

/**
 * Email can be set up two ways: SMTP_URL in the server's environment (which
 * always wins), or by an admin on the Site settings page, stored in
 * site_settings.mail. Without either, invite and reset links are shown on
 * screen instead.
 */
export const mailSettingsSchema = z.object({
  host: z.string().trim().min(1, "Enter the mail server").max(255),
  port: z.number().int().min(1).max(65535),
  security: z.enum(["ssl", "starttls", "none"]),
  user: z.string().trim().max(320),
  pass: z.string().max(500),
  from_name: z.string().trim().max(200),
  from_email: z.string().trim().pipe(z.email("Enter the address emails come from")),
});
export type MailSettings = z.infer<typeof mailSettingsSchema>;

export type MailSource = "env" | "site" | "off";

const envTransport = config.mail.smtpUrl ? nodemailer.createTransport(config.mail.smtpUrl) : null;
let cached: { key: string; transport: Transporter } | null = null;

export function transportFor(s: MailSettings): Transporter {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.security === "ssl",
    requireTLS: s.security === "starttls",
    ignoreTLS: s.security === "none",
    auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  });
}

export function fromAddress(s: MailSettings, siteName: string) {
  return { name: s.from_name || siteName, address: s.from_email };
}

export async function siteMailSettings(db: DB) {
  const row = await db.selectFrom("site_settings").select(["mail", "site_name"]).executeTakeFirst();
  const parsed = mailSettingsSchema.safeParse(parseJson(row?.mail));
  return { settings: parsed.success ? parsed.data : null, siteName: row?.site_name ?? "Northern Lights" };
}

export async function mailSource(db: DB): Promise<MailSource> {
  if (envTransport) return "env";
  return (await siteMailSettings(db)).settings ? "site" : "off";
}

export const mailEnabled = async (db: DB) => (await mailSource(db)) !== "off";

/** The transport and sender to use right now, or null when email is off. */
async function current(db: DB) {
  if (envTransport) return { transport: envTransport, from: config.mail.from };
  const { settings, siteName } = await siteMailSettings(db);
  if (!settings) return null;
  const key = JSON.stringify(settings);
  if (cached?.key !== key) cached = { key, transport: transportFor(settings) };
  return { transport: cached.transport, from: fromAddress(settings, siteName) };
}

/** Sends an email if email is set up. Returns false when mail is off or sending failed. */
export async function sendMail(db: DB, to: string, subject: string, text: string) {
  const mail = await current(db);
  if (!mail) return false;
  try {
    await mail.transport.sendMail({ from: mail.from, to, subject, text });
    return true;
  } catch (err) {
    console.error("[mail] send failed:", err);
    return false;
  }
}
