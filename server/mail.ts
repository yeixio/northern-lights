import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config.js";

let transport: Transporter | null = null;
if (config.mail.smtpUrl) transport = nodemailer.createTransport(config.mail.smtpUrl);

export const mailEnabled = () => transport !== null;

/** Sends an email if SMTP is configured. Returns false when mail is off or sending failed. */
export async function sendMail(to: string, subject: string, text: string) {
  if (!transport) return false;
  try {
    await transport.sendMail({ from: config.mail.from, to, subject, text });
    return true;
  } catch (err) {
    console.error("[mail] send failed:", err);
    return false;
  }
}
