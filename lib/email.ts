import "server-only";
import nodemailer from "nodemailer";

export async function sendVerificationCode(email: string, code: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) throw new Error("邮箱服务尚未配置，请先设置 SMTP_HOST、SMTP_USER、SMTP_PASSWORD 和 SMTP_FROM");
  const transporter = nodemailer.createTransport({
    host, port, secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  await transporter.sendMail({
    from, to: email, subject: "樱花游戏档案 - 邮箱验证码",
    text: `你的注册验证码是：${code}。验证码 10 分钟内有效，请勿向他人透露。`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2>樱花游戏档案</h2><p>你的邮箱注册验证码：</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f7edf3;border-radius:12px;text-align:center">${code}</div><p>验证码 10 分钟内有效，请勿向他人透露。</p></div>`,
  });
}
