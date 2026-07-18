<div align="center">
  <span style="font-size: 80px;">🐝</span>
  <h1>BeeChat - Honyecomb Chat Messenger</h1>
  <p>Aplikasi Chat Enkripsi End-to-End Premium dengan Dukungan Transfer Berkas Raksasa & APK Mobile.</p>
</div>

---

## 🚀 Fitur Unggulan

### 1. Enkripsi End-to-End (E2EE) AES-GCM
* Seluruh pesan teks, foto, video, dan dokumen dienkripsi secara lokal di sisi klien menggunakan **Web Crypto API (AES-GCM 256-bit)** sebelum dikirim ke database.
* Kunci enkripsi diturunkan secara unik berdasarkan ID Obrolan (`chatId`), sehingga administrator database atau pihak ketiga tidak dapat membaca isi pesan maupun melihat tautan berkas asli.

### 2. Transfer Berkas Raksasa hingga 5 GB (`/api/upload`)
* Menggunakan **Socket Streaming** (`req.pipe(writeStream)`) pada backend Node.js untuk menangani berkas besar (hingga 5 GB) dengan konsumsi RAM server hampir 0 byte.
* Dilengkapi pemantau persentase unggahan lebah 🐝 (*Bouncing Upload Progress Bar*) secara real-time.

### 3. Kompresi Cerdas ala WhatsApp (Hemat Kuota)
* **Foto & Stiker**: Foto di atas 1 MB atau stiker di atas 500 KB akan ditawarkan untuk dikompresi resolusinya secara instan lewat Canvas API sebelum diunggah.
* **Dokumen (PDF, DOCX, ZIP, dll.)**: Dokumen di atas 1 MB dapat dikompresi menjadi arsip gzip asli (`.gz`) menggunakan browser native **`CompressionStream`** tanpa dependensi pihak ketiga, mengurangi ukuran dokumen 50% - 80% secara aman.

### 4. Papan Emoticon & Reaksi Standar WhatsApp
* **Quick Reactions**: Reaksi cepat menggunakan emoji standar WA (`👍`, `❤️`, `😂`, `😮`, `😢`, `🙏`).
* **Extended Picker (+)**: Membuka panel popover berisi **80+ emoji populer** untuk reaksi yang lebih ekspresif.
* **BeeChat Emoticon Keyboard**: Papan ketik emoji melayang yang terintegrasi di baris penulisan pesan teks.
* **Stiker Kustom**: Pengguna dapat mengunggah gambar sendiri lewat tombol **"Buat Sendiri"** untuk langsung disulap menjadi stiker die-cut mengilat.

---

## 🛠️ Cara Menjalankan Lokal

### Prasyarat
* Node.js (v18+)
* PostgreSQL / Supabase Database

### Langkah-langkah
1. Pasang dependensi proyek:
   ```bash
   npm install
   ```
2. Konfigurasikan variabel lingkungan pada berkas `.env`:
   ```env
   GEMINI_API_KEY="kunci-api-gemini-anda"
   APP_SERVER="localhost"
   APP_PORT="3000"
   DB_HOST="host-db-anda"
   DB_USER="user-db-anda"
   DB_PASS="password-db-anda"
   DB_NAME="nama-db-anda"
   DB_PORT=5432
   ```
3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```

---

## 📱 Panduan Mengemas Menjadi File APK (Android)

Proyek ini telah dikonfigurasi menggunakan **Capacitor** untuk dikompilasi menjadi aplikasi Android asli secara instan.

1. **Build Aplikasi Web**:
   ```bash
   npm run build
   ```
   *(Proses ini akan menyuntikkan setelan host dan port dari `.env` secara dinamis ke dalam kode WebView APK).*

2. **Sinkronkan Aset ke Folder Android**:
   ```bash
   npx cap sync
   ```

3. **Buka Proyek di Android Studio**:
   ```bash
   npx cap open android
   ```

4. **Kompilasi APK**:
   Di dalam Android Studio, tunggu proses Gradle sync selesai, lalu klik menu:
   **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   *File debug APK akan siap dalam beberapa detik untuk ditransfer dan diinstal di ponsel Anda!* 🐝🍯
