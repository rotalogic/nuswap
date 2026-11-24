"use client";

import { useCallback, useEffect, useState } from "react";

interface AdminCode {
  id: number;
  code: string;
  is_starter: boolean;
  status: string;
  fail_count: number;
  use_count: number;
  created_at: string;
  deleted: boolean;
}

interface AdminStats {
  codes_active: number;
  codes_retired: number;
  codes_total: number;
  takes_total: number;
  reports_success: number;
  reports_failed: number;
  devices_total: number;
  winners_total: number;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [codes, setCodes] = useState<AdminCode[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [drawNo, setDrawNo] = useState("");
  const [winnerName, setWinnerName] = useState("");
  const [winnerCountry, setWinnerCountry] = useState("");
  const [drawDate, setDrawDate] = useState("");

  const loadAll = useCallback(async () => {
    const [statsRes, codesRes] = await Promise.all([
      fetch("/api/admin/stats", { cache: "no-store" }),
      fetch("/api/admin/codes", { cache: "no-store" }),
    ]);
    if (statsRes.status === 401 || codesRes.status === 401) {
      setAuthed(false);
      return;
    }
    if (statsRes.ok) setStats((await statsRes.json()).stats as AdminStats);
    if (codesRes.ok) setCodes((await codesRes.json()).codes as AdminCode[]);
    setAuthed(true);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      setPassword("");
      loadAll();
    } else {
      const data = await res.json().catch(() => ({}));
      setLoginError(data.error ?? "Login gagal.");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setStats(null);
    setCodes([]);
  }

  async function handleRetire(id: number, code: string) {
    const res = await fetch(`/api/admin/codes/${id}/retire`, { method: "POST" });
    if (res.ok) {
      setMessage(`Kode ${code} dipensiunkan.`);
      loadAll();
    } else {
      setMessage("Gagal mempensiunkan kode.");
    }
  }

  async function handleAddWinner(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/winners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draw_no: Number(drawNo),
        name: winnerName,
        country: winnerCountry,
        draw_date: drawDate,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(`Pemenang No. ${drawNo} (${winnerName}) tersimpan.`);
      setDrawNo("");
      setWinnerName("");
      setWinnerCountry("");
      setDrawDate("");
      loadAll();
    } else {
      setMessage(data.error ?? "Gagal menyimpan pemenang.");
    }
  }

  if (authed === null) {
    return (
      <div className="admin-wrap">
        <p className="muted">Memeriksa sesi admin...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-wrap" style={{ maxWidth: 420 }}>
        <img src="/logo.png" alt="Nuswap" style={{ width: 220, height: "auto" }} />
        <h1 style={{ fontSize: "1.3rem" }}>Login Admin Nuswap</h1>
        <form onSubmit={handleLogin} className="card">
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {loginError && <div className="notice notice-err">{loginError}</div>}
          <button className="btn btn-primary" type="submit">Masuk</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.35rem", margin: 0 }}>Panel Admin Nuswap</h1>
        <button className="btn btn-ghost btn-small" onClick={handleLogout}>Keluar</button>
      </div>

      {message && <div className="notice notice-ok" role="status">{message}</div>}

      {stats && (
        <div className="admin-grid" style={{ marginTop: 16 }}>
          <div className="stat"><strong>{stats.codes_active}</strong><span>kode aktif</span></div>
          <div className="stat"><strong>{stats.codes_retired}</strong><span>kode retired</span></div>
          <div className="stat"><strong>{stats.takes_total}</strong><span>total pengambilan</span></div>
          <div className="stat"><strong>{stats.reports_success}</strong><span>laporan berhasil</span></div>
          <div className="stat"><strong>{stats.reports_failed}</strong><span>laporan gagal</span></div>
          <div className="stat"><strong>{stats.devices_total}</strong><span>perangkat</span></div>
          <div className="stat"><strong>{stats.winners_total}</strong><span>pemenang tercatat</span></div>
        </div>
      )}

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Tambah Pemenang Harian</h2>
        <p className="muted">
          Verifikasi ejaan nama dari pengumuman @MyNusuk atau menu Winners di aplikasi
          Nusuk sebelum menyimpan. Update harian dilakukan sekitar pukul 20.30 WIB.
        </p>
        <form onSubmit={handleAddWinner}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="w-no">Nomor undian</label>
              <input id="w-no" type="number" min="1" value={drawNo} onChange={(e) => setDrawNo(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="w-name">Nama pemenang</label>
              <input id="w-name" value={winnerName} onChange={(e) => setWinnerName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="w-country">Negara</label>
              <input id="w-country" value={winnerCountry} onChange={(e) => setWinnerCountry(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="w-date">Tanggal undian</label>
              <input id="w-date" type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} required />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: "auto" }}>Simpan Pemenang</button>
        </form>
      </section>

      <section className="card">
        <h2 className="section-title" style={{ marginTop: 0 }}>Daftar Kode</h2>
        {codes.length === 0 && <p className="empty">Belum ada kode.</p>}
        {codes.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Status</th>
                  <th>Dipakai</th>
                  <th>Gagal</th>
                  <th>Masuk</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.code}</strong>
                      {c.is_starter ? " (starter)" : ""}
                    </td>
                    <td>{c.deleted ? "dihapus" : c.status}</td>
                    <td>{c.use_count}x</td>
                    <td>{c.fail_count}x</td>
                    <td>{c.created_at}</td>
                    <td>
                      {c.status === "active" && !c.deleted && (
                        <button className="btn btn-fail btn-small" onClick={() => handleRetire(c.id, c.code)}>
                          Retire
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
