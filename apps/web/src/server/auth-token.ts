import { createHash, randomBytes } from "node:crypto";

/** Token acak 256-bit; yang disimpan di database hanya hash SHA-256-nya. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const INVITE_TTL_MS = 7 * 864e5;
export const RESET_TTL_MS = 60 * 60e3;

/** Pengiriman email belum tersambung ke penyedia. Untuk sementara tautan dicetak di log server. */
export function sendMail(to: string, subject: string, link: string): void {
  console.log(`[mail-dev] ke=${to} | ${subject} | ${link}`);
}
