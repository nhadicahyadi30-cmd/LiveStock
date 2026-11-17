import { ApiError } from "./errors";
import { SESSION_TTL_SECONDS, sessionSecret, signSession } from "./session-token";

export const SESSION_COOKIE = "sl_session";

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function attrs(maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Menulis cookie sesi baru ke respons. */
export function setSessionCookie(res: Response, data: { userId: string; organizationId: string | null }): void {
  const secret = sessionSecret();
  if (!secret) {
    throw new ApiError(500, "AUTH_NOT_CONFIGURED", "SESSION_SECRET belum diset (minimal 32 karakter)");
  }
  res.headers.append("set-cookie", `${SESSION_COOKIE}=${signSession(data, secret)}; ${attrs(SESSION_TTL_SECONDS)}`);
}

export function clearSessionCookie(res: Response): void {
  res.headers.append("set-cookie", `${SESSION_COOKIE}=; ${attrs(0)}`);
}
