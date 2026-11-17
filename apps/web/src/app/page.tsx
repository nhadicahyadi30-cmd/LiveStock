export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      <h1>Smart Livestock Ecosystem</h1>
      <p>Fondasi proyek sudah berjalan. Antarmuka MVP dibangun di atas kerangka ini.</p>
      <ul>
        <li>
          <a href="/api/v1/health">/api/v1/health</a> memeriksa aplikasi dan koneksi database.
        </li>
        <li>
          <code>/api/v1/me</code> dan <code>/api/v1/farms</code> membutuhkan sesi (lihat README).
        </li>
      </ul>
    </main>
  );
}
