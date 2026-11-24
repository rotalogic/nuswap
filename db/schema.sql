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

-- Kunci komunitas (data real dari pemilik, 25 November 2026).
INSERT INTO invitation_codes (code)
VALUES
  ('NG-5fNFfVxd'),
  ('NG-pPvK57jg'),
  ('NG-1x69vkS0'),
  ('NG-9eGoaN5t'),
  ('NG-s1nMAXaB'),
  ('NG-qnqmJUiS'),
  ('NG-SFNwh5De'),
  ('NG-3M0PaFFD'),
  ('NG-5mCmxF2M'),
  ('NG-OKqn1w0r'),
  ('NG-6lC9PnGD'),
  ('NG-npbGCuvR'),
  ('NG-IQLVsfN9'),
  ('NG-JuskpEAN'),
  ('NG-FxnLiWlV'),
  ('NG-1akEAHuB'),
  ('NG-SuAxqReA'),
  ('NG-cPVwqbub'),
  ('NG-ramevdke'),
  ('NG-MeZnTI0E'),
  ('NG-OMOPxYVF'),
  ('NG-EEkIXoyY'),
  ('NG-qHyUTkt0'),
  ('NG-sELwEJMr'),
  ('NG-SmKS6xwM'),
  ('NG-mhWcxzD1'),
  ('NG-L8gvNv3J'),
  ('NG-ZxZS7BaP'),
  ('NG-8zcpvOQY'),
  ('NG-KzpoAy2x'),
  ('NG-E7vzZSQY'),
  ('NG-L6YNQcMr'),
  ('NG-wEzhGkFF'),
  ('NG-88PNwsOT'),
  ('NG-VAa8FRQm'),
  ('NG-G1ouN9HA'),
  ('NG-qJ3vRrHG'),
  ('NG-A4SCs5Ao'),
  ('NG-e7q3nxC9'),
  ('NG-lyyeVy9p'),
  ('NG-FsSzkpeE'),
  ('NG-KZ7g4hzt'),
  ('NG-bzfI2qks'),
  ('NG-1fnOGj1I'),
  ('NG-HjlVVQNf'),
  ('NG-midgLMgt'),
  ('NG-OZjbBqZf'),
  ('NG-AA40ikyA'),
  ('NG-sYOtfBYi'),
  ('NG-ITI8Uuzi'),
  ('NG-YhbiWIes'),
  ('NG-5nSAhif0'),
  ('NG-PaKijaDN'),
  ('NG-M7uD9F51'),
  ('NG-SSTrCGzi'),
  ('NG-YibpVoK4'),
  ('NG-kwTxMS15'),
  ('NG-xP905XPt'),
  ('NG-fWpzx0j7'),
  ('NG-VVj3Onvb'),
  ('NG-ZrELaJB7'),
  ('NG-gFwsTeRM'),
  ('NG-5zyrWuPU'),
  ('NG-ZASUYNNW'),
  ('NG-99EC6IIh'),
  ('NG-b8IGxc7o'),
  ('NG-qtr8R6QM'),
  ('NG-rvcrBkB8'),
  ('NG-hu9Y0Nei'),
  ('NG-1ZsCbhLj'),
  ('NG-FdE6tWZK')
ON CONFLICT (code) DO NOTHING;
