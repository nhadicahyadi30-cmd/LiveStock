// Menjalankan prisma/sql/*.sql berurutan sebagai role migrator (RLS, grant, constraint, view, trigger).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL belum diset.");
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "sql");
// Argumen opsional: awalan nama berkas, mis. "pnpm db:rls 018" hanya menjalankan 018_*.sql.
// Berguna di database yang sudah berisi data (berkas lama memvalidasi ulang constraint dan bisa gagal karena RLS).
const only = process.argv[2];
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql") && (!only || f.startsWith(only)))
  .sort();
if (files.length === 0) {
  console.error(`Tidak ada berkas SQL yang cocok dengan "${only ?? ""}".`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`OK  ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`GAGAL ${file}`);
      throw err;
    }
  }
} finally {
  await client.end();
}
