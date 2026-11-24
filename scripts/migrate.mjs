// Menjalankan db/schema.sql lalu membuat akun admin dari env.
// Pakai: DATABASE_URL=... ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run db:migrate
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes, scryptSync } from "crypto";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// File env hanya dibaca bila DATABASE_URL tidak diberikan langsung, supaya
// migrasi ke produksi tidak ikut memakai password admin lokal.
if (!process.env.DATABASE_URL) {
  for (const name of [".env.local", ".env"]) {
    const file = join(root, name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi nilainya.");
  process.exit(1);
}

// Nilai contoh dari versi lama repo ini, jadi diketahui umum.
const PUBLIC_PASSWORDS = ["ganti-password-admin", "ganti-dengan-password-kuat"];
if (PUBLIC_PASSWORDS.includes(process.env.ADMIN_PASSWORD ?? "")) {
  console.error("ADMIN_PASSWORD masih nilai contoh. Ganti dulu dengan password sendiri.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  const sql = readFileSync(join(root, "db", "schema.sql"), "utf8");
  await client.query(sql);
  console.log("Skema + seed selesai diterapkan.");

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (username && password) {
    const salt = randomBytes(16).toString("hex");
    const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
    await client.query(
      `INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [username, hash]
    );
    console.log(`Akun admin "${username}" siap.`);
  } else {
    console.log("ADMIN_USERNAME/ADMIN_PASSWORD tidak diisi, akun admin dilewati.");
  }
} finally {
  await client.end();
}
