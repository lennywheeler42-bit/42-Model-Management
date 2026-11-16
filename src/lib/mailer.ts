import "server-only";
import nodemailer from "nodemailer";
import { log } from "@/lib/log";

// Outgoing email for messages staff send from the dashboard (package emails). Uses
// the agency's own mailbox over SMTP; the settings are server-only and are read
// nowhere else (tests/unit/boundaries.test.mts). Sign-in emails are not sent here:
// those go through Supabase Auth.
//
//   SMTP_HOST      e.g. smtp.hostinger.com
//   SMTP_PORT      465 (default, TLS) or 587 (STARTTLS)
//   SMTP_USER      the mailbox address
//   SMTP_PASSWORD  its password or app password
//   EMAIL_FROM     optional, e.g. "42 Model Management <bookings@example.com>"; defaults to SMTP_USER

type Settings = { host: string; port: number; user: string; password: string; from: string };

function settings(): Settings | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  return { host, port, user, password, from: process.env.EMAIL_FROM?.trim() || `42 Model Management <${user}>` };
}

// Whether the site can send email itself. When it cannot, the dashboard opens the
// message in the staff member's own email app instead.
export const mailerConfigured = () => settings() !== null;

export type OutgoingMail = { to: string; toName?: string | null; subject: string; text: string; html?: string; replyTo?: string | null };

let transport: { key: string; mailer: nodemailer.Transporter } | null = null;

export async function sendMail(mail: OutgoingMail): Promise<{ ok: true } | { ok: false; reason: string }> {
  const config = settings();
  if (!config) return { ok: false, reason: "not_configured" };
  const key = `${config.host}:${config.port}:${config.user}`;
  if (transport?.key !== key) {
    transport = { key, mailer: nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: config.password }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 }) };
  }
  try {
    await transport.mailer.sendMail({
      from: config.from,
      to: mail.toName ? { name: mail.toName, address: mail.to } : mail.to,
      replyTo: mail.replyTo ?? undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { ok: true };
  } catch (error) {
    // The address is not logged; the server's reason is enough to fix a setting.
    log.error("mailer", "send failed", error);
    return { ok: false, reason: "send_failed" };
  }
}
