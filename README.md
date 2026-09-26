# Afyx Codex Engineering Kit

Installer PowerShell dan Bash untuk workflow Codex yang rapi dan aman di Windows, Linux, dan macOS.

Paket ini memasang `efficient-coding` dan `odoo-engineering`, serta mengambil `prompt-master` dari upstream resminya. Ia sengaja **tidak** mengubah model, provider, kredensial, atau MCP Codex yang sudah ada.

## Komponen

| Komponen | Sumber | Perilaku installer |
|---|---|---|
| Efficient Coding | Salinan utuh dari `~/.agents/skills/efficient-coding`, termasuk `references/` | Dipasang ke skill root yang dipilih tanpa mengubah isinya |
| Odoo Engineering | Dibundel di repositori ini | Stable Odoo 10–20 |
| Prompt Master | [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) | Dipasang atau diganti melalui staging, validasi, backup, dan swap aman |
| Afyx Graph | Komponen Afyx, dibundel di `afyx-graph/` | Komponen opsional untuk structural intelligence lokal; runtime mandiri tanpa Node.js sistem |
| Headroom | [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) | Enhancement eksternal opsional; hanya dideteksi |
| Codex Usage Tracking | Dibundel di `tools/codex-usage/` | Optional; ringkasan token/cost otomatis melalui global Stop hook |

**Core:** Efficient Coding, Odoo Engineering, dan Prompt Master. **Komponen opsional Afyx:** Afyx Graph dan Codex Usage Tracking. **Enhancement eksternal:** Headroom. Core skill tetap berfungsi tanpa komponen opsional atau eksternal.

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

Installer melakukan inventory sebelum mutasi. Pada sesi interaktif, komponen Afyx yang sudah ada menawarkan **Skip** (default) atau **Replace**; komponen opsional yang belum ada menawarkan **Install?** dengan default **No**. Mode non-interaktif selalu memilih Skip kecuali dedicated component installer dipanggil secara eksplisit. Replace menggunakan staging, validasi, backup, swap, dan rollback bila pemasangan gagal.

### Afyx Graph

Afyx Graph dipasang sebagai runtime opsional di `~/.afyx/graph/`; ia tidak ditempatkan di direktori skill. Identitasnya: paket `@a5zero7/afyx-graph`, CLI `afyx-graph`, API `AfyxGraph`, project state `.afyx-graph/` (database `afyx-graph.db`), environment prefix `AFYX_GRAPH_*`, dan identitas MCP `afyx_graph` dengan tool `afyx_graph_*`.

Afyx Graph hanya mengenali `.afyx-graph/` sebagai state project; direktori state lain tidak dibaca, dimigrasikan, atau diubah. Tidak ada alias CLI, environment, maupun tool MCP selain identitas di atas.

Instalasi normal tidak mengubah konfigurasi MCP. Afyx Graph dikelola sebagai komponen Afyx yang mandiri; instalasi lain di mesin yang sama tidak dideteksi dan tidak dikelola. Riwayat lisensi dan atribusi tersedia di `afyx-graph/THIRD_PARTY_NOTICES.md` dan `afyx-graph/LICENSES/THIRD_PARTY_ENGINE_MIT.txt`.

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

`verify.ps1` dan `verify.sh` membedakan `OK`, `WARN`, dan `FAIL`. Kegagalan core menghasilkan exit code non-zero; Afyx Graph dan Headroom yang tidak tersedia atau belum dikonfigurasi tidak menggagalkan core readiness.

Sebagai pemeriksaan manual opsional, jalankan `python scripts/check-reference-staleness.py` untuk menampilkan `WARN` bila header `Last verified` pada reference Odoo lebih lama dari enam bulan. Pemeriksaan ini selalu exit `0`, tidak dijalankan oleh installer, verifier, atau CI, dan bukan klaim bahwa isi reference valid atau tidak valid.

## Diagnostik tanpa token

`scripts/afyx-doctor.ps1` dan `scripts/afyx-doctor.sh` adalah doctor read-only untuk komponen, environment, dan project saat ini (versi Odoo, freshness index Afyx Graph). `scripts/afyx-project.ps1` / `.sh` mendeteksi konteks project, dan `python evals/harness/routing.py` memvalidasi routing skill secara statis. Semuanya lokal dan tanpa model; lihat [docs/DIAGNOSTICS.md](docs/DIAGNOSTICS.md).

## Dokumentasi

Panduan lengkap, perilaku konflik, dan pemulihan ada di [docs/INSTALLATION.md](docs/INSTALLATION.md).
Diagnostik, kontrak komponen, dan deteksi project dijelaskan di [docs/DIAGNOSTICS.md](docs/DIAGNOSTICS.md).
Metodologi dan hasil campaign benchmark tersedia di [docs/BENCHMARKS.md](docs/BENCHMARKS.md).
Tracker penggunaan token Codex dan integrasi VS Code dijelaskan di [docs/CODEX_USAGE_TRACKER.md](docs/CODEX_USAGE_TRACKER.md).

## Lisensi dan atribusi

Wrapper installer dan Efficient Coding dilisensikan MIT. Prompt Master tidak dibundel; paket ini mengambilnya dari upstream yang memiliki lisensi MIT sendiri. Sebagian Afyx Graph memuat perangkat lunak yang semula ditulis oleh Colby Mchenry dan didistribusikan dengan MIT License; pemberitahuan copyright dan lisensi aslinya dipertahankan di `afyx-graph/LICENSES/THIRD_PARTY_ENGINE_MIT.txt`.
