# Afyx Codex Engineering Kit

Installer PowerShell dan Bash untuk workflow Codex yang rapi dan aman di Windows, Linux, dan macOS.

Paket ini memasang `efficient-coding` dan `odoo-engineering`, serta mengambil `prompt-master` dari upstream resminya. Ia sengaja **tidak** mengubah model, provider, kredensial, atau MCP Codex yang sudah ada.

## Komponen

| Komponen | Sumber | Perilaku installer |
|---|---|---|
| Efficient Coding | Salinan utuh dari `~/.agents/skills/efficient-coding`, termasuk `references/` | Dipasang ke skill root yang dipilih tanpa mengubah isinya |
| Odoo Engineering | Dibundel di repositori ini | Stable Odoo 10–20 |
| Prompt Master | [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) | Dipasang atau diganti melalui staging, validasi, backup, dan swap aman |
| Afyx Graph | Distribusi resmi Afyx berbasis CodeGraph | Komponen opsional untuk structural intelligence lokal; runtime mandiri tanpa Node.js sistem |
| Headroom | [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) | Enhancement eksternal opsional; hanya dideteksi |
| Codex Usage Tracking | Dibundel di `tools/codex-usage/` | Optional; ringkasan token/cost otomatis melalui global Stop hook |

**Core:** Efficient Coding, Odoo Engineering, dan Prompt Master. **Komponen opsional Afyx:** Afyx Graph dan Codex Usage Tracking. **Enhancement eksternal:** Headroom dan standalone upstream CodeGraph. Core skill tetap berfungsi tanpa komponen opsional atau eksternal.

## Pilih installer sesuai sistem operasi

| Sistem operasi | Installer | Shell |
|---|---|---|
| Windows 10/11 | `install.ps1` | Windows PowerShell 5.1 atau PowerShell 7 |
| Linux | `install.sh` | Bash |
| macOS | `install.sh` | Bash |

## Instalasi Windows

```powershell
git clone https://github.com/a5zero7/afyx-codex-engineering-kit.git
Set-Location afyx-codex-engineering-kit
.\install.ps1
```

## Instalasi Linux dan macOS

```bash
git clone https://github.com/a5zero7/afyx-codex-engineering-kit.git
cd afyx-codex-engineering-kit
chmod +x install.sh update.sh uninstall.sh
./install.sh
```

Secara default skill dipasang ke `~/.agents/skills`, yaitu lokasi skill personal yang digunakan setup ini.

Installer mendeteksi Codex CLI, ekstensi ChatGPT/Codex VS Code, atau keduanya. Ketiganya memakai skill root personal yang sama secara default; gunakan `-SkillsRoot` / `--skills-root` hanya untuk lingkungan terisolasi yang memang Anda kelola sendiri.

Setelah selesai, buka sesi Codex baru. Skill akan aktif hanya pada task yang sesuai: Efficient Coding untuk pekerjaan engineering dan Prompt Master saat Anda secara eksplisit meminta pembuatan/perbaikan prompt.

`odoo-engineering` hanya aktif untuk pekerjaan Odoo. Referensi Odoo 10–20 berstatus stable dan tetap harus dipilih berdasarkan evidence repository versi target.

Skill menggunakan progressive disclosure: entrypoint berisi routing dan batasan, sedangkan guidance investigasi/tool dan deteksi versi berada di `references/`. Efficient Coding membedakan target yang sudah diketahui, target yang perlu ditemukan, dan perubahan cross-cutting. Odoo memuat `common.md`, lalu satu reference versi yang dibuktikan; migration dapat memerlukan source dan target secara terpisah.

## Tidak bentrok dengan Codex

Installer tidak pernah menulis atau mengganti:

- `%USERPROFILE%\.codex\config.toml`
- `%USERPROFILE%\.codex\auth.json`
- provider model, Headroom proxy, server MCP, atau plugin Codex
- standalone upstream CodeGraph

Installer melakukan inventory sebelum mutasi. Pada sesi interaktif, komponen Afyx yang sudah ada menawarkan **Skip** (default) atau **Replace**; komponen opsional yang belum ada menawarkan **Install?** dengan default **No**. Mode non-interaktif selalu memilih Skip kecuali dedicated component installer dipanggil secara eksplisit. Replace menggunakan staging, validasi, backup, swap, dan rollback bila pemasangan gagal.

### Afyx Graph

Afyx Graph dipasang sebagai runtime opsional di `~/.afyx/graph/`; ia tidak ditempatkan di direktori skill. CLI kanonisnya `afyx-graph`, project state kanonisnya `.afyx-graph/`, environment prefix-nya `AFYX_GRAPH_*`, dan identitas MCP-nya `afyx_graph` dengan tool `afyx_graph_*`. Project yang hanya memiliki `.codegraph/` tetap dikenali di tempat tanpa migrasi otomatis. Alias legacy `codegraph`, `.codegraph/`, `CODEGRAPH_*`, dan `codegraph_*` dipertahankan sebagai lapisan kompatibilitas pada engine yang sama.

Instalasi normal tidak mengubah konfigurasi MCP. Standalone upstream CodeGraph dideteksi sebagai komponen eksternal dan tidak pernah diganti atau dihapus oleh Afyx. Afyx Graph didasarkan pada CodeGraph 1.6.0; lisensi dan copyright upstream tersedia di `afyx-codegraph/THIRD_PARTY_NOTICES.md` dan `afyx-codegraph/LICENSES/CodeGraph-MIT.txt`.

## Perintah

```powershell
.\install.ps1 -ValidateOnly
.\install.ps1 -WhatIf
.\install.ps1 -SkillsRoot "$env:USERPROFILE\.agents\skills"
.\install.ps1 -Force
.\install.ps1 -InstallUsageTracker
.\install.ps1 -SkipUsageTracker
.\update.ps1
.\uninstall.ps1
.\uninstall.ps1 -RemoveUsageTracker
.\uninstall.ps1 -RemovePromptMaster
.\verify.ps1
```

Linux/macOS memakai opsi yang setara:

```bash
./install.sh --validate-only
./install.sh --dry-run
./install.sh --skills-root "$HOME/.agents/skills"
./install.sh --force
./update.sh
./uninstall.sh --remove-prompt-master
./verify.sh
```

Updater melakukan self-update kit dengan `git pull --ff-only` hanya pada checkout bersih. Jika worktree memiliki perubahan lokal, updater berhenti sebelum installer dijalankan; gunakan `git status` untuk menanganinya atau `-SkipSelfUpdate` (PowerShell) / `--skip-self-update` (Bash) sebagai opt-in untuk memasang current checkout. Git yang tidak tersedia adalah error terpisah; source non-Git dengan Git tersedia dilaporkan sebagai self-update unavailable dan dapat melanjutkan dengan source saat ini.

Backup dibuat di folder `backups\` di clone lokal dan tidak diunggah ke Git.

Pada instalasi PowerShell interaktif, Usage Tracking ditawarkan sebagai komponen opsional. Gunakan `-InstallUsageTracker` untuk opt-in tanpa prompt atau `-SkipUsageTracker` untuk melewatinya; instalasi non-interaktif tanpa opt-in akan melewatinya dengan aman. Menolak update tidak menghapus tracker yang sudah terpasang. Setelah instalasi, tinjau dan trust hook melalui `/hooks`.

Mode utama menampilkan Usage Summary otomatis di UI Codex setelah turn selesai. VS Code User Task `Codex: Watch Token Usage` tetap tersedia sebagai fallback/debug dan tidak perlu dijalankan untuk penggunaan normal.

## Headroom

Headroom bersifat opsional. CLI, proxy/provider routing, dan MCP adalah capability terpisah; MCP tidak diperlukan untuk mode proxy. Instal dan konfigurasikan mengikuti dokumentasi upstream: <https://github.com/headroomlabs-ai/headroom>.

Jika Headroom sudah ada, installer hanya menampilkan statusnya. Ini mencegah konflik dengan provider, proxy, port, atau metode login Codex yang sudah Anda gunakan.

## Verifikasi

`verify.ps1` dan `verify.sh` membedakan `OK`, `WARN`, dan `FAIL`. Kegagalan core menghasilkan exit code non-zero; Afyx Graph, standalone upstream CodeGraph, dan Headroom yang tidak tersedia atau belum dikonfigurasi tidak menggagalkan core readiness.

Sebagai pemeriksaan manual opsional, jalankan `python scripts/check-reference-staleness.py` untuk menampilkan `WARN` bila header `Last verified` pada reference Odoo lebih lama dari enam bulan. Pemeriksaan ini selalu exit `0`, tidak dijalankan oleh installer, verifier, atau CI, dan bukan klaim bahwa isi reference valid atau tidak valid.

## Dokumentasi

Panduan lengkap, perilaku konflik, dan pemulihan ada di [docs/INSTALLATION.md](docs/INSTALLATION.md).
Metodologi dan hasil campaign benchmark tersedia di [docs/BENCHMARKS.md](docs/BENCHMARKS.md).
Tracker penggunaan token Codex dan integrasi VS Code dijelaskan di [docs/CODEX_USAGE_TRACKER.md](docs/CODEX_USAGE_TRACKER.md).

## Lisensi dan atribusi

Wrapper installer dan Efficient Coding dilisensikan MIT. Prompt Master tidak dibundel; paket ini mengambilnya dari upstream yang memiliki lisensi MIT sendiri. Afyx Graph berbasis CodeGraph dan mempertahankan MIT License serta copyright asli Colby Mchenry.
