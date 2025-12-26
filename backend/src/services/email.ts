// src/services/email.ts
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.EMAIL_SMTP_HOST!;
const SMTP_PORT = Number(process.env.EMAIL_SMTP_PORT ?? 587);
const SMTP_USER = process.env.EMAIL_SMTP_USER!;
const SMTP_PASS = process.env.EMAIL_SMTP_PASS!;
const EMAIL_FROM = process.env.EMAIL_FROM!;

export function createMailer() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    throw new Error("Missing email SMTP env vars (EMAIL_SMTP_HOST/USER/PASS/EMAIL_FROM).");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for 587/STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendRecoveryEmail(to: string, verifyUrl: string) {
  const transporter = createMailer();

  const subject = "IDSafe account recovery";
  const text =
    `Use this link to continue your IDSafe recovery:\n\n${verifyUrl}\n\n` +
    `This link will expire soon. If you didn’t request this, ignore this email.`;

  const html = `
    <p>Use this link to continue your IDSafe recovery:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link will expire soon. If you didn’t request this, ignore this email.</p>
  `;

  await transporter.sendMail({ from: EMAIL_FROM, to, subject, text, html });
}

export async function sendAdminOtpEmail(to: string, otpCode: string) {
  const transporter = createMailer();

  const subject = "IDSafe admin login verification code";
  const text =
    `Your IDSafe admin verification code is: ${otpCode}\n\n` +
    `It expires in 5 minutes. If you didn’t request this, ignore this email.`;

  const html = `
    <p>Your IDSafe admin verification code is:</p>
    <p><strong style="font-size: 18px; letter-spacing: 2px;">${otpCode}</strong></p>
    <p>It expires in 5 minutes. If you didn’t request this, ignore this email.</p>
  `;

  await transporter.sendMail({ from: EMAIL_FROM, to, subject, text, html });
}
