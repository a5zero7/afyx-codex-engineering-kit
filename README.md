# Afyx Codex Engineering Kit

Installer PowerShell untuk workflow Codex yang rapi dan aman di Windows.

Paket ini memasang `efficient-coding`, mengambil `prompt-master` dari upstream resminya, dan memeriksa ketersediaan Headroom. Ia sengaja **tidak** mengubah model, provider, kredensial, atau MCP Codex yang sudah ada.

## Komponen

| Komponen | Sumber | Perilaku installer |
|---|---|---|
| Efficient Coding | Dibundel di repositori ini | Dipasang ke skill root yang dipilih |
| Prompt Master | [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) | Clone baru atau `git pull --ff-only` |
| Headroom | [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) | Hanya dideteksi; tidak diinstal/dikonfigurasi otomatis |

## Instalasi cepat

```powershell
git clone https://github.com/a5zero7/afyx-codex-engineering-kit.git
Set-Location afyx-codex-engineering-kit
.\install.ps1
```

Secara default skill dipasang ke `%USERPROFILE%\.agents\skills`, yaitu lokasi skill personal yang digunakan setup ini.

Setelah selesai, buka sesi Codex baru. Skill akan aktif hanya pada task yang sesuai: Efficient Coding untuk pekerjaan engineering dan Prompt Master saat Anda secara eksplisit meminta pembuatan/perbaikan prompt.

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
```

Backup dibuat di folder `backups\` di clone lokal dan tidak diunggah ke Git.

## Headroom

Headroom bersifat opsional. Instal dan konfigurasikan mengikuti dokumentasi upstream: <https://github.com/headroomlabs-ai/headroom>.

Jika Headroom sudah ada, installer hanya menampilkan statusnya. Ini mencegah konflik dengan provider, proxy, port, atau metode login Codex yang sudah Anda gunakan.

## Dokumentasi

Panduan lengkap, perilaku konflik, dan pemulihan ada di [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Lisensi dan atribusi

Wrapper installer dan Efficient Coding dilisensikan MIT. Prompt Master tidak dibundel; paket ini mengambilnya dari upstream yang memiliki lisensi MIT sendiri.
