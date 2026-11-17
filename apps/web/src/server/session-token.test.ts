import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session-token";

const S = "rahasia-uji-yang-cukup-panjang-1234567890";
const U = "0192f0a0-0000-7000-8000-00000000d001";

describe("session token", () => {
  it("bolak-balik valid", () => {
    const t = signSession({ userId: U, organizationId: null }, S);
    expect(verifySession(t, S)?.uid).toBe(U);
  });
  it("menolak tanda tangan salah, payload diubah, dan secret lain", () => {
    const t = signSession({ userId: U, organizationId: null }, S);
    expect(verifySession(t, "secret-lain-yang-panjang-sekali-123456")).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "x", org: null, exp: 9e9 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, S)).toBeNull();
    expect(verifySession(`${body}.`, S)).toBeNull();
  });
  it("menolak token kedaluwarsa", () => {
    const t = signSession({ userId: U, organizationId: null }, S, Date.now() - 8 * 24 * 3600 * 1000);
    expect(verifySession(t, S)).toBeNull();
  });
});
