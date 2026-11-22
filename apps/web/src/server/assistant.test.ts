import { describe, expect, it } from "vitest";
import { detectIntent, searchKnowledge } from "./assistant";

describe("detectIntent", () => {
  it("mengenali pertanyaan data", () => {
    expect(detectIntent("Berapa populasi ternak saya sekarang?")).toBe("POPULASI");
    expect(detectIntent("kematian 7 hari terakhir berapa")).toBe("KEMATIAN");
    expect(detectIntent("Tugas apa yang jatuh tempo hari ini")).toBe("TUGAS");
    expect(detectIntent("ada alarm sensor aktif?")).toBe("ALARM");
    expect(detectIntent("total pakan 30 hari")).toBe("PAKAN");
    expect(detectIntent("laba bulan ini berapa")).toBe("KEUANGAN");
  });
  it("FCR mengarah ke prediksi, bukan pakan", () => { expect(detectIntent("fcr batch saya berapa")).toBe("PREDIKSI"); });
  it("pertanyaan umum tidak dianggap data", () => { expect(detectIntent("apa itu biosekuriti")).toBeNull(); });
});
describe("searchKnowledge", () => {
  it("menemukan panduan yang relevan", () => {
    expect(searchKnowledge("suhu brooding untuk doc berapa?")?.entry.id).toBe("brooding");
    expect(searchKnowledge("bagaimana kualitas air kolam lele")?.entry.id).toBe("air-kolam");
    expect(searchKnowledge("rumus mortalitas")?.entry.id).toBe("mortalitas");
  });
  it("vaksin tidak memberi jadwal/dosis, mengarah ke dokter hewan", () => {
    const h = searchKnowledge("jadwal vaksin nd ib gumboro");
    expect(h?.entry.id).toBe("vaksin"); expect(h?.entry.answer).toMatch(/dokter hewan/);
  });
  it("tidak ada kecocokan → null", () => { expect(searchKnowledge("resep nasi goreng")).toBeNull(); });
});
