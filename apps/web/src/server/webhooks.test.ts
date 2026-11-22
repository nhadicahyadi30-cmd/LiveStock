import { describe, expect, it } from "vitest";
import { isSafeWebhookUrl, nextDelayMs, signPayload } from "./webhooks";

describe("isSafeWebhookUrl", () => {
  it("menerima https publik", () => { expect(isSafeWebhookUrl("https://example.com/hook").ok).toBe(true); });
  it("menolak http", () => { expect(isSafeWebhookUrl("http://example.com/hook").ok).toBe(false); });
  it("menolak localhost dan IP internal", () => {
    for (const u of ["https://localhost/x", "https://127.0.0.1/x", "https://10.1.2.3/x", "https://192.168.0.5/x", "https://172.20.0.1/x", "https://169.254.169.254/latest", "https://[::1]/x", "https://foo.internal/x", "https://printer.local/x"]) expect(isSafeWebhookUrl(u).ok).toBe(false);
  });
  it("menerima IP publik dan 172.32", () => { expect(isSafeWebhookUrl("https://8.8.8.8/x").ok).toBe(true); expect(isSafeWebhookUrl("https://172.32.0.1/x").ok).toBe(true); });
  it("menolak kredensial di URL", () => { expect(isSafeWebhookUrl("https://user:pw@example.com/").ok).toBe(false); });
  it("mode lokal mengizinkan http dan localhost", () => { expect(isSafeWebhookUrl("http://localhost:1880/hook", true).ok).toBe(true); });
});
describe("signPayload", () => {
  it("deterministik dan bergantung pada rahasia, waktu, isi", () => {
    const a = signPayload("s", 1, "{}");
    expect(a).toBe(signPayload("s", 1, "{}"));
    expect(a).not.toBe(signPayload("t", 1, "{}"));
    expect(a).not.toBe(signPayload("s", 2, "{}"));
    expect(a).not.toBe(signPayload("s", 1, "{ }"));
    expect(a).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
});
describe("nextDelayMs", () => {
  it("naik lalu menyerah", () => {
    expect(nextDelayMs(1)).toBe(60_000);
    expect(nextDelayMs(2)).toBe(300_000);
    expect(nextDelayMs(4)).toBe(7_200_000);
    expect(nextDelayMs(5)).toBeNull();
  });
});
