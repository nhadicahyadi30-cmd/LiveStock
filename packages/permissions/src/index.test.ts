import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, can, canEditRecord, isRole, permissionsFor } from "./index";

describe("matriks izin", () => {
  it("setiap role boleh melihat farm, ternak, catatan, tugas, dan dashboard", () => {
    for (const role of ROLES) {
      for (const p of ["farm.read", "livestock.read", "records.read", "tasks.read", "dashboard.read"] as const) {
        expect(can(role, p)).toBe(true);
      }
    }
  });

  it("Owner memiliki semua izin", () => {
    expect(permissionsFor("OWNER")).toHaveLength(PERMISSIONS.length);
  });

  it("hanya Owner yang mengelola organisasi, anggota, dan langganan", () => {
    for (const role of ["MANAGER", "WORKER", "VIEWER"] as const) {
      expect(can(role, "org.manage")).toBe(false);
      expect(can(role, "members.manage")).toBe(false);
      expect(can(role, "billing.manage")).toBe(false);
    }
  });

  it("Petugas bisa input catatan tetapi tidak bisa ekspor laporan atau melihat audit log", () => {
    expect(can("WORKER", "records.create")).toBe(true);
    expect(can("WORKER", "livestock.write")).toBe(true);
    expect(can("WORKER", "reports.export")).toBe(false);
    expect(can("WORKER", "audit.read")).toBe(false);
  });

  it("Pengamat bisa ekspor laporan tetapi tidak bisa menulis apa pun", () => {
    expect(can("VIEWER", "reports.export")).toBe(true);
    for (const p of ["farm.write", "livestock.write", "records.create", "tasks.manage", "tasks.complete"] as const) {
      expect(can("VIEWER", p)).toBe(false);
    }
  });

  it("Manajer bisa mengelola tugas dan mengoreksi catatan", () => {
    expect(can("MANAGER", "tasks.manage")).toBe(true);
    expect(can("MANAGER", "records.correct")).toBe(true);
  });

  it("isRole menolak nilai di luar enum", () => {
    expect(isRole("OWNER")).toBe(true);
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("canEditRecord", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);

  it("Petugas boleh mengubah catatannya sendiri dalam 24 jam", () => {
    expect(canEditRecord({ role: "WORKER", userId: "u1", recordedBy: "u1", createdAt: hoursAgo(23), now })).toBe(true);
  });

  it("Petugas tidak boleh mengubah catatannya sendiri setelah 24 jam", () => {
    expect(canEditRecord({ role: "WORKER", userId: "u1", recordedBy: "u1", createdAt: hoursAgo(25), now })).toBe(false);
  });

  it("Petugas tidak boleh mengubah catatan orang lain", () => {
    expect(canEditRecord({ role: "WORKER", userId: "u1", recordedBy: "u2", createdAt: hoursAgo(1), now })).toBe(false);
  });

  it("Manajer boleh mengoreksi kapan saja; Pengamat tidak pernah", () => {
    expect(canEditRecord({ role: "MANAGER", userId: "u1", recordedBy: "u2", createdAt: hoursAgo(100), now })).toBe(true);
    expect(canEditRecord({ role: "VIEWER", userId: "u1", recordedBy: "u1", createdAt: hoursAgo(1), now })).toBe(false);
  });
});
