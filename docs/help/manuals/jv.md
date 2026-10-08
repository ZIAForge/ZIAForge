<!-- Generated from docs/help/en.json; source SHA-256 910098d2b61e07851b0a1433429a6bf1ee342749ea1fdc4885d1e63afda3cd7f. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: jv; served locale: jv; status: machine-translated. -->
# Pandhuan pangguna ZIAForge

Saka kekarepan nganti asil sing wis diverifikasi. Pandhuan praktis kanggo Code, Work lan kendhali aplikasi.

Basa Inggris minangka babon resmi (kanonik). Pitulung asil jarwan mesin diwenehi tandha kapisah saka jarwan sing ditlusuri manungsa. Pemriksan otomatis ora njamin katitising basa asline.

> Pandhuan iki diterjemahake nganggo mesin saka sumber basa Inggris saiki. Tinjauan manungsa tetep ditampa kanthi seneng.

## Bagean pandhuan

- [Langkah-langkah wiwitan](#start)
- [Pasang paket desktop sing bener](#install-platforms)
- [Code: limang rute](#code)
- [Rembugan Forge](#forge)
- [Dhokumen lan kaputusan](#decisions)
- [Eksekusi lan panyemakan](#execution)
- [Tim panyemak paralel lan arsitek laporan](#review-teams)
- [Spesialisasi agen lan kawicaksanan pituduh](#specializations)
- [Work: saka pitakon menyang dhokumen](#work)
- [Prasetel, model lan akses](#models)
- [Obrolan, Stop lan antrean](#chat)
- [Berkas, Git lan pungkasan](#files)
- [API connections](#api)
- [Setelan, basa lan reset aman](#settings)
- [Takon marang asisten Pitulung](#help-assistant)
- [Asisten lan Telegram](#assistant-control)
- [Operasikake bot Telegram pribadi panjenengan](#telegram)
- [Izin komputer asli mung-pamilik](#native-permissions)
- [Panjlajah lan instansi kadohan](#remote)
- [OpenClaw, Hermes, lan agen eksternal liyane](#external-agents)
- [CLI lokal lan watesan otomatisasi](#local-cli)
- [Versi lan pembaruan](#updates)
- [Mulai maneh lan pemulihan](#restart)
- [Pamecahan masalah](#troubleshooting)
- [Laporke masalah lan priksa bukti](#diagnostics)
- [Data lokal lan watesan](#privacy)
- [Pahami lan owahi proyek sumber mbukak iki](#project-contributors)

<a id="start"></a>

## Langkah-langkah wiwitan

ZIAForge njaga rembugan, perencanaan, eksekusi, lan verifikasi ing siji tugas. Pilih Code kanggo proyek Git, utawa Work kanggo dhokumen, riset, lan asil liyane ing folder biasa.

Wiwiti nganggo tugas cilik ing proyek kapisah. Yen sampeyan milih CLI asli, pasang lan mlebu log nganggo akune dhewe ing terminal dhisik. Utawa, atur sambungan API. Langganan CLI lan API mbayar minangka cara sambungan sing kapisah; ZIAForge ora mlebu log kanggo sampeyan utawa mindhah kredit ing antarane kabeh mau.

1. Bukak Setelan banjur priksa folder ruang kerja lan basa. Babagan nuduhake idhentitas pas saka rilis sing lagi mlaku.
2. Kanggo Code, tambahake repositori Git ing bilah sisih. Kanggo Work, pilih folder kapisah nalika nggawe tugas.
3. Simpen prasetel nganggo CLI, model, bobot pamikiran (reasoning effort), lan tingkat akses. Sampeyan uga bisa milih Custom langsung tanpa prasetel sing disimpen.
4. Gawe tugas, pilih rute, peran, lan pamajuan manual utawa otomatis. Priksa pilihan sadurunge Pencet Wiwiti.

> Gunakake artefak lan checksum sing diwenehake dening pangreksa (maintainer). Pratayang bisa uga ora ditandatangani utawa ora duwe umpan nganyari sing diterbitake. Dhukungan desktop lan panyedhiya asli kudu diverifikasi kanggo OS, arsitektur, lan artefak sing pas; dhukungan kode sumber dhewe dudu sertifikasi rilis.

Pituduh gegandhengan: [Ringkesan proyek](../../../README.md) · [Kesesuaian panyedhiya](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Pasang paket desktop sing bener

Pilih paket kanggo sistem operasi lan arsitektur CPU sampeyan: x64 utawa arm64. Saluran pambangunan (build pipeline) bisa ngasilake format macOS DMG/ZIP, Windows NSIS installer/ZIP, lan Linux DEB/RPM/AppImage/tar.gz/ZIP. Berkas sing diasilake utawa cross-build dudu bukti yen installer lan UI asline lulus ing mesin sampeyan; priksa cathetan verifikasi rilis kasebut.

Rilis macOS sing nggunakake Electron 44 mbutuhake macOS 13 utawa luwih anyar. Gunakake paket arm64 ing Apple Silicon lan paket x64 kanggo Intel. Metu babar blas saka aplikasi lawas sadurunge ngganti. Paket pratayang bisa uga ora ditandatangani lan ora dinotarisasi; aja kliru nganggep artefak pangembangan minangka rilis umum sing ditandatangani.

Windows mbutuhake sistem operasi sing didhukung dening versi Electron bawaan lan Git kasedhiya ing PATH. Pilih arsitektur sing cocog. Pratayang sing ora ditandatangani ora duwe sertifikasi Authenticode. ZIP portabel kudu ngemot direktori aplikasi lan berkas runtime sing jangkep, ora mung berkas sing bisa dieksekusi.

Linux mbutuhake desktop grafis sing cocog, pustaka sistem sing dibutuhake dening Electron, lan Git. Kanggo kredensial kendhali sing dienkripsi, sedhiyakake Secret Service sing makarya kaya gnome-libsecret utawa KWallet; backend basic_text sing ora aman ora ditampa. Bukti tes asap (smoke test) ing headless/kontainer ora menehi sertifikasi kanggo saben desktop utawa distribusi.

Pasang DEB nganggo apt install ./file.deb, utawa pasang RPM liwat manajer paket distribusi sampeyan. AppImage mbutuhake idin eksekusi lan dhukungan FUSE sing cocog; --appimage-extract-and-run minangka alternatif yen didhukung. Ekstrak paket tar.gz lan ZIP bebarengan karo kabeh berkas runtime. Pisahake data pangguna lan berkas aplikasi nalika ngganti paket.

Kanggo mbangun saka sumber (source), gunakake Node 24, Git lan npm ci, kalebu installer Electron normal. Mbangun maneh modul asli mbutuhake piranti platform: Xcode command-line tools ing macOS; MSVC C++, Windows SDK lan Python ing Windows; compiler, make, Python, pkg-config lan piranti packaging sing dibutuhake ing Linux. Tinduti PLATFORM_BUILDS.md kanggo préntah pas lan watesan platform saiki.

Versi rilis diatur sacara pusat lan asile ora bisa diowahi (immutable). Pambangunan verifikasi CI dudu installer sing diterbitake. Arsip kode sumber ngemot kode sumber, lockfile, dokumentasi, lan skrip; dependensi, kredensial, profil pangguna, lan riset pribadi ora kalebu. Aja tau nyimpulake validasi asli ARM utawa Windows mung saka pambangunan x64 sing sukses.

Pituduh gegandhengan: [Paket platform, prasyarat lan watesan verifikasi](../../PLATFORM_BUILDS.md) · [Idhentitas rilis lan pamriksan rilis](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: limang rute

Auto mbiji cakupan: pitakon prasaja bisa rampung kanthi wangsulan, dene tugas sing luwih gedhe mbutuhake persiapan. Dandani bug nliti sebab lan nyiapake pambeneran. Spec dhisik diwiwiti saka solusi teknis; Requirements dhisik diwiwiti saka syarat lan kritéria panampa.

Multi-model nggunakake konteks kapisah kanggo eksplorasi, desain, implementasi, lan panyemakan. Jeneng rute ora mbutuhake panyedhiya sing beda: saben peran nggunakake prasetel utawa konfigurasi Custom sing sampeyan pilih.

Worktree ngisolasi pangowahan Git sawijining tugas. Branch makarya ing checkout sing dipilih. Priksa proyek, branch, lan model sadurunge miwiti; katrangan tugas ora dikirim menyang obrolan biasa.

Kanggo gagasan sing pilihan produk utawa teknise durung rampung, gunakake Requirements dhisik lan bangun dhasare ing rembugan. Auto nggolongake panyuwunan; iki dudu préntah kanggo langsung nindakake saben frasa cendhak. Simpen draf bakal nahan panyuwunan tanpa ngubungi model; Start nyimpen lan mbukak alur sing dikelola sapisan. Siji nganti patang salinan tugas duwe ID panggawéan lan setelan peran sing mandhiri.

Pituduh gegandhengan: [Kontrak alur kerja Code](../../WORKFLOWS.md) · [Profil pituduh Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Rembugan Forge

Start mbukak rembugan pusat. Wangsulana kanthi alami, wenehana pitakon walik, tambahake watesan, lan rembugan pilihan teknis. Pacelathon lan pitakon tetep ana ing tugas kasebut.

Ngirim teks ora ateges nampa dhokumen utawa menehi wewenang rencana implementasi anyar. Klarifikasi sajrone eksekusi bakal ngaso giliran sing dikelola dhisik lan nliti maneh cakupan sing kena pengaruh. Wangsulan kanggo pitakon ing sajroning langkah sing wis ditampa bisa nerusake langkah kasebut.

Kanggo nliti maneh dhasar kanthi sengaja, pilih Requirements, Specification, utawa Planning. Versi anyar mbutuhake panampa anyar kanggo kaputusan-kaputusan sing gumantung. Langkah-langkah sing wis rampung lan buktine tetep ana; fase sing durung rampung nanging wis diganti tetep disimpen ing riwayat.

Sesi fase sing dikelola beda karo obrolan bebas. Gunakake rembugan Forge tinimbang ngirim pituduh manual langsung menyang sesi sing diduweni alur kerja.

Pituduh gegandhengan: [Kontrak rembugan Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Dhokumen lan kaputusan

Bukak dhokumen, priksa versine, lan owahi yen perlu. Ngirim modifikasi liwat rembugan bakal ngasilake versi anyar; laporan lan asil sing wis diverifikasi ora ditulis maneh kanthi surut.

Sadurunge nampa rencana sing diusulake, owahi urutan, pandhuan, kritéria panampa, lan préntah verifikasi. Wenehi wewenang mung marang préntah konkrit sing sampeyan mangerteni: préntah kasebut mlaku ing folder tugas. Multi-model ngusulake siji langkah implementasi kanggo kabeh tugas, kanthi rincian ing dhokumen lan pandhuane.

Sarujuk minangka kaputusan kapisah sing disengaja. Auto ora ngliwati pitakon utawa panampa syarat, spesifikasi, lan rencana. Dhokumen sing owah saka njaba ora bisa nggunakake maneh persetujuan lawas.

Berkas persiapan katon minangka artefak. Versi, fase sing ngasilake, lan hash naleni artefak menyang sawijining asil. Dhokumen Code disimpen ing sanjabane worktree lan ora otomatis mlebu menyang commit.

Priksa dhokumen lan kaputusan sing ditampilake sadurunge nampa. Panampa naleni ID gapura saiki, revisi rencana, lan hash dhokumen sing disimpen. Nyuwun owah-owahan yen cakupan utawa bukti salah. Yen kaputusan dadi kadaluwarsa, amot maneh kahanan sing disimpen sadurunge nggawe pilihan anyar; berkas sing wis owah ora bisa ditampa ing versi sadurunge.

Pituduh gegandhengan: [Gapura alur kerja lan versi dhokumen](../../WORKFLOWS.md).

<a id="execution"></a>

## Eksekusi lan panyemakan

Daftar ayahan nuduhake langkah nyata, upaya saiki, asil verifikasi, lan asil panyemakan. Agen sing ngomong "rampung" ora ateges langkah wis rampung: bukti sing dibutuhake rencana kudu ana.

Mode manual mandheg sauntara ing antarane langkah-langkah sing cocog. Auto nerusake langkah-langkah sing wis diverifikasi lan ngidini nyoba maneh kanthi winates. Mandheg sawise tansah nggawe titik pamriksan. Ngaso mandhegake pakaryan aktif alur kerja; nutup panel ora bakal mandhegake pakaryan kasebut.

Penelaah mandhiri nggunakake konteks kapisah sing ngemot berkas lan asil verifikasi. Saben temuan pamblokir sing dibutuhake kudu dirampungake; sawetara penelaah ora bisa mbuwang kaluputan pamblokir liwat voting.

Ing Multi-model, mbenerake temuan mbutuhake kaputusan sing cetha. Pambeneran ora miwiti panyemakan liyane kanthi meneng-menengan: Telaah maneh mbukak siklus anyar. Komentar panyemakan bisa njaluk pertimbangan maneh saka koordinator tanpa mbaleni implementasi.

Langkah sing wis rampung ora bisa diowahi kanthi meneng-menengan. Kanthi TDD, Abang kudu bener-bener gagal amarga sebab sing diarepake, banjur Ijo kudu lulus. Cacahing nyoba sing winates nyegah upaya balen tanpa pungkasan.

Simpen penelaah CLI/API mandhiri ing Setelan → Tim panyemak, banjur pilih tim kasebut ing Code utawa Work. Penelaah mlaku kanthi bebarengan (paralel), banjur diterusake dening arsitek laporan tim. Sampeyan uga bisa ngatur penelaah mandhiri tanpa tim sing disimpen. Arsitek laporan mung nampa laporan terstruktur anonim, tanpa berkas proyek utawa piranti; isolasi iki saiki mbutuhake Claude Code utawa API.

Saben langkah implementasi mbutuhake pamriksan sing bisa dieksekusi, panyemakan mandhiri sing diwajibake, utawa loro-lorone. Fase persiapan mung nyimpen asil sing divalidasi lan resi artefak; iki ora pura-pura yen tes implementasi wis lumaku. Préntah dianggep sukses mung yen status metu sejatine lan reresik proses duweke wis dikonfirmasi. Pamriksan Abang kanggo TDD kudu gagal kanthi normal sadurunge implementasi lan verifikasi Ijo; eksekusi sing ilang utawa wektu entek (timeout) dudu asil Abang sing sah.

Pambatal otomatis gawan bakal mandheg sawise kaping telu gagal ing siji langkah utawa seket upaya sakabehe. Gangguan nggunakake siji jatah upaya nanging ora dianggep minangka upaya gagal. Watesan lan bukti sing wis rampung tetep ana sanajan diwiwiti maneh; Nyoba maneh ora ngreset kabeh mau. Waca kagagalan sing disimpen sadurunge menehi idin kanggo nyoba maneh.

Pituduh gegandhengan: [Verifikasi lan panyemakan](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Tim panyemak paralel lan arsitek laporan

Bukak Setelan → Tim panyemak lan simpen tim. Tambahake penelaah mandhiri kanthi CLI utawa API, model, bobot pamikiran, lan spesialisasine dhewe, banjur pilih arsitek laporan. Pilih tim kasebut ing konfigurasi panyemakan tugas. Prasetel eksekutor uga bisa digunakake dening penelaah, lan Custom tetep kasedhiya; peran mandhiri tetep duwe konteks kapisah.

Penelaah mlaku kanthi bebarengan ing bukti tugas sing padha. Saben laporan, kaluputan, lan kaputusan sing dibutuhake bakal disimpen. Arsitek nampa laporan kanthi nomer anonim tanpa jeneng penelaah, idhentitas model utawa panyedhiya, isi tugas asli, akses repositori, utawa piranti. Arsitek mbandhingake laporan lan ngasilake siji kaputusan terstruktur; arsitek ora nindakake panyemakan kode sumber anyar.

Temuan pamblokir utawa panolakan penelaah sing diwajibake ora bisa diilangi liwat swara mayoritas utawa pilihan arsitek. Laporan sing ilang utawa salah format bakal nyegah persetujuan. Priksa temuan individu lan kaputusan gabungan sadurunge nampa utawa menehi idin kanggo pambeneran. Tim sing disimpen bakal ditemtokake lan dibekukake kanggo pamlayuan kasebut; ngowahi prasetel tim ora nulis maneh bukti sing wis rampung.

Arsitek mung-laporan saiki nggunakake konfigurasi bebas-piranti Claude utawa API sing didhukung. Codex lan Antigravity tetep kasedhiya minangka penelaah nanging ditolak kanggo peran arsitek sing diisolasi iki nganti ana kontrak bebas-piranti sing diverifikasi. Pituduh sing mung muni "tanpa piranti" ora cukup.

> Saluran desain/panyemakan Multi-model Code lan tim panyemak paralel sing disimpen minangka kendhali kapisah. Tetep gunakake kawicaksanan panyemakan khusus sing dipilih; aja nganggep siji rute bakal ngaktifake saben fitur panyemakan.

Pituduh gegandhengan: [Konfigurasi tim kanthi tipe](../../../shared/review-team.ts) · [Panggabungan panyemakan](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Spesialisasi agen lan kawicaksanan pituduh

Model minangka mesin eksekusi; spesialisasi minangka profil pandhuan. Pilih Ora ana kanggo tanpa tambahan spesialisasi, Standar kanggo pandhuan gawan, Auto kanggo pandhuan bawaan sing cocog, utawa Manual kanggo pandhuan sing dipilih lan pandhuan winates sampeyan dhewe. Prasetel bisa nyimpen pilihan kasebut.

Katalog asli nyakup pamrograman umum, arsitektur, keamanan, keandalan, performa, pangujian, lan kegunaan antarmuka. Auto nggunakake teks tugas/langkah sing kasedhiya kanggo milih pandhuan; pilihan iki ora kanthi meneng-menengan nelpon model liya utawa njamin keahlian. Usulan perencanaan bisa dipriksa lan diowahi sadurunge nampa rencana implementasi.

Spesialisasi panyemakan mbantu ngarahake kawigaten nanging ora nate ngganti bukti mandhiri, watesan akses, utawa kaputusan terstruktur. Anggep pandhuan khusus minangka bagean saka cakupan tugas: aja nggunakake pandhuan kasebut kanggo ngliwati panampa dhokumen, kawicaksanan piranti, otentikasi, utawa kagagalan penelaah.

Pituduh gegandhengan: [Katalog pituduh asli](../../../shared/specializations.ts).

<a id="work"></a>

## Work: saka pitakon menyang dhokumen

Work ora mbutuhake Git. Gawan nggawe folder tugas kapisah; Custom milih folder sing wis ana liwat pamilih asli. Simpen draf nyimpen setelan tanpa inferensi; Start nglakokake fase kapisan.

Auto mangsuli langsung utawa ngusulake rencana sing cocog kanthi Daftar ayahan nyata. Brainstorm nggawe ideas.md sadurunge sampeyan milih luwih akeh gagasan utawa evaluasi. Research nyimpen findings.md, sumber, lan watesan. Write lumaku saka niyat lan, yen migunani, outline.md menyang dhokumen deskriptif utawa draft.md; revisi tetep nyimpen versi sadurunge.

Pilih input berkas liwat pamilih asli lan rujuk nganggo @. Aplikasi nyalin minangka input tugas sing ora bisa diowahi lan mvalidasi idhentitase sadurunge mlaku. Gawan nggawe folder tugas kagungane aplikasi; akses folder Custom minangka idin pamilik sing disimpen. Draf sing wis disimpen nanging durung diwiwiti bisa ngowahi foldere.

Gawe 1 nganti 4 salinan kanthi setelan eksekutor sing mandhiri. Tugas sing nggunakake folder tumpang tindih ora bisa nulis kanthi bebarengan. Koordinasi iki mung ditrapake kanggo operasi ZIAForge, dudu program eksternal liyane.

Deep Brainstorm kanthi gawan nggunakake telung buruh mandhiri lan nyengkuyung nganti wolung buruh. Pilih urutan lan konfigurasine, kalebu nggunakake maneh prasetel ing konteks kapisah. Pitakon buruh tetep nyimpen asale; laporan sing salah format entuk kesempatan ndandani format sapisan. Kagagalan sebagean tetep katon tinimbang ditampilake minangka suksès mutlak.

Deep nggabungake laporan buruh sing disimpen dadi brainstorm_report.md lan tansah njaluk kaputusan pangguna. Tindak lanjut cilik bakal mbenakake laporan liwat koordinator; pangowahan gedhe bakal miwiti babak liyane kanggo buruh sing wis dibekukake. Artefak tetep njaga versine dhewe-dhewe.

Peran sing wis ditemtokake bakal dibekukake nalika panggawéan tugas utawa panyimpenan draf kanthi cetha. Sawise panggilan pisanan, mung pamajuan otomatis/manual sing bisa diowahi; gunakake tugas anyar kanggo setelan peran utawa model sing beda. Ngowahi prasetel global ora bakal ngowahi fase sabanjure kanthi meneng-menengan.

Mode manual mandheg sauntara ing antarane fase sing cocog, kalebu cengkorongan Write sing jembar. Auto bisa nerusake liwat cengkorongan kasebut. Pitakon, rencana eksekusi sing diusulake, arah Brainstorm, lan panyemakan laporan Deep tetep dadi kaputusan sing cetha sanajan ing Auto. Sitiran wae ora mbuktekake manawa panjlajahan web bener-bener kedadeyan, lan berkas biner sing disimpen wae ora mbuktekake pambabare.

Pituduh gegandhengan: [Mode lan kaputusan Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Prasetel, model lan akses

Prasetel nyimpen CLI/API, model, bobot pamikiran (reasoning effort), lan idin. Footer obrolan duwe bagean prasetel, CLI, model, lan pilihan. Custom bisa mlaku tanpa prasetel; Nggawe prasetel nyimpen pilihan saiki.

Katalog asale saka CLI utawa API sing wis dipasang lan dipilih yen didhukung. Segerake bakal nganyari dhaptar tanpa ngowahi pilihan. Yen panemuan ora kasedhiya, lebokake ID model kanthi cetha; panyedhiya tetep kudu nyengkuyung model kasebut. Tingkat panalaran gumantung marang model lan CLI. Gawan panyedhiya beda karo token none sing cetha.

Terapake owah-owahan mung sawise ana pangakon saka backend. Pilihan ora bisa diganti sajrone giliran aktif utawa antrean sing ora kosong. Draf lan riwayat sing katon tetep ana, nanging ngowahi panyedhiya ora bakal mindhah kahanan internal pribadine.

Ing Forge, label peran iku penting: persiapan bisa nggunakake Perencana (Planner) kapisah. Footer ngowahi peran sing ditampilake; penelaah lan pambiyantu dipilih ing setelan alur kerja. Kawicaksanan kanggo implementasi sing wis diverifikasi bisa uga dikunci.

Hak akses beda-beda ing antarane panyedhiya. Mung waca lan Tulis ruang kerja kasedhiya yen didhukung dening adaptor. Antigravity nggunakake setelan CLI asli utawa akses jangkep sing dipilih kanthi cetha. Akses jangkep dudu sandbox.

Spesialisasi nambahake pandhuan pituduh, dudu model utawa hak akses liyane. Prasetel lan peran nyengkuyung Ora ana, Standar, Auto, lan Manual. Auto milih profil saka teks langkah tanpa panyuwunan model tambahan; Manual nampa nganti patang spesialisasi lan pandhuan khusus. Tugas sing diusulake Perencana bisa diowahi sadurunge nampa rencana kasebut.

ID model utawa tingkat penalaran sing dilebokake manual tetep dadi pilihan sampeyan, nanging panyedhiya bisa nolak. Ngowahi prasetel global ora ngowahi obrolan sing lagi mlaku utawa rencana sing wis ditampa kanthi surut. Kanggo ngowahi pacelathon sing lagi nganggur kanthi sengaja, gunakake kendhali konfigurasine dhewe lan enteni pangakon. Pilihan sing dipateni kudu dianggep minangka watesan kemampuan utawa siklus urip, aja diliwati kanthi ngowahi JSON sing disimpen.

Pituduh gegandhengan: [Kemampuan panyedhiya](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Obrolan, Stop lan antrean

Tab mbukak, Anyar, lan draf kalebu ing siji tugas. Nutup tab mbusak saka Mbukak nanging tetep nyimpen ing Anyar lan ora mandhegake proses panyedhiya utawa alur kerja sing dikelola. Golèki riwayat, bukak maneh obrolan, utawa tutup kabeh tab tambahan saka menu riwayat.

Stop ngganggu (ngendhegake) giliran saiki. Enteni nganti proses mandheg rampung sadurunge Kirim sabanjure: pangakon interupsi dudu tandha yen proses wis rampung. Sampeyan bisa ngetik draf sabanjure sauntara kuwi.

Ing obrolan biyasa, Antrean nyimpen panyuwunan sabanjure kanthi kapisah saka draf saiki. Ngaso antrean bakal nahan pangiriman sabanjure. Stop lan Metu ngaso antrean. Sawise miwiti maneh, Terusake dhisik, banjur kanthi cetha Terusake antrean.

Ora mesthi tegese pangiriman ora dingerteni kahanane. Pesen kaya ngono ora dikirim maneh kanthi otomatis: priksa riwayat, salin teks yen perlu, lan buwang item sing ana ing antrean. Ngirim maneh minangka panyuwunan anyar sing disengaja.

Obrolan fase sing dikelola nggunakake alur kerjane dhewe, dudu antrean biasa. Tinduti tahap nuduhake fase saiki; milih tab liyane kanthi manual bakal mandhegake anggone ngetutake. Log CLI nuduhake diagnostik kanthi kapisah saka wangsulan.

Wangsulan Markdown nampilake judhul, dhaptar, tabel, pranala, lan blok kode. Kertu piranti lan diagnostik CLI tetep kapisah saka wangsulan. Pikiran lan metrik token sing dilaporake model mung katon yen panyedhiya pancen mbukak data kasebut; aja nyimpulake penalaran pribadi utawa panggunaan mung saka animasi.

Sawise pangiriman utawa pangakon antrean sing ora mesthi, priksa riwayat lan baleni mung panyuwunan sing padha sing disimpen yen ditawakake. Bukti panampa antrean tegese panyimpenan wis nampa item kasebut, dudu inferensi wis rampung. Mbusak item antrean sing ora mesthi mung minangka pambatalan sing cetha; tumindak iki ora bisa narik maneh pituduh sing wis dikirim.

Pituduh gegandhengan: [Antrean pesen tahan suwe](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Berkas, Git lan pungkasan

Berkas nuduhake folder tugas. Bandhingake asil karo syarat, bukak dhokumen, lan priksa prabedan (diff). Nyimpen berkas biner ora mbuktekake pambabar (rendering) sing bener ing aplikasi tujuane.

Git nyedhiyakake status, owah-owahan, lan operasi kanthi asil sing kecathet. Commit, gabung (merge), lan push lumaku manual kanthi gawan; operasi otomatis minangka pilihan kapisah kanggo rencana sing wis diverifikasi kanthi jangkep.

Aja ngowahi berkas kerja ing antarane wektu verifikasi lan publikasi: persetujuan kaiket karo bita (bytes) sing pas. Konflik, push sing gagal, lan asil operasi sing ora dingerteni bakal mblokir kamajuan nganti ana kaputusan sing cetha. Auto ora menehi idin publikasi kanthi meneng-menengan.

Work ora nggawe cabang Git lan ora duwe finalisasi Git. Simpen dhokumen sing dibutuhake saka folder sing dipilih, kalebu versi lan sumbere.

Editor berkas nyedhiyakake sintaksis adhedhasar ekstensi, golek lan ganti, riwayat batalaken (undo), pamotongan baris, lan draf saben tab. Nyimpen bakal njaga enkoding UTF-8/UTF-16 sing didhukung lan nolak konflik modifikasi saka njaba. Enkoding liyane lan konten biner mbutuhake editor eksternal. Draf sing durung disimpen nyegah Metu saka aplikasi nganti sing duwe nyimpen utawa mbuwang draf kasebut.

Sintaksis jangkep diaktifake nganti 8 MiB. Berkas teks sing luwih gedhe dibukak ing jendhela 256 KiB; 8–64 MiB bisa dimot kanthi jangkep kanthi cetha tanpa panyorot sintaksis. Ndhuwur 64 MiB nggunakake panyuntingan jendhela lan nggoleki asil cocog sabanjure sing winates. Iki minangka mode berkas gedhe sing winates, dudu pepadhan Sublime Text kanggo dhokumen gedhe tanpa wates.

Bukak folder nggunakake konteks tugas utawa cabang/worktree saiki, dudu mung mbukak repositori asli kanthi meneng-menengan. Baris berkas bisa nuduhake folder induk saka berkas kasebut. Path divalidasi dening backend adhedhasar idin tugas sing kadhaftar. Berkas biner ora bisa diedit minangka teks biasa; gunakake pamirsa tujuane lan jaganen bita asline.

Mbusak worktree minangka tumindak kapisah sing dijaga. Rampungake sesi terstruktur lan terminal sing kapekat sadurunge mbusak, kalebu sesi sing lagi nganggur. Priksa asil Git lan kahanan pemulihan sing disimpen; mbusak cathetan tugas dudu gantine ngreksa pakaryan sing durung di-commit kanthi aman.

Pituduh gegandhengan: [Kontrak editor terketik](../../../shared/editor.ts) · [Kawicaksanan Git](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> Pandhuan lengkap durung diterjemahake menyang basa tampilan sampeyan. Nampilake rujukan basa Inggris.

Connections adds an explicitly selected OpenAI-compatible endpoint. Enter a name, base URL, model and a key if needed. Select Chat Completions for existing integrations or Responses for function rounds, provider tool progress and generated images. Existing connections retain Chat Completions until you change them explicitly. For an existing connection, Set up Responses opens a draft for that same endpoint; review the profile and click Save connection. Choose Codex connector or Grok Connector v1 only for a gateway that supports that extension. The saved key is retained when the endpoint is unchanged and the key field stays blank.

HTTPS is required except for loopback HTTP. Use a plain endpoint without credentials, queries or fragments. Redirects are refused. Keys use supported OS encryption and are never returned to the UI. Changing the endpoint requires re-entering or clearing its key. Leaving the key field blank preserves a saved key.

Workspace file tools execute in the backend-resolved local task folder, with relative paths and checks against traversal and links. Every file write needs explicit approval and an unchanged expected revision. Read-only sessions expose only read tools. In Responses, Allow local commands separately enables approved executable/argument calls on macOS and Linux. Command supervision is unavailable on Windows; the adapter does not advertise that tool there. Commands always require owner approval and are not an operating-system sandbox.

The Codex connector profile identifies that gateway’s Responses tool-progress extension. Native provider tools execute on the server, separately from caller tools on your computer. Local read-only permissions do not constrain the server. A connector cannot be selected for a report-only architect that requires all tools disabled: unsupported isolation fails rather than silently allowing native tools. Select an endpoint that can enforce the required policy.

Generated PNG, JPEG and WebP results appear as separate image cards, with Save image, outside collapsed tool output. Images are validated and kept in private application storage; model-supplied URLs and Markdown images are not fetched automatically. Opening saved history, retrying an image read and saving a cached image do not request a new generation. Results are bounded to 32 MiB and 32 million pixels per image, with a 128 MiB private cache. Preserve needed images before manually clearing the private cache if it becomes full. Click a chat image to open the image viewer. Zoom in or out, choose Actual size (100%) or Fit to window, and drag to inspect a detail. Escape or Close image viewer returns to the chat. Viewing and zooming reuse the loaded private image; they do not request a new generation.

Responses conversations retain the acknowledged response identity and exact function call IDs. Interrupted inputs are not automatically resent. An uncertain local edit or command is not rerun after restart; preserve the history and explicitly create a new context after inspection. Changes to a saved transport or endpoint require explicit reconfiguration. Provider status, cancellation and expiry failures are reported without hiding them behind a CLI fallback. The chat header shows the protocol pinned to that run. After saving connection changes, open the chat’s CLI / API selector and click Apply, even if the same connection is already selected. This creates a new run with the saved configuration and retains chat history. Saving a connection alone does not migrate active chats. Older text-only image links remain text; switching protocol does not regenerate or import previous results.

API connections use their configured endpoint and authentication, separately from native CLI subscriptions. Some gateways use subscriptions internally; ZIAForge does not copy native authentication into an API. Models, tool policies, reasoning parameters and billing depend on the endpoint. Discovery alone does not prove inference. Keep keys in Connections, never in task prose or screenshots.

For Grok Connector v1, save an explicit Responses connection and use Inspect connector to read its advertised capabilities, models and usage without running inference. Model reasoning levels and context window choices come from the catalog. The optional native turn limit is 1–100. Missing quota percentages remain unknown; the usage period end is not a subscription payment or expiration date. Apply connection changes in each existing chat before they take effect there.

Grok questions appear as cards with the exact native question and option labels. Choose the requested answers or enter a custom response, then send once. Plan interviews can offer discussion or skip actions. Provider permission cards show the exact native choices and never select a permission automatically. These differ from local file/command approvals. Stop, expiry or restart makes old cards inactive; an uncertain submission is not repeated automatically.

In a Grok chat, the attachment button opens the system picker for PNG, JPEG and WebP. Four images are allowed per message, up to 16 MiB each and 20 MiB combined, with 32 million pixels per image. Private draft copies have a 128 MiB budget and belong to that chat run. They are transmitted only when you send. Failed or uncertain sends retain their draft identities. Image messages cannot use the text-only queue. Remove or explicitly discard a pending image draft before changing or resuming its run; discarding a draft does not undo an already delivered message. Accepted image messages retain private image cards for later inspection, zoom and saving.

Grok provider tools are restricted to supported web retrieval, images and interactive questions. Local project tools still execute on the computer in the backend-selected task folder. Read-only review excludes provider image generation/editing and questions as well as local writes and commands. Tool-free Help and report-only architect sessions cannot use this connector profile. Audio and video generation/playback are not offered; a discovered tool is not evidence of a verified usable result.

Pituduh gegandhengan: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## Setelan, basa lan reset aman

Setelan umum milih ruang kerja, basa antarmuka, lan gawan. Sambungan ngatur endpoint API. Prasetel lan Tim panyemak nyimpen konfigurasi peran. Kendhali jarak adoh ngatur kredensial lokal, cakupan server, lan hak akses pamilik; Nganyari ngatur sumber/saluran rilis. Babagan nuduhake rilis pas sing lagi mlaku.

Basa antarmuka kapisah saka basa prentah pituduh lan status tinjauan dokumentasi. Jeneng produk, ID prentah, ekstensi berkas, ID model panyedhiya, lan jeneng sing digawe panganggo tetep dadi pengenal. Pitulung ngetutake basa antarmuka sing dipilih nalika terjemahan saiki kasedhiya; terjemahan mesin diwenehi label lan basa Inggris tetep dadi rujukan kanonik.

Simpen bakal nrapake konfigurasi sing ditampilake. Reset basis data utawa reset setelan pabrik bisa mbusak metadata aplikasi; simpen berkas lan serep sing wis diuji sadurunge nggunakake reset kanthi sengaja. Operasi iki minangka tumindak pamilik lokal. Aja nggunakake operasi kasebut minangka dalan pintas kanggo nyelidiki alur makarya sing gagal utawa cathetan sing rusak.

Pituduh gegandhengan: [Pandhuan lokalisasi](../../LOCALIZATION.md) · [Pamulihan data](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Takon marang asisten Pitulung

Bukak Pitulung, pilih prasetelan sing wis disimpen lan disambungake ing panel asistene, lan takona babagan ZIAForge. Wangsulan nggunakake pandhuan basa Inggris kanonik saiki lan basa antarmuka sing panjenengan pilih. Tombol rujukan bagean mbukak topik pandhuan sing relevan, saengga panjenengan bisa mbandhingake panjelasan karo rujukane.

Asisten iki nyimpen pacelathon pribadi sing kapisah nganti 100 entri sing disimpen lan 3 MiB. Lebokake pitakonan nganti 12,000 karakter; Kirim bakal takon, Mandheg bakal mbatalake wangsulan sing aktif kanthi tetep njaga pitakonan sampeyan kasedhiya, lan Busak bakal mbusak pacelathon Pitulung iki. Draf sing durung dikirim lan pilihan prasetel sampeyan bakal tetep ana nalika nutup utawa mbukak maneh Pitulung ing sesi aplikasi sing padha, nanging draf kasebut ora disimpen ing disk. Asisten iki ora ngirim prentah aplikasi, ngowahi alur kerja, utawa nampa gerbang pamriksa. Pitutur dudu verifikasi langsung kanggo tugas, akun, utawa sambungan eksternal.

Sesi Pitulung Claude Code lan API ngetrapake kabijakan tanpa-piranti sing didhukung. Sesi Pitulung Codex lan Antigravity asli mbutuhake izin komputer asli pamilik lokal sing wis ana. Yen dipateni, aplikasi bakal nerangake prasyarat kasebut tinimbang milih panyedhiya sing beda. Mung pamilik sing bisa ngaktifake ing setelan kontrol lokal; asisten ora bisa ngaktifake dhewe.

Pitulung Codex nggunakake sandbox mung-waca lan nolak panyuwunan persetujuan piranti. Antigravity nggunakake mode rencana lan panji sandbox asline. Mode asli iki dudu jaminan universal watesan sistem operasi. Hash pandhuan-sumber ngidentifikasi rujukan sing digunakake kanggo wangsulan; panjelasan sing diasilake isih bisa kleru, mula priksa bagean sing disambungake sadurunge tumindak. Wangsulan lawas ditandhani nalika versi pandhuan-sumber kasebut beda karo pandhuan saiki.

Pituduh gegandhengan: [Pandhuan kanonik lan pangopènan terjemahan](../../HELP_MAINTENANCE.md) · [Asisten aplikasi lan izin](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Asisten lan Telegram

Asisten nggunakake prasetelan sing dipilih lan API kontrol aplikasi sing padha. Izin mriksa kahanan lan izin nindakake operasi iku kapisah. Priksa prentah lan asil: teks saka asisten dudu bukti yen sawijining tumindak wis rampung.

Telegram mung bisa diaktifake dening pamilik lokal, kanthi token bot sing wis ana lan ID pamilik angka. Kontrol mung kanggo obrolan pribadi pamilik kasebut. Bot sing durung dikonfigurasi utawa ora aktif ora kena nampa pesen aplikasi.

Aja nempelake token bot menyang obrolan biasa. Ngonfigurasi integrasi ora mbuktekake panyambungan Telegram lan ora otomatis nggawe bot. Tangkapan layar lan balesan bisa ngemot data papan makarya pribadi.

Pilih prasetelan asisten lan wenehi izin operasi-aplikasi kanthi kapisah saka pamriksan. Panyelenggaraan asisten Codex lan Antigravity mbutuhake izin asli pamilik; loro-lorone ora diganti kanthi meneng-meneng nganggo sesi API utawa Claude sing tanpa piranti. Tangkapan layar bisa ditampilake ing obrolan asisten, nanging input model saiki ora ngemot analisis gambar. Aja nganggep asisten mriksa gambar kanthi visual mung amarga dheweke nampilake gambar kasebut.

Asisten bisa mriksa ringkesan, tugas, obrolan, kahanan alur makarya, konteks proses, lan jendhela aplikasi lumantar piranti sing duwe tipe. Asisten bisa ngowahi setelan biasa sing diidinake lan miwiti operasi aplikasi sing diwenehi wewenang. Asisten ora bisa menehi hak asli, mbukak kredensial sing disimpen, ngowahi izin papan makarya root saka kadohan, utawa nyetujoni gerbang Forge mung amarga kepenak.

Pituduh gegandhengan: [Kontrak kontrol aplikasi](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Operasikake bot Telegram pribadi panjenengan

Gawe utawa jupuk bot panjenengan dhewe, wiwiti obrolan pribadine, banjur lebokake tokene lan ID pangguna Telegram angka panjenengan ing setelan kontrol lokal. Aktifake integrasi mung nalika panjenengan duwe kekarepan supaya aplikasi nyambung. ID pamilik iku pengenal pangguna, dudu jeneng pangguna utawa ID bot. Mung pesen saka pangguna kasebut ing obrolan pribadi sing padha sing bakal ditampa.

Gunakake /start, /menu utawa /status kanggo ringkesan versi sing lumaku, gunggung proyek/tugas, lan status tugas. Tombol mbukak Proyek, Tugas, Tangkapan Layar, Pitulung, lan Basa. Dhaptar nampilake wolung item saben kaca, kanthi pandhu arah Bali, Segarake, Beranda, lan Sadurunge/Sabanjure. Tombol proyek nyaring dhaptar tugas. Kertu tugas nuduhake kemajuan alur makarya sing disimpen, model/prasetelan, lan pitakonan sing nunggu yen ana.

Bukak Obrolan tugas kanggo ndeleng pratinjau obrolan sing mbukak/anyar lan obrolan fase alur makarya. Saben pratinjau nampilake nganti enem pesen pungkasan pangguna/asisten, sing dicekak kanthi katon dadi 200 karakter saben pesen. Penalaran pribadi ora ditampilake. Maca riwayat ora miwiti panyedhiya. Pratinjau mung kanggo diwaca: teks biasa lan /ask TEXT tetep ditujokake menyang asisten aplikasi, ora tau kanthi implisit menyang obrolan tugas sing lagi dideleng.

Lakokake / Terusake maca maneh alur makarya Code utawa Work saiki lan miwiti alur makarya disimpen sing nduweni hak. Jeda njaluk jedane. Loro-lorone ora nampa sarat, spesifikasi, rencana, temuan tinjauan, utawa pitakonan; keputusan sing nunggu bakal nyegah Lakokake. Gawe keputusan ing aplikasi, utawa gunakake prentah mawa tipe sing sah kanthi gerbang lan revisi saiki sing persis.

Gunakake Basa utawa /language kanggo milih salah siji saka 56 basa antarmuka miturut jeneng asline. Iki nyimpen pilihan kanggo bot lan pamilik iki wae. Gunakake basa aplikasi mbusak pilihan kasebut. Iki ora ngowahi basa aplikasi utawa izin akses; pesen sing wis ana ora dikirim maneh kanthi otomatis.

Pandhu arah biasane nganyari pesen menu sing wis diterbitake sing padha. Tombol duwe identitas buram sing kadaluwarsa sawise 15 menit lan bisa digunakake sapisan; ngowahi kertu bakal mbatalake tombol-tombol lawase. Tombol sing kadaluwarsa, wis digunakake, pesen ora cocog, lan proses sadurunge ora bisa nindakake tumindak. Pesen sing pancen ora bisa diowahi bisa diganti nganggo kertu anyar; kesalahan jaringan sing ora dingerteni ora dicoba maneh minangka pesen anyar.

Nalika diaktifake, poller mbuwang backlog sadurunge lan nyathet panriman pembaruan sadurunge dikirim supaya prentah sing kaganggu ora diputer maneh kanthi otomatis nalika miwiti maneh. Iki nyegah muter maneh; iki ora njamin rampunge pakaryan. Priksa status/konteks sadurunge kanthi sengaja ngetokake pakaryan anyar sawise kesalahan. Ora ana kabar status tugas otomatis.

Prentah eksplisit tetep kasedhiya: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot, lan /ask TEXT. /new {JSON} nggawe tugas lumantar createTask mawa tipe; /command {JSON} ngirim prentah katalog eksplisit. Waca katalog langsung kanggo wujud argumen. Otorisasi backend lan izin folder sing padha ditrapake kaya ing aplikasi.

Aplikasi ora tau ngirim nilai token bot sing disimpen menyang asisten. Nanging, tangkapan layar, ringkesan, lan teks obrolan bisa ngemot informasi proyek pribadi. Mandhegake integrasi sacara lokal yen akun bot utawa pamilik wis ora dipercaya maneh. Ganti token sing bocor menyang panyedhiya bot, banjur anyari konfigurasi lokal sing wis dienkripsi.

Pituduh gegandhengan: [Bot pribadi lan prentah](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Izin komputer asli mung-pamilik

Akses komputer asli diwiwiti kanthi kahanan dipateni. Mung pamilik sing bisa ngaktifake ing Setelan lokal → Kontrol jarak adoh. Asisten lan prentah HTTP/MCP/Telegram ora bisa ngaktifake panji iki kanggo awake dhewe. Yen operasi ditolak, asisten kudu nerangake setelan kasebut lan nglilani pamilik mutusake.

Nalika diaktifake kanthi eksplisit, computer.run nampa eksekusi, larik argumen, lan direktori makarya mutlak opsional. Prentah iki ora nggunakake interpolasi shell, duwe watesan 30 detik, lan mbatesi output nganti 1 MiB. Direktori sing diwenehake nanging ora ana utawa ora sah bakal ditolak; ora nyatakake cwd bakal nggunakake direktori setelan duweke aplikasi, dudu HOME. Metu mbatalake prentah aktif sing diduweni lan ngenteni reresik prosese.

Cakupan waca/operasi aplikasi lan akses asli iku keputusan sing kapisah. Worktree ora mbatesi akses sistem berkas saka panyedhiya sing ora diwatesi. Cabut akses asli sawise tugas rampung yen wis ora dibutuhake, lan priksa kuitansi prentah tinimbang nampa teks asisten minangka bukti.

Pituduh gegandhengan: [Kontrak kontrol mung-pamilik](../../../shared/control.ts).

<a id="remote"></a>

## Panjlajah lan instansi kadohan

Pamilik lokal ngaktifake server lan milih alamat, port, lan cakupane: waca kanggo mriksa utawa operasi kanggo tumindak. Alamat gawan 127.0.0.1 mung kasedhiya ing komputer iki. 0.0.0.0 ngrungokake ing antarmuka jaringan; tinjau akses jaringan sadurunge ngaktifake.

Panjlajah mbukak antarmuka sing padha sawise mlebu nganggo token. Aja nglebokake token ing pranala umum utawa tangkapan layar. HTTP dhewe ora ndhelikake lalu lintas; gunakake saluran sing dilindhungi liwat jaringan sing ora dipercaya.

Pamilik ngonfigurasi instansi liyane nganggo URL lan token. Backend dadi proksi panjaluk; iki ora nyalin proyeke menyang mesin lokal. Priksa instansi sing dipilih sadurunge saben tumindak.

Prentah lan acara mawa tipe nggawa kontrol aplikasi. Cakupan waca ora menehi wewenang mutasi tugas. Kontrol komputer asli iku pilihan kapisah pamilik lokal lan diwiwiti kanthi dipateni.

Aplikasi kudu tetep lumaku kanggo panjlajah, Telegram, lan kontrol agen eksternal. Saben instansi duwe profil pribadi, kahanan tugas, token, lan port server dhewe. Aja nggunakake maneh siji profil bebarengan ing antarane instansi sing independen. Acara panjlajah lan tanggapan prentah diwatesi ing instansi sing dipilih; ngalihake UI ora mindhah berkas utawa nyalin sesi mlebu asli.

Pituduh gegandhengan: [Kontrol HTTP lan instansi](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes, lan agen eksternal liyane

Gunakake API kontrol aplikasi sing wis diautentikasi utawa jembatan stdio MCP bawaan. Aktifake server sacara lokal, pilih waca utawa operasi, lan konfigurasi saben klien nganggo URL lan token instansi kasebut. Node.js 22 utawa luwih anyar dibutuhake kanggo nglakokake jembatan MCP mandhiri; aplikasi Electron ora masang klien agen panjenengan. URL panjlajah dudu titik pungkasan HTTP MCP Streamable: wenehake minangka ZIAFORGE_URL menyang jembatan stdio.

Jembatan kasebut nyedhiyakake ziaforge_status, ziaforge_commands, ziaforge_command, lan ziaforge_screenshot. Wiwiti nganggo status lan katalog prentah langsung, banjur waca system.context kanggo tugas sing dipilih. Prentah kanthi tipe ngetutake pamriksan revisi, gerbang, folder tugas, lan reresik sing padha karo UI lokal.

Katalog prentah langsung ngemot documentation.guide, pitulung basa Inggris kanonik, kanthi dalan sumber lan sourceSha256 kasebut. Arsitek aplikasi internal nampa rujukan sing padha lumantar pirantine. Iki menehi agen kabeh konteks produk tanpa gumantung ing cathetan lawas; dokumentasi ora tau menehi akses utawa ngganti keputusan manungsa saiki.

Agen kudu ngrembug syarat, keputusan teknis, lan perencanaan saka gagasan cekak manungsa. Agen kudu ngreksa gerbang manungsa sing eksplisit, model sing dipilih, kabijakan manual/Auto, lan tinjauan sing dibutuhake. Agen ora kena ngarang persetujuan, muter maneh prentah sing durung mesthi ing sangisore ID anyar, utawa nerbitake owah-owahan Git tanpa kekarepan pamilik.

Konfigurasi sawetara server MCP sing dijenengi kanggo sawetara instalasi. Ngalih instansi iku keputusan rute, dudu sinkronisasi. Tuladha konfigurasi OpenClaw lan Hermes ana ing AGENT_CONTROL.md; persiyapan tartamtu klien lan kompatibilitas kudu dipriksa kanggo versi klien sing dipasang.

Cache requestId njaba mung ngilangi duplikasi set panjaluk sing winates nalika aplikasi lumaku. Operasi tahan suwe nggunakake identitas dhewe: createRequestId kanggo nggawe tugas, commandId kanggo keputusan alur makarya, clientMessageId kanggo pesen, lan operationId kanggo owah-owahan Git. Simpen identitas asli lan payload sawise nampa pangakon sing ora dingerteni; waca kahanan sing disimpen sadurunge kanthi sengaja ngetokake pakaryan anyar.

Pituduh gegandhengan: [Pandhuan klien MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI lokal lan watesan otomatisasi

Dispatcher ziaf ngontrol aplikasi lumaku lan alur makarya disimpen sing padha. Saka sumber, gunakake npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, utawa npm run ziaf -- pause --task TASK_ID. Pangakon Mulai sing kasil ora ateges tugas kasebut wis rampung.

--until-success kanthi sengaja ngaktifake Auto kanggo alur makarya sing disimpen, nanging pitakonan, tinjauan, gerbang panrima, watesan, lan titik pamriksan tetep ditrapake. Ctrl+C metu saka dispatcher sing ngawasi; iki ora kanthi implisit mandhegake alur makarya aplikasi. Deleng CLI.md kanggo kode metu, titik pungkasan lokal, lan penanganan profil.

Antarmuka Otomatisasi saiki nyimpen definisi tampilan lan pancacah lumaku lokal. Iki dudu panjadwal bola-bali sing disertifikasi lan ora mbuktekake manawa giliran model latar mburi wis lumaku. Kanggo eksekusi nyata, gunakake kontrol alur makarya sing disimpen, ziaf, utawa API sing wis diautentikasi lan priksa kuitansine. Aja kliru nganggep panel demonstrasi minangka panjadwalan tanpa dijaga.

Pituduh gegandhengan: [Prentah dispatcher](../../CLI.md).

<a id="updates"></a>

## Versi lan pembaruan

Babagan nampilake versi lumaku sing persis. Pembaruan umum mbutuhake repositori rilis GitHub sing dipercaya lan saluran stabil utawa pratinjau. Mriksa, ngundhuh, lan masang duwe kahanan kapisah; kesalahan ora ateges pembaruan wis kapacak.

Pemasangan otomatis kanggo rilis macOS sing ditandatangani. Rilis pangembangan sing ora ditandatangani ora dipasang kanthi otomatis lumantar mekanisme iki. Kanggo panggantian manual, pateni aplikasi saiki kanthi lengkap lan gunakake artifak sing wis diverifikasi.

Pamriksan otomatis lumaku sanalika diaktifake, banjur saben nem jam.

Stabil ora kalebu rilis pratinjau; pratinjau ngidini rilis pangembangan uga. Pamriksan sing kasil mung nemtokake metadata rilis sing kasedhiya. Ngundhuh lan masang mbutuhake paket platform lan umpan rilis sing dikonfigurasi. Pangiriman Linux DEB iku jalur installer kapisah; aja nganggep DEB otomatis dianyari dening mekanisme pembaruan macOS.

Pituduh gegandhengan: [Kesiapan rilis](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Mulai maneh lan pemulihan

Ing macOS, gunakake Metu / ⌘Q kanggo mateni kanthi lengkap. Nutup jendhela bisa uga ninggalake aplikasi tetep lumaku. Pateni kanthi lengkap versi lawas sadurunge ngganti aplikasi.

Sawise diluncurake, pilih tugas sing padha. Riwayat lan draf bakal bali maneh. Nerusake mulihake konteks asli/lokal nanging ora ngirim draf, mbatalake jeda antrean, utawa menehi wewenang mbaleni operasi sing ora dingerteni.

Yen Pemulihan katon, aja ngowahi JSON nganggo tangan. Priksa jinis dokumen sing kena pengaruh, simpen berkas asli, lan pilih serep sing wis divalidasi. Mulihake antrean sing luwih lawas bakal nengeri iteme ora mesthi.

Nalika pangiriman ora dingerteni, alur makarya sing dikelola mbutuhake izin eksplisit kanggo konteks anyar. Pakaryan sadurunge lan upaya sing gagal tetep ana; panolakan sing katon luwih aman tinimbang sukses palsu.

Gawe serep berkas tugas lan profil aplikasi kanthi kabeh instansi aplikasi ditutup. Folder sing disalin dudu pemulihan sing wis diuji. Yen pemulihan njaluk panjenengan milih serep sing wis divalidasi, simpen uga berkas rusak sing persis. Mulihake alur makarya utawa antrean sing luwih lawas ora menehi wewenang kanggo mbaleni inferensi sing ora mesthi utawa operasi Git.

Pituduh gegandhengan: [Kontrak pemulihan](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Pamecahan masalah

CLI ora ditemokake: priksa instalasi lan versine ing terminal biasa, banjur uripake maneh ZIAForge. Eksekusi sing kasedhiya ora ateges panjenengan wis mlebu log. Gunakake mekanisme mlebu log duweke panyedhiya dhewe.

Model ora kasedhiya utawa otorisasi gagal: anyari panemon, pilih ID sing kasedhiya, lan priksa akun sarta watesan panjenengan. Aja mbaleni panjaluk sing durung mesthi sadurunge mriksa riwayate.

Alur makarya mandheg: bukak fase saiki, pitakonan, kuitansi verifikasi, utawa log CLI. Tangani sabab tartamtu: pitakonan sing durung dijawab, prentah, izin folder, utawa watesan upaya. Terusake ora bisa ngowahi pamriksan sing gagal dadi sukses.

Folder ilang utawa diganti: pulihake akses menyang folder asli utawa gawe tugas anyar. Aplikasi ora kena nerusake saka HOME. Yen panjenengan nemokake cwd liyane, mandhegake giliran lan simpen diagnostik.

Kanggo laporan, sertakake versi Babagan, rute, CLI/model, tumindak sing diarepake lan nyata, tangkapan layar, lan cuplikan log sing aman. Busak wadi, konten pribadi, lan dalan sing ora bisa diterbitake.

Kaca jarak adoh ora kasedhiya: priksa manawa pamilik ngaktifake server, priksa alamat lan port sing ngrungokake, banjur otentikasi nganggo token instansi sing bener. 401 nuduhake otentikasi; mutasi sing ditolak bisa uga amarga cakupan waca utawa kontrol mung-pamilik. Ngowahi token bakal nutup klien panjlajah sing wis ana. Aja mbukak port pamriksan DevTools sing kapisah minangka kontrol aplikasi jarak adoh.

Panyimpenan editor ditolak: simpen draf, priksa berkas saiki ing disk, lan rampungake konflik owah-owahan eksternal. Aja ngliwati pambandhing kanthi nulis maneh metadata aplikasi. Yen pamuatan lengkap berkas gedhe ora kasedhiya, gunakake panyuntingan/panggolekan jendhela sing didhukung utawa editor eksternal.

Telegram ora kasedhiya: konfirmasi token bot, pamilik angka, obrolan pribadi, lan status sacara lokal. Webhook utawa poller saingan bisa mblokir polling; ZIAForge ora otomatis mbusak webhook utawa njupuk alih poller liyane. Prentah sing ditolak utawa kaganggu ing wates sing ora dingerteni ora diputer maneh kanthi otomatis.

Pituduh gegandhengan: [Pengujian lan diagnosis](../../TESTING.md).

<a id="diagnostics"></a>

## Laporke masalah lan priksa bukti

Cathet persis versi build sing lumaku saka Babagan, OS/arsitektur, mode tugas, panyedhiya/model sing dipilih, lan langkah-langkah kanggo nggawe maneh masalah kasebut. Wedharake asil sing diarepake lan asil sing diamati. Sertakake tangkapan layar sing aman lan kuitansi prentah utawa verifikasi sing relevan sing disimpen, dudu kabeh profil pribadi.

Log CLI, jurnal acara, transkrip model, tilas panjlajah, lan tangkapan layar bisa nuduhake kode sumber, dalan pribadi, utawa token. Priksa lan busak bagean rahasia sadurunge nuduhake. Pangresik log kanthi upaya paling apik ora njamin manawa tangkapan layar utawa arsip bisa disebarake.

Kanggo kontributor, qa:doctor maca identitas lingkungan/build; qa:inspect mbukak profil kapisah nganggo stub panyedhiya. Fixture mbuktekake jalur aplikasi sing dites tanpa ngubungi model. Inferensi langsung, panyambungan Telegram, desktop Linux asli, panandatanganan, lan pamriksan artifak paket iku bukti sing kapisah. Deleng TESTING.md kanggo prentah sing bisa dibaleni lan reresik.

Pituduh gegandhengan: [Prentah bukti](../../TESTING.md).

<a id="privacy"></a>

## Data lokal lan watesan

Proyek, riwayat, rencana, dokumen, lan diagnostik bisa ngemot teks pribadi. Aja nerbitake profil, tangkapan mentah, kunci, utawa log lengkap bebarengan karo kode sumber.

Ing Linux, nyimpen kredensial API, kontrol, Telegram, lan instansi mbutuhake Layanan Rahasia GNOME utawa KWallet sing ora dikunci; tanpa panyimpenan rahasia sing didhukung, ZIAForge nolak nyimpen wadi-wadi iki tinimbang nggunakake cadangan basic_text duweke Electron.

Panyimpenan lokal ora ateges panjaluk tetep ana ing komputer panjenengan: CLI/API sing dipilih bakal ngirim menyang panyedhiyahipun. Folder makarya lan pengawasan proses dudu isolasi OS. Priksa izin sing dipilih.

Bedakake jinis bukti: fixture nguji aplikasi tanpa model; langsung asli nglatih CLI/akun nyata; pamriksan paket nyertifikasi artifak tartamtu. Lulus salah siji ora njamin liyane.

Cakupan aplikasi, worktree, lan pituduh mung-waca beda karo pamaksaan sistem operasi. Kabijakan peninjau/panulung Antigravity ndeteksi owah-owahan ing bukti papan makarya sing dikumpulake tinimbang ngetrapake akses sistem berkas mung-waca. Kontrol komputer asli nglakokake program sing diidinake pamilik ing njaba wates piranti aplikasi biasa; pateni yen wis ora dibutuhake maneh.

Pituduh gegandhengan: [Asal-usul lan publikasi](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Pahami lan owahi proyek sumber mbukak iki

Waca AGENTS.md lan CONTRIBUTING.md dhisik, banjur PROJECT_MAP.md kanggo wates sumber saiki. Kontrak mawa tipe sing ditrapake lan dokumen alur makarya/panyedhiya saiki ngatur tumindak aplikasi. CONCEPT.md lan bagean terminal-utamane saka ARCHITECTURE.md nyimpen tujuan historis lan ora kena kliru dianggep minangka pratelan rilis saiki.

Sumber pitulung basa Inggris yaiku docs/help/en.json. Aja ngowahi nganggo tangan USER_GUIDE.md utawa website/guide.html sing diasilake. Owahi bagean kanonik, anyari kontrak sing kena pengaruh, lan lakokake node scripts/help/generate.cjs. Pitulung sajrone aplikasi maca sumber sing padha. Tinjau tambahan karo implementasi nyata, kalebu watesan, izin, lan jalur sing ora didhukung.

Saben 56 lokal antarmuka duwe status pitulung kapisah ing docs/help/locales.json. Pitulung sing ilang utawa ora lengkap bakal bali nggunakake basa Inggris. Awak teks asil terjemahan mesin sing lengkap diwenehi label lan kaiket karo hash sumber basa Inggris, tanpa pratelan tinjauan manungsa. Terjemahan sing ditinjau manungsa uga nyathet peninjaune. Saben terjemahan kudu ngreksa ID bagean, tumindak, pengenal berkas/prentah, lan watesan teknis, nggunakake arah sing bener, lan dianyari nalika sumber basa Inggrise owah.

Sadurunge ngirim, lakokake node scripts/help/generate.cjs --check kanggo ndeteksi asil generasi sing lawas, cithakan lokal sing ora sah, utawa pranala kontrak lokal sing rusak. Pamriksan terjemahan UI lan pamriksan tumindak aplikasi tetep kapisah. HELP_MAINTENANCE.md menehi tata cara pembaruan kontributor lan AI; dokumentasi ora kena ngaku tes sing lulus yen durung nate dilakokake.

Pituduh gegandhengan: [Peta proyek saiki](../../PROJECT_MAP.md) · [Pangopènan dokumentasi](../../HELP_MAINTENANCE.md) · [Pandhuan kontributor](../../../CONTRIBUTING.md) · [Pandhuan agen](../../../AGENTS.md).
