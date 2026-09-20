# Panduan instalasi

## Prasyarat

- Windows PowerShell 5.1 atau PowerShell 7.
- Git tersedia pada `PATH`.
- Codex telah terpasang.

Headroom tidak diperlukan untuk memasang skill. Jika digunakan, pasang terlebih dahulu dari dokumentasi upstream dan jalankan sesuai konfigurasi Anda sendiri.

## Alur aman

1. Jalankan `./install.ps1 -ValidateOnly` untuk melihat status tanpa membuat perubahan.
2. Jalankan `./install.ps1 -WhatIf` untuk melihat perubahan yang direncanakan.
3. Jalankan `./install.ps1` untuk memasang jika target belum ada.
4. Mulai sesi Codex baru.

Default installer tidak menghapus, mengganti, atau memperbarui folder skill yang ada secara paksa.

## Saat skill sudah ada

| Kondisi | Perilaku default | Opsi aman |
|---|---|---|
| `efficient-coding` ada | Berhenti, tidak mengubah apa pun | Periksa folder, lalu gunakan `-Force` bila memang ingin menggantinya |
| `prompt-master` checkout Git | Hanya fast-forward dari upstream | Pastikan perubahan lokal sudah di-commit atau disimpan |
| `prompt-master` bukan checkout Git | Berhenti, tidak mengubah apa pun | Gunakan `-Force`; installer membuat backup lebih dulu |

## Konfigurasi Codex yang sengaja tidak diubah

Installer tidak pernah memodifikasi `config.toml`, `auth.json`, konfigurasi MCP, plugin, sandbox, model, atau provider. Ini berarti Headroom dan CodeGraph yang sudah aktif tetap tidak tersentuh.

## Pembaruan

`./update.ps1` memperbarui Prompt Master dengan `git pull --ff-only` dan mengganti Efficient Coding setelah mencadangkannya. Bila upstream tidak dapat di-fast-forward atau koneksi gagal, perintah berhenti tanpa reset paksa.

## Penghapusan

`./uninstall.ps1` hanya menghapus Efficient Coding. Prompt Master hanya dihapus saat `-RemovePromptMaster` disebut secara eksplisit. Headroom dan konfigurasi Codex tidak pernah dihapus.

## Pemulihan

Jika memakai `-Force`, salinan skill sebelumnya tersedia di `backups\`. Salin folder backup yang diperlukan kembali ke skill root setelah menutup sesi Codex aktif.
