// Antarmuka sesi. Penyedia login (Auth.js atau identity provider terkelola) adalah KEPUTUSAN TERBUKA
// di dokumen Desain Database. Sampai diputuskan, hanya ada dua penyedia di bawah ini.
//
// Aturan yang harus dipertahankan oleh penyedia sungguhan:
//  - userId dan activeOrganizationId berasal dari sesi yang ditandatangani server, bukan dari input klien.
//  - activeOrganizationId hanya pilihan; keanggotaan tetap diverifikasi ulang di tenant-guard.ts.

export interface Session {
  userId: string;
  activeOrganizationId: string | null;
}

export interface SessionProvider {
  getSession(req: Request): Promise<Session | null>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * HANYA UNTUK PENGEMBANGAN LOKAL. Siapa pun yang bisa mengirim header ini dianggap login sebagai pengguna itu.
 * Aktif hanya bila ENABLE_DEV_SESSION=true dan NODE_ENV bukan production.
 */
const devSessionProvider: SessionProvider = {
  async getSession(req) {
    const userId = req.headers.get("x-dev-user-id");
    if (!userId || !UUID_RE.test(userId)) return null;

    const org = req.headers.get("x-dev-organization-id");
    return {
      userId,
      activeOrganizationId: org && UUID_RE.test(org) ? org : null,
    };
  },
};

/** Pengganti sampai penyedia login dipilih: tidak ada sesi, semua request ditolak 401. */
const unconfiguredSessionProvider: SessionProvider = {
  async getSession() {
    return null;
  },
};

function selectProvider(): SessionProvider {
  const devEnabled = process.env.ENABLE_DEV_SESSION === "true" && process.env.NODE_ENV !== "production";
  return devEnabled ? devSessionProvider : unconfiguredSessionProvider;
}

export function getSession(req: Request): Promise<Session | null> {
  return selectProvider().getSession(req);
}
