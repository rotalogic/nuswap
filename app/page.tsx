"use client";

import { useCallback, useEffect, useState } from "react";

interface PublicCode {
  code: string;
  deepLink: string;
  useCount: number;
}

interface HistoryItem {
  code: string;
  taken_at: string;
  report: "success" | "failed" | null;
}

interface KeysData {
  starter: PublicCode | null;
  main: PublicCode | null;
  grid: PublicCode[];
  taken: string[];
  history: HistoryItem[];
  stats: { codes_ready: number; keys_shared: number };
}

interface Winner {
  draw_no: number;
  name: string;
  country: string;
  draw_date: string;
  is_indonesia: boolean;
}

interface WinnersData {
  today: Winner | null;
  winners: Winner[];
}

type Tab = "ambil" | "titip" | "cara" | "tips" | "pemenang";

// Teks berjalan di bagian paling atas, meniru pita pengumuman situs referensi
// yang ditunjuk pemilik: ajakan membaca shalawat + istighfar, diulang mulus.
const MARQUEE_UNIT =
  "✨ Bacalah shalawat kepada Nabi ﷺ — اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ — أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ — ";
const MARQUEE_TEXT = MARQUEE_UNIT.repeat(3);

const TABS: { id: Tab; label: string }[] = [
  { id: "ambil", label: "Ambil Kunci" },
  { id: "titip", label: "Titip Kunci" },
  { id: "cara", label: "Cara Pakai" },
  { id: "tips", label: "Tips dari Pemenang" },
  { id: "pemenang", label: "Pemenang" },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(".", ":");
  return `${date}, pukul ${time} WIB`;
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("ambil");
  const [keys, setKeys] = useState<KeysData | null>(null);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [winners, setWinners] = useState<WinnersData | null>(null);
  const [pendingReport, setPendingReport] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reciprocity, setReciprocity] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [gridBusy, setGridBusy] = useState(false);

  const [submitInput, setSubmitInput] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitResult, setSubmitResult] = useState<
    { ok: true; code: string; position: number } | { ok: false; message: string } | null
  >(null);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/keys", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      setKeys((await res.json()) as KeysData);
      setKeysError(null);
    } catch {
      setKeysError("Data kunci belum bisa dimuat. Periksa koneksimu lalu coba lagi.");
    }
  }, []);

  const loadWinners = useCallback(async () => {
    try {
      const res = await fetch("/api/winners", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      setWinners((await res.json()) as WinnersData);
    } catch {
      setWinners(null);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    loadWinners();
  }, [loadKeys, loadWinners]);

  async function take(code: string): Promise<boolean> {
    const res = await fetch("/api/keys/take", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.status === 409) return true; // sudah tercatat diambil perangkat ini
    return res.ok;
  }

  async function handleMainTake() {
    if (!keys?.main || busyCode) return;
    const target = keys.main;
    setBusyCode(target.code);
    const copied = await copyText(target.code);
    const took = await take(target.code);
    setBusyCode(null);
    if (!took) {
      setNotice("Pengambilan belum tercatat. Coba lagi ya.");
      return;
    }
    setNotice(
      copied
        ? `Kode ${target.code} tersalin. Aplikasi Nusuk dibuka di tab baru, tempel kodenya di sana.`
        : `Aplikasi Nusuk dibuka di tab baru. Salin manual kodenya: ${target.code}`
    );
    setPendingReport(target.code);
    window.open(target.deepLink, "_blank", "noopener");
    loadKeys();
  }

  async function refreshGrid() {
    if (!keys || gridBusy) return;
    setGridBusy(true);
    try {
      const exclude = [
        ...(keys.main ? [keys.main.code] : []),
        ...keys.grid.map((g) => g.code),
      ].join(",");
      const res = await fetch(`/api/keys/more?exclude=${encodeURIComponent(exclude)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("bad status");
      const json = (await res.json()) as { grid: PublicCode[] };
      setKeys((prev) => (prev ? { ...prev, grid: json.grid } : prev));
    } catch {
      setNotice("Kode lain belum bisa dimuat. Coba lagi ya.");
    }
    setGridBusy(false);
  }

  async function handleGridCopy(item: PublicCode) {
    if (busyCode) return;
    setBusyCode(item.code);
    const copied = await copyText(item.code);
    await take(item.code);
    setBusyCode(null);
    setNotice(
      copied
        ? `Kode ${item.code} tersalin. Tempel di aplikasi Nusuk, menu Keys.`
        : `Salin manual kodenya: ${item.code}`
    );
    loadKeys();
  }

  async function handleGridOpen(item: PublicCode) {
    if (busyCode) return;
    setBusyCode(item.code);
    await copyText(item.code);
    await take(item.code);
    setBusyCode(null);
    window.open(item.deepLink, "_blank", "noopener");
    loadKeys();
  }

  async function handleReport(result: "success" | "failed") {
    if (!pendingReport) return;
    const code = pendingReport;
    const res = await fetch("/api/keys/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, result }),
    });
    setPendingReport(null);
    if (res.ok && result === "success") {
      setReciprocity(true);
      setNotice("Terima kasih, laporanmu tercatat. Kunci ekstra sudah masuk ke akun Nusukmu.");
    } else if (res.ok) {
      setNotice("Laporan tercatat. Kode yang gagal 3 kali akan dipensiunkan dari antrean.");
    } else {
      setNotice("Laporan belum terkirim. Coba lagi nanti ya.");
    }
    loadKeys();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitBusy(true);
    setSubmitResult(null);
    try {
      const res = await fetch("/api/keys/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: submitInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitResult({ ok: true, code: data.code, position: data.position });
        setSubmitInput("");
        loadKeys();
      } else {
        setSubmitResult({ ok: false, message: data.error ?? "Titip kunci gagal." });
      }
    } catch {
      setSubmitResult({ ok: false, message: "Koneksi bermasalah. Coba lagi ya." });
    }
    setSubmitBusy(false);
  }

  const todayWinner = winners?.today ?? null;
  const latestWinner = winners?.winners[0] ?? null;
  const stripWinner = todayWinner ?? latestWinner;

  return (
    <div className="shell">
      <div className="marquee" aria-label="Bacalah shalawat kepada Nabi ﷺ">
        <div className="marquee-track">
          <span className="marquee-half">{MARQUEE_TEXT}</span>
          <span className="marquee-half" aria-hidden="true">
            {MARQUEE_TEXT}
          </span>
        </div>
      </div>

      <header className="site-header">
        {/* Logo resmi dari pemilik aplikasi. */}
        <img src="/logo.png" alt="Nuswap" />
        <p className="tagline">Tukar Kunci Nusuk untuk Sesama</p>
      </header>

      <section className="card share-quick">
        <h2 className="section-title" style={{ marginTop: 0 }}>Bagikan Kodemu</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="quick-submit-input">Kode atau tautan Nusuk</label>
            <input
              id="quick-submit-input"
              type="text"
              placeholder="Tempel kunci atau tautan Nusuk"
              value={submitInput}
              onChange={(e) => setSubmitInput(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitBusy} style={{ marginTop: 14 }}>
            {submitBusy ? "Menyimpan..." : "Kirim Kode"}
          </button>
        </form>
        {submitResult?.ok && (
          <div className="notice notice-ok" role="status">
            Kunci {submitResult.code} tersimpan. Posisi antreanmu sekarang nomor{" "}
            {submitResult.position}. Kunci titipan peserta tampil lebih dulu di antrean.
          </div>
        )}
        {submitResult && !submitResult.ok && (
          <div className="notice notice-err" role="alert">{submitResult.message}</div>
        )}
      </section>

      <p className="shalawat-line">
        Bacalah shalawat: اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ
      </p>

      <nav className="tabs" role="tablist" aria-label="Menu Nuswap">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "ambil" && (
        <main>
          <div className="stats-row" aria-label="Statistik Nuswap">
            <div className="stat">
              <strong>{keys ? keys.stats.codes_ready : "..."}</strong>
              <span>kode siap diambil</span>
            </div>
            <div className="stat">
              <strong>{keys ? keys.stats.keys_shared : "..."}</strong>
              <span>kunci sudah dibagikan</span>
            </div>
          </div>

          {stripWinner && (
            <button className="winner-strip" onClick={() => setTab("pemenang")}>
              <small>{todayWinner ? "Pemenang Hari Ini" : "Pemenang Terbaru"}</small>
              <strong>
                No. {stripWinner.draw_no}: {stripWinner.name} ({stripWinner.country})
              </strong>
            </button>
          )}

          {notice && <div className="notice notice-ok" role="status">{notice}</div>}

          {keysError && <div className="notice notice-err" role="alert">{keysError}</div>}

          {!keys && !keysError && <div className="card empty">Memuat kunci...</div>}

          {keys && keys.main && (
            <section className="card main-key" aria-label="Kunci utama">
              <p className="label">
                {keys.starter && keys.main.code === keys.starter.code
                  ? "Mulailah dengan Bismillah"
                  : "Kode berikutnya dari antrean komunitas"}
              </p>
              <div className="key-code">{keys.main.code}</div>
              <button
                className="btn btn-primary"
                onClick={handleMainTake}
                disabled={busyCode === keys.main.code}
              >
                Salin + Buka di Nusuk
              </button>

              {pendingReport === keys.main.code ? (
                <div className="report-row">
                  <p>Bagaimana hasil pemakaian kode tadi di Nusuk?</p>
                  <div className="report-actions">
                    <button className="btn btn-success" onClick={() => handleReport("success")}>
                      Berhasil
                    </button>
                    <button className="btn btn-fail" onClick={() => handleReport("failed")}>
                      Gagal
                    </button>
                  </div>
                </div>
              ) : (
                pendingReport && (
                  <div className="report-row">
                    <p>
                      Kamu baru mengambil kode {pendingReport}. Laporkan hasilnya supaya
                      antrean tetap sehat.
                    </p>
                    <div className="report-actions">
                      <button className="btn btn-success" onClick={() => handleReport("success")}>
                        Berhasil
                      </button>
                      <button className="btn btn-fail" onClick={() => handleReport("failed")}>
                        Gagal
                      </button>
                    </div>
                  </div>
                )
              )}
            </section>
          )}

          {keys && !keys.main && keys.grid.length === 0 && keys.taken.length === 0 && (
            <section className="card empty">
              Antrean sedang kosong. Titip kuncimu lewat menu Titip Kunci supaya peserta
              lain bisa ikut mengambil.
            </section>
          )}

          {reciprocity && (
            <div className="notice notice-ok">
              Giliranmu membantu peserta lain. Titip kuncimu, pemilik kode dan pemakai
              sama-sama dapat kunci ekstra.{" "}
              <button className="copy-link" onClick={() => setTab("titip")} style={{ background: "none", border: 0, fontWeight: 900, color: "var(--green-dark)", textDecoration: "underline" }}>
                Titip Kunci sekarang
              </button>
            </div>
          )}

          {keys && (keys.grid.length > 0 || keys.taken.length > 0) && (
            <>
              <div className="section-head">
                <h2 className="section-title">Kunci Siap Pakai Lainnya</h2>
                <button
                  className="refresh-btn"
                  onClick={refreshGrid}
                  disabled={gridBusy}
                  aria-label="Muat kode lain yang belum pernah dipakai"
                >
                  {gridBusy ? "Memuat…" : "↻ Refresh"}
                </button>
              </div>
              <p className="section-sub">
                Ambil beberapa kunci sekaligus dalam satu kunjungan. Kunci titipan peserta
                tampil lebih dulu; di tiap kelompok, kode yang paling sedikit dipakai
                tampil lebih dulu.
              </p>
              <div className="grid">
                {keys.grid.map((item, i) => (
                  <article className="key-card" key={item.code}>
                    <span className="num">#{i + 1}</span>
                    <div className="code">{item.code}</div>
                    <button
                      className="copy-link"
                      onClick={() => handleGridCopy(item)}
                      disabled={busyCode === item.code}
                    >
                      Nusuk Challenge Key <span>Copy code</span>
                    </button>
                    <button
                      className="open-btn"
                      onClick={() => handleGridOpen(item)}
                      disabled={busyCode === item.code}
                    >
                      Buka di Nusuk
                    </button>
                  </article>
                ))}
                {keys.taken.map((code) => (
                  <article className="key-card used" key={`taken-${code}`}>
                    <span className="num">Terpakai</span>
                    <div className="code">{code}</div>
                    <div className="used-tag">Sudah dipakai</div>
                  </article>
                ))}
              </div>
            </>
          )}

          {keys && (
            <>
              <h2 className="section-title">Riwayat Kunci Saya</h2>
              <p className="section-sub">
                Kunci yang sudah kamu ambil tercatat di sini dan tidak bisa dipakai ulang
                di perangkat ini.
              </p>
              {keys.history.length === 0 ? (
                <section className="card empty">
                  Belum ada kunci yang kamu ambil. Kunci yang sudah kamu ambil akan
                  tercatat di sini dan tidak bisa dipakai ulang.
                </section>
              ) : (
                <div className="history-list">
                  {keys.history.map((h) => (
                    <div className="history-item" key={`${h.code}-${h.taken_at}`}>
                      <div className="who">
                        <strong>{h.code}</strong>
                        <span>Diambil {formatDateTime(h.taken_at)}</span>
                      </div>
                      {h.report === "success" && (
                        <span className="history-badge badge-ok">Berhasil</span>
                      )}
                      {h.report === "failed" && (
                        <span className="history-badge badge-fail">Gagal</span>
                      )}
                      {h.report === null && (
                        <span className="history-badge badge-used">Sudah dipakai</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      )}

      {tab === "titip" && (
        <main>
          <section className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>Titip Kuncimu</h2>
            <p className="muted">
              Tempel kode undanganmu atau tautan Nusuk lengkap. Kuncimu masuk antrean
              bersama dan dipakai peserta lain. Kamu dan pemakai sama-sama dapat kunci
              ekstra di Nusuk.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="submit-input">Kode atau tautan Nusuk</label>
                <input
                  id="submit-input"
                  type="text"
                  placeholder="NG-xxxxxxxx atau https://services.nusuk.sa/app/?p=27&id=NG-xxxxxxxx"
                  value={submitInput}
                  onChange={(e) => setSubmitInput(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitBusy} style={{ marginTop: 14 }}>
                {submitBusy ? "Menyimpan..." : "Titip Kunci"}
              </button>
            </form>
            {submitResult?.ok && (
              <div className="notice notice-ok" role="status">
                Kunci {submitResult.code} tersimpan. Posisi antreanmu sekarang nomor{" "}
                {submitResult.position}. Makin sedikit dipakai, makin cepat tampil di depan.
              </div>
            )}
            {submitResult && !submitResult.ok && (
              <div className="notice notice-err" role="alert">{submitResult.message}</div>
            )}
            <p className="muted" style={{ marginBottom: 0 }}>
              Huruf besar dan kecil kode dijaga persis seperti yang kamu tempel, karena
              kode Nusuk bersifat case-sensitive. Kode yang sama tidak bisa dititipkan dua kali.
            </p>
          </section>
        </main>
      )}

      {tab === "cara" && (
        <main>
          <section className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>Cara Pakai Kode di Nusuk</h2>
            <ol className="steps">
              <li>
                Buka aplikasi <strong>Nusuk</strong>, masuk ke menu{" "}
                <strong>Competitions and Challenges</strong>.
              </li>
              <li>
                Buka bagian <strong>Keys</strong>.
              </li>
              <li>
                Tempel kode yang kamu salin dari Nuswap, lalu ketuk <strong>Verify</strong>.
                Kunci ekstra masuk ke akunmu dan pemilik kode juga mendapat kunci.
              </li>
            </ol>
            <div className="notice notice-err" style={{ marginBottom: 0 }}>
              Catatan keamanan: Nuswap tidak pernah meminta password atau OTP akun Nusuk.
              Jangan pernah memasukkan password atau OTP Nusuk di situs mana pun selain
              aplikasi resmi Nusuk.
            </div>
          </section>
        </main>
      )}

      {tab === "tips" && (
        <main>
          <section className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>Tips dari Pemenang</h2>
            <p className="muted">
              Dua pola yang diceritakan para pemenang Challenge Umrah Nusuk. Ini pengalaman
              mereka, bukan jaminan menang.
            </p>
            <ol className="steps">
              <li>
                Jawab pertanyaan di <strong>setiap pintu</strong> Nusuk,{" "}
                <strong>20 sampai 30 pertanyaan per pintu</strong>, dan tuntaskan satu pintu
                sampai selesai. Jangan berhenti di tengah pintu.
              </li>
              <li>
                Kerjakan pada <strong>waktu menjelang sholat atau sesudah sholat</strong>.
                Lima jendela waktunya: Subuh, Zuhur, Ashar, Maghrib, dan Isya.
              </li>
            </ol>
            <p className="muted" style={{ marginBottom: 0 }}>
              Kunci tambahan dari tukar kode di Nuswap membantumu membuka lebih banyak
              pintu, jadi kombinasikan keduanya: kumpulkan kunci, lalu mainkan di jendela
              waktu di atas.
            </p>
          </section>
        </main>
      )}

      {tab === "pemenang" && (
        <main>
          {todayWinner && (
            <section className="card" style={{ marginBottom: 14 }}>
              <p className="label" style={{ fontWeight: 800, color: "var(--green-dark)", margin: "0 0 6px" }}>
                Pemenang Hari Ini, {formatDate(todayWinner.draw_date)}
              </p>
              <div style={{ fontSize: "1.25rem", fontWeight: 900 }}>
                No. {todayWinner.draw_no}: {todayWinner.name}
              </div>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {todayWinner.country}
                {todayWinner.is_indonesia ? " (Indonesia)" : ""}
              </p>
            </section>
          )}
          <h2 className="section-title" style={{ marginTop: 0 }}>Daftar Pemenang Terverifikasi</h2>
          {!winners && <div className="card empty">Memuat daftar pemenang...</div>}
          {winners && winners.winners.length === 0 && (
            <div className="card empty">Belum ada data pemenang.</div>
          )}
          {winners && winners.winners.length > 0 && (
            <div className="winner-list">
              {winners.winners.map((w) => (
                <div className="winner-item" key={w.draw_no}>
                  <span className="no">#{w.draw_no}</span>
                  <div className="who">
                    <strong>{w.name}</strong>
                    <span>{w.country}, {formatDate(w.draw_date)}</span>
                  </div>
                  {w.is_indonesia && <span className="indo-badge">Indonesia</span>}
                </div>
              ))}
            </div>
          )}
          <p className="muted">
            Sumber: pengumuman resmi @MyNusuk dan menu Winners di aplikasi Nusuk. Daftar
            diperbarui setiap hari sekitar pukul 20.30 WIB, setelah undian pukul 20.00 WIB.
            Ejaan nama diverifikasi dulu sebelum ditampilkan.
          </p>
        </main>
      )}

      <footer className="site-footer">
        <p>
          Nuswap adalah situs komunitas independen untuk peserta Challenge Umrah Nusuk.
          Nuswap bukan situs resmi Nusuk dan tidak berafiliasi dengan Nusuk atau
          penyelenggara Challenge Umrah. Nuswap tidak pernah meminta password atau OTP
          akun Nusuk kamu.
        </p>
      </footer>
    </div>
  );
}
