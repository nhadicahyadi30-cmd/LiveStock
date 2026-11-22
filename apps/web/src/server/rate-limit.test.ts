import { describe, expect, it } from "vitest";
import { _clearForTest, hit, resetKey } from "./rate-limit";

describe("hit", () => {
  it("mengizinkan sampai batas lalu menolak", () => {
    _clearForTest();
    for (let i = 0; i < 3; i++) expect(hit("a", 3, 1000, 0).ok).toBe(true);
    const r = hit("a", 3, 1000, 100);
    expect(r.ok).toBe(false); expect(r.retryAfterSec).toBe(1);
  });
  it("jendela baru setelah waktu lewat", () => {
    _clearForTest();
    for (let i = 0; i < 4; i++) hit("b", 3, 1000, 0);
    expect(hit("b", 3, 1000, 1001).ok).toBe(true);
  });
  it("kunci berbeda tidak saling memengaruhi; resetKey membersihkan", () => {
    _clearForTest();
    for (let i = 0; i < 5; i++) hit("c", 3, 1000, 0);
    expect(hit("d", 3, 1000, 0).ok).toBe(true);
    resetKey("c"); expect(hit("c", 3, 1000, 0).ok).toBe(true);
  });
});
