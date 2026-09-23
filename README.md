# Afyx Codex Engineering Kit

Installer PowerShell dan Bash untuk workflow Codex yang rapi dan aman di Windows, Linux, dan macOS.

Paket ini memasang `efficient-coding` dan `odoo-engineering`, serta mengambil `prompt-master` dari upstream resminya. Ia sengaja **tidak** mengubah model, provider, kredensial, atau MCP Codex yang sudah ada.

## Komponen

| Komponen | Sumber | Perilaku installer |
|---|---|---|
| Efficient Coding | Salinan utuh dari `~/.agents/skills/efficient-coding`, termasuk `references/` | Dipasang ke skill root yang dipilih tanpa mengubah isinya |
| Odoo Engineering | Dibundel di repositori ini | Stable Odoo 10–19; Odoo 20 preview |
| Prompt Master | [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) | Clone baru atau `git pull --ff-only` |
| CodeGraph | Optional enhancement | Structural intelligence: references, callers/callees, inheritance, dependencies, dan hubungan lintas modul |
| Headroom | [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) | Optional context/token optimization untuk output tool besar |

**Core:** Efficient Coding, Odoo Engineering, dan Prompt Master. **Optional:** CodeGraph dan Headroom. Core skill tetap berfungsi saat enhancement optional tidak tersedia.

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

`odoo-engineering` hanya aktif untuk pekerjaan Odoo. Referensi Odoo 10–19 berstatus stable; Odoo 20 adalah preview/emerging dan harus diverifikasi terhadap evidence repository sebelum digunakan.

Skill menggunakan progressive disclosure: entrypoint berisi routing dan batasan, sedangkan guidance investigasi/tool dan deteksi versi berada di `references/`. Efficient Coding membedakan target yang sudah diketahui, target yang perlu ditemukan, dan perubahan cross-cutting. Odoo memuat `common.md`, lalu satu reference versi yang dibuktikan; migration dapat memerlukan source dan target secara terpisah.

## Tidak bentrok dengan Codex

Installer tidak pernah menulis atau mengganti:

- `%USERPROFILE%\.codex\config.toml`
- `%USERPROFILE%\.codex\auth.json`
- provider model, Headroom proxy, server MCP, atau plugin Codex
- skill yang sudah ada tanpa `-Force`

Jika `efficient-coding` sudah ada, instalasi berhenti dengan pesan jelas. Jika `prompt-master` sudah ada tetapi bukan checkout Git, instalasi juga berhenti. Gunakan `-Force` hanya jika Anda ingin membuat backup lalu menggantinya.

## Perintah

```powershell
.\install.ps1 -ValidateOnly
.\install.ps1 -WhatIf
.\install.ps1 -SkillsRoot "$env:USERPROFILE\.agents\skills"
.\install.ps1 -Force
.\update.ps1
.\uninstall.ps1
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

## Headroom

Headroom bersifat opsional. CLI, proxy/provider routing, dan MCP adalah capability terpisah; MCP tidak diperlukan untuk mode proxy. Instal dan konfigurasikan mengikuti dokumentasi upstream: <https://github.com/headroomlabs-ai/headroom>.

Jika Headroom sudah ada, installer hanya menampilkan statusnya. Ini mencegah konflik dengan provider, proxy, port, atau metode login Codex yang sudah Anda gunakan.

## Verifikasi

`verify.ps1` dan `verify.sh` membedakan `OK`, `WARN`, dan `FAIL`. Kegagalan core menghasilkan exit code non-zero; CodeGraph dan Headroom yang tidak tersedia atau belum dikonfigurasi hanya menghasilkan peringatan.

## Dokumentasi

Panduan lengkap, perilaku konflik, dan pemulihan ada di [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Lisensi dan atribusi

Wrapper installer dan Efficient Coding dilisensikan MIT. Prompt Master tidak dibundel; paket ini mengambilnya dari upstream yang memiliki lisensi MIT sendiri.
