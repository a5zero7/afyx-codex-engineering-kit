# Afyx Codex Engineering Kit

Installer PowerShell dan Bash untuk workflow Codex yang rapi dan aman di Windows, Linux, dan macOS.

Paket ini memasang `efficient-coding`, mengambil `prompt-master` dari upstream resminya, dan memeriksa ketersediaan Headroom. Ia sengaja **tidak** mengubah model, provider, kredensial, atau MCP Codex yang sudah ada.

## Komponen

| Komponen | Sumber | Perilaku installer |
|---|---|---|
| Efficient Coding | Salinan utuh dari `~/.agents/skills/efficient-coding`, termasuk `references/` | Dipasang ke skill root yang dipilih tanpa mengubah isinya |
| Odoo Engineering | Dibundel di repositori ini | Routing aman untuk Odoo 10–20 |
| Prompt Master | [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) | Clone baru atau `git pull --ff-only` |
| Headroom | [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) | Hanya dideteksi; tidak diinstal/dikonfigurasi otomatis |

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

Secara default skill dipasang ke `%USERPROFILE%\.agents\skills`, yaitu lokasi skill personal yang digunakan setup ini.

Installer mendeteksi Codex CLI, ekstensi ChatGPT/Codex VS Code, atau keduanya. Ketiganya memakai skill root personal yang sama secara default; gunakan `-SkillsRoot` / `--skills-root` hanya untuk lingkungan terisolasi yang memang Anda kelola sendiri.

Setelah selesai, buka sesi Codex baru. Skill akan aktif hanya pada task yang sesuai: Efficient Coding untuk pekerjaan engineering dan Prompt Master saat Anda secara eksplisit meminta pembuatan/perbaikan prompt.

`odoo-engineering` hanya aktif untuk pekerjaan Odoo. Ia menentukan versi repository terlebih dahulu dan merujuk panduan terpisah untuk setiap versi 10 sampai 20, tanpa memaksakan pola versi terbaru ke codebase lama.

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

Backup dibuat di folder `backups\` di clone lokal dan tidak diunggah ke Git.

## Headroom

Headroom bersifat opsional. Instal dan konfigurasikan mengikuti dokumentasi upstream: <https://github.com/headroomlabs-ai/headroom>.

Jika Headroom sudah ada, installer hanya menampilkan statusnya. Ini mencegah konflik dengan provider, proxy, port, atau metode login Codex yang sudah Anda gunakan.

## Dokumentasi

Panduan lengkap, perilaku konflik, dan pemulihan ada di [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Lisensi dan atribusi

Wrapper installer dan Efficient Coding dilisensikan MIT. Prompt Master tidak dibundel; paket ini mengambilnya dari upstream yang memiliki lisensi MIT sendiri.
