-- Nuswap: skema PostgreSQL + seed data awal.
-- Aman dijalankan berulang kali (IF NOT EXISTS / ON CONFLICT DO NOTHING).

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  device_key TEXT NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitation_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  is_starter BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  fail_count INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  owner_device_id INTEGER REFERENCES devices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS code_takes (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  code_id INTEGER NOT NULL REFERENCES invitation_codes(id),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, code_id)
);

CREATE TABLE IF NOT EXISTS code_reports (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  code_id INTEGER NOT NULL REFERENCES invitation_codes(id),
  result TEXT NOT NULL CHECK (result IN ('success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS winners (
  id SERIAL PRIMARY KEY,
  draw_no INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  draw_date DATE NOT NULL,
  is_indonesia BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codes_active_queue
  ON invitation_codes (status, use_count, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_takes_device ON code_takes (device_id);
CREATE INDEX IF NOT EXISTS idx_winners_draw_no ON winners (draw_no DESC);

-- Kode starter pemilik (kunci pertama untuk perangkat baru).
INSERT INTO invitation_codes (code, is_starter)
VALUES ('NG-E4uHwcFo', true)
ON CONFLICT (code) DO NOTHING;

-- 12 pemenang terverifikasi dari pengumuman resmi @MyNusuk / menu Winners aplikasi Nusuk.
INSERT INTO winners (draw_no, name, country, draw_date, is_indonesia) VALUES
  (24, 'Siti Zumaroh', 'Indonesia', '2026-11-24', true),
  (23, 'Marwa Sayed Hanafy Kataria', 'Egypt', '2026-11-23', false),
  (22, 'Mohamed Rashad Abdelshafy Khalaf', 'Egypt', '2026-11-22', false),
  (21, 'Musab Khalid Ibrahim Sakhriyeh', 'Jordan', '2026-11-21', false),
  (20, 'Hamlawi Katia', 'Algeria', '2026-11-20', false),
  (19, 'Sahra Natasya', 'Indonesia', '2026-11-19', true),
  (15, 'Tutus Fatma Sri Agustini', 'Indonesia', '2026-11-15', true),
  (8, 'Naveed Fazal', 'Pakistan', '2026-11-08', false),
  (4, 'Rashid Azad', 'Pakistan', '2026-11-04', false),
  (3, 'Md Khaled Hussain Chowdhury', 'Bangladesh', '2026-11-03', false),
  (2, 'Lina Kalash', 'Syria', '2026-11-02', false),
  (1, 'Ahmed Elsaid Mokhtar', 'Egypt', '2026-11-01', false)
ON CONFLICT (draw_no) DO NOTHING;
