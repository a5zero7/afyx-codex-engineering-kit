# Panduan instalasi

## Prasyarat dan klasifikasi

- **REQUIRED:** Windows PowerShell 5.1/7 atau Bash di Linux/macOS; Git; Codex CLI atau ekstensi ChatGPT/Codex VS Code.
- **COMPONENT_REQUIRED (Afyx Graph):** Node.js >=22.5 dan kemampuan archive/SHA-256 platform.
- **BUILD_ONLY (Afyx Graph):** npm, hanya ketika artifact release terverifikasi tidak tersedia dan fallback lokal dibutuhkan.
- **OPTIONAL:** Headroom, dikelola eksternal dan tidak pernah dipasang/diubah oleh kit.

Installer mendeteksi salah satu dari Codex CLI atau ekstensi ChatGPT/Codex VS Code. Jika keduanya ada, skill dipasang sekali pada skill root personal bersama (`~/.agents/skills`), bukan ke home internal/sandbox. Ini mencegah duplikasi maupun bentrok konfigurasi.

Headroom tidak diperlukan untuk memasang skill. Jika digunakan, pasang terlebih dahulu dari dokumentasi upstream dan jalankan sesuai konfigurasi Anda sendiri.

## Alur aman

Untuk pengujian Alpha internal, `D:\Project\workspace\afyx-codex-engineering-kit` adalah satu-satunya repository pengembangan dan sumber build/candidate. `D:\Project\afyx-alpha` hanya boleh menjadi target acceptance untuk clean install, update, verifikasi identitas terpasang, dan smoke/post-install checks; jangan mengubah source, commit, benchmark source, membangun artifact, atau menyiapkan release dari direktori tersebut. Defect yang ditemukan di environment Alpha harus direproduksi dan diperbaiki di repository kanonis, lalu candidate baru dibangun di sana sebelum diuji ulang melalui install/update.

1. Jalankan `./install.ps1 -ValidateOnly` atau `./install.sh --validate-only` untuk melihat status tanpa membuat perubahan.
2. Jalankan `./install.ps1 -WhatIf` atau `./install.sh --dry-run` untuk melihat perubahan yang direncanakan.
3. Jalankan installer platform Anda untuk memasang jika target belum ada.
4. Mulai sesi Codex baru.

Installer melakukan inventory read-only lebih dahulu untuk Efficient Coding, Odoo Engineering, Afyx Engineering Expert, Prompt Master, Afyx Graph, dan Usage Tracking. State menentukan action yang sah: `NOT INSTALLED` = Install/Skip, `HEALTHY` = Update/Skip, `INCOMPLETE`/`INVALID` = Repair/Skip, dan `UNKNOWN` = Skip saja. Mode non-interaktif selalu Skip kecuali action diberikan melalui `-ComponentAction id=...` atau `--component id=...`. `-ValidateOnly`, `-WhatIf`, dan `--dry-run` tidak membuat mutasi.

Phase 6 menambahkan desired-state preset pada engine yang sama: `minimal`,
`recommended`, `full`, atau `custom`. Gunakan `-Preset minimal` / `--preset minimal`;
untuk Custom tambahkan `-CustomComponent <id>` / `--custom-component <id>`. Komponen
yang tidak dipilih dipertahankan, bukan dihapus. `verify.ps1`/`verify.sh` menerima
preset yang sama dan gagal tegas untuk desired component yang missing, drifted, atau
ownership-nya tidak terverifikasi. Hanya instalasi ber-marker Afyx yang berubah dapat
direpair otomatis; USER/foreign tetap ditolak.

## Afyx Graph Technical Alpha

Afyx Graph saat ini merupakan Technical Alpha prerelease, bukan Stable v1. Installer memilih artifact berdasarkan versi, channel, OS, dan arsitektur; memverifikasi SHA-256 dan staged identity; lalu memasang secara transaksional. Jika release yang cocok tidak tersedia atau cache/release gagal verifikasi, installer dapat menjalankan `npm ci`, clean build, packaging, dan checksum otomatis dari checkout Git tervalidasi. Windows menggunakan packaging PowerShell native—Bash/WSL tidak diperlukan.

Identitas artifact juga mencatat source revision/build identity dan extraction version. Cache lokal dengan semver yang sama tetapi revision berbeda diklasifikasikan sebagai valid-but-stale dan tidak dipasang diam-diam. Archive eksternal tanpa revision terverifikasi tetap dilaporkan `UNKNOWN`. `-ValidateOnly` / `--validate-only` membandingkan runtime terpasang dengan checkout tanpa mengubah keduanya; revision drift dilaporkan sebagai `UPDATE AVAILABLE — REVISION MISMATCH`.

Gunakan `-Offline` / `--offline` untuk mencegah self-update/lookup jaringan dan memakai cache/fallback Graph lokal. Karena Prompt Master dimiliki upstream dan tidak dibundel, action install/update Prompt Master ditolak dalam mode offline. Gunakan `-NoBuildFallback` / `--no-build-fallback` untuk gagal tegas bila artifact tidak tersedia. Source dirty ditolak untuk fallback; `-AllowDirtySource` / `--allow-dirty-source` adalah opt-in eksplisit yang harus dipakai hanya saat provenance perubahan lokal telah dipahami.

## Ownership, backup, dan pemulihan

Skill yang dipasang oleh Afyx memiliki `.afyx-install.json` berisi identitas komponen dan digest konten. Update, repair, dan uninstall memverifikasi containment canonical, menolak symlink/reparse point, lalu membedakan target Afyx yang tidak berubah, target Afyx yang telah dimodifikasi, integrasi upstream tervalidasi, dan target asing/tidak terbukti. Target modified/foreign dipertahankan secara default; replacement memerlukan action komponen eksplisit atau `-Force`/`--force`. Uninstall selalu menolak target yang ownership-nya tidak dapat dibuktikan.

Backup skill disimpan di `${AFYX_BACKUP_ROOT}` bila diatur, atau secara default di `~/.afyx/backups/<component>/`, bukan di checkout kit. Batas default adalah 20 backup per komponen (`AFYX_BACKUP_LIMIT`); saat batas tercapai operasi berhenti tanpa menghapus backup lama. Pemulihan manual dilakukan dengan menyalin direktori backup pilihan kembali ke skill root ketika target tidak ada. Jika proses terputus setelah target lama dipindah, retry memulihkan `.<component>.afyx-old` secara otomatis; keadaan ambigu dengan target baru dan recovery path sekaligus dihentikan untuk inspeksi manual.

Instalasi legacy sebelum marker dapat diadopsi secara eksplisit per komponen dengan `-ComponentAction efficient-coding=adopt` / `--component efficient-coding=adopt` (gunakan ID `odoo-engineering` atau `prompt-master` untuk komponen lain). Jalankan `-WhatIf` / `--dry-run` lebih dahulu untuk preview read-only. Adoption hanya menambahkan metadata setelah provenance cocok dan backup diverifikasi; isi skill tidak diganti, di-upgrade, atau dihapus. Efficient Coding/Odoo Engineering harus cocok byte-for-byte dengan digest distribusi historis 1.1.0. Prompt Master 1.8.0 harus berupa checkout Git bersih pada origin resmi dan revision allowlist tepat—nama/version saja tidak cukup. Afyx Engineering Expert 0.1.0 tidak memiliki distribusi legacy dan tidak dapat diadopsi. State `MODIFIED`, `FOREIGN`, `UNKNOWN`, path tidak aman, atau backup gagal selalu ditolak; `-Force` / `--force` bukan pengganti verifikasi adoption.

Prompt Master tetap dimiliki upstream dan tidak dibundel. Default acquisition dipin ke commit yang tercatat di `scripts/components.json`; installer fetch commit tersebut, memverifikasi `HEAD`, struktur skill, remote, dan clean state sebelum promosi. Perubahan revision harus berupa perubahan contract yang direview. Mode offline tidak mengklaim dapat memasang/update komponen ini.

## Integritas dan trust artifact

`SHA256SUMS` membuktikan integritas byte, bukan identitas publisher. `RELEASE-MANIFEST.json` mengikat digest platform ke target, versi, dan source commit; release workflow juga menerbitkan GitHub build-provenance attestations. Jika GitHub CLI tersedia saat instalasi release, attestation diverifikasi dan metadata melaporkan `GITHUB_ATTESTED`. Tanpa verifikasi independen, instalasi tetap melaporkan `PublisherAuthenticity: UNVERIFIED`; archive eksternal tanpa manifest dilaporkan `MISSING`/`UNVERIFIED`, bukan authenticated. `-ValidateOnly`/`--validate-only` menampilkan status manifest, publisher authenticity, dan build provenance terpasang.

## Verifikasi

Jalankan `./verify.ps1` pada Windows atau `./verify.sh` pada Linux/macOS. Core environment valid jika tersedia Codex CLI, ekstensi ChatGPT/Codex VS Code, atau keduanya. Verifier juga memeriksa tiga skill core serta melaporkan Headroom CLI, proxy/provider routing, dan MCP sebagai capability optional yang terpisah. Semua pemeriksaan bersifat read-only; absennya capability optional tidak menyebabkan core readiness gagal.

Jika Afyx Graph dipilih, installer dapat mendaftarkan MCP melalui antarmuka native `codex mcp` dengan entry point Node absolut dari runtime terpasang. Registrasi ini consented, idempotent, dan tidak menulis TOML sendiri. Entry Afyx-owned yang stale dapat diperbarui secara terkendali; entry yang conflicting atau tidak terbukti Afyx-owned dipertahankan dan dilaporkan. Gunakan `-SkipGraphMcp` / `--skip-graph-mcp` untuk melewati integrasi. Verifier membedakan `GRAPH_INSTALLED`, `CLI_REACHABLE`, `MCP_NOT_CONFIGURED`, `MCP_CONFIGURED`, `MCP_REACHABLE`, `MCP_BLOCKED`, dan `MCP_HANDSHAKE_FAILED` melalui initialize + tools/list nyata.

Untuk diagnosis project, `afyx-graph status` dan `afyx-graph status --json` menampilkan dimensi terpisah: Git freshness, pending filesystem/content changes, extraction completeness, extraction-version compatibility, pending references, watcher state, dan accounting full-index terakhir. Viewer menampilkan kontrak Index Health yang sama. `ignored: null` berarti path ignored tidak dienumerasi—bukan hitungan nol. Alasan skip seperti `size_exceeded` dan timing fase hanya muncul bila telah direkam oleh full index; nilai lama/tidak tersedia tidak direka sebagai nol.

Untuk inventory struktural yang harus exhaustive dalam scope terindeks, gunakan `afyx-graph inventory <declaration> <value> --scope <path>` atau default MCP `afyx_graph_inventory`. Operasi ini berbeda dari ranked search/explore: hasil melaporkan total declaration/file/module, pagination, unresolved expression, serta coverage stale/failed/skipped/unsupported/ignored. Page terbatas tidak pernah dilabeli complete. Fakta Python class assignment adalah static source evidence dan bukan Odoo runtime registry.

## Odoo Engineering 10–20 stable

Odoo Engineering 1.2.0 dipasang bersama Efficient Coding. Referensi Odoo 10–20 berstatus stable, tetapi Odoo 20 tetap memerlukan evidence exact 20.0 sebelum perilaku spesifik versi digunakan. Saat task Odoo dimulai, skill menentukan versi dari repository lalu memuat reference yang sesuai untuk mencegah penerapan API lintas-versi tanpa verifikasi. Jika strong source/runtime evidence tidak tersedia, pemilihan versi memerlukan dua supporting signal independen; konflik dibiarkan unresolved sampai ada bukti lebih kuat.

Untuk perubahan code, skill memeriksa inheritance/`super`, perilaku multi-record dan batching, security layers, XML inheritance, serta persisted identifier sesuai boundary yang terdampak. Pertanyaan penjelasan sederhana tidak memicu investigasi repository yang berat bila versi tidak material.

Kedua skill memakai frontmatter Agent Skills dengan `name`, `description`, dan `metadata.version`. Entrypoint tetap ringkas; detail kondisional dimuat dari `references/` hanya saat routing task membutuhkannya.

Efficient Coding 1.2.0 memakai loop `GROUND → LOCATE → REPRODUCE → CHANGE → VALIDATE → REPORT`, validasi berbasis risiko, dan routing tool selektif. Afyx Graph dipakai hanya untuk relasi struktural yang material; fallback selalu inspeksi source langsung dan tidak pernah dependency graph eksternal yang sudah deprecated. Versi ini tidak mengubah provenance adoption historis 1.1.0.

## Afyx Engineering Expert 0.1.0 (opsional)

Pasang secara eksplisit dengan `./install.ps1 -ComponentAction afyx-engineering-expert=install` atau `./install.sh --component afyx-engineering-expert=install`. Setelah membuka sesi Codex baru, panggil standalone dengan menyebut `afyx-engineering-expert` untuk product discovery, requirements, architecture, security review, incident/reliability, AI/data, atau koordinasi ERP yang substantif.

Skill ini tetap satu orchestrator adaptif: pilih satu domain utama dan mula-mula paling banyak dua domain pendukung, lalu muat hanya reference/workflow yang relevan. Untuk implementasi/debugging, ia berkomposisi dengan Efficient Coding; untuk Odoo, ERP expert menangani arsitektur proses sedangkan Odoo Engineering tetap otoritatif untuk detail teknis versi-spesifik. Afyx Graph bersifat opsional dan tidak menjadi activation dependency. Prompt Master tetap independen dan upstream-owned.

Folder skill yang sama tetap kompatibel sebagai ZIP berisi satu top-level folder untuk lingkungan ChatGPT yang memang menyediakan upload Skills. Installer Kit hanya memasang ke Codex CLI/VS Code skill root; ia tidak memasang atau mengaktifkan skill di ChatGPT secara otomatis.

## Saat skill sudah ada

| Kondisi | Perilaku default | Opsi aman |
|---|---|---|
| Komponen Afyx sehat/current | Skip | Pilih Update hanya bila diperlukan |
| Komponen Afyx incomplete/invalid | Skip + warning | Pilih Repair untuk staged replacement dengan backup |
| Skill legacy tanpa marker | Skip + status UNKNOWN | Preview lalu pilih Adopt; hanya provenance `MATCH` yang diterima |
| Prompt Master memiliki perubahan lokal | Skip dan laporkan dirty state | Pilih Replace secara eksplisit; backup lokal dipertahankan |
| Afyx Graph belum terpasang | Skip | Pilih Install; runtime dipasang ke `~/.afyx/graph/` |

## Konfigurasi Codex yang sengaja tidak diubah

Installer tidak memodifikasi `auth.json`, Headroom, plugin, sandbox, model, provider, atau MCP server lain. Hanya ketika integrasi Graph dipilih, installer meminta Codex CLI mengelola entry MCP Afyx-owned; entry conflicting/unproven tidak ditimpa. Afyx Graph memasang runtime mandiri dan CLI `afyx-graph` di `~/.afyx/graph/`; Headroom tetap eksternal dan hanya dideteksi. Project state memakai `.afyx-graph/` (database `afyx-graph.db`); direktori state lain tidak dibaca atau diubah.

## Pembaruan

`./update.ps1` atau `./update.sh` terlebih dahulu mencoba memperbarui checkout kit sendiri dengan `git pull --ff-only`, lalu menggunakan state/version untuk memilih update; tidak ada blanket force replacement. Action eksplisit tetap dapat diberikan per komponen. Worktree dirty menghentikan updater sebelum installer dijalankan; gunakan `git status` untuk menangani perubahan atau `-SkipSelfUpdate` / `--skip-self-update` untuk secara sengaja memasang current checkout.

## Penghapusan

`./uninstall.ps1` atau `./uninstall.sh` menghapus skill Afyx yang ownership-nya terverifikasi, termasuk Efficient Coding, Odoo Engineering, dan Afyx Engineering Expert bila terpasang. Gunakan `./uninstall.ps1 -Component afyx-engineering-expert` atau `./uninstall.sh --component afyx-engineering-expert` untuk menghapus hanya Expert tanpa menyentuh skill Afyx lain. Prompt Master hanya dihapus saat opsi `-RemovePromptMaster` atau `--remove-prompt-master` disebut secara eksplisit. Uninstaller dapat menghapus runtime Afyx Graph milik Afyx, tetapi tidak menghapus konfigurasi Codex atau state `.afyx-graph/` milik project.

## Pemulihan

Skill/runtime yang di-update atau di-repair dibuat melalui staging dan backup. Checksum, extraction, staged metadata, CLI `--version`, atau `help` yang gagal menyebabkan runtime sebelumnya dipulihkan. Perubahan entry MCP Afyx-owned menggunakan backup/restore native CLI; index project `.afyx-graph/` tidak diubah. Backup skill yang berhasil diganti tersedia di `backups\` bila pemulihan manual diperlukan.
