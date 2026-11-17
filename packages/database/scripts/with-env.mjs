// Memuat .env di root repositori (bila ada) lalu menjalankan perintah yang diberikan.
// Variabel yang sudah ada di environment (misalnya di CI) tidak ditimpa.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const envFile = join(root, ".env");

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Pemakaian: node scripts/with-env.mjs <perintah> [argumen...]");
  process.exit(2);
}

const result = spawnSync(cmd, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
