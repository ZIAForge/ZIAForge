<!-- Generated from docs/help/en.json; source SHA-256 910098d2b61e07851b0a1433429a6bf1ee342749ea1fdc4885d1e63afda3cd7f. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: tl; served locale: tl; status: machine-translated. -->
# Gabay ng gumagamit ng ZIAForge

Mula sa layunin patungo sa napatunayang resulta. Isang praktikal na gabay para sa Code, Work at pagkontrol sa aplikasyon.

Ingles ang opisyal na batayan. Ang tulong na isinalin ng makina ay nakahiwalay ang label mula sa mga salin na sinuri ng tao. Hindi pinatutunayan ng mga awtomatikong pagsusuri ang kawastuhan sa katutubong wika.

> Ang gabay na ito ay isinalin ng makina mula sa kasalukuyang pinagmulang Ingles. Malugod pa ring tinatanggap ang pagsusuri ng tao.

## Mga seksyon ng gabay

- [Mga unang hakbang](#start)
- [I-install ang tamang desktop package](#install-platforms)
- [Code: limang ruta](#code)
- [Talakayan sa Forge](#forge)
- [Mga dokumento at desisyon](#decisions)
- [Pagpapatupad at pagsusuri](#execution)
- [Magkakasabay na pangkat ng pagsusuri at ang arkitekto ng ulat](#review-teams)
- [Mga espesyalisasyon ng ahente at patakaran sa prompt](#specializations)
- [Work: mula sa tanong patungo sa dokumento](#work)
- [Mga preset, modelo at access](#models)
- [Mga chat, Hinto at ang pila](#chat)
- [Mga file, Git at pagkumpleto](#files)
- [API connections](#api)
- [Mga setting, mga wika at ligtas na pag-reset](#settings)
- [Magtanong sa assistant ng Tulong](#help-assistant)
- [Assistant at Telegram](#assistant-control)
- [Patakbuhin ang iyong pribadong bot sa Telegram](#telegram)
- [Pahintulot sa katutubong computer ng may-ari lamang](#native-permissions)
- [Browser at mga malayuang instance](#remote)
- [OpenClaw, Hermes at iba pang panlabas na agent](#external-agents)
- [Lokal na CLI at mga limitasyon ng automation](#local-cli)
- [Bersyon at mga update](#updates)
- [Pag-restart at pagbawi](#restart)
- [Pagtugon sa mga problema](#troubleshooting)
- [Mag-ulat ng mga problema at sumuri ng ebidensya](#diagnostics)
- [Lokal na data at mga hangganan](#privacy)
- [Unawain at baguhin ang open-source na proyektong ito](#project-contributors)

<a id="start"></a>

## Mga unang hakbang

Pinapanatili ng ZIAForge ang talakayan, pagpaplano, pagpapatupad at pagpapatunay sa iisang gawain. Piliin ang Code para sa isang proyekto ng Git, o Work para sa mga dokumento, pananaliksik at iba pang mga resulta sa isang karaniwang folder.

Magsimula sa isang maliit na gawain sa isang hiwalay na proyekto. Kung pipiliin mo ang isang katutubong CLI, i-install ito at mag-sign in muna gamit ang sarili nitong account sa isang terminal. Bilang alternatibo, mag-configure ng koneksyon ng API. Magkahiwalay na paraan ng koneksyon ang subscription sa CLI at bayad na API; hindi ka isina-sign in o naglilipat ng mga credit ang ZIAForge sa pagitan ng mga ito.

1. Buksan ang Mga Setting at suriin ang folder ng workspace at wika. Ipinapakita ng Tungkol sa ang eksaktong pagkakakilanlan ng tumatakbong build.
2. Para sa Code, magdagdag ng repositoryo ng Git sa sidebar. Para sa Work, pumili ng hiwalay na folder kapag lumilikha ng gawain.
3. Mag-save ng preset na may CLI, modelo, pagsisikap sa pangangatwiran at antas ng access. Maaari mo ring piliin ang Custom nang direkta nang walang naka-save na preset.
4. Lumikha ng gawain, piliin ang ruta, mga tungkulin at manu-mano o awtomatikong pagsulong nito. Suriin ang mga pinili bago ang Simulan.

> Gamitin ang artifact at checksum na ibinigay ng maintainer. Maaaring hindi nalagdaan ang isang preview o walang nai-publish na feed ng update. Dapat mapatunayan ang suporta sa desktop at katutubong provider para sa eksaktong OS, arkitektura at artifact; ang suporta sa source lamang ay hindi sertipikasyon ng release.

Mga kaugnay na tagubilin: [Pangkalahatang-ideya ng proyekto](../../../README.md) · [Pagiging tugma ng provider](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## I-install ang tamang desktop package

Pumili ng package para sa iyong operating system at arkitektura ng CPU: x64 o arm64. Kayang gumawa ng build pipeline ng mga format na macOS DMG/ZIP, Windows NSIS installer/ZIP, at Linux DEB/RPM/AppImage/tar.gz/ZIP. Ang isang nagawang file o cross-build ay hindi patunay na pumasa ang installer nito at katutubong UI sa iyong makina; kumonsulta sa talaan ng pagpapatunay ng release na iyon.

Ang mga build ng macOS na gumagamit ng Electron 44 ay nangangailangan ng macOS 13 o mas bago. Gamitin ang package na arm64 sa Apple Silicon at ang package na x64 para sa Intel. Ganap na ihinto ang lumang app bago magpalit. Maaaring hindi nalagdaan at hindi notarized ang mga preview package; huwag ipagkamali ang isang artifact ng pagbuo bilang isang nilagdaang pampublikong release.

Nangangailangan ang Windows ng operating system na sinusuportahan ng kasamang bersyon ng Electron at Git na available sa PATH. Piliin ang tumutugmang arkitektura. Walang sertipikasyon ng Authenticode ang isang hindi nalagdaang preview. Dapat panatilihin ng isang portable na ZIP ang kumpletong directory ng aplikasyon at mga runtime file, hindi lamang ang executable nito.

Nangangailangan ang Linux ng katugmang graphical desktop, mga library ng system na kinakailangan ng Electron, at Git. Para sa mga naka-encrypt na kredensyal sa pagkontrol, magbigay ng gumaganang Secret Service tulad ng gnome-libsecret o KWallet; hindi tinatanggap ang hindi ligtas na basic_text backend. Hindi pinatutunayan ng ebidensya ng smoke test sa headless/container ang bawat desktop o pamamahagi.

Mag-install ng DEB gamit ang apt install ./file.deb, o mag-install ng RPM sa pamamagitan ng package manager ng iyong pamamahagi. Nangangailangan ang isang AppImage ng pahintulot na maipatupad at angkop na suporta sa FUSE; isang alternatibo ang --appimage-extract-and-run kung saan sinusuportahan. I-extract ang mga package ng tar.gz at ZIP kasama ang lahat ng kanilang runtime file. Panatilihing magkahiwalay ang data ng gumagamit at mga file ng aplikasyon kapag nagpapalit ng package.

Upang bumuo mula sa source, gumamit ng Node 24, Git at npm ci, kabilang ang normal na installer ng Electron. Nangangailangan ang mga katutubong muling pagbuo ng mga tool ng platform: mga command-line tool ng Xcode sa macOS; MSVC C++, Windows SDK at Python sa Windows; compiler, make, Python, pkg-config at ang kinakailangang mga packaging tool sa Linux. Sundin ang PLATFORM_BUILDS.md para sa eksaktong mga utos at kasalukuyang limitasyon ng platform.

Nakalaan sa gitna ang mga bersyon ng release at hindi nababago ang mga output. Ang isang verification build ng CI ay hindi isang nai-publish na installer. Naglalaman ang mga archive ng source ng source, lockfile, dokumentasyon at mga script; hindi kasama ang mga dependency, kredensyal, profile ng gumagamit at pribadong pananaliksik. Huwag kailanman ipalagay ang katutubong pagpapatunay ng ARM o Windows mula sa isang matagumpay na build ng x64.

Mga kaugnay na tagubilin: [Mga package ng platform, mga kinakailangan at mga limitasyon sa pagpapatunay](../../PLATFORM_BUILDS.md) · [Pagkakakilanlan ng build at mga pagsusuri sa release](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: limang ruta

Tinutukoy ng Auto ang saklaw: maaaring magtapos sa isang sagot ang isang simpleng tanong, samantalang nangangailangan ng paghahanda ang isang mas malaking gawain. Nagsisiyasat ng dahilan at naghahanda ng pagwawasto ang Ayusin ang bug. Nagsisimula sa teknikal na solusyon ang Unahin ang spec; nagsisimula sa mga kinakailangan at pamantayan sa pagtanggap ang Unahin ang mga kinakailangan.

Gumagamit ang Maraming modelo ng magkakahiwalay na konteksto para sa paggalugad, disenyo, pagpapatupad at pagsusuri. Hindi nangangailangan ang pangalan ng ruta ng magkakaibang mga provider: ginagamit ng bawat tungkulin ang preset o Custom na pagsasaayos na iyong pinili.

Ibinubukod ng Worktree ang mga pagbabago sa Git ng isang gawain. Gumagana ang Branch sa napiling checkout. Suriin ang proyekto, branch at modelo bago magsimula; hindi rin ipinapadala ang paglalarawan ng gawain sa isang karaniwang chat.

Para sa isang ideyang may hindi pa nalulutas na mga pagpipilian sa produkto o teknikal, gamitin ang Unahin ang mga kinakailangan at buuin ang pundasyon sa talakayan. Inuuri ng Auto ang kahilingan; hindi ito utos na ipatupad agad ang bawat maikling parirala. Pinapanatili ng I-save ang draft ang kahilingan nang hindi nakikipag-ugnayan sa isang modelo; sine-save at inilulunsad ng Simulan ang pinamamahalaang daloy nang isang beses. Ang isa hanggang apat na kopya ng gawain ay may mga independiyenteng ID ng paggawa at mga setting ng tungkulin.

Mga kaugnay na tagubilin: [Kontrata ng daloy ng trabaho ng Code](../../WORKFLOWS.md) · [Mga profile ng prompt ng Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Talakayan sa Forge

Binubuksan ng Simulan ang gitnang talakayan. Sumagot nang natural, magtanong ng mga pabalik na tanong, magdagdag ng mga limitasyon at talakayin ang mga teknikal na pagpipilian. Nananatili sa gawain ang pag-uusap at mga tanong.

Hindi tumatanggap ng dokumento o nagpapahintulot ng bagong plano sa pagpapatupad ang pagpapadala ng teksto. Ang isang paglilinaw sa panahon ng pagpapatupad ay unang nagpo-pause sa pinamamahalaang turn at muling bumibisita sa apektadong saklaw. Ang pagsagot sa isang tanong sa loob ng isang natanggap nang hakbang ay maaaring magpatuloy sa hakbang na iyon.

Upang sinasadyang muling bisitahin ang pundasyon, piliin ang Mga Kinakailangan, Detalye o Pagpaplano. Ang isang bagong bersyon ay nangangailangan ng panibagong pagtanggap sa mga nakadependeng desisyon. Nananatili ang mga nakumpletong hakbang at ang kanilang ebidensya; nananatili sa kasaysayan ang mga napalitan nang hindi natapos na yugto.

Iba ang mga pinamamahalaang session ng yugto sa libreng chat. Gamitin ang talakayan sa Forge sa halip na direktang magpadala ng mga manu-manong prompt sa isang session na pagmamay-ari ng daloy ng trabaho.

Mga kaugnay na tagubilin: [Kontrata ng talakayan sa Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Mga dokumento at desisyon

Magbukas ng dokumento, suriin ang bersyon nito at gumawa ng mga pag-edit kung kinakailangan. Gumagawa ng bagong bersyon ang pagsusumite ng mga pag-edit sa pamamagitan ng talakayan; hindi muling isinusulat nang pabalik ang mga ulat at napatunayang resulta.

Bago tanggapin ang isang iminungkahing plano, i-edit ang pagkakasunod-sunod, mga tagubilin, pamantayan sa pagtanggap at mga utos sa pagpapatunay. Pahintulutan ang mga kongkretong utos na iyong nauunawaan: tumatakbo ang mga ito sa folder ng gawain. Nagmumungkahi ang Maraming modelo ng isang hakbang sa pagpapatupad para sa buong gawain, na may mga detalye sa mga dokumento at tagubilin nito.

Ang Aprubahan ay isang hiwalay at sinadyang desisyon. Hindi nilalampasan ng Auto ang mga tanong o pagtanggap sa mga kinakailangan, detalye at mga plano. Hindi maaaring muling gamitin ng isang dokumentong binago sa labas ang isang lumang pag-apruba.

Lumalabas ang mga file ng paghahanda bilang mga artifact. Ikinakabit sila ng kanilang bersyon, yugto ng paggawa at hash sa isang resulta. Pinapanatili ang mga dokumento ng Code sa labas ng worktree at hindi awtomatikong pumapasok sa isang commit.

Suriin kapwa ang dokumento at ang ipinapakitang desisyon bago tanggapin. Ikinakabit ng pagtanggap ang kasalukuyang ID ng gate, rebisyon ng plano at napanatiling mga hash ng dokumento. Humiling ng mga pagbabago kapag mali ang saklaw o ebidensya. Kung naging luma na ang isang desisyon, muling i-load ang naka-save na estado bago gumawa ng bagong pagpili; hindi maaaring tanggapin ang isang binagong file sa ilalim ng mas naunang bersyon.

Mga kaugnay na tagubilin: [Mga gate ng daloy ng trabaho at mga bersyon ng dokumento](../../WORKFLOWS.md).

<a id="execution"></a>

## Pagpapatupad at pagsusuri

Ipinapakita ng Mga dapat gawin ang mga tunay na hakbang, ang kasalukuyang pagsubok, pagpapatunay at mga kinalabasan ng pagsusuri. Ang pagsasabi ng ahente ng “tapos na” ay hindi nakukumpleto sa isang hakbang: dapat umiral ang kinakailangang ebidensya ng plano.

Pumipigil ang manu-manong mode sa pagitan ng mga karapat-dapat na hakbang. Isinusulong ng Auto ang mga napatunayang hakbang at pinapayagan ang may-hangganang muling pagsubok. Palaging lumilikha ng checkpoint ang Huminto pagkatapos. Pinipigil ng I-pause ang aktibong gawain ng daloy ng trabaho; hindi ito pinipigil ng pagsasara ng panel.

Gumagamit ang isang independiyenteng tagasuri ng hiwalay na konteksto na may mga file at resulta ng pagpapatunay. Dapat malutas ang bawat kinakailangang humaharang na natuklasan; hindi maiboboto palayo ng maraming tagasuri ang isang humaharang na error.

Sa Maraming modelo, nangangailangan ng tahasang desisyon ang pagwawasto sa mga natuklasan. Hindi tahimik na nagsisimula ang pagwawasto ng isa pang pagsusuri: nagbubukas ang Muling suriin ng isang bagong siklo. Maaaring humiling ang mga komento sa pagsusuri ng muling pagsasaalang-alang ng tagapag-ugnay nang hindi inuulit ang pagpapatupad.

Hindi maaaring tahimik na i-edit ang mga nakumpletong hakbang. Sa TDD, dapat talagang bumagsak ang Red sa inaasahang dahilan, pagkatapos ay dapat pumasa ang Green. Pinipigilan ng may-hangganang mga pagsubok ang walang katapusang muling pagsubok.

Mag-save ng mga independiyenteng tagasuri ng CLI/API sa Mga Setting → Mga pangkat ng pagsusuri, pagkatapos ay piliin ang pangkat sa Code o Work. Tumatakbo nang magkakasabay ang mga tagasuri, na sinusundan ng arkitekto ng ulat ng pangkat. Maaari ka ring mag-configure ng mga independiyenteng tagasuri nang walang naka-save na pangkat. Tanging di-nagpapakilalang mga nakabalangkas na ulat ang natatanggap ng arkitekto ng ulat, nang walang mga file ng proyekto o mga tool; kasalukuyang nangangailangan ang pagbubukod na ito ng Claude Code o API.

Nangangailangan ang bawat hakbang sa pagpapatupad ng isang maipapatupad na pagsusuri, kinakailangang independiyenteng pagsusuri, o pareho. Sa halip, pinapanatili ng mga yugto ng paghahanda ang mga napatunayang resulta at mga resibo ng artifact; hindi nagpapanggap ang mga ito na tumakbo ang mga pagsusuri sa pagpapatupad. Nagtatagumpay lamang ang isang utos kapag nakumpirma ang aktwal nitong katayuan sa paglabas at paglilinis ng pagmamay-aring proseso. Dapat karaniwang bumagsak ang isang pagsusuri ng Red para sa TDD bago ang pagpapatupad at pagpapatunay ng Green; ang nawawalang executable o timeout ay hindi wastong resulta ng Red.

Humihinto ang mga default na circuit breaker pagkatapos ng tatlong nabigong pagsubok sa isang hakbang o limampung pagsubok sa kabuuan. Kumukonsumo ng pagsubok ang pagkaantala ngunit hindi ito mismong binibilang bilang isang nabigong pagsubok. Nananatili ang mga limitasyon at nakumpletong ebidensya pagkatapos ng pag-restart; hindi binubura ng Subukang muli ang mga ito. Basahin ang napanatiling kabiguan bago pahintulutan ang isa pang pagsubok.

Mga kaugnay na tagubilin: [Pagpapatunay at pagsusuri](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Magkakasabay na pangkat ng pagsusuri at ang arkitekto ng ulat

Buksan ang Mga Setting → Mga pangkat ng pagsusuri at mag-save ng isang pangkat. Magdagdag ng mga independiyenteng tagasuri na may sariling CLI o API, modelo, pagsisikap sa pangangatwiran at espesyalisasyon, pagkatapos ay pumili ng isang arkitekto ng ulat. Piliin ang pangkat sa pagsasaayos ng pagsusuri ng gawain. Maaari ding gamitin ng isang tagasuri ang isang preset ng tagapagpatupad, at nananatiling available ang Custom; mayroon pa ring magkakahiwalay na konteksto ang mga independiyenteng tungkulin.

Tumatakbo nang magkakasabay ang mga tagasuri sa parehong ebidensya ng gawain. Pinapanatili ang bawat kinakailangang ulat, error at hatol. Tumatanggap ang arkitekto ng mga di-nagpapakilalang may numerong ulat nang walang mga pangalan ng tagasuri, pagkakakilanlan ng modelo o provider, orihinal na nilalaman ng gawain, access sa repositoryo o mga tool. Inihahambing nito ang mga ulat at nagbabalik ng isang nakabalangkas na hatol; hindi ito nagsasagawa ng panibagong pagsusuri sa source.

Ang isang humaharang na natuklasan o pagtanggi ng isang kinakailangang tagasuri ay hindi maaaring pawalang-bisa sa pamamagitan ng mayoryang boto o kagustuhan ng arkitekto. Pinipigilan ng nawawala o maling anyo na mga ulat ang pag-apruba. Suriin ang mga indibidwal na natuklasan at pinagsama-samang desisyon bago tanggapin o pahintulutan ang mga pagwawasto. Nalulutas at naii-freeze ang isang naka-save na pangkat para sa takbo; hindi muling isinusulat ng pag-edit sa preset nito ang nakumpletong ebidensya.

Kasalukuyang gumagamit ang arkitekto na para lamang sa ulat ng mga suportadong pagsasaayos na walang tool ng Claude o API. Nananatiling available ang Codex at Antigravity bilang mga tagasuri ngunit tinatanggihan para sa nakabukod na tungkuling ito ng arkitekto hanggang sa magkaroon ng napatunayang kontratang walang tool. Hindi sapat ang isang prompt lamang na nagsasabing “walang tool”.

> Magkakahiwalay na kontrol ang pipeline ng disenyo/pagsusuri ng Maraming modelo ng Code at ang naka-save na magkakasabay na pangkat ng pagsusuri. Panatilihin ang napiling pasadyang patakaran sa pagsusuri; huwag ipagpalagay na pinapagana ng isang ruta ang bawat feature ng pagsusuri.

Mga kaugnay na tagubilin: [Pagsasaayos ng typed team](../../../shared/review-team.ts) · [Pagsasama-sama ng pagsusuri](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Mga espesyalisasyon ng ahente at patakaran sa prompt

Ang modelo ang makina ng pagpapatupad; ang espesyalisasyon ay isang profile ng tagubilin. Piliin ang Wala para sa walang idinagdag na espesyalisasyon, Karaniwan para sa default na gabay, Auto para sa nauugnay na built-in na gabay, o Manu-mano para sa mga napiling gabay at sarili mong may-hangganang mga tagubilin. Maaaring panatilihin ng mga preset ang pinili.

Sinasaklaw ng orihinal na katalogo ang pangkalahatang coding, arkitektura, seguridad, pagiging maaasahan, pagganap, pagsubok at kakayahang magamit ng interface. Gumagamit ang Auto ng available na teksto ng gawain/hakbang upang pumili ng gabay; hindi ito lihim na tumatawag ng isa pang modelo o nagpapatunay ng kadalubhasaan. Maaaring suriin at baguhin ang mga mungkahi sa pagpaplano bago tanggapin ang plano sa pagpapatupad.

Tumutulong ang mga espesyalisasyon sa pagsusuri na ituon ang pansin ngunit hindi kailanman pinapalitan ang independiyenteng ebidensya, mga limitasyon sa access o ang nakabalangkas na hatol. Ituring ang mga pasadyang tagubilin bilang bahagi ng saklaw ng gawain: huwag gamitin ang mga ito upang lampasan ang pagtanggap sa dokumento, patakaran sa tool, pagpapatotoo o mga kabiguan ng tagasuri.

Mga kaugnay na tagubilin: [Orihinal na katalogo ng prompt](../../../shared/specializations.ts).

<a id="work"></a>

## Work: mula sa tanong patungo sa dokumento

Hindi nangangailangan ng Git ang Work. Gumagawa ang Default ng hiwalay na folder ng gawain; pumipili ang Custom ng umiiral nang folder sa pamamagitan ng katutubong picker. Nag-iimbak ang I-save ang draft ng mga setting nang walang hinuha; pinapatakbo ng Simulan ang unang yugto.

Direktang sumasagot ang Auto o nagmumungkahi ng angkop na plano na may mga tunay na Dapat gawin. Lumilikha ang Brainstorm ng ideas.md bago ka pumili ng higit pang mga ideya o pagsusuri. Pinapanatili ng Research ang findings.md, mga pinagmulan at mga limitasyon. Lumilipat ang Write mula sa layunin at, kapag kapaki-pakinabang, outline.md patungo sa isang naglalarawang dokumento o draft.md; pinapanatili ng mga rebisyon ang mga naunang bersyon.

Pumili ng mga file input sa pamamagitan ng katutubong picker at sumangguni sa mga ito gamit ang @. Kinokopya ng app ang mga ito bilang di-nababagong mga input ng gawain at pinapatunayan ang kanilang pagkakakilanlan bago ang isang takbo. Gumagawa ang Default ng folder ng gawain na pagmamay-ari ng aplikasyon; ang pag-access sa folder ng Custom ay isang naka-save na pahintulot ng may-ari. Maaaring baguhin ng isang naka-save at hindi pa nasisimulang draft ang folder nito.

Lumikha ng 1–4 na kopya na may independiyenteng mga setting ng tagapagpatupad. Hindi maaaring sumulat nang sabay-sabay ang mga gawaing gumagamit ng magkakapatong na folder. Nalalapat ang koordinasyong ito sa mga operasyon ng ZIAForge, hindi sa mga di-makatwirang panlabas na programa.

Naka-default ang Deep Brainstorm sa tatlong independiyenteng manggagawa at sumusuporta ng hanggang walo. Piliin ang kanilang pagkakasunod-sunod at mga pagsasaayos, kabilang ang muling paggamit ng preset sa magkakahiwalay na konteksto. Pinapanatili ng mga tanong ng manggagawa ang kanilang pinagmulan; binibigyan ng isang pagsubok sa pag-aayos ng format ang mga ulat na may maling anyo. Nananatiling nakikita ang bahagyang kabiguan sa halip na iharap bilang nagkakaisang tagumpay.

Pinagsasama ng Deep ang napanatiling mga ulat ng manggagawa sa brainstorm_report.md at palaging humihingi ng desisyon ng gumagamit. Binabago ng isang maliit na follow-up ang ulat sa pamamagitan ng tagapag-ugnay; nagsisimula ang isang malaking pagbabago ng panibagong yugto ng mga na-freeze na manggagawa. Pinapanatili ng mga artifact ang kanilang mga bersyon.

Nagye-freeze ang mga nalutas na tungkulin sa paggawa ng gawain o tahasang pag-save ng draft. Pagkatapos ng unang tawag, tanging awtomatiko/manu-manong pagsulong lamang ang maaaring magbago; gumamit ng bagong gawain para sa ibang mga setting ng tungkulin o modelo. Hindi tahimik na binabago ng pag-edit sa pangkalahatang preset ang mga susunod na yugto.

Pumipigil ang manu-manong mode sa pagitan ng mga karapat-dapat na yugto, kabilang ang isang malaking balangkas ng Write. Maaaring magpatuloy ang Auto sa balangkas na iyon. Nananatiling tahasang desisyon ang mga tanong, iminungkahing maipapatupad na plano, direksyon ng Brainstorm at pagsusuri sa ulat ng Deep kahit sa Auto. Ang pagsipi lamang ay hindi nagpapatunay na nagkaroon ng pagba-browse, at ang napanatiling binary file lamang ay hindi nagpapatunay sa pag-render nito.

Mga kaugnay na tagubilin: [Mga mode at desisyon ng Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Mga preset, modelo at access

Nagse-save ang isang preset ng CLI/API, modelo, pagsisikap sa pangangatwiran at mga pahintulot. May mga segment ng preset, CLI, modelo at mga opsyon ang footer ng chat. Gumagana ang Custom nang walang preset; sine-save ng Gumawa ng preset ang kasalukuyang pinili.

Nagmumula ang katalogo sa napiling naka-install na CLI o API kung saan sinusuportahan. Ina-update ng I-refresh ang listahan nang hindi binabago ang pinili. Kung hindi available ang pagtuklas, maglagay ng tahasang ID ng modelo; dapat pa rin itong suportahan ng provider. Depende ang mga antas ng pangangatwiran sa modelo at CLI. Iba ang default ng provider sa tahasang none token.

Ilapat lamang ang mga pagbabago pagkatapos ng pagkilala ng backend. Pinaghihigpitan ang pagpapalit sa panahon ng isang aktibong turn o di-blangkong pila. Nananatili ang mga draft at nakikitang kasaysayan, ngunit hindi inililipat ng pagpapalit ng mga provider ang kanilang pribadong panloob na estado.

Sa Forge, mahalaga ang label ng tungkulin: maaaring gumamit ng hiwalay na Planner ang paghahanda. Binabago ng footer ang ipinapakitang tungkulin; pinipili ang mga tagasuri at katulong sa mga setting ng daloy ng trabaho. Maaaring mai-lock ang patakaran para sa napatunayan nang pagpapatupad.

Nagkakaiba ang mga pahintulot sa pagitan ng mga provider. Available ang Read only at Workspace write kung saan sinusuportahan ng adapter ang mga ito. Gumagamit ang Antigravity ng mga katutubong setting ng CLI o tahasang piniling ganap na access. Ang ganap na access ay hindi isang sandbox.

Nagdaragdag ang espesyalisasyon ng gabay sa prompt, hindi ng isa pang modelo o pahintulot. Sinusuportahan ng mga preset at tungkulin ang Wala, Karaniwan, Auto at Manu-mano. Pumipili ang Auto ng mga profile mula sa teksto ng hakbang nang walang karagdagang tawag sa modelo; tumatanggap ang Manu-mano ng hanggang apat na espesyalidad at pasadyang mga tagubilin. Maaaring i-edit ang mga iminungkahing pagtatalaga ng Planner bago tanggapin ang plano.

Ang manu-manong inilagay na ID o pagsisikap ng modelo ay nananatiling iyong pagpipilian, ngunit maaaring tanggihan ito ng provider. Hindi pabalik na binabago ng pag-edit ng pangkalahatang preset ang tumatakbong chat o natanggap na plano. Upang sinasadyang baguhin ang isang idle na pag-uusap, gamitin ang sarili nitong mga kontrol sa pagsasaayos at maghintay para sa pagkilala. Ang isang hindi pinaganang opsyon ay dapat ituring bilang limitasyon sa kakayahan o ikot ng buhay, hindi nilalampasan sa pamamagitan ng pag-edit ng naka-save na JSON.

Mga kaugnay na tagubilin: [Mga kakayahan ng provider](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Mga chat, Hinto at ang pila

Kabilang sa iisang gawain ang mga bukas na tab, Kamakailan at mga draft. Inaalis ito ng pagsasara ng tab mula sa Bukas ngunit pinapanatili ito sa Kamakailan at hindi pinipigil ang proseso ng provider nito o pinamamahalaang daloy ng trabaho. Maghanap sa kasaysayan, muling magbukas ng chat o isara ang lahat ng karagdagang tab mula sa menu ng kasaysayan.

Pinuputol ng Hinto ang kasalukuyang turn. Maghintay na matapos ang paghinto bago ang susunod na Ipadala: ang pagkilala sa pagkaantala ay hindi pagkakumpleto ng proseso. Maaari mong i-type ang susunod na draft pansamantala.

Sa karaniwang chat, inihihiwalay ng Pila ang pag-save ng susunod na kahilingan mula sa kasalukuyang draft. Pinipigilan ng I-pause ang pila ang karagdagang paghahatid. Ipinapa-pause ng Hinto at Lumabas ang pila. Pagkatapos mag-restart, Ipagpatuloy muna, pagkatapos ay tahasang Ipagpatuloy ang pila.

Nangangahulugan ang Hindi Tiyak na hindi alam ang katayuan ng paghahatid. Hindi awtomatikong muling ipinapadala ang naturang mensahe: suriin ang kasaysayan, kopyahin ang teksto kung nararapat at i-dismiss ang naka-queue na item. Isang bagong sinadyang kahilingan ang muling pagpapadala nito.

Gumagamit ang mga pinamamahalaang chat ng yugto ng kanilang daloy ng trabaho, hindi ang karaniwang pila. Ipinapakita ng Subaybayan ang yugto ang kasalukuyang yugto; ititigil ang pagsubaybay sa pamamagitan ng manu-manong pagpili ng ibang tab. Ipinapakita ng mga log ng CLI ang mga diagnostic nang hiwalay sa tugon.

Nire-render ng mga tugon sa Markdown ang mga heading, listahan, talahanayan, link at fenced code. Nananatiling hiwalay sa sagot ang mga tool card at diagnostic ng CLI. Lumalabas lamang ang naiulat na pag-iisip at sukatan ng token ng modelo kapag aktwal itong inilalantad ng provider; huwag ipalagay ang pribadong pangangatwiran o paggamit mula sa animasyon.

Pagkatapos ng isang hindi tiyak na pagpapadala o pagkilala sa pila, suriin ang kasaysayan at subukang muli ang parehong napanatiling kahilingan kung saan inaalok. Nangangahulugan ang resibo ng pila na tinanggap ng imbakan ang item, hindi na natapos ang paghihinuha. Alisin ang isang hindi tiyak na naka-queue na item bilang tahasang pag-dismiss lamang; hindi nito mababawi ang isang prompt na naihatid na.

Mga kaugnay na tagubilin: [Matatag na pila ng mensahe](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Mga file, Git at pagkumpleto

Ipinapakita ng Mga File ang folder ng gawain. Ihambing ang mga resulta sa mga kinakailangan, buksan ang mga dokumento at suriin ang mga diff. Ang pagpapanatili ng binary file ay hindi nagpapatunay ng tamang pag-render sa target na aplikasyon nito.

Nagbibigay ang Git ng katayuan, mga pagbabago at mga operasyon na may mga naitalang resulta. Manu-mano ang commit, merge at push bilang default; ang mga awtomatikong operasyon ay magkakahiwalay na pagpipilian para sa isang ganap na napatunayang plano.

Huwag baguhin ang mga file na ginagawa sa pagitan ng pagpapatunay at paglalathala: nakatali ang pag-apruba sa eksaktong mga byte. Ang mga salungatan, nabigong pag-push at hindi kilalang mga resulta ng operasyon ay humaharang sa pag-unlad hanggang sa magkaroon ng tahasang desisyon. Hindi tahimik na nagpapahintulot ang Auto ng paglalathala.

Hindi lumilikha ang Work ng mga Git branch at walang pagtatapos sa Git. Panatilihin ang mga kinakailangang dokumento mula sa napiling folder, kabilang ang mga bersyon at pinagmulan.

Nagbibigay ang editor ng file ng syntax ayon sa extension, paghahanap at pagpapalit, kasaysayan ng undo, line wrapping at mga draft bawat tab. Pinapanatili ng pag-save ang suportadong pag-encode ng UTF-8/UTF-16 at tinatanggihan ang mga panlabas na salungatan sa pagbabago. Nangangailangan ng panlabas na editor ang iba pang mga pag-encode at binary na nilalaman. Pinipigilan ng mga hindi na-save na draft ang paglabas sa aplikasyon hanggang sa mai-save o itapon ng may-ari ang mga ito.

Pinapagana ang buong syntax hanggang sa 8 MiB. Nagbubukas ang mas malalaking text file sa mga 256 KiB window; ang 8–64 MiB ay maaaring tahasang i-load nang buo nang walang syntax. Higit sa 64 MiB, gumamit ng pag-edit sa window at may-hangganang paghahanap ng susunod na tugma. Limitadong mode ito para sa malalaking file, hindi pagkapantay sa Sublime Text para sa di-makatwirang malalaking dokumento.

Ginagamit ng Buksan ang folder ang kasalukuyang konteksto ng gawain o branch/worktree, sa halip na tahimik na buksan lamang ang orihinal na repositoryo. Maaaring ilantad ng hilera ng file ang parent directory ng file na iyon. Pinapatunayan ng backend ang mga path laban sa mga nakarehistrong permiso ng gawain. Hindi maaaring i-edit ang mga binary file bilang payak na teksto; gamitin ang kanilang target na viewer at panatilihin ang orihinal na mga byte.

Ang pag-alis ng worktree ay isang hiwalay at binabantayang aksyon. Wakasan ang mga nakakabit na nakabalangkas na session at terminal bago ito alisin, kabilang ang mga session na idle. Suriin ang naka-save na resulta ng Git at estado ng pagbawi; ang pagbura ng talaan ng gawain ay hindi kapalit sa ligtas na pagpapanatili ng gawaing hindi pa nai-commit.

Mga kaugnay na tagubilin: [Kontrata ng typed editor](../../../shared/editor.ts) · [Mga patakaran ng Git](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> Hindi pa naisasalin ang buong gabay sa wika ng iyong interface. Ipinapakita ang sanggunian sa Ingles.

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

Mga kaugnay na tagubilin: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## Mga setting, mga wika at ligtas na pag-reset

Pumipili ang mga pangkalahatang setting ng workspace, wika ng interface at mga default. Pinamamahalaan ng Mga Koneksyon ang mga endpoint ng API. Pinapanatili ng Mga Preset at Mga pangkat ng pagsusuri ang mga pagsasaayos ng tungkulin. Pinamamahalaan ng Remote control ang mga lokal na kredensyal, saklaw ng server at mga pahintulot ng may-ari; pinamamahalaan ng Mga Update ang pinagmulan/channel ng release. Ipinapakita ng Tungkol sa ang eksaktong tumatakbong build.

Ang wika ng interface ay hiwalay sa wika ng prompt at estado ng pagsusuri ng dokumentasyon. Ang mga pangalan ng produkto, command ID, extension ng file, ID ng modelo ng provider, at mga pangalang ginawa ng user ay nananatiling mga identifier. Sinusunod ng Tulong ang napiling wika ng interface kapag available ang isang kasalukuyang pagsasalin; may label ang mga pagsasalin ng makina at ang Ingles ang nananatiling kanonikal na sanggunian.

Inilalapat ng I-save ang ipinapakitang pagsasaayos. Maaaring alisin ng pag-reset ng database o factory reset ang metadata ng application; magpanatili ng mga file at isang nasubukang backup bago sinasadyang gumamit ng pag-reset. Ang mga operasyong ito ay mga aksyon ng lokal na may-ari. Huwag gamitin ang mga ito bilang shortcut upang siyasatin ang isang nabigong workflow o sirang talaan.

Mga kaugnay na tagubilin: [Mga tagubilin sa lokalisasyon](../../LOCALIZATION.md) · [Pagbawi ng data](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Magtanong sa assistant ng Tulong

Buksan ang Tulong, pumili ng naka-save at nakakonektang preset sa panel ng assistant nito, at magtanong tungkol sa ZIAForge. Gumagamit ang mga sagot ng kasalukuyang kanonikal na gabay sa Ingles at ng iyong napiling wika ng interface. Binubuksan ng mga button ng sanggunian sa seksyon ang mga kaugnay na paksa ng gabay, upang maikumpara mo ang paliwanag sa sanggunian.

Ang assistant na ito ay nagpapanatili ng hiwalay na pribadong usapan na may hanggang 100 naka-save na entry at 3 MiB. Maglagay ng tanong na may hanggang 12,000 character; ipinapadala ito ng Ipadala, kinakansela ng Ihinto ang aktibong sagot habang pinapanatiling available ang iyong tanong, at inaalis ng I-clear ang usapang ito sa Tulong. Ang iyong hindi naipadalang draft at pagpili ng preset ay nananatili kahit isara o muling buksan ang Tulong sa parehong sesyon ng app, ngunit ang draft ay hindi nai-save sa disk. Hindi nagpapadala ang assistant ng mga command ng application, hindi nagbabago ng workflow, o tumatanggap ng gate. Ang payo ay hindi live na beripikasyon ng isang gawain, account, o panlabas na koneksyon.

Ipinapatupad ng mga sesyon ng Tulong sa Claude Code at API ang sinusuportahang patakaran na walang tool. Ang mga katutubong sesyon ng Tulong sa Codex at Antigravity ay nangangailangan ng umiiral nang katutubong pahintulot sa computer ng lokal na may-ari. Kung ito ay hindi pinagana, ipinapaliwanag ng app ang paunang kinakailangan sa halip na pumili ng ibang provider. Ang may-ari lamang ang maaaring magpagana nito sa mga setting ng lokal na pagkontrol; hindi ito maaaring paganahin ng assistant nang mag-isa.

Gumagamit ang Tulong ng Codex ng read-only na sandbox at tinatanggihan ang mga kahilingan sa pag-apruba ng tool. Gumagamit ang Antigravity ng plan mode at ng katutubong flag ng sandbox nito. Ang mga katutubong mode na ito ay hindi pangkalahatang garantiya ng pagkulong sa antas ng operating system. Tinutukoy ng hash ng pinagmulang gabay ang sangguniang ginamit para sa sagot; ang isang nabuong paliwanag ay maaari pa ring magkamali, kaya suriin ang mga naka-link na seksyon nito bago kumilos. Minamarkahan ang mga lumang sagot kapag ang bersyon ng pinagmulang gabay ng mga ito ay naiiba sa kasalukuyang gabay.

Mga kaugnay na tagubilin: [Kanonikal na gabay at pagpapanatili ng pagsasalin](../../HELP_MAINTENANCE.md) · [Assistant ng application at mga pahintulot](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Assistant at Telegram

Ginagamit ng assistant ang napiling preset at ang kaparehong API sa pagkontrol ng application. Magkahiwalay ang pahintulot na sumuri ng estado at ang pahintulot na magsagawa ng mga operasyon. Suriin ang mga command at resulta: ang mga paliwanag ng assistant ay hindi katunayan na nakumpleto ang isang aksyon.

Ang Telegram ay pinapagana lamang ng lokal na may-ari, gamit ang isang umiiral nang bot token at numerikong ID ng may-ari. Ang pagkontrol ay para sa pribadong chat lamang ng may-aring iyon. Ang hindi naka-configure o hindi aktibong bot ay hindi dapat makatanggap ng mga mensahe ng application.

Huwag i-paste ang bot token sa karaniwang chat. Ang pag-configure sa integrasyon ay hindi nagpapatunay ng koneksyon sa Telegram at hindi awtomatikong lumilikha ng bot. Maaaring maglaman ang mga screenshot at tugon ng pribadong data ng workspace.

Pumili ng preset ng assistant at igawad ang pahintulot sa pagpapatakbo ng application nang hiwalay sa pagsusuri. Ang pagpapatupad ng assistant sa Codex at Antigravity ay nangangailangan ng katutubong pahintulot ng may-ari; hindi tahimik na pinapalitan ang mga ito para sa isang sesyon ng API o Claude na walang tool. Maaaring ipakita ang mga screenshot sa usapan ng assistant, ngunit ang kasalukuyang input ng modelo ay hindi kabilang ang pagsusuri ng imahe. Huwag ipagpalagay na biswal na sinuri ng assistant ang isang imahe dahil lamang ipinakita ito.

Maaaring suriin ng assistant ang mga buod, gawain, chat, estado ng workflow, konteksto ng proseso, at mga window ng application sa pamamagitan ng mga typed tool. Maaari nitong baguhin ang mga pinapahintulutang karaniwang setting at ilunsad ang mga awtorisadong operasyon ng application. Hindi ito maaaring magbigay ng mga katutubong karapatan, magbunyag ng mga nakaimbak na kredensyal, magbago ng root workspace grant nang malayuan, o mag-apruba ng isang gate ng Forge dahil lamang ito ay maginhawa.

Mga kaugnay na tagubilin: [Kontrata sa pagkontrol ng application](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Patakbuhin ang iyong pribadong bot sa Telegram

Lumikha o kumuha ng iyong sariling bot, simulan ang pribadong chat nito, at ilagay ang token nito at ang iyong numerikong user Telegram ID sa mga setting ng lokal na pagkontrol. Paganahin lamang ang integrasyon kung nilalayon mong kumonekta ang app. Ang ID ng may-ari ay isang identifier ng user, hindi isang username o bot ID. Tanging mga mensahe mula sa user na iyon sa parehong pribadong chat ang tinatanggap.

Gamitin ang /start, /menu, o /status para sa pangkalahatang-ideya ng tumatakbong bersyon, mga bilang ng proyekto/gawain, at mga katayuan ng gawain. Binubuksan ng mga button ang Mga Proyekto, Mga Gawain, Screenshot, Tulong, at Wika. Nagpapakita ang mga listahan ng walong item bawat pahina, na may nabigasyong Bumalik, I-refresh, Home, at Nakaraan/Susunod. Sinasala ng mga button ng proyekto ang listahan ng gawain. Ipinapakita ng task card ang naka-save nitong progreso sa workflow, modelo/preset, at mga nakabinbing tanong kung mayroon.

Buksan ang Mga Chat ng isang gawain upang i-preview ang bukas/kamakailang mga usapan at mga chat sa yugto ng workflow. Ang bawat preview ay nagpapakita ng hanggang anim na pinakabagong mensahe ng user/assistant, na kitang-kitang pinaikli sa 200 character bawat isa. Hindi ipinapakita ang pribadong pangangatwiran. Ang pagbabasa ng kasaysayan ay hindi nagsisimula ng provider. Read-only ang mga preview: ang karaniwang teksto at /ask TEXT ay tumutugon pa rin sa assistant ng application, hindi kailanman tahimik sa chat ng gawaing tinitingnan mo.

Muling binabasa ng Patakbuhin / Ipagpatuloy ang kasalukuyang workflow ng Code o Work at sinisimulan ang isang kwalipikadong naka-save na workflow. Humihiling ng pag-pause ang I-pause. Wala sa alinman ang tumatanggap ng mga kinakailangan, isang detalye, isang plano, mga natuklasan sa pagsusuri, o mga tanong; pinipigilan ng nakabinbing desisyon ang Pagpapatakbo. Gumawa ng mga desisyon sa application, o gumamit ng tahasang awtorisadong typed command kasama ang eksaktong kasalukuyang gate at rebisyon nito.

Gamitin ang Wika o /language upang pumili ng alinman sa 56 wika ng interface ayon sa katutubong pangalan nito. Pinapanatili nito ang kagustuhan para sa bot at may-ari lamang na ito. Inaalis ng Gamitin ang wika ng app ang kagustuhang iyon. Hindi nito binabago ang wika ng application o ang mga pahintulot sa pag-access; ang mga umiiral na mensahe ay hindi awtomatikong muling ipinapadala.

Karaniwang ina-update ng nabigasyon ang parehong na-publish na mensahe ng menu. Ang mga button ay may mga opaque na pagkakakilanlan na mag-e-expire pagkalipas ng 15 minuto at magagamit nang isang beses; ang pagbabago ng card ay nagpapawalang-bisa sa mga lumang button nito. Ang mga button na nag-expire, nagamit na, hindi tumutugma sa mensahe, at mula sa nakaraang proseso ay hindi makapagsasagawa ng aksyon. Ang isang mensahe na tiyak na hindi mae-edit ay maaaring palitan ng bagong card; ang hindi kilalang error sa network ay hindi muling sinusubukan bilang bagong mensahe.

Sa pag-activate, itinatapon ng poller ang naunang backlog at itinatala ang pagtanggap ng update bago ipadala upang ang mga naantalang command ay hindi awtomatikong ma-replay sa pag-restart. Pinipigilan nito ang replay; hindi nito ginagarantiya ang pagkumpleto. Suriin ang katayuan/konteksto bago sinasadyang maglabas ng bagong gawain pagkatapos ng isang error. Walang awtomatikong mga abiso sa katayuan ng gawain.

Nananatiling available ang mga tahasang command: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot, at /ask TEXT. Lumilikha ang /new {JSON} ng gawain sa pamamagitan ng typed na createTask; nagpapadala ang /command {JSON} ng tahasang catalog command. Basahin ang live catalog para sa mga hugis ng argumento. Nalalapat ang parehong backend authorization at mga folder grant tulad ng sa application.

Hindi kailanman ipinapadala ng app ang mga nakaimbak na value ng bot token sa assistant. Gayunpaman, maaaring maglaman ang mga screenshot, buod, at teksto ng usapan ng pribadong impormasyon ng proyekto. Ihinto ang integrasyon nang lokal kung ang bot o account ng may-ari ay hindi na pinagkakatiwalaan. I-rotate ang na-leak na token sa provider ng bot, pagkatapos ay i-update ang lokal na naka-encrypt na pagsasaayos nito.

Mga kaugnay na tagubilin: [Pribadong bot at mga command](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Pahintulot sa katutubong computer ng may-ari lamang

Nagsisimulang hindi pinagana ang katutubong pag-access sa computer. Ang may-ari lamang ang maaaring magpagana nito sa lokal na Mga Setting → Malayuang pagkontrol. Hindi maaaring paganahin ng assistant at ng mga command ng HTTP/MCP/Telegram ang flag na ito para sa kanilang sarili. Kung tinanggihan ang isang operasyon, dapat ilarawan ng assistant ang setting at hayaang magpasya ang may-ari.

Kapag tahasang pinagana, tumatanggap ang computer.run ng isang executable, array ng argumento, at opsyonal na absolute working directory. Hindi ito gumagamit ng interpolation ng shell, may limitasyong 30 segundo, at naglilimita ng output sa 1 MiB. Tinatanggihan ang isang ibinigay na nawawala o di-wastong direktoryo; ang pag-alis ng cwd ay gumagamit ng direktoryo ng mga setting na pagmamay-ari ng app, hindi ang HOME. Kinakansela ng Paglabas ang mga aktibong command na pagmamay-ari at naghihintay para sa paglilinis ng proseso ng mga ito.

Magkahiwalay na desisyon ang saklaw ng pagbasa/pagpapatakbo ng application at ang katutubong pag-access. Ang isang worktree ay hindi naglilimita sa pag-access sa filesystem ng isang provider na walang paghihigpit. Bawiin ang katutubong pag-access pagkatapos ng gawain kung hindi na ito kinakailangan, at suriin ang mga resibo ng command sa halip na tanggapin ang mga paliwanag ng assistant bilang patunay.

Mga kaugnay na tagubilin: [Kontrata sa pagkontrol ng may-ari lamang](../../../shared/control.ts).

<a id="remote"></a>

## Browser at mga malayuang instance

Pinapagana ng lokal na may-ari ang server at pinipili ang address, port, at saklaw nito: read para sa pagsusuri o operate para sa mga aksyon. Ang default na address na 127.0.0.1 ay available lamang sa computer na ito. Nakikinig ang 0.0.0.0 sa mga interface ng network; suriin ang access sa network bago ito paganahin.

Binubuksan ng browser ang parehong interface pagkatapos ng pag-login gamit ang token. Huwag isama ang mga token sa mga pampublikong link o screenshot. Ang HTTP lamang ay hindi nag-e-encrypt ng trapiko; gumamit ng protektadong channel sa isang hindi pinagkakatiwalaang network.

Iniaayos ng may-ari ang iba pang mga instance sa pamamagitan ng URL at token. Ipinoproxy ng backend ang mga kahilingan; hindi nito kinokopya ang kanilang mga proyekto sa lokal na makina. Suriin ang napiling instance bago ang bawat aksyon.

Naglalaman ang mga typed command at kaganapan ng pagkontrol sa application. Ang saklaw ng pagbasa ay hindi nagpapahintulot ng mga pagbabago sa gawain. Ang katutubong pagkontrol sa computer ay isang hiwalay na pagpipilian ng lokal na may-ari at nagsisimulang hindi pinagana.

Dapat manatiling tumatakbo ang app para sa pagkontrol ng browser, Telegram, at panlabas na agent. Ang bawat instance ay may sariling pribadong profile, estado ng gawain, token, at port ng server. Huwag muling gamitin ang isang profile nang sabay-sabay sa pagitan ng mga independiyenteng instance. Ang mga kaganapan sa browser at tugon sa command ay nakalaan lamang sa napiling instance; ang pagpapalit ng UI ay hindi naglilipat ng mga file o nagkokopya ng katutubong pag-login.

Mga kaugnay na tagubilin: [HTTP at pagkontrol ng instance](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes at iba pang panlabas na agent

Gamitin ang napatunayang API sa pagkontrol ng application o ang kasamang stdio bridge ng MCP. Paganahin ang server nang lokal, piliin ang read o operate, at i-configure ang bawat client gamit ang URL at token ng instance na iyon. Kinakailangan ang Node.js 22 o mas bago upang patakbuhin ang standalone na bridge ng MCP; hindi ini-install ng Electron app ang iyong agent client. Ang URL ng browser ay hindi isang Streamable HTTP MCP endpoint: ibigay ito bilang ZIAFORGE_URL sa stdio bridge.

Inilalantad ng bridge ang ziaforge_status, ziaforge_commands, ziaforge_command, at ziaforge_screenshot. Magsimula sa katayuan at sa live na catalog ng command, pagkatapos ay basahin ang system.context para sa napiling gawain. Sumusunod ang mga typed command sa parehong mga pagsusuri sa rebisyon, gate, folder ng gawain, at paglilinis tulad ng sa lokal na UI.

Kabilang sa live na catalog ng command ang documentation.guide, ang kanonikal na tulong sa Ingles, kasama ang source path at sourceSha256 nito. Tinatanggap ng panloob na architect ng application ang parehong sanggunian sa pamamagitan ng mga tool nito. Nagbibigay ito sa mga agent ng buong konteksto ng produkto nang hindi umaasa sa mga lumang tala; ang dokumentasyon ay hindi kailanman nagbibigay ng access o pumapalit sa kasalukuyang desisyon ng tao.

Dapat pag-usapan ng mga agent ang mga kinakailangan, teknikal na desisyon, at pagpaplano mula sa maikling ideya ng tao. Dapat nilang panatilihin ang tahasang mga gate ng tao, mga napiling modelo, patakaran sa manual/Auto, at kinakailangang pagsusuri. Hindi sila dapat mag-imbento ng pag-apruba, mag-replay ng mga hindi tiyak na command sa ilalim ng bagong ID, o mag-publish ng mga pagbabago sa Git nang walang layunin ng may-ari.

Mag-configure ng ilang pinangalanang server ng MCP para sa ilang pag-install. Ang pagpapalit ng instance ay isang desisyon sa pagruruta, hindi pag-synchronize. Ang mga halimbawa ng pagsasaayos ng OpenClaw at Hermes ay nasa AGENT_CONTROL.md; ang setup at pagiging tugma na partikular sa client ay dapat suriin para sa naka-install na bersyon ng client.

Ang panlabas na cache ng requestId ay nag-aalis lamang ng duplikasyon sa isang limitadong hanay ng mga kahilingan habang tumatakbo ang app. Gumagamit ang mga matatag na operasyon ng sarili nilang mga pagkakakilanlan: createRequestId para sa paggawa ng gawain, commandId para sa mga desisyon sa workflow, clientMessageId para sa mga mensahe, at operationId para sa mga mutasyon ng Git. Panatilihin ang orihinal na pagkakakilanlan at payload pagkatapos ng hindi kilalang pagkilala; basahin ang naka-save na estado bago sinasadyang maglabas ng bagong gawain.

Mga kaugnay na tagubilin: [Mga tagubilin sa client ng MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## Lokal na CLI at mga limitasyon ng automation

Kinokontrol ng ziaf dispatcher ang parehong tumatakbong app at naka-save na workflow. Mula sa source, gamitin ang npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, o npm run ziaf -- pause --task TASK_ID. Ang matagumpay na pagkilala sa Simula ay hindi nangangahulugang nakumpleto na ang gawain.

Sinasadyang pinapagana ng --until-success ang Auto para sa naka-save na workflow, ngunit nalalapat pa rin ang mga tanong, pagsusuri, mga gate ng pagtanggap, mga limitasyon, at mga checkpoint. Lumalabas ang Ctrl+C sa nagmamasid na dispatcher; hindi nito tahasang hinihinto ang workflow ng application. Tingnan ang CLI.md para sa mga exit code, lokal na endpoint, at pangangasiwa ng profile.

Kasalukuyang nag-iimbak ang interface ng Mga Automation ng mga kahulugan ng display at mga lokal na counter ng pagpapatakbo. Hindi ito isang sertipikadong umuulit na scheduler at hindi nagpapatunay na tumakbo ang turn ng modelo sa background. Para sa aktwal na pagpapatupad, gamitin ang mga kontrol ng naka-save na workflow, ziaf, o ang napatunayang API at suriin ang kanilang mga resibo. Huwag ipagkamali ang demonstrasyong panel para sa hindi binabantayang pag-iiskedyul.

Mga kaugnay na tagubilin: [Mga command ng dispatcher](../../CLI.md).

<a id="updates"></a>

## Bersyon at mga update

Ipinapakita ng About ang eksaktong tumatakbong bersyon. Ang mga pampublikong update ay nangangailangan ng pinagkakatiwalaang release repository sa GitHub at isang stable o preview channel. May magkakahiwalay na estado ang pagsusuri, pag-download, at pag-install; ang isang error ay hindi nangangahulugang na-install ang isang update.

Ang awtomatikong pag-install ay para sa mga nilagdaang release ng macOS. Ang mga hindi nilagdaang development build ay hindi awtomatikong ini-install sa pamamagitan ng mekanismong ito. Para sa manu-manong pagpapalit, ganap na ihinto ang kasalukuyang app at gumamit ng napatunayang artifact.

Ang awtomatikong pagsusuri ay tumatakbo kaagad kapag pinagana, pagkatapos ay bawat anim na oras.

Hindi kasama sa stable ang mga release ng preview; pinapayagan din ng preview ang mga development release. Ang matagumpay na pagsusuri ay nagtatatag lamang ng available na metadata ng release. Ang pag-download at pag-install ay nangangailangan ng package para sa platform at na-configure na feed ng release. Ang paghahatid ng Linux DEB ay isang hiwalay na path ng installer; huwag ipagpalagay na ang isang DEB ay awtomatikong ia-upgrade ng mekanismo ng pag-update ng macOS.

Mga kaugnay na tagubilin: [Kahandaan sa release](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Pag-restart at pagbawi

Sa macOS, gamitin ang Quit / ⌘Q para sa buong pag-shutdown. Ang pagsasara ng window ay maaaring mag-iwan sa app na tumatakbo. Ganap na ihinto ang lumang bersyon bago palitan ang application.

Pagkatapos ilunsad, piliin ang parehong gawain. Nagbabalik ang kasaysayan at mga draft. Ipinapanumbalik ng Ipagpatuloy ang isang katutubo/lokal na konteksto ngunit hindi nagpapadala ng draft, nag-aalis ng pause sa pila, o nagpapahintulot sa pag-ulit ng hindi kilalang operasyon.

Kung lilitaw ang Pagbawi, huwag i-edit ang JSON nang manu-mano. Suriin ang apektadong uri ng dokumento, panatilihin ang orihinal na mga file, at pumili ng napatunayang backup. Ang pagpapanumbalik ng mas lumang pila ay nagmamarka sa mga item nito na hindi tiyak.

Kapag hindi alam ang paghahatid, maaaring mangailangan ang pinamamahalaang workflow ng tahasang pahintulot para sa bagong konteksto. Nananatili ang mga naunang gawa at nabigong pagsubok; mas ligtas ang isang nakikitang pagtanggi kaysa sa gawa-gawang tagumpay.

I-backup ang mga file ng gawain at profile ng app habang nakasara ang lahat ng instance ng app. Ang nakopyang folder ay hindi isang nasubukang pagpapanumbalik. Kung hihilingin sa iyo ng pagbawi na pumili ng napatunayang backup, panatilihin din ang eksaktong nasirang mga file. Ang pagpapanumbalik ng mas lumang workflow o pila ay hindi nagpapahintulot sa pag-replay ng hindi tiyak na inference o mga operasyon ng Git.

Mga kaugnay na tagubilin: [Kontrata sa pagbawi](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Pagtugon sa mga problema

Hindi nahanap ang CLI: suriin ang pag-install at bersyon nito sa isang karaniwang terminal, pagkatapos ay i-restart ang ZIAForge. Ang pagkakaroon ng executable ay hindi nangangahulugang naka-sign in ka na. Gamitin ang sariling mekanismo ng pag-sign-in ng provider.

Hindi available ang modelo o nabigo ang awtorisasyon: i-refresh ang discovery, pumili ng available na ID, at suriin ang iyong account at mga limitasyon. Huwag ulitin ang isang hindi tiyak na kahilingan bago suriin ang kasaysayan nito.

Huminto ang workflow: buksan ang kasalukuyang yugto, tanong, resibo ng beripikasyon, o mga log ng CLI. Tugunan ang partikular na dahilan: isang hindi nasagot na tanong, command, pahintulot sa folder, o limitasyon sa pagsubok. Hindi magagawang tagumpay ng Ipagpatuloy ang isang nabigong pagsusuri.

Nawawala o napalitan ang folder: ibalik ang access sa orihinal na folder o lumikha ng bagong gawain. Hindi dapat magpatuloy ang app mula sa HOME. Kung may naobserbahan kang ibang cwd, ihinto ang turn at panatilihin ang mga diagnostic.

Para sa isang ulat, isama ang bersyon mula sa About, ruta, CLI/modelo, inaasahan at aktwal na gawi, isang screenshot, at isang ligtas na sipi ng log. Alisin ang mga lihim, personal na nilalaman, at mga path na hindi maaaring i-publish.

Hindi available ang malayuang pahina: tiyaking pinagana ng may-ari ang server, suriin ang nakikinig na address at port, pagkatapos ay magpatotoo gamit ang tamang token ng instance. Ang 401 ay nagpapahiwatig ng pagpapatotoo; ang tinanggihang mutasyon ay maaaring saklaw ng pagbasa o kontrol na para sa may-ari lamang. Isinasara ng pagpapalit ng token ang mga umiiral na client ng browser. Huwag ilantad ang hiwalay na inspection port ng DevTools bilang malayuang pagkontrol ng application.

Tinanggihan ang pag-save ng editor: panatilihin ang draft, suriin ang kasalukuyang file sa disk, at lutasin ang salungatan sa panlabas na pagbabago. Huwag laktawan ang paghahambing sa pamamagitan ng muling pagsulat ng metadata ng application. Kung hindi available ang buong paglo-load ng malaking file, gamitin ang sinusuportahang pag-edit/paghahanap sa window o isang panlabas na editor.

Hindi available ang Telegram: kumpirmahin ang bot token, numerikong may-ari, pribadong chat, at katayuan nang lokal. Maaaring harangan ng nakikipagkumpitensyang webhook o poller ang pag-poll; hindi awtomatikong nagtatanggal ang ZIAForge ng webhook o kumukuha ng kontrol sa isa pang poller. Ang mga command na tinanggihan o naantala sa isang hindi kilalang hangganan ay hindi awtomatikong muling ipinapatupad.

Mga kaugnay na tagubilin: [Pagsusuri at diagnosis](../../TESTING.md).

<a id="diagnostics"></a>

## Mag-ulat ng mga problema at sumuri ng ebidensya

Itala ang eksaktong tumatakbong build mula sa About, OS/arkitektura, mode ng gawain, napiling provider/modelo, at ang mga hakbang na nagpaparami ng problema. Ilarawan ang inaasahang resulta at ang naobserbahang resulta. Magsama ng ligtas na screenshot at ang may-katuturang napanatiling resibo ng command o beripikasyon, sa halip na ang buong pribadong profile.

Maaaring maglantad ang mga log ng CLI, journal ng kaganapan, transcript ng modelo, bakas ng browser, at mga screenshot ng source code, mga personal na path, o token. Suriin at i-redact bago ibahagi. Ang isang best-effort na redactor ng log ay hindi nagpapatunay na ang isang screenshot o archive ay ligtas na mai-publish.

Para sa mga contributor, binabasa ng qa:doctor ang pagkakakilanlan ng kapaligiran/build; binubuksan ng qa:inspect ang isang nakahiwalay na profile na may mga stub ng provider. Pinatutunayan ng isang fixture ang sinubukang path ng application nang hindi nakikipag-ugnayan sa modelo. Ang live na inference, koneksyon sa Telegram, katutubong desktop ng Linux, paglagda, at mga pagsusuri sa naka-package na artifact ay magkakahiwalay na ebidensya. Tingnan ang TESTING.md para sa mga reproducible na command at paglilinis.

Mga kaugnay na tagubilin: [Mga command sa ebidensya](../../TESTING.md).

<a id="privacy"></a>

## Lokal na data at mga hangganan

Maaaring maglaman ng pribadong teksto ang mga proyekto, kasaysayan, plano, dokumento, at diagnostic. Huwag mag-publish ng mga profile, hilaw na capture, key, o kumpletong log kasama ang source code.

Sa Linux, ang pag-save ng mga kredensyal ng API, pagkontrol, Telegram, at instance ay nangangailangan ng naka-unlock na GNOME Secret Service o KWallet; kung walang sinusuportahang taguan ng lihim, tumatanggi ang ZIAForge na i-save ang mga lihim na ito sa halip na gamitin ang fallback na basic_text ng Electron.

Ang lokal na imbakan ay hindi nangangahulugang mananatili ang mga kahilingan sa iyong computer: ipinapadala ang mga ito ng napiling CLI/API sa provider nito. Ang isang gumaganang folder at pangangasiwa ng proseso ay hindi paghihiwalay ng OS. Suriin ang mga napiling pahintulot.

Ipag-iba ang mga uri ng ebidensya: sinusubok ng mga fixture ang application nang walang modelo; ang native live ay nagsasanay ng totoong CLI/account; pinatutunayan ng mga pagsusuri sa naka-package ang isang partikular na artifact. Ang pagpasa sa isa ay hindi garantiya sa iba.

Iba ang saklaw ng application, worktree, at read-only prompt sa pagpapatupad ng operating system. Ang mga patakaran ng reviewer/helper sa Antigravity ay nakakakita ng mga pagbabago sa nakolektang ebidensya ng workspace sa halip na magpatupad ng read-only na pag-access sa filesystem. Isinasagawa ng katutubong pagkontrol sa computer ang mga programang pinahintulutan ng may-ari sa labas ng karaniwang hangganan ng tool ng app; i-off ito kapag hindi na ito kailangan.

Mga kaugnay na tagubilin: [Pinagmulan at publikasyon](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Unawain at baguhin ang open-source na proyektong ito

Basahin muna ang AGENTS.md at CONTRIBUTING.md, pagkatapos ay ang PROJECT_MAP.md para sa kasalukuyang mga hangganan ng source. Ang mga ipinatupad na typed contract at kasalukuyang mga dokumento ng workflow/provider ang namamahala sa pag-uugali. Pinapanatili ng CONCEPT.md at ng mga bahaging terminal-first ng ARCHITECTURE.md ang historikal na layunin at hindi dapat ipagkamali sa mga pag-angkin sa kasalukuyang release.

Ang source ng tulong sa Ingles ay docs/help/en.json. Huwag i-edit nang manu-mano ang nabuong USER_GUIDE.md o website/guide.html. Baguhin ang kanonikal na seksyon, i-update ang apektadong kontrata, at patakbuhin ang node scripts/help/generate.cjs. Binabasa ng Tulong sa loob ng app ang parehong source. Suriin ang mga karagdagan gamit ang aktwal na pagpapatupad, kabilang ang mga limitasyon, pahintulot, at mga hindi sinusuportahang path.

Bawat isa sa 56 interface locale ay may hiwalay na katayuan ng tulong sa docs/help/locales.json. Ang nawawala o hindi kumpletong tulong ay bumabalik sa Ingles. Ang mga kumpletong katawan na isinalin ng makina ay may label at nakatali sa hash ng pinagmulang Ingles, nang walang pag-angkin ng pagsusuri ng tao. Ang isang pagsasalin na sinuri ng tao ay karagdagang nagtatala ng tagasuri nito. Dapat panatilihin ng bawat pagsasalin ang mga ID ng seksyon, mga aksyon, mga identifier ng file/command, at mga teknikal na limitasyon, gamitin ang tamang direksyon, at i-refresh kapag nagbago ang pinagmulan nitong Ingles.

Bago ipadala, patakbuhin ang node scripts/help/generate.cjs --check upang matukoy ang lipas na nabuong output, mga di-wastong scaffold ng locale, o mga sirang link ng lokal na kontrata. Nananatiling magkahiwalay ang mga pagsusuri sa pagsasalin ng UI at mga pagsusuri sa gawi ng application. Ibinibigay ng HELP_MAINTENANCE.md ang pamamaraan sa pag-update para sa contributor at AI; hindi dapat mag-angkin ang dokumentasyon ng isang pumapasang pagsubok na hindi naman napatakbo.

Mga kaugnay na tagubilin: [Kasalukuyang mapa ng proyekto](../../PROJECT_MAP.md) · [Pagpapanatili ng dokumentasyon](../../HELP_MAINTENANCE.md) · [Mga tagubilin para sa contributor](../../../CONTRIBUTING.md) · [Mga tagubilin para sa agent](../../../AGENTS.md).
