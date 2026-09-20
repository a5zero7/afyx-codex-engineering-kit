# Panduan instalasi

## Prasyarat

- Windows PowerShell 5.1 atau PowerShell 7, atau Bash di Linux/macOS.
- Git tersedia pada `PATH`.
- Codex telah terpasang.

Installer mendeteksi salah satu dari Codex CLI atau ekstensi ChatGPT/Codex VS Code. Jika keduanya ada, skill dipasang sekali pada skill root personal bersama (`~/.agents/skills`), bukan ke home internal/sandbox. Ini mencegah duplikasi maupun bentrok konfigurasi.

Headroom tidak diperlukan untuk memasang skill. Jika digunakan, pasang terlebih dahulu dari dokumentasi upstream dan jalankan sesuai konfigurasi Anda sendiri.

## Alur aman

1. Jalankan `./install.ps1 -ValidateOnly` atau `./install.sh --validate-only` untuk melihat status tanpa membuat perubahan.
2. Jalankan `./install.ps1 -WhatIf` atau `./install.sh --dry-run` untuk melihat perubahan yang direncanakan.
3. Jalankan installer platform Anda untuk memasang jika target belum ada.
4. Mulai sesi Codex baru.

Default installer tidak menghapus, mengganti, atau memperbarui folder skill yang ada secara paksa.

## Verifikasi

Jalankan `./verify.ps1` pada Windows atau `./verify.sh` pada Linux/macOS. Verifier memeriksa CLI dan tiga skill sebagai core, lalu executable dan entri MCP CodeGraph/Headroom sebagai enhancement optional. Verifier hanya membaca state; tidak mengubah konfigurasi. Absennya enhancement optional menghasilkan `WARN`, bukan kegagalan atau exit code non-zero.

## Odoo Engineering 10–20

Skill Odoo dipasang bersama Efficient Coding. Saat task Odoo dimulai, ia harus menentukan versi dari evidence repository, lalu memuat satu reference yang sesuai dari Odoo 10 sampai Odoo 20. Ini mencegah penerapan API lintas-versi tanpa verifikasi.

## Saat skill sudah ada

| Kondisi | Perilaku default | Opsi aman |
|---|---|---|
| `efficient-coding` ada | Berhenti, tidak mengubah apa pun | Periksa folder, lalu gunakan `-Force` bila memang ingin menggantinya |
| `prompt-master` checkout Git | Hanya fast-forward dari upstream | Pastikan perubahan lokal sudah di-commit atau disimpan |
| `prompt-master` bukan checkout Git | Berhenti, tidak mengubah apa pun | Gunakan `-Force`; installer membuat backup lebih dulu |

## Konfigurasi Codex yang sengaja tidak diubah

Installer tidak pernah memodifikasi `config.toml`, `auth.json`, konfigurasi MCP, Headroom, CodeGraph, plugin, sandbox, model, atau provider. CodeGraph dan Headroom adalah enhancement eksternal yang dikonfigurasi sendiri mengikuti dokumentasi upstream masing-masing.

## Pembaruan

`./update.ps1` atau `./update.sh` memperbarui Prompt Master dengan `git pull --ff-only` dan mengganti Efficient Coding setelah mencadangkannya. Bila upstream tidak dapat di-fast-forward atau koneksi gagal, perintah berhenti tanpa reset paksa.

## Penghapusan

`./uninstall.ps1` atau `./uninstall.sh` menghapus Efficient Coding dan Odoo Engineering. Prompt Master hanya dihapus saat opsi `-RemovePromptMaster` atau `--remove-prompt-master` disebut secara eksplisit. Headroom dan konfigurasi Codex tidak pernah dihapus.

## Pemulihan

Jika memakai `-Force`, salinan skill sebelumnya tersedia di `backups\`. Salin folder backup yang diperlukan kembali ke skill root setelah menutup sesi Codex aktif.
