import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

/**
 * Reads SMTP settings from the environment.
 *
 * For Google Workspace / Gmail with a custom domain (e.g. info@kvadra.io):
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=info@kvadra.io
 *   SMTP_PASS=<Google App Password>
 *   SMTP_FROM=info@kvadra.io
 *   SMTP_FROM_NAME=Your Company
 */
export function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromEmail = (process.env.SMTP_FROM || user)?.trim();
  if (!host || !user || !pass || !fromEmail) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.SMTP_SECURE === '1' ||
    port === 465;

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName: (process.env.SMTP_FROM_NAME || fromEmail).trim(),
  };
}

export function smtpConfigured(): boolean {
  return readSmtpConfig() !== null;
}

export function createSmtpTransport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function sendSmtpMail(input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
}): Promise<{ messageId: string }> {
  const config = readSmtpConfig();
  if (!config) {
    throw new Error(
      'SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env',
    );
  }

  const transport = createSmtpTransport(config);
  const result = await transport.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo || config.fromEmail,
  });

  return { messageId: String(result.messageId || '') };
}
