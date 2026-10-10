# Panduan instalasi

## Prasyarat dan klasifikasi

- **REQUIRED:** Windows PowerShell 5.1/7 atau Bash di Linux/macOS; Git; Codex CLI atau ekstensi ChatGPT/Codex VS Code.
- **COMPONENT_REQUIRED (Afyx Graph):** Node.js >=22.5 dan kemampuan archive/SHA-256 platform.
- **BUILD_ONLY (Afyx Graph):** npm, hanya ketika artifact release terverifikasi tidak tersedia dan fallback lokal dibutuhkan.
- **OPTIONAL:** Headroom, dikelola eksternal dan tidak pernah dipasang/diubah oleh kit.

Installer mendeteksi salah satu dari Codex CLI atau ekstensi ChatGPT/Codex VS Code. Jika keduanya ada, skill dipasang sekali pada skill root personal bersama (`~/.agents/skills`), bukan ke home internal/sandbox. Ini mencegah duplikasi maupun bentrok konfigurasi.

Headroom tidak diperlukan untuk memasang skill. Jika digunakan, pasang terlebih dahulu dari dokumentasi upstream dan jalankan sesuai konfigurasi Anda sendiri.

## Alur aman

1. Jalankan `./install.ps1 -ValidateOnly` atau `./install.sh --validate-only` untuk melihat status tanpa membuat perubahan.
2. Jalankan `./install.ps1 -WhatIf` atau `./install.sh --dry-run` untuk melihat perubahan yang direncanakan.
3. Jalankan installer platform Anda untuk memasang jika target belum ada.
4. Mulai sesi Codex baru.

Installer melakukan inventory read-only lebih dahulu untuk Efficient Coding, Odoo Engineering, Prompt Master, Afyx Graph, dan Usage Tracking. State menentukan action yang sah: `NOT INSTALLED` = Install/Skip, `HEALTHY` = Update/Skip, `INCOMPLETE`/`INVALID` = Repair/Skip, dan `UNKNOWN` = Skip saja. Mode non-interaktif selalu Skip kecuali action diberikan melalui `-ComponentAction id=...` atau `--component id=...`. `-ValidateOnly`, `-WhatIf`, dan `--dry-run` tidak membuat mutasi.

## Afyx Graph Technical Alpha

Afyx Graph saat ini merupakan Technical Alpha prerelease, bukan Stable v1. Installer memilih artifact berdasarkan versi, channel, OS, dan arsitektur; memverifikasi SHA-256 dan staged identity; lalu memasang secara transaksional. Jika release yang cocok tidak tersedia atau cache/release gagal verifikasi, installer dapat menjalankan `npm ci`, clean build, packaging, dan checksum otomatis dari checkout Git tervalidasi. Windows menggunakan packaging PowerShell native—Bash/WSL tidak diperlukan.

Identitas artifact juga mencatat source revision/build identity dan extraction version. Cache lokal dengan semver yang sama tetapi revision berbeda diklasifikasikan sebagai valid-but-stale dan tidak dipasang diam-diam. Archive eksternal tanpa revision terverifikasi tetap dilaporkan `UNKNOWN`. `-ValidateOnly` / `--validate-only` membandingkan runtime terpasang dengan checkout tanpa mengubah keduanya; revision drift dilaporkan sebagai `UPDATE AVAILABLE — REVISION MISMATCH`.

Gunakan `-Offline` / `--offline` untuk mencegah self-update/lookup jaringan dan memakai cache/fallback Graph lokal. Karena Prompt Master dimiliki upstream dan tidak dibundel, action install/update Prompt Master ditolak dalam mode offline. Gunakan `-NoBuildFallback` / `--no-build-fallback` untuk gagal tegas bila artifact tidak tersedia. Source dirty ditolak untuk fallback; `-AllowDirtySource` / `--allow-dirty-source` adalah opt-in eksplisit yang harus dipakai hanya saat provenance perubahan lokal telah dipahami.

## Verifikasi

Jalankan `./verify.ps1` pada Windows atau `./verify.sh` pada Linux/macOS. Core environment valid jika tersedia Codex CLI, ekstensi ChatGPT/Codex VS Code, atau keduanya. Verifier juga memeriksa tiga skill core serta melaporkan Headroom CLI, proxy/provider routing, dan MCP sebagai capability optional yang terpisah. Semua pemeriksaan bersifat read-only; absennya capability optional tidak menyebabkan core readiness gagal.

Jika Afyx Graph dipilih, installer dapat mendaftarkan MCP melalui antarmuka native `codex mcp` dengan entry point Node absolut dari runtime terpasang. Registrasi ini consented, idempotent, dan tidak menulis TOML sendiri. Entry Afyx-owned yang stale dapat diperbarui secara terkendali; entry yang conflicting atau tidak terbukti Afyx-owned dipertahankan dan dilaporkan. Gunakan `-SkipGraphMcp` / `--skip-graph-mcp` untuk melewati integrasi. Verifier membedakan `GRAPH_INSTALLED`, `CLI_REACHABLE`, `MCP_NOT_CONFIGURED`, `MCP_CONFIGURED`, `MCP_REACHABLE`, `MCP_BLOCKED`, dan `MCP_HANDSHAKE_FAILED` melalui initialize + tools/list nyata.

Untuk diagnosis project, `afyx-graph status` dan `afyx-graph status --json` menampilkan dimensi terpisah: Git freshness, pending filesystem/content changes, extraction completeness, extraction-version compatibility, pending references, watcher state, dan accounting full-index terakhir. Viewer menampilkan kontrak Index Health yang sama. `ignored: null` berarti path ignored tidak dienumerasi—bukan hitungan nol. Alasan skip seperti `size_exceeded` dan timing fase hanya muncul bila telah direkam oleh full index; nilai lama/tidak tersedia tidak direka sebagai nol.

## Odoo Engineering 10–20 stable

Skill Odoo dipasang bersama Efficient Coding. Referensi Odoo 10–20 berstatus stable, tetapi Odoo 20 tetap memerlukan evidence exact 20.0 sebelum perilaku spesifik versi digunakan. Saat task Odoo dimulai, skill menentukan versi dari repository lalu memuat reference yang sesuai untuk mencegah penerapan API lintas-versi tanpa verifikasi.

Kedua skill memakai frontmatter Agent Skills dengan `name`, `description`, dan `metadata.version`. Entrypoint tetap ringkas; detail kondisional dimuat dari `references/` hanya saat routing task membutuhkannya.

## Saat skill sudah ada

| Kondisi | Perilaku default | Opsi aman |
|---|---|---|
| Komponen Afyx sehat/current | Skip | Pilih Update hanya bila diperlukan |
| Komponen Afyx incomplete/invalid | Skip + warning | Pilih Repair untuk staged replacement dengan backup |
| Prompt Master memiliki perubahan lokal | Skip dan laporkan dirty state | Pilih Replace secara eksplisit; backup lokal dipertahankan |
| Afyx Graph belum terpasang | Skip | Pilih Install; runtime dipasang ke `~/.afyx/graph/` |

## Konfigurasi Codex yang sengaja tidak diubah

Installer tidak memodifikasi `auth.json`, Headroom, plugin, sandbox, model, provider, atau MCP server lain. Hanya ketika integrasi Graph dipilih, installer meminta Codex CLI mengelola entry MCP Afyx-owned; entry conflicting/unproven tidak ditimpa. Afyx Graph memasang runtime mandiri dan CLI `afyx-graph` di `~/.afyx/graph/`; Headroom tetap eksternal dan hanya dideteksi. Project state memakai `.afyx-graph/` (database `afyx-graph.db`); direktori state lain tidak dibaca atau diubah.

## Pembaruan

`./update.ps1` atau `./update.sh` terlebih dahulu mencoba memperbarui checkout kit sendiri dengan `git pull --ff-only`, lalu menggunakan state/version untuk memilih update; tidak ada blanket force replacement. Action eksplisit tetap dapat diberikan per komponen. Worktree dirty menghentikan updater sebelum installer dijalankan; gunakan `git status` untuk menangani perubahan atau `-SkipSelfUpdate` / `--skip-self-update` untuk secara sengaja memasang current checkout.

## Penghapusan

`./uninstall.ps1` atau `./uninstall.sh` menghapus Efficient Coding dan Odoo Engineering. Prompt Master hanya dihapus saat opsi `-RemovePromptMaster` atau `--remove-prompt-master` disebut secara eksplisit. Uninstaller dapat menghapus runtime Afyx Graph milik Afyx, tetapi tidak menghapus konfigurasi Codex atau state `.afyx-graph/` milik project.

## Pemulihan

Skill/runtime yang di-update atau di-repair dibuat melalui staging dan backup. Checksum, extraction, staged metadata, CLI `--version`, atau `help` yang gagal menyebabkan runtime sebelumnya dipulihkan. Perubahan entry MCP Afyx-owned menggunakan backup/restore native CLI; index project `.afyx-graph/` tidak diubah. Backup skill yang berhasil diganti tersedia di `backups\` bila pemulihan manual diperlukan.
