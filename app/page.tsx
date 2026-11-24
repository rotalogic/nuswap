"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

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
const SHALAWAT = "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ";
const ISTIGHFAR = "أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ";

// Ditandai lang="ar" agar dibaca dengan pelafalan Arab oleh pembaca layar.
function Arabic({ children }: { children: string }) {
  return (
    <span lang="ar" dir="rtl">
      {children}
    </span>
  );
}

function MarqueeText() {
  return [0, 1, 2].map((i) => (
    <Fragment key={i}>
      ✨ Bacalah shalawat kepada Nabi ﷺ — <Arabic>{SHALAWAT}</Arabic> —{" "}
      <Arabic>{ISTIGHFAR}</Arabic> —{" "}
    </Fragment>
  ));
}

const TABS: { id: Tab; label: string }[] = [
  { id: "ambil", label: "Ambil Kunci" },
  { id: "titip", label: "Titip Kunci" },
  { id: "cara", label: "Cara Pakai" },
  { id: "tips", label: "Tips dari Pemenang" },
  { id: "pemenang", label: "Pemenang" },
];

type TakeOutcome = "ok" | "inactive" | "error";

interface Notice {
  kind: "ok" | "err";
  text: string;
}

function copyWithTextarea(text: string): boolean {
  const previous = document.activeElement as HTMLElement | null;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.readOnly = true;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  previous?.focus?.();
  return ok;
}

// Cara sinkron didahulukan, supaya salinan selesai sebelum tab Nusuk mengambil fokus.
function copyText(text: string): Promise<boolean> {
  if (copyWithTextarea(text)) return Promise.resolve(true);
  if (!navigator.clipboard) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false
  );
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
  const [winnersError, setWinnersError] = useState(false);
  const [reportBusy, setReportBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
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
      setWinnersError(false);
    } catch {
      setWinnersError(true);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    loadWinners();
  }, [loadKeys, loadWinners]);

  async function take(code: string): Promise<TakeOutcome> {
    try {
      const res = await fetch("/api/keys/take", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        // Tetap terkirim walau halaman ini ditinggal ke aplikasi Nusuk.
        keepalive: true,
      });
      // 409: sudah tercatat diambil perangkat ini.
      if (res.ok || res.status === 409) return "ok";
      return res.status === 410 || res.status === 404 ? "inactive" : "error";
    } catch {
      return "error";
    }
  }

  async function takeCode(item: PublicCode, openNusuk: boolean) {
    if (busyCode) return;
    setBusyCode(item.code);
    // Salin, catat, lalu buka tab, semuanya dimulai langsung dari ketukan. Bila
    // window.open menunggu jaringan dulu, Safari memblokirnya sebagai popup.
    const copying = copyText(item.code);
    const taking = take(item.code);
    if (openNusuk) window.open(item.deepLink, "_blank", "noopener");
    const copied = await copying;
    const outcome = await taking;
    setBusyCode(null);

    if (outcome === "inactive") {
      setNotice({ kind: "err", text: `Kode ${item.code} sudah tidak aktif. Pakai kode lain ya.` });
    } else if (outcome === "error") {
      setNotice({ kind: "err", text: "Pengambilan belum tercatat. Periksa koneksimu lalu coba lagi ya." });
    } else if (!copied) {
      setNotice({ kind: "ok", text: `Salin manual kodenya: ${item.code}` });
    } else if (openNusuk) {
      setNotice({
        kind: "ok",
        text: `Kode ${item.code} tersalin. Aplikasi Nusuk dibuka di tab baru, tempel kodenya di sana.`,
      });
    } else {
      setNotice({ kind: "ok", text: `Kode ${item.code} tersalin. Tempel di aplikasi Nusuk, menu Keys.` });
    }
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
      setNotice({ kind: "err", text: "Kode lain belum bisa dimuat. Coba lagi ya." });
    }
    setGridBusy(false);
  }

  async function handleReport(code: string, result: "success" | "failed") {
    if (reportBusy) return;
    setReportBusy(code);
    let sent = false;
    try {
      const res = await fetch("/api/keys/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, result }),
      });
      sent = res.ok;
    } catch {
      sent = false;
    }
    setReportBusy(null);
    if (!sent) {
      setNotice({ kind: "err", text: "Laporan belum terkirim. Coba lagi nanti ya." });
      return;
    }
    if (result === "success") {
      setReciprocity(true);
      setNotice({
        kind: "ok",
        text: "Terima kasih, laporanmu tercatat. Kunci ekstra sudah masuk ke akun Nusukmu.",
      });
    } else {
      setNotice({
        kind: "ok",
        text: "Laporan tercatat. Kode yang lebih sering gagal akan dipensiunkan dari antrean.",
      });
    }
    loadKeys();
  }

  // Hasil titip hanya berlaku di tab tempat formulirnya dikirim.
  function openTab(next: Tab) {
    setTab(next);
    setSubmitResult(null);
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

  // Diambil dari riwayat server, jadi tidak hilang saat halaman dimuat ulang.
  const lastTake = keys?.history[0];
  const pendingReport = lastTake && lastTake.report === null ? lastTake.code : null;

  function reportButtons(code: string) {
    return (
      <div className="report-actions">
        <button
          className="btn btn-success"
          onClick={() => handleReport(code, "success")}
          disabled={reportBusy === code}
          aria-label={`Laporkan kode ${code} berhasil`}
        >
          Berhasil
        </button>
        <button
          className="btn btn-fail"
          onClick={() => handleReport(code, "failed")}
          disabled={reportBusy === code}
          aria-label={`Laporkan kode ${code} gagal`}
        >
          Gagal
        </button>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="marquee" aria-label="Bacalah shalawat kepada Nabi ﷺ">
        <div className="marquee-track">
          <span className="marquee-half">
            <MarqueeText />
          </span>
          <span className="marquee-half" aria-hidden="true">
            <MarqueeText />
          </span>
        </div>
      </div>

      <header className="site-header">
        {/* Logo resmi dari pemilik aplikasi. */}
        <img src="/logo.png" alt="Nuswap" />
        <p className="tagline">Tukar Kunci Nusuk untuk Sesama</p>
      </header>

      <nav className="tabs" role="tablist" aria-label="Menu Nuswap">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className="tab"
            onClick={() => openTab(t.id)}
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
            <button className="winner-strip" onClick={() => openTab("pemenang")}>
              <small>{todayWinner ? "Pemenang Hari Ini" : "Pemenang Terbaru"}</small>
              <strong>
                No. {stripWinner.draw_no}: {stripWinner.name} ({stripWinner.country})
              </strong>
            </button>
          )}

          {notice && (
            <div
              className={`notice ${notice.kind === "ok" ? "notice-ok" : "notice-err"}`}
              role={notice.kind === "ok" ? "status" : "alert"}
            >
              {notice.text}
            </div>
          )}

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
                onClick={() => keys.main && takeCode(keys.main, true)}
                disabled={busyCode === keys.main.code}
              >
                Salin + Buka di Nusuk
              </button>

              {pendingReport && (
                <div className="report-row">
                  <p>
                    Kamu baru mengambil kode {pendingReport}. Bagaimana hasilnya di Nusuk?
                  </p>
                  {reportButtons(pendingReport)}
                </div>
              )}
            </section>
          )}

          {keys && !keys.main && keys.grid.length === 0 && keys.taken.length === 0 && (
            <section className="card empty">
              Antrean sedang kosong. Titip kuncimu lewat menu Titip Kunci supaya peserta
              lain bisa ikut mengambil.
            </section>
          )}

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
            Bacalah shalawat: <Arabic>{SHALAWAT}</Arabic>
          </p>

          {reciprocity && (
            <div className="notice notice-ok">
              Giliranmu membantu peserta lain. Titip kuncimu, pemilik kode dan pemakai
              sama-sama dapat kunci ekstra.{" "}
              <button className="copy-link" onClick={() => openTab("titip")} style={{ background: "none", border: 0, fontWeight: 900, color: "var(--green-dark)", textDecoration: "underline" }}>
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
                      onClick={() => takeCode(item, false)}
                      disabled={busyCode === item.code}
                    >
                      Nusuk Challenge Key <span>Copy code</span>
                    </button>
                    <button
                      className="open-btn"
                      onClick={() => takeCode(item, true)}
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
                di perangkat ini. Laporkan hasilnya supaya antrean tetap sehat.
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
                      {h.report === null && reportButtons(h.code)}
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
              </p>
            </section>
          )}
          <h2 className="section-title" style={{ marginTop: 0 }}>Daftar Pemenang Terverifikasi</h2>
          {!winners && !winnersError && (
            <div className="card empty">Memuat daftar pemenang...</div>
          )}
          {!winners && winnersError && (
            <div className="notice notice-err" role="alert">
              <p style={{ margin: "0 0 10px" }}>Daftar pemenang belum bisa dimuat.</p>
              <button className="btn btn-ghost btn-small" onClick={loadWinners}>
                Coba lagi
              </button>
            </div>
          )}
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
