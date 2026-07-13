# Roadmap Fix: Concurrency, Goroutine Leaks & Optimizations

Dokumen ini melacak perbaikan dari hasil audit kode terkait isu goroutine leak, race conditions, rate-limiter, dan optimasi logs.

## Checklist Perbaikan

### 1. 🔴 HIGH SEVERITY
- [ ] **H1: MihomoService Concurrency & startRoutingHealthCheck Race**
  - [ ] Tambahkan `sync.Mutex` pada `MihomoService` untuk mengamankan data-sharing fields (`routingHealthy`, `routingError`, `routingLatency`, `routingCheckStop`, `startTime`).
  - [ ] Amankan inisialisasi `routingCheckStop` channel & check status logic menggunakan mutex lock pada `Start()` / `Stop()` / `startRoutingHealthCheck()`.
- [ ] **H2: proxyWebsocket Goroutine Leak**
  - [ ] Gunakan context cancellation atau signal close channel yang benar untuk menghentikan goroutine pengirim/penerima WebSocket.
  - [ ] Amankan penulisan ke `errc` channel agar tidak terhambat (*blocked*) ketika kedua goroutine melempar error secara bersamaan.

### 2. 🟡 MEDIUM SEVERITY
- [ ] **M1: Rate-Limiter Goroutine Cleanup Leak**
  - [ ] Tambahkan fungsi Clean / Stop mechanism pada middleware rate-limiter agar goroutine pembersih IP limit pool bisa berhenti saat program dihentikan (*graceful shutdown*).
- [ ] **M2: Config YAML Mutation Stability**
  - [ ] Tingkatkan keandalan parsing YAML ketika me-rewrite config profile daripada menggunakan regexp/string manipulation secara kasar untuk mencegah kerusakan konfigurasi.
- [ ] **M3: Connection Logger & Restart Race**
  - [ ] Cegah instance logger/koneksi lama menulis data status baru setelah core di-stop/restart.

### 3. 🟢 LOW & OPTIMIZATIONS
- [ ] **O1: useLogs O(n) array copy optimization**
  - [ ] Optimalkan update state log di React frontend agar menggunakan slice buffer efisien dibanding menyalin seluruh array penuh `MAX_LOGS` di tiap baris baru.
