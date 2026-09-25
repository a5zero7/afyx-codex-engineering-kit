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

Installer melakukan inventory read-only lebih dahulu. Dalam sesi interaktif, komponen Afyx yang sudah ada menawarkan Skip (default) atau Replace; komponen opsional yang belum ada menawarkan Install dengan default No. Mode non-interaktif selalu Skip. Replace memakai staging, validasi, backup, swap, dan rollback bila pemasangan gagal.

## Verifikasi

Jalankan `./verify.ps1` pada Windows atau `./verify.sh` pada Linux/macOS. Core environment valid jika tersedia Codex CLI, ekstensi ChatGPT/Codex VS Code, atau keduanya. Verifier juga memeriksa tiga skill core serta melaporkan Headroom CLI, proxy/provider routing, dan MCP sebagai capability optional yang terpisah. Semua pemeriksaan bersifat read-only; absennya capability optional tidak menyebabkan core readiness gagal.

## Odoo Engineering 10–20 stable

Skill Odoo dipasang bersama Efficient Coding. Referensi Odoo 10–20 berstatus stable, tetapi Odoo 20 tetap memerlukan evidence exact 20.0 sebelum perilaku spesifik versi digunakan. Saat task Odoo dimulai, skill menentukan versi dari repository lalu memuat reference yang sesuai untuk mencegah penerapan API lintas-versi tanpa verifikasi.

Kedua skill memakai frontmatter Agent Skills dengan `name`, `description`, dan `metadata.version`. Entrypoint tetap ringkas; detail kondisional dimuat dari `references/` hanya saat routing task membutuhkannya.

## Saat skill sudah ada

| Kondisi | Perilaku default | Opsi aman |
|---|---|---|
| Komponen Afyx sudah ada | Skip | Pilih Replace untuk staged replacement dengan backup |
| Prompt Master memiliki perubahan lokal | Skip dan laporkan dirty state | Pilih Replace secara eksplisit; backup lokal dipertahankan |
| Afyx Graph belum terpasang | Skip | Pilih Install; runtime dipasang ke `~/.afyx/graph/` |

## Konfigurasi Codex yang sengaja tidak diubah

Installer tidak pernah memodifikasi `config.toml`, `auth.json`, konfigurasi MCP, Headroom, standalone upstream CodeGraph, plugin, sandbox, model, atau provider. Afyx Graph adalah komponen opsional resmi yang memasang runtime mandiri dan CLI `afyx-graph` di `~/.afyx/graph/`; Headroom dan standalone upstream CodeGraph tetap eksternal dan hanya dideteksi. Project state baru memakai `.afyx-graph/`, sedangkan `.codegraph/` lama tetap dikenali tanpa migrasi otomatis.

## Pembaruan

`./update.ps1` atau `./update.sh` terlebih dahulu mencoba memperbarui checkout kit sendiri dengan `git pull --ff-only`, lalu menjalankan installer untuk memperbarui Prompt Master dan skill. Worktree dirty menghentikan updater sebelum installer dijalankan; gunakan `git status` untuk menangani perubahan atau `-SkipSelfUpdate` / `--skip-self-update` untuk secara sengaja memasang current checkout. Git yang tidak tersedia menghasilkan error tersendiri. Bila Git tersedia tetapi source bukan checkout Git, self-update dilaporkan unavailable dan installer tetap berjalan dari source saat ini.

## Penghapusan

`./uninstall.ps1` atau `./uninstall.sh` menghapus Efficient Coding dan Odoo Engineering. Prompt Master hanya dihapus saat opsi `-RemovePromptMaster` atau `--remove-prompt-master` disebut secara eksplisit. Uninstaller dapat menghapus runtime Afyx Graph milik Afyx, tetapi tidak menghapus standalone upstream CodeGraph, konfigurasi Codex, `.afyx-graph/`, atau `.codegraph/` milik project.

## Pemulihan

Jika memakai `-Force`, salinan skill sebelumnya tersedia di `backups\`. Salin folder backup yang diperlukan kembali ke skill root setelah menutup sesi Codex aktif.
