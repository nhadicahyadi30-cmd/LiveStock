import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/password";

describe("password", () => {
  it("menerima kata sandi benar dan menolak yang salah", async () => {
    const h = await hashPassword("rahasia-panjang");
    expect(await verifyPassword("rahasia-panjang", h)).toBe(true);
    expect(await verifyPassword("salah", h)).toBe(false);
  });
  it("menolak bila pengguna belum punya hash", async () => {
    expect(await verifyPassword("apa-saja", null)).toBe(false);
  });
  it("hash berbeda untuk kata sandi yang sama (salt acak)", async () => {
    expect(await hashPassword("x1234567")).not.toBe(await hashPassword("x1234567"));
  });
});
