// Asisten tanya-jawab Nusa Ternak: pencocokan kata kunci, BUKAN model bahasa. Dua sumber jawaban:
//  1) data organisasi sendiri (populasi, kematian, tugas, alarm, pakan, keuangan) dan
//  2) panduan umum peternakan yang ditulis di bawah (kisaran umum, bukan resep).
// Fungsi di file ini murni (tanpa database) supaya mudah diuji.

export type Intent = "POPULASI" | "KEMATIAN" | "TUGAS" | "ALARM" | "PAKAN" | "KEUANGAN" | "PREDIKSI";

export const normalize = (q: string): string => q.toLowerCase().replace(/[^a-z0-9\s./%]/g, " ").replace(/\s+/g, " ").trim();

const INTENT_WORDS: Record<Intent, string[]> = {
  PREDIKSI: ["prediksi", "perkiraan", "kapan panen", "waktu panen", "estimasi bobot", "fcr", "konversi pakan", "adg", "pertambahan bobot"],
  KEMATIAN: ["kematian", "mati", "mortalitas", "deplesi"],
  POPULASI: ["populasi", "jumlah ternak", "berapa ekor", "stok ternak", "isi kandang", "jumlah ayam", "jumlah sapi", "jumlah kambing", "jumlah ikan"],
  TUGAS: ["tugas", "jadwal hari ini", "agenda", "pengingat", "to do", "todo", "kerjaan"],
  ALARM: ["alarm", "peringatan sensor", "sensor bermasalah", "suhu kandang saya", "kondisi sensor"],
  PAKAN: ["pakan saya", "pakan bulan", "konsumsi pakan", "pakan 30", "habis pakan", "berapa pakan", "total pakan"],
  KEUANGAN: ["laba", "rugi", "untung", "pemasukan", "pengeluaran", "keuangan", "profit", "omzet", "biaya bulan"],
};
// Prediksi dicek lebih dulu agar "fcr" tidak jatuh ke pakan.
const ORDER: Intent[] = ["PREDIKSI", "KEMATIAN", "KEUANGAN", "ALARM", "TUGAS", "POPULASI", "PAKAN"];

export function detectIntent(question: string): Intent | null {
  const q = ` ${normalize(question)} `;
  for (const intent of ORDER) if (INTENT_WORDS[intent].some((w) => q.includes(` ${w}`) || q.includes(w + " "))) return intent;
  return null;
}

export interface KnowledgeEntry { id: string; title: string; keywords: string[]; answer: string; link?: { href: string; label: string } }

const CAVEAT = "Kisaran umum; sesuaikan dengan jenis/strain, iklim, dan petunjuk pemasok bibit.";
export const KNOWLEDGE: KnowledgeEntry[] = [
  { id: "brooding", title: "Suhu brooding anak ayam (DOC)", keywords: ["brooding", "doc", "anak ayam", "suhu indukan", "pemanas"], answer: `Pada minggu pertama suhu di area brooding umumnya dijaga sekitar 32 sampai 34°C, lalu diturunkan bertahap kira-kira 2 sampai 3°C tiap minggu sampai mendekati suhu kandang. Perhatikan perilaku anak ayam: bergerombol di bawah pemanas berarti terlalu dingin, menjauh dan terengah berarti terlalu panas. ${CAVEAT}` },
  { id: "kepadatan", title: "Kepadatan kandang ayam pedaging", keywords: ["kepadatan", "populasi per meter", "ekor per m", "per m2", "kapasitas kandang"], answer: `Ayam pedaging umumnya dipelihara sekitar 8 sampai 12 ekor per m², lebih rendah bila ventilasi terbatas atau cuaca panas. Terlalu padat meningkatkan stres, penyakit, dan kematian. ${CAVEAT}` },
  { id: "amonia", title: "Amonia di kandang", keywords: ["amonia", "bau kandang", "ammonia", "bau menyengat"], answer: "Amonia kandang sebaiknya di bawah sekitar 10 sampai 20 ppm. Di atas 25 ppm mulai mengganggu pernapasan dan mata ternak. Perbaiki ventilasi, jaga litter tetap kering (ganti yang basah/menggumpal), dan atur kepadatan. Pasang sensor amonia di menu IoT dan buat alarm di ambang yang kamu pilih.", link: { href: "/app/iot", label: "Buka IoT" } },
  { id: "air-kolam", title: "Kualitas air kolam lele/nila", keywords: ["kualitas air", "ph kolam", "oksigen terlarut", "do kolam", "air kolam", "lele", "nila", "salinitas"], answer: `Kisaran umum untuk lele dan nila: pH 6,5 sampai 8,5, oksigen terlarut di atas 3 mg/L, suhu 26 sampai 30°C, amonia sebisa mungkin mendekati nol. Oksigen turun paling rendah menjelang pagi, jadi pantau saat itu. Udang vaname punya kisaran berbeda (termasuk salinitas), ikuti panduan teknis budidayanya. ${CAVEAT}`, link: { href: "/app/iot", label: "Buka IoT" } },
  { id: "fcr", title: "Cara menghitung FCR", keywords: ["cara hitung fcr", "rumus fcr", "apa itu fcr", "fcr itu"], answer: "FCR (food conversion ratio) = total pakan yang dimakan (kg) dibagi total pertambahan bobot (kg). Makin kecil makin efisien. Contoh: 3.200 kg pakan menghasilkan tambahan bobot 1.800 kg, FCR = 1,78. Di Nusa Ternak, catat pakan dan timbang rutin; FCR dihitung otomatis di menu AI.", link: { href: "/app/ai", label: "Buka AI (prediksi)" } },
  { id: "mortalitas", title: "Cara menghitung mortalitas", keywords: ["rumus mortalitas", "cara hitung mortalitas", "persen kematian", "angka kematian"], answer: "Mortalitas (%) = jumlah ternak mati dibagi populasi awal, dikali 100. Contoh: 45 mati dari 5.000 ekor = 0,9%. Pantau juga lonjakan harian; kenaikan mendadak lebih penting daripada angka kumulatif." },
  { id: "hpp", title: "Cara menghitung HPP", keywords: ["hpp", "harga pokok", "biaya per kg", "modal per kg", "break even", "titik impas"], answer: "HPP per kg = total biaya batch (bibit + pakan + obat/vaksin + tenaga kerja + listrik/air + lainnya) dibagi total kg hasil panen. Jual di atas HPP baru untung. Nusa Ternak menghitungnya per batch di menu Keuangan (pakan dan kesehatan diambil otomatis dari catatanmu).", link: { href: "/app/keuangan", label: "Buka Keuangan" } },
  { id: "adg", title: "Pertambahan bobot harian (ADG)", keywords: ["adg", "pertambahan bobot harian", "average daily gain", "bobot harian"], answer: "ADG = (bobot sekarang dikurangi bobot sebelumnya) dibagi jumlah hari di antara penimbangan. Timbang sampel yang sama (mis. 5 sampai 10% populasi) dengan jarak waktu teratur supaya angkanya bisa dibandingkan." },
  { id: "biosekuriti", title: "Biosekuriti dasar", keywords: ["biosekuriti", "cegah penyakit", "sanitasi", "disinfeksi", "karantina"], answer: "Dasar yang paling berpengaruh: batasi dan catat tamu, sediakan pencelup kaki/semprot disinfeksi di pintu, pisahkan ternak baru (karantina) sebelum digabung, jangan berbagi peralatan antar kandang, kendalikan tikus dan burung liar, dan buang bangkai dengan cara yang aman (kubur dalam atau bakar), bukan dibuang ke sungai. Catat tindakan di menu Kesehatan.", link: { href: "/app/kesehatan", label: "Buka Kesehatan" } },
  { id: "vaksin", title: "Jadwal vaksinasi", keywords: ["vaksin", "vaksinasi", "jadwal vaksin", "nd ib", "gumboro", "newcastle", "pmk", "antraks"], answer: "Jadwal vaksin berbeda tiap jenis ternak, daerah, dan riwayat penyakit di sekitar kandangmu, jadi saya tidak memberi jadwal atau dosis. Minta program vaksinasi dari dokter hewan atau dinas peternakan setempat, lalu catat di menu Kesehatan supaya pengingatnya muncul. Untuk penyakit hewan menular seperti PMK atau antraks, laporkan ke dinas setempat.", link: { href: "/app/dokter", label: "Konsultasi dokter hewan" } },
  { id: "sakit", title: "Ternak sakit atau mati mendadak", keywords: ["ternak sakit", "mati mendadak", "lesu", "mencret", "tidak mau makan", "batuk", "ngorok", "gejala"], answer: "Saya tidak bisa mendiagnosis. Langkah aman sekarang: pisahkan ternak yang sakit, catat jumlah dan gejalanya, hentikan keluar-masuk ternak dan alat dari kandang itu, dan segera hubungi dokter hewan. Bila banyak yang mati dalam waktu singkat, jangan menunda. Catat kematian di Nusa Ternak agar polanya terlihat.", link: { href: "/app/dokter", label: "Konsultasi dokter hewan" } },
  { id: "timbang", title: "Cara mencatat bobot", keywords: ["catat bobot", "timbang", "cara timbang", "input bobot"], answer: "Buka menu Catat, tab Bobot, pilih batch, isi bobot rata-rata sampel dan tanggalnya. Makin rutin (mis. mingguan), makin akurat prediksi panen di menu AI.", link: { href: "/app/catat", label: "Buka Catat" } },
  { id: "iot-sambung", title: "Menyambungkan sensor", keywords: ["sambung sensor", "hubungkan sensor", "node-red", "nodered", "esp32", "cara iot", "token perangkat"], answer: "Daftarkan perangkat di menu IoT, salin token (hanya tampil sekali), lalu kirim JSON ke /api/iot/v1/readings dengan header Authorization: Bearer <token>. Ada contoh Node-RED dan ESP32 di halaman perangkat dan di docs/IOT.md.", link: { href: "/app/iot", label: "Buka IoT" } },
  { id: "jual", title: "Menjual ternak atau hasil", keywords: ["jual ternak", "cara jual", "pasang iklan", "marketplace", "pasar"], answer: "Buat profil toko di menu Pasar, tambahkan produk dengan harga dan stok, lalu tunggu pesanan masuk. Terima pesanan, isi pengiriman, dan catat pembayarannya. Pembayaran saat ini dicatat manual (belum ada penahanan dana oleh pihak ketiga).", link: { href: "/app/pasar", label: "Buka Pasar" } },
];

export interface KnowledgeHit { entry: KnowledgeEntry; score: number }
/** Mencari panduan terbaik. Skor = jumlah kata kunci yang muncul (kata kunci lebih panjang bernilai lebih). */
export function searchKnowledge(question: string): KnowledgeHit | null {
  const q = normalize(question);
  let best: KnowledgeHit | null = null;
  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const k of entry.keywords) if (q.includes(k)) score += k.includes(" ") ? 2 : 1;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}

export const SUGGESTIONS = ["Berapa populasi ternak saya sekarang?", "Berapa kematian 7 hari terakhir?", "Tugas apa yang jatuh tempo?", "Ada alarm sensor yang aktif?", "Berapa pakan 30 hari terakhir?", "Laba bulan ini berapa?", "Bagaimana cara menghitung FCR?", "Berapa suhu brooding anak ayam?"];
