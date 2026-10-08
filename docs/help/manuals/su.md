<!-- Generated from docs/help/en.json; source SHA-256 132e99f829c744c67a5160004c5a9db678393731d2e56b8eab14a0b4fd6df903. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: su; served locale: su; status: machine-translated. -->
# Pituduh pamaké ZIAForge

Ti niat dugika hasil anu diverifikasi. Pituduh praktis ngeunaan Code, Work jeung kadali aplikasi.

Basa Inggris mangrupa kanonik. Pitulung tarjamahan mesin dilabélan sacara misah tina tarjamahan anu geus dirécép ku manusa. Pamariksaan otomatis henteu ngasertifikasi katepatan basa pituin.

> Pituduh ieu mangrupa tarjamahan mesin tina sumber basa Inggris ayeuna. Tinjauan ti manusa tetep dianti-anti.

## Bagian pituduh

- [Léngkah-léngkah munggaran](#start)
- [Pasang pakét déstop anu bener](#install-platforms)
- [Code: lima rute](#code)
- [Sawala Forge](#forge)
- [Dokumén jeung kaputusan](#decisions)
- [Palaksanaan jeung révisi](#execution)
- [Tim révisi sajajar jeung arsiték laporan](#review-teams)
- [Spésialisasi agén jeung kawijakan pituduh](#specializations)
- [Work: ti mimiti patarosan dugi ka dokumén](#work)
- [Prasetél, modél jeung aksés](#models)
- [Obrolan, Eureun sareng antrian](#chat)
- [Berkas, Git jeung panyelesaian](#files)
- [API connections](#api)
- [Setélan, basa jeung reset aman](#settings)
- [Tanya asistén Pitulung](#help-assistant)
- [Asistén jeung Telegram](#assistant-control)
- [Jalankeun bot Telegram pribadi anjeun](#telegram)
- [Idin komputer asli husus-nu-boga](#native-permissions)
- [Panyungsi jeung instansi jarak jauh](#remote)
- [OpenClaw, Hermes jeung agén éksternal lianna](#external-agents)
- [CLI lokal jeung wates otomatisasi](#local-cli)
- [Vérsi jeung pembaruan](#updates)
- [Mimitian deui jeung pamulihan](#restart)
- [Pamérésan masalah](#troubleshooting)
- [Laporkeun masalah jeung pariksa bukti](#diagnostics)
- [Data lokal jeung watesan](#privacy)
- [Pikaharti jeung robah proyék sumber kabuka ieu](#project-contributors)

<a id="start"></a>

## Léngkah-léngkah munggaran

ZIAForge ngahijikeun sawala, perencanaan, palaksanaan sareng vérifikasi dina hiji tugas. Pilih Code pikeun proyék Git, atanapi Work pikeun dokumén, panalungtikan sareng hasil sanésna dina folder biasa.

Mimitian ku tugas leutik dina proyék anu misah. Upami anjeun milih CLI pituin, pasang heula sareng asup nganggo akunna nyalira dina terminal. Alternatipna, konpigurasikeun sambungan API. Langganan CLI sareng API mayar mangrupa métode sambungan anu misah; ZIAForge henteu ngasupkeun anjeun atanapi mindahkeun kirédit di antara maranéhna.

1. Buka Setélan teras pariksa folder workspace sareng basa. Ngeunaan mintonkeun idéntitas pasti tina wangunan anu nuju jalan.
2. Pikeun Code, tambahkeun répositori Git dina bilah sisi. Pikeun Work, pilih folder anu misah nalika ngadamel tugas.
3. Simpen prasetél kalayan CLI, modél, usaha penalaran sareng tingkat aksés. Anjeun ogé tiasa milih Adat sacara langsung tanpa prasetél anu disimpen.
4. Jieun tugas, pilih rute, peran sareng kamajuan manual atanapi otomatis. Tinjau pilihan sateuacan Mimitian.

> Anggo artéfak sareng checksum anu disayogikeun ku maintainer. Sawangan tiasa waé henteu ditandatanganan atanapi henteu gaduh feed pembaruan anu dipublikasikeun. Pangrojong déstop sareng panyadia pituin kedah diverifikasi pikeun OS, arsitéktur sareng artéfak anu pasti; pangrojong sumber wungkul sanés sertifikasi rilis.

Pituduh nu patali: [Ringkesan proyék](../../../README.md) · [Kasaluyuan panyadia](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Pasang pakét déstop anu bener

Pilih pakét pikeun sistem operasi sareng arsitéktur CPU anjeun: x64 atanapi arm64. Pipa pangwangunan tiasa ngahasilkeun format macOS DMG/ZIP, pamasang Windows NSIS/ZIP, sareng Linux DEB/RPM/AppImage/tar.gz/ZIP. Berkas anu dihasilkeun atanapi wangunan silang sanés bukti yén pamasang sareng UI pituinna parantos lulus dina mesin anjeun; tingal rékaman vérifikasi rilis éta.

Wangunan macOS anu ngagunakeun Electron 44 meryogikeun macOS 13 atanapi anu langkung énggal. Anggo pakét arm64 dina Apple Silicon sareng pakét x64 pikeun Intel. Kaluar sapinuhna tina aplikasi anu langkung lami sateuacan ngagantina. Pakét sawangan tiasa waé henteu ditandatanganan sareng henteu dinotarisasi; ulah salah nganggap artéfak pamekaran salaku rilis umum anu ditandatanganan.

Windows meryogikeun sistem operasi anu dirojong ku vérsi Electron anu dibuntel sareng Git anu sayogi dina PATH. Pilih arsitéktur anu cocog. Sawangan anu henteu ditandatanganan henteu ngagaduhan sertifikasi Authenticode. ZIP portabel kedah mertahankeun diréktori aplikasi anu lengkep sareng berkas runtime, henteu ngan ukur berkas anu tiasa dieksekusi.

Linux meryogikeun déstop grafis anu cocog, pustaka sistem anu diperyogikeun ku Electron, sareng Git. Pikeun krédénsial kadali anu énkripsi, sayogikeun Secret Service anu fungsional sapertos gnome-libsecret atanapi KWallet; backend basic_text anu henteu aman henteu ditampi. Bukti tés haseup headless/wadah henteu ngasertifikasi unggal déstop atanapi distribusi.

Pasang DEB nganggo apt install ./file.deb, atanapi pasang RPM ngalangkungan pangatur pakét distribusi anjeun. Hiji AppImage meryogikeun izin anu tiasa dieksekusi sareng pangrojong FUSE anu cocog; --appimage-extract-and-run mangrupa altérnatif anu tiasa dianggo upami dirojong. Ékstrak pakét tar.gz sareng ZIP kalayan sadaya berkas runtime-na. Pisahkeun data pamaké sareng berkas aplikasi nalika ngaganti hiji pakét.

Pikeun ngawangun tina sumber, anggo Node 24, Git sareng npm ci, kalebet pamasang Electron normal. Pangwangunan deui pituin meryogikeun parabot platform: parabot baris paréntah Xcode dina macOS; MSVC C++, Windows SDK sareng Python dina Windows; kompilator, make, Python, pkg-config sareng parabot bungkusan anu diperyogikeun dina Linux. Tuturkeun PLATFORM_BUILDS.md pikeun paréntah anu pasti sareng watesan platform ayeuna.

Vérsi rilis dicadangkeun sacara puseur sareng hasilna henteu tiasa dirobih. Wangunan vérifikasi CI sanés pamasang anu dipublikasikeun. Arsip sumber ngandung kode sumber, berkas konci, dokuméntasi sareng skrip; dépéndénsi, krédénsial, profil pamaké sareng panalungtikan pribadi dikaluarkeun. Ulah kantos nyindikkeun validasi pituin ARM atanapi Windows tina wangunan x64 anu suksés.

Pituduh nu patali: [Pakét platform, prasarat jeung watesan vérifikasi](../../PLATFORM_BUILDS.md) · [Idéntitas wangunan jeung pamariksaan rilis](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: lima rute

Auto meunteun wengkuan: patarosan saderhana tiasa réngsé kalayan jawaban, sedengkeun tugas anu langkung ageung peryogi persiapan. Doméan bug nalungtik sabab sareng nyiapkeun koréksi. Spésifikasi heula ngamimitian ku solusi téknis; Sarat heula ngamimitian ku sarat sareng kritéria panarimaan.

Multi-modél ngagunakeun kontéks anu misah pikeun éksplorasi, rarancang, palaksanaan sareng révisi. Nami rute henteu meryogikeun panyadia anu bénten: unggal peran ngagunakeun konfigurasi prasetél atanapi Adat anu anjeun pilih.

Worktree ngasingkeun parobahan Git dina hiji tugas. Cabang fungsina dina checkout anu dipilih. Pariksa proyék, cabang sareng modél sateuacan ngamimitian; pedaran tugas henteu ogé dikirimkeun ka obrolan biasa.

Pikeun ide anu gaduh pilihan produk atanapi téknis anu teu acan réngsé, anggo Sarat heula sareng bangun pondasina dina sawala. Auto ngagolongkeun pamundut; éta sanés paréntah pikeun nerapkeun unggal frasa pondok sacara langsung. Simpen draf nahan pamundut tanpa ngahubungi modél; Mimitian nyimpen sareng ngajalankeun alur anu dikokolakeun sakali. Hiji dugi ka opat salinan tugas gaduh ID jieun sareng setélan peran anu mandiri.

Pituduh nu patali: [Kontrak alur gawé Code](../../WORKFLOWS.md) · [Profil pituduh Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Sawala Forge

Mimitian muka sawala sentral. Waler sacara alami, tangtoskeun patarosan balik, tambahkeun konstrain sareng diskusikeun pilihan téknis. Paguneman sareng patarosan tetep aya dina tugas.

Ngirim téks henteu hartosna nampi dokumén atanapi masihan otorisasi rencana palaksanaan anyar. Klarifikasi salami palaksanaan mimitina ngareureuhkeun giliran anu dikokolakeun sareng marios deui wengkuan anu kapangaruhan. Jawaban pikeun patarosan dina léngkah anu parantos ditampi tiasa neraskeun léngkah éta.

Pikeun ngahaja marios deui pondasina, pilih Sarat, Spésifikasi atanapi Perencanaan. Vérsi anyar meryogikeun panarimaan énggal tina kaputusan anu gumantung. Léngkah-léngkah anu parantos réngsé sareng buktina tetep aya; fase-fase anu teu acan réngsé anu digentos tetep aya dina riwayat.

Sési fase anu dikokolakeun bénten tina obrolan bébas. Anggo sawala Forge tinimbang ngirim pituduh manual sacara langsung ka sési anu dipiboga ku alur gawé.

Pituduh nu patali: [Kontrak sawala Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Dokumén jeung kaputusan

Buka hiji dokumén, pariksa vérsina sareng damel édit upami diperyogikeun. Ngirimkeun éditan ngaliwatan sawala bakal ngahasilkeun vérsi anyar; laporan sareng hasil anu diverifikasi henteu ditulis deui sacara rétrospéktif.

Sateuacan nampi rencana anu diajukeun, édit urutan, pituduh, kritéria panarimaan sareng paréntah vérifikasi. Otorisasi paréntah kongkrit anu anjeun ngartos: paréntah éta dijalankeun dina folder tugas. Multi-modél ngajukeun hiji léngkah palaksanaan pikeun sakabéh tugas, kalayan rinci dina dokumén sareng pituduhna.

Satuju mangrupa kaputusan anu dipikirkeun sacara misah. Auto henteu ngaliwat patarosan atanapi panarimaan sarat, spésifikasi sareng rencana. Dokumén anu dirobih sacara éksternal henteu tiasa ngagunakeun deui persetujuan lami.

Berkas persiapan némbongan salaku artéfak. Vérsi maranéhanana, fase anu ngahasilkeunana sareng hash ngabeungkeut maranéhanana kana hiji hasil. Dokumén Code disimpen di luar worktree sareng henteu otomatis lebet kana commit.

Pariksa dokumén sareng kaputusan anu ditingalikeun sateuacan nampi. Panarimaan ngabeungkeut ID gapura ayeuna, révisi rencana sareng hash dokumén anu dipikagaduh. Mundut parobahan nalika wengkuan atanapi bukti salah. Upami hiji kaputusan parantos kadaluwarsa, muat deui kaayaan anu disimpen sateuacan nyandak pilihan anyar; berkas anu parantos dirobih henteu tiasa ditampi dina vérsi sateuacanna.

Pituduh nu patali: [Gapura alur gawé jeung vérsi dokumén](../../WORKFLOWS.md).

<a id="execution"></a>

## Palaksanaan jeung révisi

Pikeun-dilakukeun mintonkeun léngkah nyata, usaha ayeuna, vérifikasi sareng hasil révisi. Agén anu nyarios "parantos" henteu ngaréngsékeun léngkah: bukti anu diperyogikeun ku rencana kedah aya.

Modeu manual ngareureuhkeun antara léngkah-léngkah anu layak. Auto ngamajukeun léngkah-léngkah anu diverifikasi sareng ngamungkinkeun usaha deui anu kawates. Eureun saatosna salawasna nyieun titik pamariksaan. Reureuhkeun ngeureunkeun pagawéan aktip tina alur gawé; nutup panel henteu ngeureunkeunana.

Nu marios mandiri ngagunakeun kontéks anu misah sareng berkas sarta hasil vérifikasi. Unggal pamanggih ngahalangan anu diwajibkeun kedah diréngsékeun; sababaraha pamarios henteu tiasa ngaleungitkeun éror anu ngahalangan ngaliwatan sora.

Dina Multi-modél, ngoméan pamanggih merlukeun kaputusan eksplisit. Koréksi henteu sacara cicing-cicing ngamimitian révisi anu sanés: Pariksa deui muka siklus anu seger. Koméntar révisi tiasa naroskeun pertimbangan deui ti koordinator tanpa ngulang palaksanaan.

Léngkah-léngkah anu parantos réngsé henteu tiasa diédit sacara cicing-cicing. Kalayan TDD, Beureum kedah leres-leres gagal kusabab alesan anu disangka, teras Héjo kedah lulus. Usaha anu kawates nyegah usaha deui anu teu aya tungtungna.

Simpen pamarios CLI/API mandiri dina Setélan → Tim révisi, teras pilih tim dina Code atanapi Work. Pamarios jalan sacara sajajar, dituturkeun ku arsiték laporan tim. Anjeun ogé tiasa ngonpigurasikeun pamarios mandiri tanpa tim anu disimpen. Arsiték laporan ngan nampi laporan terstruktur anu anonim, tanpa berkas proyék atanapi parabot; isolasi ieu ayeuna meryogikeun Claude Code atanapi API.

Unggal léngkah palaksanaan meryogikeun pamariksaan anu tiasa dieksekusi, révisi mandiri anu diwajibkeun, atanapi duanana. Fase persiapan sabalikna mertahankeun hasil anu divalidasi sareng kuitansi artéfak; ieu henteu pura-pura yén tés palaksanaan parantos jalan. Hiji paréntah suksés ngan ukur nalika status kaluar anu saleresna sareng beberesih prosés anu dipiboga parantos dikonfirmasi. Pamariksaan Beureum pikeun TDD kedah gagal sacara normal sateuacan palaksanaan sareng vérifikasi Héjo; berkas anu tiasa dieksekusi anu leungit atanapi béak waktu sanés hasil Beureum anu sah.

Pamutus sirkuit baku eureun saatos tilu usaha gagal dina hiji léngkah atanapi lima puluh usaha sacara total. Interupsi meakeun hiji usaha tapi henteu diétang salaku usaha anu gagal. Watesan sareng bukti anu réngsé tetep salamet tina balikan deui; Cobian deui henteu ngareset éta. Baca kagagalan anu dipikagaduh sateuacan masihan otorisasi usaha sanés.

Pituduh nu patali: [Vérifikasi jeung révisi](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Tim révisi sajajar jeung arsiték laporan

Buka Setélan → Tim révisi sareng simpen hiji tim. Tambahkeun pamarios mandiri kalayan CLI atanapi API, modél, usaha penalaran sareng spésialisasi maranéhanana nyalira, teras pilih arsiték laporan. Pilih tim dina konfigurasi révisi tugas. Prasetél palaksana ogé tiasa dianggo ku pamarios, sareng Adat tetep sayogi; peran mandiri tetep gaduh kontéks anu misah.

Pamarios jalan sacara sajajar dina bukti tugas anu sami. Unggal laporan, éror sareng putusan anu diperyogikeun dipikagaduh. Arsiték nampi laporan dinomeran anu anonim tanpa nami pamarios, idéntitas modél atanapi panyadia, eusi tugas asli, aksés répositori atanapi parabot. Éta ngabandingkeun laporan sareng mulangkeun hiji putusan anu terstruktur; éta henteu ngalaksanakeun révisi sumber anu seger.

Pamanggih anu ngahalangan atanapi panolakan pamarios anu diperyogikeun henteu tiasa dileungitkeun ku sora mayoritas atanapi karesep arsiték. Laporan anu leungit atanapi salah bentuk nyegah persetujuan. Pariksa unggal pamanggih sareng kaputusan agrégat sateuacan nampi atanapi masihan otorisasi koréksi. Tim anu disimpen parantos direngsekeun sareng dibekukeun pikeun jalan éta; ngédit prasetélna henteu nulis deui bukti anu parantos réngsé.

Arsiték ngan-laporan ayeuna ngagunakeun konfigurasi bébas-parabot Claude atanapi API anu dirojong. Codex sareng Antigravity tetep sayogi salaku pamarios tapi ditolak pikeun peran arsiték anu terisolasi ieu dugi ka aya kontrak bébas-parabot anu diverifikasi. Pituduh anu nyebatkeun "henteu aya parabot" nyalira henteu cekap.

> Pipa rarancang/révisi Multi-modél Code sareng tim révisi sajajar anu disimpen mangrupa kadali anu misah. Pertahankeun kawijakan révisi khusus anu dipilih; ulah nganggap hiji rute ngaktifkeun unggal fitur révisi.

Pituduh nu patali: [Konfigurasi tim anu ditangtukeun tipena](../../../shared/review-team.ts) · [Agrégasi révisi](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Spésialisasi agén jeung kawijakan pituduh

Modél mangrupa mesin palaksanaan; spésialisasi mangrupa profil pituduh. Pilih Henteu aya pikeun henteu nambihan spésialisasi, Standar pikeun pituduh standar, Auto pikeun pituduh bawaan anu rélevan, atanapi Manual pikeun pituduh anu dipilih sareng pituduh anjeun nyalira anu kawates. Prasetél tiasa mertahankeun pilihan éta.

Katalog asli ngawengku pamrograman umum, arsitéktur, kaamanan, réliabilitas, kinerja, nguji sareng kagunaan antarbeungeut. Auto ngagunakeun téks tugas/léngkah anu sayogi pikeun milih pituduh; éta henteu sacara rusiah nyauran modél sanés atanapi ngasertifikasi kaahlian. Saran perencanaan tiasa dipariksa sareng dirobih sateuacan nampi rencana palaksanaan.

Spésialisasi révisi ngabantosan museurkeun perhatian tapi henteu kantos ngagantikeun bukti mandiri, wates aksés atanapi putusan anu terstruktur. Perlakukan pituduh khusus salaku bagian tina wengkuan tugas: ulah anggo éta pikeun ngaliwat panarimaan dokumén, kawijakan parabot, auténtikasi atanapi kagagalan pamarios.

Pituduh nu patali: [Katalog pituduh asli](../../../shared/specializations.ts).

<a id="work"></a>

## Work: ti mimiti patarosan dugi ka dokumén

Work henteu meryogikeun Git. Standar nyieun folder tugas anu misah; Adat milih folder anu parantos aya ngaliwatan pamilih pituin. Simpen draf nyimpen setélan tanpa inferénsi; Mimitian ngajalankeun fase munggaran.

Auto ngajawab sacara langsung atanapi ngajukeun rencana anu cocog kalayan Pikeun-dilakukeun anu nyata. Brainstorm ngadamel ideas.md sateuacan anjeun milih langkung seueur ide atanapi évaluasi. Panalungtikan mertahankeun findings.md, sumber sareng watesan. Nulis ngaléngkah tina niat sareng, nalika aya mangpaatna, outline.md kana dokumén déskriptif atanapi draft.md; révisi mertahankeun vérsi sateuacanna.

Pilih asupan berkas ngalangkungan pamilih pituin sareng rujuk nganggo @. Aplikasi nyalin maranéhanana salaku asupan tugas anu henteu tiasa dirobih sareng ngavalidasi idéntitasna sateuacan dijalankeun. Standar nyieun folder tugas anu dipiboga ku aplikasi; aksés folder Adat mangrupa hibah pamilik anu disimpen. Draf anu disimpen sareng teu acan dimimitian tiasa ngarobih folderna.

Jieun 1–4 salinan kalayan setélan palaksana mandiri. Tugas anu nganggo folder tumpang tindih henteu tiasa nyerat sacara babarengan. Koordinasi ieu lumaku pikeun operasi ZIAForge, sanés program éksternal anu sawenang-wenang.

Deep Brainstorm standar nganggo tilu pagawé mandiri sareng ngarojong dugi ka dalapan. Pilih urutan sareng konfigurasina, kalebet ngagunakeun deui prasetél dina kontéks anu misah. Patarosan pagawé mertahankeun asal-usulna; laporan anu salah bentuk nampi hiji usaha ngoméan format. Kagagalan parsial tetep katingali tinimbang disajikan salaku kasuksésan sagemblengna.

Deep ngagabungkeun laporan pagawé anu dipikagaduh kana brainstorm_report.md sareng salawasna menta kaputusan pamaké. Tindak lanjut leutik ngarévisi laporan ngaliwatan koordinator; parobahan ageung ngamimitian babak sanés tina pagawé anu dibekukeun. Artéfak tetep ngajaga vérsina.

Peran anu parantos direngsekeun bakal dibekukeun nalika nyieun tugas atanapi nyimpen draf sacara eksplisit. Saatos pamanggilan munggaran, ngan ukur kamajuan otomatis/manual anu tiasa dirobih; anggo tugas énggal pikeun setélan peran atanapi modél anu bénten. Ngédit prasetél global henteu sacara cicing-cicing ngarobih fase-fase salajengna.

Modeu manual ngareureuhkeun antara fase-fase anu layak, kalebet gurat badag Nulis anu penting. Auto tiasa neraskeun ngaliwatan gurat badag éta. Patarosan, rencana anu tiasa dieksekusi anu diajukeun, arah Brainstorm sareng tinjauan laporan Deep tetep janten kaputusan eksplisit bahkan dina Auto. Rujukan hungkul henteu ngabuktikeun yén panyungsi parantos kajantenan, sareng berkas binér anu dipikagaduh hungkul henteu ngabuktikeun réndéringna.

Pituduh nu patali: [Modeu jeung kaputusan Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Prasetél, modél jeung aksés

Hiji prasetél nyimpen CLI/API, modél, usaha penalaran sareng izin. Bagian handap obrolan ngagaduhan bagian prasetél, CLI, modél sareng pilihan. Adat jalan tanpa prasetél; Jieun prasetél nyimpen pilihan ayeuna.

Katalog asalna tina CLI atanapi API anu dipasang anu dipilih upami dirojong. Segerkeun ngamutahirkeun daptar tanpa ngarobih pilihan. Upami panimuan henteu sayogi, lebetkeun ID modél anu eksplisit; panyadia kedah tetep ngarojongna. Tingkat penalaran gumantung kana modél sareng CLI. Standar panyadia bénten tina token none anu eksplisit.

Terapkeun parobahan ngan saatos pangakuan backend. Pindah diwatesan salami giliran aktip atanapi antrian henteu kosong. Draf sareng riwayat anu katingali tetep aya, tapi ngarobih panyadia henteu mindahkeun kaayaan internal pribadina.

Dina Forge, labél peran penting pisan: persiapan tiasa ngagunakeun Parancang anu misah. Bagian handap ngarobih peran anu ditingalikeun; nu marios sareng pambantu dipilih dina setélan alur gawé. Kawijakan pikeun palaksanaan anu parantos diverifikasi tiasa dikonci.

Izin bénten-bénten antara panyadia. Baca hungkul sareng Tulis workspace sayogi upami adaptor ngarojongna. Antigravity ngagunakeun setélan CLI pituin atanapi aksés pinuh anu dipilih sacara eksplisit. Aksés pinuh sanés sandbox.

Spésialisasi nambihan pituduh arahan, sanés modél atanapi izin anu sanés. Prasetél sareng peran ngarojong Henteu aya, Standar, Auto sareng Manual. Auto milih profil tina téks léngkah tanpa panggilan modél tambahan; Manual nampi dugi ka opat kaahlian sareng pituduh khusus. Tugas anu diajukeun ku Parancang tiasa diédit sateuacan nampi rencana.

Hiji ID modél atanapi usaha anu dilebetkeun sacara manual tetep janten pilihan anjeun, tapi panyadia tiasa waé nolak éta. Ngédit prasetél global henteu ngarobih sacara rétroaktif obrolan anu nuju jalan atanapi rencana anu parantos ditampi. Pikeun ngarobih paguneman anu nuju nganggur sacara ngahaja, anggo kadali konpigurasina sorangan sareng antosan pangakuan. Pilihan anu ditumpurkeun kedah dibaca salaku kamampuan atanapi wates siklus hirup, henteu diliwat ku cara ngédit JSON anu disimpen.

Pituduh nu patali: [Kamampuh panyadia](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Obrolan, Eureun sareng antrian

Tab kabuka, Nu Anyar jeung draf mangrupa bagian tina hiji tugas. Nutup tab bakal ngaleungitkeunana tina Kabuka tapi tetep mertahankeunana dina Nu Anyar sarta henteu ngeureunkeun prosés panyadiana atanapi alur gawé anu dikokolakeun. Sungsi riwayat, buka deui obrolan atanapi tutup sadaya tab tambahan tina ménu riwayat.

Eureun ngaganggu giliran ayeuna. Antosan dugi ka prosés ngeureunkeun réngsé sateuacan Ngirim salajengna: konfirmasi interupsi sanés panyelesaian prosés. Anjeun tiasa ngetik draf salajengna samentawis éta.

Dina obrolan biasa, Antrian nyimpen pamundut engké sacara misah tina draf ayeuna. Reureuhkeun antrian nahan pangiriman salajengna. Eureun sareng Kaluar ngareureuhkeun antrian. Saatos ngamimitian deui, Teruskeun heula, teras sacara eksplisit Teruskeun antrian.

Henteu pasti hartosna pangiriman henteu dipikanyaho. Pesen sapertos kitu henteu dikirim deui sacara otomatis: pariksa riwayat, salin téks upami cocog sareng singkirkeun item anu aya dina antrian. Ngirimkeunana deui mangrupa pamundut anyar anu ngahaja.

Obrolan fase anu dikokolakeun ngagunakeun alur gawéna sorangan, sanés antrian biasa. Tuturkeun tahap mintonkeun fase ayeuna; milih tab sanés sacara manual bakal ngeureunkeun nuturkeun. Log CLI mintonkeun diagnostik sacara misah tina réspon.

Réspon Markdown ngaréndér judul, daptar, tabél, tautan sareng blok kode. Kartu parabot sareng diagnostik CLI tetep misah tina jawaban. Penalaran sareng métrik token anu dilaporkeun modél nembongan ngan ukur nalika panyadia leres-leres nembongkeunana; ulah nyindikkeun penalaran pribadi atanapi pamakéan tina animasi.

Saatos pangiriman anu henteu pasti atanapi konfirmasi antrian, pariksa riwayat sareng cobian deui ngan ukur pamundut anu sami anu dipikagaduh upami ditawarkeun. Tanda tarima antrian hartosna panyimpenan nampi item kasebut, sanés yén inferénsi parantos réngsé. Cabut item antrian anu henteu pasti ngan ukur salaku panyingkiran eksplisit; éta henteu tiasa narik deui pituduh anu parantos dikirimkeun.

Pituduh nu patali: [Antrian pesen anu awét](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Berkas, Git jeung panyelesaian

Berkas mintonkeun folder tugas. Bandingkeun hasil sareng sarat, buka dokumén sareng pariksa bédana. Mertahankeun berkas binér henteu ngabuktikeun réndéring anu leres dina aplikasi udaganana.

Git nyayogikeun status, parobahan sareng operasi kalayan hasil anu dirékam. Commit, gabungkeun sareng dorong sacara manual sacara standar; operasi otomatis mangrupa pilihan anu misah pikeun rencana anu parantos diverifikasi sapinuhna.

Ulah ngarobih berkas padamelan antara vérifikasi sareng publikasi: persetujuan kabeungkeut kana bait anu pasti. Konflik, dorongan anu gagal sareng hasil operasi anu henteu dipikanyaho ngahalangan kamajuan dugi ka aya kaputusan eksplisit. Auto henteu sacara cicing-cicing masihan otorisasi publikasi.

Work henteu ngadamel cabang Git sareng henteu gaduh finalisasi Git. Simpen dokumén anu diperyogikeun tina folder anu dipilih, kalebet vérsi sareng sumberna.

Éditor berkas nyayogikeun sintaks dumasar éksténsi, sungsi sareng gentos, riwayat bolaykeun, bungkus garis sareng draf per-tab. Nyimpen mertahankeun énkoding UTF-8/UTF-16 anu dirojong sareng nolak konflik modifikasi éksternal. Énkoding sanés sareng eusi binér merlukeun éditor éksternal. Draf anu teu disimpen nyegah Kaluar aplikasi dugi ka anu gaduhna nyimpen atanapi miceun éta.

Sintaks lengkep diaktipkeun dugi ka 8 MiB. Berkas téks anu langkung ageung dibuka dina jandéla 256 KiB; 8–64 MiB tiasa dimuat sacara lengkep sacara eksplisit tanpa sintaks. Di luhur 64 MiB anggo éditan jandéla sareng sungsi cocog-salajengna anu kawates. Ieu mangrupa modeu berkas ageung anu kawates, sanés kasataraan Sublime Text pikeun dokumén anu ageungna sakahayang.

Buka folder ngagunakeun tugas ayeuna atanapi kontéks cabang/worktree, tinimbang sacara cicing-cicing ngan ukur muka répositori asli. Jajaran berkas tiasa nembongkeun diréktori induk tina éta berkas. Jalur divalidasi ku backend ngalawan hibah tugas anu didaptarkeun. Berkas binér henteu tiasa diédit salaku téks polos; anggo pamiarsa udaganana sareng pertahankeun bait aslina.

Panyabutan worktree mangrupa tindakan anu dijaga sacara misah. Pungkasan sési terstruktur sareng terminal anu napel sateuacan nyabutna, kalebet sési anu nuju nganggur. Pariksa hasil Git anu disimpen sareng kaayaan pamulihan; ngahapus catetan tugas sanés gaganti pikeun sacara aman ngajaga padamelan anu teu acan di-commit.

Pituduh nu patali: [Kontrak éditor anu ditangtukeun tipena](../../../shared/editor.ts) · [Kawijakan Git](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> Pituduh lengkep tacan ditarjamahkeun kana basa antarbeungeut anjeun. Némbongkeun rujukan basa Inggris.

Connections adds an explicitly selected OpenAI-compatible endpoint. Enter a name, base URL, model and a key if needed. Select Chat Completions for existing integrations or Responses for function rounds, provider tool progress and generated images. Existing connections retain Chat Completions until you change them explicitly. For an existing connection, Set up Responses opens a draft for that same endpoint; review the profile and click Save connection. Choose Codex connector only for a gateway that supports its extension. The saved key is retained when the endpoint is unchanged and the key field stays blank.

HTTPS is required except for loopback HTTP. Use a plain endpoint without credentials, queries or fragments. Redirects are refused. Keys use supported OS encryption and are never returned to the UI. Changing the endpoint requires re-entering or clearing its key. Leaving the key field blank preserves a saved key.

Workspace file tools execute in the backend-resolved local task folder, with relative paths and checks against traversal and links. Every file write needs explicit approval and an unchanged expected revision. Read-only sessions expose only read tools. In Responses, Allow local commands separately enables approved executable/argument calls on macOS and Linux. Command supervision is unavailable on Windows; the adapter does not advertise that tool there. Commands always require owner approval and are not an operating-system sandbox.

The Codex connector profile identifies that gateway’s Responses tool-progress extension. Native provider tools execute on the server, separately from caller tools on your computer. Local read-only permissions do not constrain the server. A connector cannot be selected for a report-only architect that requires all tools disabled: unsupported isolation fails rather than silently allowing native tools. Select an endpoint that can enforce the required policy.

Generated PNG, JPEG and WebP results appear as separate image cards, with Save image, outside collapsed tool output. Images are validated and kept in private application storage; model-supplied URLs and Markdown images are not fetched automatically. Opening saved history, retrying an image read and saving a cached image do not request a new generation. Results are bounded to 32 MiB and 32 million pixels per image, with a 128 MiB private cache. Preserve needed images before manually clearing the private cache if it becomes full. Click a chat image to open the image viewer. Zoom in or out, choose Actual size (100%) or Fit to window, and drag to inspect a detail. Escape or Close image viewer returns to the chat. Viewing and zooming reuse the loaded private image; they do not request a new generation.

Responses conversations retain the acknowledged response identity and exact function call IDs. Interrupted inputs are not automatically resent. An uncertain local edit or command is not rerun after restart; preserve the history and explicitly create a new context after inspection. Changes to a saved transport or endpoint require explicit reconfiguration. Provider status, cancellation and expiry failures are reported without hiding them behind a CLI fallback. The chat header shows the protocol pinned to that run. After saving connection changes, open the chat’s CLI / API selector and click Apply, even if the same connection is already selected. This creates a new run with the saved configuration and retains chat history. Saving a connection alone does not migrate active chats. Older text-only image links remain text; switching protocol does not regenerate or import previous results.

API connections use their configured endpoint and authentication, separately from native CLI subscriptions. Some gateways use subscriptions internally; ZIAForge does not copy native authentication into an API. Models, tool policies, reasoning parameters and billing depend on the endpoint. Discovery alone does not prove inference. Keep keys in Connections, never in task prose or screenshots.

Pituduh nu patali: [API connections](../../API_CONNECTIONS.md).

<a id="settings"></a>

## Setélan, basa jeung reset aman

Setélan umum milih workspace, basa antarbeungeut sareng standar. Sambungan ngokolakeun endpoint API. Prasetél sareng Tim révisi mertahankeun konfigurasi peran. Kadali jauh ngokolakeun krédénsial lokal, wengkuan sérvér sareng izin pamilik; Pembaruan ngokolakeun sumber/saluran rilis. Ngeunaan mintonkeun wangunan pasti anu nuju jalan.

Basa antarbeungeut dipisahkeun tina basa pituduh (prompt) jeung status tinjauan dokuméntasi. Ngaran produk, ID paréntah, éksténsi berkas, ID modél panyadia, jeung ngaran nu dijieun ku pamaké tetep jadi pamingpin. Pitulung nuturkeun basa antarbeungeut nu dipilih nalika tarjamahan ayeuna geus sadia; tarjamahan mesin dibéré labél sarta basa Inggris tetep jadi rujukan kanonik.

Simpen nerapkeun konfigurasi nu keur dipintonkeun. Setél ulang pangkalan data atawa setél ulang ka pabrik bisa ngahapus métadata aplikasi; simpen berkas jeung cadangan nu geus diuji saméméh ngagunakeun setél ulang kalawan dihaja. Operasi ieu mangrupa tindakan husus ti nu boga lokal. Ulah dipaké salaku jalan pondok pikeun mariksa alur gawé nu gagal atawa catetan nu ruksak.

Pituduh nu patali: [Pituduh lokalisasi](../../LOCALIZATION.md) · [Pamulihan data](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Tanya asistén Pitulung

Buka Pitulung, pilih prasetél nyambung nu diteundeun dina panél asisténna sarta tanyakeun ngeunaan ZIAForge. Jawaban ngagunakeun pituduh kanonik basa Inggris ayeuna jeung basa antarbeungeut nu dipilih ku anjeun. Tombol rujukan-bagian muka topik pituduh nu relevan, ku kituna anjeun bisa ngabandingkeun pedaran jeung rujukanna.

Asistén ieu nyimpen obrolan pribadi nu misah nepi ka 100 éntri nu diteundeun sarta 3 MiB. Asupkeun pananya nepi ka 12,000 karakter; Kirim nanyakeunana, Eureun ngabolaykeun jawaban nu keur aktip bari tetep nyadiakeun pananya anjeun, jeung Hapus miceun obrolan Pitulung ieu. Draf nu can kakirim sarta pilihan prasetél anjeun bakal tetep aya sanajan Pitulung ditutup atawa dibukakeun deui dina sési aplikasi nu sarua, tapi draf éta teu diteundeun kana piringan. Asistén teu ngirim paréntah aplikasi, ngarobah alur gawé, atawa narima gerbang. Naséhat lain vérifikasi langsung ngeunaan pancén, akun, atawa sambungan éksternal.

Sési Pitulung Claude Code jeung API nerapkeun kawijakan tanpa-parabot nu dirojong. Sési Pitulung asli Codex jeung Antigravity merlukeun idin komputer asli nu boga lokal nu geus aya. Lamun dinonaktipkeun, aplikasi bakal ngajelaskeun sarat awal ieu batan milih panyadia séjén. Ngan nu boga nu bisa ngaktipkeunana dina setélan kontrol lokal; asistén teu bisa ngaktipkeunana sorangan.

Pitulung Codex ngagunakeun kotak keusik ngan-baca sarta nolak pamundut persetujuan parabot. Antigravity ngagunakeun modeu rarancang jeung umbul kotak keusik aslina. Modeu asli ieu lain jaminan universal pikeun kurungan sistem operasi. Hash sumber-pituduh nangtukeun rujukan nu dipaké pikeun jawaban; pedaran nu dihasilkeun bisa kénéh waé salah, jadi pariksa bagian nu ditautkeunana saméméh meta. Jawaban nu leuwih heubeul ditandaan lamun vérsi sumber-pituduhna béda ti pituduh nu ayeuna.

Pituduh nu patali: [Pituduh kanonik jeung ngarumat tarjamahan](../../HELP_MAINTENANCE.md) · [Asistén aplikasi jeung idin](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Asistén jeung Telegram

Asistén ngagunakeun prasetél nu dipilih jeung API kontrol aplikasi nu sarua. Idin mariksa kaayaan jeung idin ngajalankeun operasi téh misah. Pariksa paréntah jeung hasilna: kalimah asistén lain bukti yén hiji tindakan geus réngsé.

Telegram ngan diaktipkeun ku nu boga lokal, kalawan token bot nu geus aya jeung ID numerik nu boga. Kontrol ieu husus keur obrolan pribadi nu boga éta. Bot nu can dikonfigurasi atawa teu aktip teu meunang nampa talatah aplikasi.

Ulah témpélkeun token bot kana obrolan biasa. Konfigurasi integrasi henteu ngabuktikeun konéktivitas Telegram jeung henteu otomatis nyieun bot. Tangkapan layar jeung réspon bisa ngandung data rohangan gawé nu sifatna pribadi.

Pilih prasetél asistén sarta bikeun idin operasi-aplikasi sacara misah ti pamariksaan. Éksekusi asistén Codex jeung Antigravity merlukeun idin asli nu boga; maranéhna moal diganti sacara cicing-cicing ku sési API atawa Claude nu tanpa-alat. Tangkapan layar bisa dipintonkeun dina obrolan asistén, tapi asupan modél ayeuna teu ngawengku analisis gambar. Ulah nganggap asistén geus mariksa gambar sacara visual saukur pédah manéhna mintonkeun éta gambar.

Asistén bisa mariksa ringkesan, pancén, obrolan, kaayaan alur gawé, kontéks prosés, jeung jandéla aplikasi ngaliwatan parabot nu boga tipe. Manéhna bisa ngarobah setélan biasa nu diidinan sarta ngajalankeun operasi aplikasi nu geus diotorisasi. Manéhna teu bisa méré hak asli, némbongkeun kredénsial nu diteundeun, ngarobah idin akar rohangan gawé ti kajauhan, atawa nyatujuan gerbang Forge saukur alatan praktis.

Pituduh nu patali: [Kontrak kontrol aplikasi](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Jalankeun bot Telegram pribadi anjeun

Jieun atawa piboga bot anjeun sorangan, mimitian obrolan pribadina, sarta asupkeun tokenna jeung Telegram pamaké numerik ID anjeun dina setélan kontrol lokal. Aktipkeun integrasi ngan lamun anjeun bener-bener hayang aplikasina nyambung. Nu boga ID mangrupa pamingpin pamaké, lain ngaran pamaké atawa bot ID. Ngan talatah ti pamaké éta dina obrolan pribadi nu sarua nu bakal ditarima.

Paké /start, /menu, atawa /status pikeun ringkesan vérsi nu keur jalan, jumlah proyék/pancén, sarta status pancén. Tombol-tombol bakal muka Proyék, Pancén, Tangkapan Layar, Pitulung, jeung Basa. Daptar némbongkeun dalapan item per kaca, kalawan navigasi Balik, Muat Ulang, Utama, jeung Saméméhna/Salajengna. Tombol proyék nyaring daptar pancén. Kartu pancén némbongkeun kamajuan alur gawé nu diteundeun, modél/prasetél, jeung pananya nu nungtut lamun aya.

Buka Obrolan pancén pikeun nilik sawangan obrolan nu muka/anyar jeung obrolan fase alur gawé. Unggal sawangan némbongkeun nepi ka genep talatah pamaké/asistén panganyarna, nu dipotong sacara écés nepi ka 200 karakter séwang-séwangan. Penalaran pribadi moal dipintonkeun. Maca riwayat henteu ngamimitian panyadia. Sawangan sifatna ngan-baca: téks biasa jeung /ask TEXT tetep ditujukeun ka asistén aplikasi, moal kungsi sacara implisit kana obrolan pancén nu keur ditempo ku anjeun.

Jalankeun / Teruskeun maca deui alur gawé Code atawa Work ayeuna sarta ngamimitian alur gawé nu diteundeun nu minuhan sarat. Jeda ménta jedana. Duanana henteu narima sarat, spésifikasi, rarancang, hasil tinjauan, atawa pananya; kaputusan nu tunda bakal nyegah Jalankeun. Jieun kaputusan dina aplikasi, atawa paké paréntah nu boga tipe nu geus diidinan sacara écés kalawan gerbang jeung révisi ayeuna nu pas.

Paké Basa atawa /language pikeun milih salah sahiji ti 56 basa antarbeungeut dumasar ngaran aslina. Ieu nyimpen préferénsi pikeun bot ieu jeung nu boga wungkul. Paké basa aplikasi ngahapus préferénsi éta. Ieu henteu ngarobah basa aplikasi atawa idin aksés; talatah nu geus aya henteu dikirimkeun deui sacara otomatis.

Navigasi biasana ngamutahirkeun talatah ménu nu dipedalkeun nu sarua. Tombol-tombol boga idéntitas burem nu bakal kadaluwarsa sanggeus 15 menit sarta ngan bisa dipaké sakali; ngarobah kartu ngabatalkeun tombol-tombol heubeulna. Tombol nu geus kadaluwarsa, béak dipaké, talatah teu cocog, jeung prosés saméméhna teu bisa ngajalankeun tindakan. Talatah nu geus pasti teu bisa diédit bisa diganti ku kartu anyar; kasalahan jaringan nu teu dipikanyaho moal diulang deui salaku talatah anyar.

Nalika diaktipkeun, poller miceun tumpukan heubeul sarta nyatet panarimaan pamutakhiran saméméh dikirimkeun sangkan paréntah nu kapotong henteu otomatis diputer deui dina waktu ngamimitian deui. Ieu nyegah pamuteran ulang; tapi teu ngajamin paréngséan. Pariksa status/kontéks saméméh ngaluarkeun pagawéan anyar sacara dihaja sanggeus kasalahan. Henteu aya béwara status pancén otomatis.

Paréntah écés tetep sadia: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot, jeung /ask TEXT. /new {JSON} nyieun pancén ngaliwatan createTask nu boga tipe; /command {JSON} ngirimkeun paréntah katalog nu écés. Baca katalog langsung pikeun wangun argumén. Otorisasi backend jeung idin folder nu sarua lumaku saperti dina aplikasi.

Aplikasi moal kungsi ngirimkeun ajén token-bot nu diteundeun ka asistén. Tangkapan layar, ringkesan, jeung téks obrolan sanajan kitu bisa waé ngandung inpormasi proyék nu pribadi. Eureunkeun integrasi sacara lokal lamun akun bot atawa nu boga geus teu dipercaya deui. Puter token nu bocor jeung panyadia bot, tuluy mutahirkeun konfigurasi énkripsi lokalna.

Pituduh nu patali: [Bot pribadi jeung paréntah](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Idin komputer asli husus-nu-boga

Aksés komputer asli mimitina dina kaayaan pareum. Ngan nu boga nu bisa ngaktipkeunana dina Setélan lokal → Kontrol jarak jauh. Asistén jeung paréntah HTTP/MCP/Telegram teu bisa ngaktipkeun umbul ieu pikeun maranéhna sorangan. Lamun hiji operasi ditolak, asistén kudu ngajelaskeun setélan ieu sarta ngantepkeun nu boga nu mutuskeun.

Nalika diaktipkeun sacara écés, computer.run nampa hiji berkas nu bisa dieksekusi, larik argumén, sarta folder gawé mutlak pilihan. Ieu teu ngagunakeun interpolasi cangkang, boga wates waktu 30 detik, sarta ngawatesan kaluaran nepi ka 1 MiB. Folder nu dibikeun lamun leungit atawa teu sah bakal ditolak; ngaleungitkeun cwd bakal ngagunakeun folder setélan milik aplikasi, lain HOME. Kaluar ngabolaykeun paréntah aktip milikna sarta ngadagoan prosésna réngsé diberesihan.

Wengkuan baca/operasi aplikasi jeung aksés asli mangrupa kaputusan nu misah. Hiji tangkal gawé teu ngawatesan aksés sistem berkas ti panyadia nu teu diwatesan. Cabut aksés asli sanggeus pancénna réngsé lamun geus teu diperlukeun deui, sarta pariksa resi paréntah batan narima carita asistén salaku bukti.

Pituduh nu patali: [Kontrak kontrol husus-nu-boga](../../../shared/control.ts).

<a id="remote"></a>

## Panyungsi jeung instansi jarak jauh

Nu boga lokal ngaktipkeun sérver sarta milih alamat, port, jeung wengkuanana: baca pikeun pamariksaan atawa operasi pikeun tindakan. Alamat standar 127.0.0.1 ngan sadia dina komputer ieu. 0.0.0.0 ngadéngékeun dina antarbeungeut jaringan; pariksa deui aksés jaringan saméméh ngaktipkeunana.

Panyungsi muka antarbeungeut nu sarua sanggeus asup ngagunakeun token. Ulah ngasupkeun token dina tautan publik atawa tangkapan layar. HTTP wungkul henteu ngénkripsi patalimarga; paké saluran nu ditangtayungan dina jaringan nu teu bisa dipercaya.

Nu boga ngonpigurasikeun instansi séjén dumasar kana URL jeung token. Backend nyalurkeun pamundut ngaliwatan proxy; ieu henteu nyalin proyék maranéhna kana mesin lokal. Pariksa instansi nu dipilih saméméh unggal tindakan.

Paréntah jeung kajadian nu boga tipe mawa kontrol aplikasi. Wengkuan baca henteu méré otorisasi pikeun mutasi pancén. Kontrol komputer asli mangrupa pilihan misah ti nu boga lokal sarta mimitina dina kaayaan pareum.

Aplikasi kudu tetep jalan pikeun panyungsi, Telegram, jeung kontrol agén-éksternal. Unggal instansi boga profil pribadi, kaayaan pancén, token, jeung port sérverna sorangan. Ulah maké deui hiji profil sacara barengan di antara instansi-instansi nu mandiri. Kajadian panyungsi jeung réspon paréntah kawates dina instansi nu dipilih; pindah UI henteu mindahkeun berkas atawa nyalin login asli.

Pituduh nu patali: [Kontrol HTTP jeung instansi](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes jeung agén éksternal lianna

Paké API kontrol-aplikasi nu geus diauténtikasi atawa sasak stdio MCP bawaan. Aktipkeun sérverna sacara lokal, pilih baca atawa operasi, sarta konpigurasikeun unggal klien kalawan URL jeung token instansi éta. Node.js 22 atawa nu leuwih anyar diperlukeun pikeun ngajalankeun sasak MCP mandiri; aplikasi Electron teu masangkeun klien agén anjeun. URL panyungsi lain titik tungtung HTTP MCP nu bisa distrim: pasangkeun éta salaku ZIAFORGE_URL kana sasak stdio.

Sasak némbongkeun ziaforge_status, ziaforge_commands, ziaforge_command, jeung ziaforge_screenshot. Mimitian ku status jeung katalog paréntah langsung, tuluy baca system.context pikeun pancén nu dipilih. Paréntah nu boga tipe nuturkeun pamariksaan révisi, gerbang, folder-pancén, jeung diberesihan nu sarua jeung UI lokal.

Katalog paréntah langsung ngawengku documentation.guide, pituduh basa Inggris kanonik, kalawan jalur sumber jeung sourceSha256-na. Arsitek aplikasi internal narima rujukan nu sarua ngaliwatan parabotna. Ieu méré agén sakabéh kontéks produk tanpa gumantung kana catetan heubeul; dokuméntasi moal kungsi méré aksés atawa ngagantikeun kaputusan manusa ayeuna.

Agén kudu ngadiskusikeun sarat, kaputusan téknis, jeung rarancang dumasar kana hiji gagasan ringkes ti manusa. Maranéhna kudu ngajaga gerbang écés ti manusa, modél nu dipilih, kawijakan manual/Auto, sarta révisi nu diperlukeun. Maranéhna teu meunang ngadaweung nyieun persetujuan sorangan, maénkeun deui paréntah nu teu pasti dina handapeun ID anyar, atawa medalkeun parobahan Git tanpa kahayang ti nu boga.

Konpigurasikeun sawatara sérver MCP nu dingaranan pikeun sababaraha pamasangan. Pindah instansi téh mangrupa kaputusan rute, lain sinkronisasi. Conto konfigurasi OpenClaw jeung Hermes aya dina AGENT_CONTROL.md; setélan husus klien jeung kasaluyuan kudu dipariksa keur vérsi klien nu dipasang.

Cache requestId luar ngan saukur miceun duplikat ti sakumpulan pamundut nu kawates sawaktos aplikasi keur jalan. Operasi nu tahan lila ngagunakeun idéntitasna sorangan: createRequestId pikeun nyieun pancén, commandId pikeun kaputusan alur gawé, clientMessageId pikeun talatah, sarta operationId pikeun mutasi Git. Pertahankeun idéntitas jeung payload aslina sanggeus narima konfirmasi nu teu dipikanyaho; baca kaayaan nu diteundeun saméméh ngaluarkeun pagawéan anyar kalawan kahaja.

Pituduh nu patali: [Pituduh klien MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI lokal jeung wates otomatisasi

Panyalur ziaf ngadalikeun aplikasi nu keur jalan jeung alur gawé nu diteundeun nu sarua. Ti kode sumber, paké npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, atawa npm run ziaf -- pause --task TASK_ID. Pangakuan Mimitian nu hasil henteu hartina pancén geus réngsé.

--until-success sacara dihaja ngaktipkeun Auto pikeun alur gawé nu diteundeun, tapi pananya, tinjauan, gerbang panarimaan, wates, jeung titik pamariksaan tetep lumaku. Ctrl+C kaluar ti panyalur nu keur niténan; ieu henteu sacara implisit ngeureunkeun alur gawé aplikasi. Tingali CLI.md pikeun kode kaluar, titik tungtung lokal, sarta pananganan profil.

Antarbeungeut Otomatisasi ayeuna nyimpen définisi pintonan jeung pangétang jalan lokal. Ieu lain panyusun jadwal kanceuh nu kasértifikasi sarta henteu ngabuktikeun yén hiji giliran modél latar tukang geus jalan. Pikeun éksekusi nyata, paké kadali alur gawé nu diteundeun, ziaf, atawa API nu geus diauténtikasi sarta pariksa resi maranéhna. Ulah salah nganggap panél démonstrasi salaku panyusun jadwal tanpa pangawasan.

Pituduh nu patali: [Paréntah panyalur](../../CLI.md).

<a id="updates"></a>

## Vérsi jeung pembaruan

Ngeunaan némbongkeun vérsi pasti nu keur jalan. Pembaruan publik merlukeun répositori rilis GitHub nu dipercaya sarta saluran stabil atawa sawangan. Pamariksaan, ngundeur, jeung pamasangan mibanda kaayaan nu misah; kasalahan henteu hartina hiji pembaruan geus dipasang.

Pamasangan otomatis nyaéta pikeun rilis macOS nu ditandatanganan. Wangunan pamekaran nu teu ditandatanganan moal otomatis dipasang ngaliwatan mékanisme ieu. Pikeun ngaganti sacara manual, kaluar sapinuhna ti aplikasi ayeuna sarta paké artéfak nu geus divérifikasi.

Pamariksaan otomatis langsung jalan nalika diaktipkeun, tuluy unggal genep jam sakali.

Stabil henteu ngasupkeun rilis sawangan; sawangan ngawenangkeun ogé rilis pamekaran. Pamariksaan nu hasil ngan netepkeun métadata rilis nu sadia. Ngundeur jeung masang merlukeun pakét platform jeung eupan rilis nu dikonfigurasi. Pangiriman Linux DEB mangrupa jalur pamasang nu misah; ulah nganggap hiji DEB bakal ditingkatkeun sacara otomatis ku mékanisme pembaruan macOS.

Pituduh nu patali: [Kasiapan rilis](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Mimitian deui jeung pamulihan

Dina macOS, paké Kaluar / ⌘Q pikeun mareuman sapinuhna. Nutup jandéla bisa waé ngantepkeun aplikasi tetep jalan. Pareumkeun sapinuhna vérsi heubeul saméméh ngaganti aplikasina.

Sanggeus dibuka deui, pilih pancén nu sarua. Riwayat jeung draf bakal balik deui. Teruskeun mulangkeun kontéks asli/lokal tapi henteu ngirimkeun draf, henteu ngaleupaskeun jeda antrian, atawa henteu méré otorisasi pikeun ngulang operasi nu teu dipikanyaho.

Lamun Pamulihan némbongan, ulah ngédit JSON ku leungeun. Pariksa jinis dokumén nu kapangaruhan, simpen berkas aslina, sarta pilih cadangan nu geus divalidasi. Mulangkeun antrian nu leuwih heubeul bakal nandaan item-itemna salaku teu pasti.

Nalika pangiriman teu dipikanyaho, alur gawé nu dikokolakeun meureun merlukeun idin écés pikeun kontéks nu anyar. Pagawéan saméméhna jeung usaha nu gagal tetep aya; panolakan nu katingali leuwih aman batan hasil rekaan nu palsu.

Cadangkeun berkas pancén jeung profil aplikasi kalawan sakabéh instansi aplikasi ditutup. Folder nu disalin lain pamulihan nu geus diuji. Lamun pamulihan ménta anjeun milih cadangan nu geus divalidasi, simpen ogé berkas pasti nu ruksakna. Mulangkeun alur gawé atawa antrian nu leuwih heubeul henteu méré otorisasi pikeun muter deui inferénsi atawa operasi Git nu teu pasti.

Pituduh nu patali: [Kontrak pamulihan](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Pamérésan masalah

CLI teu kapanggih: pariksa pamasangan jeung vérsina dina terminal biasa, tuluy mimitian deui ZIAForge. Berkas nu bisa dieksekusi aya henteu hartina anjeun geus asup log. Paké mékanisme asup log milik panyadiana sorangan.

Modél teu sadia atawa otorisasi gagal: muat ulang papanggihan, pilih ID nu sadia, sarta pariksa akun jeung watesan anjeun. Ulah ngulang pamundut nu can pasti saméméh mariksa riwayatna.

Alur gawé eureun: buka fase ayeuna, pananya, resi vérifikasi, atawa log CLI. Rékéhkeun sabab hususna: pananya nu can diwaler, paréntah, idin folder, atawa wates usaha. Teruskeun moal bisa ngarobah pamariksaan nu gagal jadi suksés.

Folder leungit atawa diganti: pulihkeun aksés kana folder aslina atawa jieun pancén anyar. Aplikasi teu meunang nuluykeun ti HOME. Lamun anjeun nempo cwd séjén, eureunkeun giliran sarta amankeun diagnostik.

Pikeun laporan, lampirkeun vérsi Ngeunaan, rute, CLI/modél, paripolah nu diarepkeun jeung nu sabenerna kajadian, tangkapan layar, sarta petikan log nu aman. Hapus rusiah, eusi pribadi, jeung jalur nu teu meunang dipublikasikeun.

Kaca jarak jauh teu sadia: pastikeun nu boga geus ngaktipkeun sérver, pariksa alamat jeung port nu ngadéngékeun, tuluy lakukeun auténtikasi ku token instansi nu bener. 401 nandakeun auténtikasi; mutasi nu ditolak bisa jadi alatan wengkuan baca atawa kontrol husus-nu-boga. Ngarobah token bakal nutup klien panyungsi nu aya. Ulah némbongkeun port pamariksaan DevTools nu misah salaku kontrol aplikasi jarak jauh.

Nyimpen éditor ditolak: simpen draf, pariksa berkas ayeuna dina piringan, sarta réngsékeun konflik parobahan éksternal. Ulah ngaliwat babandingan ku cara nulis ulang métadata aplikasi. Lamun muka berkas gedé sapinuhna teu sadia, paké éditan/panyarian jandéla nu dirojong atawa éditor éksternal.

Telegram teu sadia: pastikeun token bot, nu boga numerik, obrolan pribadi, jeung statusna sacara lokal. Webhook atawa poller nu paséa bisa ngahalangan polling; ZIAForge henteu otomatis ngahapus webhook atawa ngarebut poller séjén. Paréntah nu ditolak atawa kapotong dina wates nu teu dipikanyaho moal otomatis diputer deui.

Pituduh nu patali: [Pangujian jeung diagnosis](../../TESTING.md).

<a id="diagnostics"></a>

## Laporkeun masalah jeung pariksa bukti

Catet vérsi wangunan nu keur jalan sacara pas ti Ngeunaan, OS/arsitektur, modeu pancén, panyadia/modél nu dipilih, sarta léngkah-léngkah nu ngahasilkeun deui masalahna. Jéntrékeun hasil nu diarepkeun jeung hasil nu katingali. Lampirkeun tangkapan layar nu aman sarta resi paréntah atawa vérifikasi nu relevan nu masih aya, lain sakabéh profil pribadi.

Log CLI, jurnal kajadian, transkrip modél, tapak panyungsi, jeung tangkapan layar bisa némbongkeun kode sumber, jalur pribadi, atawa token. Pariksa jeung rédaksian saméméh dibagikeun. Pangrédaksi log saaya-aya henteu ngajamin yén tangkapan layar atawa arsip téh pantes dipublikasikeun.

Pikeun kontributor, qa:doctor maca idéntitas lingkungan/wangunan; qa:inspect muka profil nu diisolasi kalawan rintisan panyadia. Hiji fixture ngabuktikeun jalur aplikasi nu diuji tanpa ngahubungan modél. Inferénsi langsung, konéktivitas Telegram, déstop Linux asli, panandatanganan, jeung pamariksaan artéfak nu dibungkus mangrupa bukti-bukti nu misah. Tingali TESTING.md pikeun paréntah nu bisa ditiron deui sarta cara meresihanana.

Pituduh nu patali: [Paréntah bukti](../../TESTING.md).

<a id="privacy"></a>

## Data lokal jeung watesan

Proyék, riwayat, rarancang, dokumén, jeung diagnostik bisa waé ngandung téks pribadi. Ulah medalkeun profil, rékaman atah, konci, atawa log lengkep bareng jeung kode sumber.

Dina Linux, nyimpen kredénsial API, kontrol, Telegram, jeung instansi merlukeun GNOME Secret Service atawa KWallet nu teu dikonci; tanpa panyimpen rusiah nu dirojong, ZIAForge nolak nyimpen rusiah-rusiah ieu batan ngagunakeun cadangan basic_text ti Electron.

Panyimpenan lokal teu ngandung harti yén pamundut tetep aya dina komputer anjeun: CLI/API nu dipilih ngirimkeunana ka panyadiana. Folder gawé jeung pangawasan prosés lain isolasi OS. Pariksa idin nu dipilih.

Bédakeun rupa-rupa bukti: fixture nguji aplikasi tanpa modél; langsung asli ngajalankeun CLI/akun nyata; pamariksaan bungkusan nyértifikasi artéfak husus. Hasil lulus dina salah sahijina teu ngajamin nu séjénna.

Wengkuan aplikasi, tangkal gawé, jeung pamundut ngan-baca béda ti panerapan sistem operasi. Kawijakan pamarios/pangbantu Antigravity ngaditéksi parobahan dina bukti rohangan gawé nu dikumpulkeun batan nerapkeun aksés sistem berkas nu ngan-baca. Kontrol komputer asli ngajalankeun program nu diidinan ku nu boga di luar wates parabot-aplikasi biasa; pareumkeun ieu lamun geus teu diperlukeun deui.

Pituduh nu patali: [Asal-usul jeung publikasi](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Pikaharti jeung robah proyék sumber kabuka ieu

Baca AGENTS.md jeung CONTRIBUTING.md leuwih ti heula, tuluy PROJECT_MAP.md pikeun wates-wates sumber ayeuna. Kontrak boga tipe nu diterapkeun sarta dokumén alur gawé/panyadia ayeuna ngatur paripolahna. CONCEPT.md jeung bagian terminal-heula dina ARCHITECTURE.md ngajaga maksud sajarah sarta teu meunang disalahartikeun salaku klaim rilis ayeuna.

Sumber pitulung basa Inggris nyaéta docs/help/en.json. Ulah ngédit langsung ku leungeun berkas nu dihasilkeun USER_GUIDE.md atawa website/guide.html. Robah bagian kanonikna, perbarui kontrak nu kapangaruhan, sarta jalankeun node scripts/help/generate.cjs. Pitulung dina aplikasi maca sumber nu sarua. Tilik deui panambahan kalawan palaksanaan sabenerna, kaasup watesan, idin, jeung jalur nu teu dirojong.

Unggal ti 56 lokal antarbeungeut mibanda status pitulung nu misah dina docs/help/locales.json. Pitulung nu leungit atawa can lengkep bakal balik deui ka basa Inggris. Awak hasil tarjamahan mesin nu lengkep dibéré labél sarta diiketkeun kana hash sumber basa Inggris, tanpa aya klaim pamariksaan manusa. Tarjamahan nu ditilik ku manusa sacara tambahan nyatet pamariosna. Unggal tarjamahan kudu ngajaga ID bagian, tindakan, pamingpin berkas/paréntah, jeung wates téknis, ngagunakeun arah nu bener, sarta ditarik anyar nalika sumber basa Inggrisna robah.

Saméméh ngirimkeun, jalankeun node scripts/help/generate.cjs --check pikeun ngaditéksi kaluaran hasil nu geus basi, parancah lokal nu teu sah, atawa tautan kontrak lokal nu rusak. Pamariksaan tarjamahan UI jeung pamariksaan paripolah aplikasi tetep misah. HELP_MAINTENANCE.md nyadiakeun prosedur pamutakhiran kontributor jeung AI; dokuméntasi teu meunang ngaku-ngaku lulus tés nu henteu dijalankeun.

Pituduh nu patali: [Peta proyék ayeuna](../../PROJECT_MAP.md) · [Ngarumat dokuméntasi](../../HELP_MAINTENANCE.md) · [Pituduh kontributor](../../../CONTRIBUTING.md) · [Pituduh agén](../../../AGENTS.md).
