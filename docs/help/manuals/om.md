<!-- Generated from docs/help/en.json; source SHA-256 19977b173c646929e3b4afd5f8a5c30639cc32ca620657d7c2aed5e71419b947. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: om; served locale: om; status: machine-translated. -->
# Qajeelfama fayyadamaa ZIAForge

Kakka'umsa irraa gara bu'aa mirkanaa'etti. Qajeelfama qabatamaa Code, Work fi to'annoo appilikeeshinii.

Afaan Ingilizii isa bu'uuraati. Gargaarsi maashiniin hiikame hiika namaan gamaaggamame irraa addatti mallatteeffama. Sakatta'iinsi ofiin-hojjetu sirrii ta'uu afaan dhalootaa hin mirkaneessu.

> Qajeelfamni kun madda Ingiliffaa ammaa irraa maashiniin kan hiikameedha. Gamaaggamni namaa ammas ni simatama.

## Kutaalee qajeelchaa

- [Tarkaanfilee jalqabaa](#start)
- [Paakeejii deskitoolpii sirrii ta'e fe'i](#install-platforms)
- [Code: kallattiiwwan shan](#code)
- [Marii Forge](#forge)
- [Sanadoota fi murteewwan](#decisions)
- [Raawwii fi gamaaggama](#execution)
- [Gareewwan gamaaggamaa wal-faanaa fi arkiteektii gabaasaa](#review-teams)
- [Ogummaa eejantii fi imaammata qajeelfamaa](#specializations)
- [Work: gaaffii irraa gara sanadaatti](#work)
- [Qindaa'inoota dursaa, moodeelota fi heeyyama](#models)
- [Mariiwwan, Dhaabi fi tarree](#chat)
- [Faayiloota, Git fi xumura](#files)
- [Walqabsiisota API](#api)
- [Qindaa'inoota, afaanota fi haaromsa nageenyaa](#settings)
- [Gargaaraa Gargaarsaa gaafadhu](#help-assistant)
- [Gargaaraa fi Telegram](#assistant-control)
- [Boottii Telegram dhuunfaa kee hojjechiisi](#telegram)
- [Eeyyama kompiitara dhalataa abbaa qabeenyaa qofaa](#native-permissions)
- [Baafataa fi qindaa'inoota fagootti argaman](#remote)
- [OpenClaw, Hermes fi ejensota alaa biroo](#external-agents)
- [CLI naannoo fi daangaawwan of-hojjechiisaa](#local-cli)
- [Gosa fi haaromsawwan](#updates)
- [Irra deebisanii kaasuufi deebisanii dhaabuu](#restart)
- [Rakkoo furuu](#troubleshooting)
- [Rakkoowwan gabaasuu fi ragaa qorachuu](#diagnostics)
- [Daataa naannoo fi daangaawwan](#privacy)
- [Pirojektii madda banaa kana hubachuu fi jijjiiruu](#project-contributors)

<a id="start"></a>

## Tarkaanfilee jalqabaa

ZIAForge marii, karoorsuu, raawwii fi mirkaneessuu hojii tokko keessatti walitti qaba. Pirojektii Git tiif Code filadhu, yookiin sanadoota, qorannoo fi bu'aawwan biroo galmee baramaa keessatti argamaniif Work filadhu.

Pirojektii addaa keessatti hojii xiqqaadhaan jalqabi. Yoo CLI dhalootaa filatte, jalqaba teerminaalii keessatti isa fe'ii akawuntii mataa isaatiin seeni. Akka filannootti, walqabsiisa API qindeessi. Maamilummaan CLI fi kaffaltiin API mala walqabsiisaa adda addaati; ZIAForge si hin seensisu yookiin kireeditiilee gidduu isaaniitti hin dabarsu.

1. Settings baniitii galmee bakka hojii fi afaan sakatta'i. About eenyummaa sirrii ijaarsa hojjetaa jiruu agarsiisa.
2. Code tiif, kuusaa Git cinaatti dabali. Work tiif, yeroo hojii uumtu galmee addaa filadhu.
3. Qindaa'ina dursaa CLI, moodeela, tattaaffii yaadaa fi sadarkaa heeyyamaa waliin olkaawi. Qindaa'ina dursaa olkaawame malees kallattiin Custom filachuu dandeessa.
4. Hojii uumi, kallattii isaa, gaheewwan fi tarkaanfii harkaanii yookiin ofiisaa filadhu. Jalqabuu dura filannoowwan gamaaggami.

> Meeshaalee bu'aa fi sakatta'iinsa lakkoofsaa dhiheessaa biraa kenname fayyadami. Dur-argiin mallattoo hin qabaatin yookiin dhiheessii haaromsaa maxxanfame dhabuu danda'a. Deeggarsi deskitoolpii fi dhiheessaa dhalootaa OS, arkiteekchara fi faayila sirriidhaaf mirkanaa'uu qaba; deeggarsi maddaa qofti waraqaa ragaa gadi-lakkifamaa miti.

Qajeelfamoota walqabatan: [Ibsa waliigalaa pirojektii](../../../README.md) · [Wal-simiinsa dhiheessitootaa](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Paakeejii deskitoolpii sirrii ta'e fe'i

Sirna hojjataa keetii fi arkiteekchara CPU keetiif paakeejii filadhu: x64 yookiin arm64. Xurreen ijaarsaa bifa macOS DMG/ZIP, Windows NSIS fe'aa/ZIP, fi Linux DEB/RPM/AppImage/tar.gz/ZIP oomishuu danda'a. Faayilli uumame yookiin ijaarsi qaxxaamuraa fe'aan isaa fi UI dhalootaa maashinii kee irratti darbuu isaatiif ragaa miti; galmee mirkaneessaa gadi-lakkifama sanaa ilaali.

Ijaarsi macOS kan Electron 44 fayyadamu macOS 13 yookiin isa boodaa barbaada. Apple Silicon irratti paakeejii arm64 fi Intel-iif immoo paakeejii x64 fayyadami. Bakka buusuu dura appilikeeshinii moofaa guutummaatti cufi. Paakeejonni dur-argii mallattoo kan hin qabnee fi beekamtii kan hin arganne ta'uu danda'u; meeshaa misoomaa gadi-lakkifama ummataa kan mallatteeffame waliin hin burjaajessin.

Windows sirna hojjataa gosa Electron waliin wal-simuu fi Git PATH keessatti argamu barbaada. Arkiteekchara wal-simu filadhu. Dur-argiin mallattoo hin qabne waraqaa ragaa Authenticode hin qabu. ZIP socho'aan faayila raawwatamu qofa otoo hin taane galmee appilikeeshinii guutuu fi faayiloota yeroo hojii qabachuu qaba.

Linux deskitoolpii giraafiksii wal-simu, kuusaa sirnaa kan Electron barbaadu, fi Git barbaada. Ragaalee to'annoo icciiteeffamaniif, Secret Service kan akka gnome-libsecret yookiin KWallet hojjatu dhiheessi; duubee basic_text kan nageenya hin qabne hin fudhatamu. Ragaan qorannoo salphaa kan mataa hin qabne/koonteyineeraa deskitoolpii yookiin raabsa hunda hin mirkaneessu.

DEB ajaja apt install ./file.deb fayyadamuun fe'i, yookiin RPM to'ataa paakeejii raabsa keetiin fe'i. AppImage heeyyama raawwatamummaa fi deeggarsa FUSE mijataa barbaada; bakka deeggaramutti --appimage-extract-and-run filannoo biraati. Paakeejota tar.gz fi ZIP faayiloota yeroo hojii isaanii hundumaa waliin baasi. Yeroo paakeejii bakka buustu daataa fayyadamaa fi faayiloota appilikeeshinii addaan baasi.

Madda irraa ijaaruuf, fe'aa Electron baramaa dabalatee Node 24, Git fi npm ci fayyadami. Ijaarsi dhalootaa meeshaalee waltajjii barbaada: meeshaalee sarara-ajajaa Xcode macOS irratti; MSVC C++, Windows SDK fi Python Windows irratti; kumpaayilarii, make, Python, pkg-config fi meeshaalee saamsamaa barbaachisoo Linux irratti. Ajajoota sirrii fi daangaawwan waltajjii ammaa arguuf PLATFORM_BUILDS.md hordofi.

Gosaan gadi-lakkifamaa giddu-galeessaan kan qabamaniifi bu'aawwan kan hin jijjiiramneedha. Ijaarsi mirkaneessaa CI fe'aa maxxanfame miti. Kuusaan maddaa koodii madda, lockfile, sanadoota fi iskiriipitiilee qabata; qooda-fudhannoon, ragaaleen dhuunfaa, piroofaayiliin fayyadamaa fi qorannoon dhuunfaa keessaa baafamaniiru. Ijaarsa x64 milkaa'e irraa mirkanaa'ina ARM dhalootaa yookiin Windows gonkumaa hin tilmaamin.

Qajeelfamoota walqabatan: [Paakeejota waltajjii, ulaagaalee dursaa fi daangaawwan mirkaneessaa](../../PLATFORM_BUILDS.md) · [Eenyummaa ijaarsaa fi sakatta'iinsa gadi-lakkifamaa](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: kallattiiwwan shan

Auto bal'ina hojii madaala: gaaffiin salphaan deebiidhaan xumuramu danda'a, hojiin bal'aan immoo qophii barbaada. Hantuuba sirreessi sababa qoratee sirreeffama qopheessa. Spec first furmaata teeknikaatiin jalqaba; Requirements first ulaagaalee fi meeshaalee fudhatamummaa irraa jalqaba.

Multi-model qorannoo, dizaayinii, raawwii fi gamaaggamaaf haaloota addaa addaa fayyadama. Maqaan kallattichaa dhiheessitoota adda addaa hin barbaadu: gahiin tokkoon tokkoo qindaa'ina dursaa yookiin qindaa'ina Custom ati filatte fayyadama.

Worktree-n jijjiiramoota Git hojichaa adda baasa. Branch baafama filatame keessatti hojjeta. Jalqabuu dura pirojektii, damee fi moodeela sakatta'i; ibsi hojichaa gara marii baramaatti hin ergamu.

Yaada filannoowwan oomishaa yookiin teeknikaa hin furamne qabuuf, Requirements first fayyadamiitii bu'uura isaa mariidhaan ijaari. Auto gaafficha gareetti ramada; gaalee gabaabaa hunda battalatti hojiirra oolchuuf ajaja miti. Wixinicha olkaawi moodeela qunnamuu malee gaafficha tursiisa; Jalqabi adeemsa to'atame yeroo tokkoof olkaayee eegalsiisa. Garagaltoonni hojii tokko hanga afurii ID uumamaa fi qindaa'inoota gahee walaba ta'an qabu.

Qajeelfamoota walqabatan: [Waliigaltee adeemsa hojii Code](../../WORKFLOWS.md) · [Piroofaayilii qajeelfama Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Marii Forge

Jalqabi marii giddu-galeessaa bana. Uumamaan deebisi, gaaffii deebii gaafadhu, daangaawwan dabali fi filannoowwan teeknikaa irratti mari'adhu. Haasaa fi gaaffiileen hojicha waliin turu.

Barreeffama erguun sanada fudhachuu yookiin karoora raawwii haaraa heeyyamuu miti. Raawwii keessatti ibsa gaafachuun jalqaba dabaree to'atame dhaabee bal'ina dhimmi ilaallatu irra deebi'ee ilaala. Tarkaanfii duraan fudhatame keessatti gaaffiif deebii kennuun tarkaanfii sana itti fufsiisuu danda'a.

Ta'e jedhanii bu'uura irra deebi'anii ilaaluuf, Requirements, Specification yookiin Planning filadhu. Gosti haaraan murteewwan irratti hundaa'aniif fudhatamummaa haaraa barbaada. Tarkaanfileen xumuraman fi ragaaleen isaanii ni turu; marsaan hin xumuramne kan bakka bu'ame seenaa keessatti hafa.

Kutaan marsaa to'atamee marii bilisaa irraa addadha. Kallattiin gaaffii harkaatiin gara kutaa abbaa adeemsa hojiitti erguu mannaa marii Forge fayyadami.

Qajeelfamoota walqabatan: [Waliigaltee marii Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Sanadoota fi murteewwan

Sanada bani, gosa isaa sakatta'i yoo barbaachises gulaallii taasisi. Gulaalliiwwan mariidhaan dhiheessuun gosa haaraa uuma; gabaasawwanii fi bu'aawwan mirkanaa'an boodatti deebi'anii hin barreeffaman.

Karoora dhihaate fudhachuu dura, tartiiba, qajeelfamoota, ulaagaalee fudhatamummaa fi ajajoota mirkaneessaa gulaali. Ajajoota qabatamaa hubatte heeyyami: isaan galmee hojichaa keessatti raawwatamu. Multi-model tarkaanfii raawwii hojii guutuu tokko kan tarreeffamoota sanadoota fi qajeelfamoota isaa keessatti qabu dhiheessa.

Mirkaneessuun murtoo of-eeggannoo addaati. Auto gaaffiilee yookiin fudhatamummaa ulaagaalee, qajeeltoowwan teeknikaa fi karooraa bira hin darbu. Sanadni alaan jijjiirame mirkaneessa duraanii deebisee fayyadamuu hin danda'u.

Faayiloonni qophii akka bu'aalee hojiitti mul'atu. Gosti isaanii, marsaan oomishee fi haashii isaanii bu'aa tokkotti isaan hidha. Sanadoonni Code worktree alatti eegamu fi ofiin gara commit keessa hin seenan.

Fudhachuu dura sanadichaa fi murtoo agarsiifame lamaan isaanii sakatta'i. Fudhatamummaan ID kelloo ammaa, irra-deebii karooraa fi haashii sanada tursiifamee walitti hidha. Yeroo bal'inni yookiin ragaan dogoggora ta'u jijjiirama gaafadhu. Yoo murtoon yeroon itti darbe, filannoo haaraa gochuu dura haala olkaawame irra deebii fe'i; faayilli jijjiirame gosa duraa jalatti fudhatamuu hin danda'u.

Qajeelfamoota walqabatan: [Kelloowwan adeemsa hojii fi gosoota sanadaa](../../WORKFLOWS.md).

<a id="execution"></a>

## Raawwii fi gamaaggama

Hojjetamuu-qaba tarkaanfilee dhugaa, yaalii ammaa, mirkaneessaa fi bu'aawwan gamaaggamaa agarsiisa. Eejantiin "hojjetameera" jechuun tarkaanfii hin xumuru: ragaan karooraan barbaadamu jiraachuu qaba.

Haalli harkaanii tarkaanfilee mijatoo gidduutti ni dhaaba. Auto tarkaanfilee mirkanaa'an dursisee yaaliiwwan daangeffaman heeyyama. Booda dhaabi yeroo hunda qabxii dhaabbataa uuma. Dhaabi hojii socho'aa adeemsa hojichaa dhaaba; paanaalii cufuun isa hin dhaabu.

Gamaaggamaan walabaa haala addaa faayilootaa fi bu'aawwan mirkaneessaa waliin fayyadama. Argannoon danqaa ta'e kan barbaadamu hundi furamuu qaba; gamaaggamtoonni hedduun dogoggora danqaa ta'e sagaleedhaan balleessuu hin danda'an.

Multi-model keessatti, argannoowwan sirreessuun murtoo ifaa barbaada. Sirreeffamni cal-dhisee gamaaggama biraa hin jalqabu: Irra deebi'ii gamaaggami marsaa haaraa bana. Yaadoleen gamaaggamaa raawwii irra deebi'uu malee qindeessaan irra deebiee akka ilaalu gaafachuu danda'u.

Tarkaanfileen xumuraman cal-dhiisanii gulaalamuu hin danda'an. TDD waliin, Diimaan dhugumatti sababa eegameen kufuu qaba, achiis Magariisni darbuu qaba. Yaaliileen daangeffaman irra-deebii dhuma hin qabne ittisu.

Gamaaggamtota walabaa CLI/API Qindaa'inoota → Gareewwan gamaaggamaa keessatti olkaawi, sana booda garee sana Code yookiin Work keessatti filadhu. Gamaaggamtoonni cinaatti wal-faana fiigu, itti aansee arkiteektii gabaasa gareeti. Garee olkaawame malees gamaaggamtota walabaa qindeessuu dandeessa. Arkiteektiin gabaasaa gabaasawwan caaseffaman kan maqaan hin ibsamne qofa fudhata, faayiloota pirojektii yookiin meeshaalee malee; adda baasiinsi kun ammaan tana Claude Code yookiin API barbaada.

Tarkaanfiin raawwii hundi sakatta'iinsa raawwatamu, gamaaggama walabaa barbaadamu, yookiin lamaan isaaniiyyuu barbaada. Marsaan qophii garuu bu'aawwan mirkanaa'anii fi nagaheewwan meeshaa bu'aa tursiisa; kunniin qorannoowwan raawwii fiiganiiru jedhanii hin soban. Ajajni tokko kan milkaa'u yoo haalli ba'iinsaa dhugaa fi qulqullinni adeemsa abbaa qabuu mirkanaa'e qofaadha. Sakatta'iinsi Diimaa kan TDD raawwii fi mirkaneessa Magariisaa dura uumamaan kufuu qaba; faayila raawwatamu dhabuun yookiin yeroon darbuun bu'aa Diimaa sirrii miti.

Citoonni elektiriikii baramoon tarkaanfii tokko irratti yaalii kufe sadii yookiin walumaagalatti yaalii shantama booda dhaabu. Addaan citiinsi yaalii tokko fudhata garuu ofumaan akka yaalii kufetti hin lakkaa'amu. Daangaawwanii fi ragaaleen xumuraman irra-deebii jalqabuu boodas ni turu; Irra-deebi'i isaan hin haaromsu. Yaalii biraa heeyyamuu dura kufaatii tursiifame dubbisi.

Qajeelfamoota walqabatan: [Mirkaneessa fi gamaaggama](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Gareewwan gamaaggamaa wal-faanaa fi arkiteektii gabaasaa

Qindaa'inoota → Gareewwan gamaaggamaa baniitii garee olkaawi. Gamaaggamtota walabaa CLI yookiin API, moodeela, tattaaffii yaadaa fi ogummaa mataa isaanii qaban dabali, sana booda arkiteektii gabaasaa filadhu. Garee sana qindaa'ina gamaaggama hojichaa keessatti filadhu. Qindaa'inni dursaa raawwataas gamaaggamaadhaan fayyadamamuu danda'a, akkasumas Custom ni jiraata; gaheen walabaa ammayyuu haaloota addaa qaba.

Gamaaggamtoonni ragaa hojii walfakkaataa irratti wal-faana fiigu. Gabaasni barbaadamu, dogoggorri fi murtoon hundi ni tursiifamu. Arkiteektiin gabaasawwan lakkoofsa qaban kan maqaan isaanii hin tuqamne, maqaa gamaaggamaa malee, eenyummaa moodeelaa yookiin dhiheessaa malee, qabiyyee hojii as-aanaa malee, heeyyama kuusaa yookiin meeshaalee malee fudhata. Gabaasota wal-bira qabee murtoo caaseffame tokko deebisa; gamaaggama madda haaraa hin geggeessu.

Argannoon danqaa ta'e yookiin kufaatiin gamaaggamaa barbaadamu sagalee caalmaatiin yookiin fedhii arkiteektiitiin dhiifamuu hin danda'u. Gabaasni dhabame yookiin bifa sirrii hin qabne mirkaneessa ittisa. Fudhachuu yookiin sirreeffamoota heeyyamuu dura argannoowwan dhuunfaa fi murtoo waloo sakatta'i. Gareen olkaawame raawwiidhaaf qophaa'ee qorqorama; qindaa'ina dursaa isaa gulaaluun ragaa xumurame irra deebiee hin barreessu.

Arkiteektiin gabaasa-qofaa ammaan tana qindaa'inoota meeshaa-maleeyyii kan Claude yookiin API deeggaraman fayyadama. Codex fi Antigravity akka gamaaggamtotaatti argamu garuu hanga waliigalteen meeshaa-maleessaa mirkanaa'e jirutti gahee arkiteektii adda baafame kanaan hin eeyyamaman. Qajeelfamni “meeshaan hin jiru” qofti gahaa miti.

> Xurreen dizaayinii/gamaaggamaa Code Multi-model fi gareen gamaaggamaa wal-faanaa olkaawame to'annoowwan adda addaati. Imaammata gamaaggamaa filatame eegi; kallattiin tokko amala gamaaggamaa hunda ni dandeessisa jettee hin yaadin.

Qajeelfamoota walqabatan: [Qindaa'ina garee bifa qabuu](../../../shared/review-team.ts) · [Walitti-qabama gamaaggamaa](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Ogummaa eejantii fi imaammata qajeelfamaa

Moodeelli maashinii raawwataati; ogummaan immoo piroofaayilii qajeelfamaati. Ogummaa dabalataa dhabuuf None, qajeelfama baramaaf Standard, qajeelfama keessaa dhimma ilaallatuuf Auto, yookiin qajeelfamoota filatamanii fi qajeelfama daangeffamaa mataa keetiif Manual filadhu. Qindaa'inonni dursaa filannoo kana tursiisuu danda'u.

Tarreen duraanii koodiingii waliigalaa, arkiteekchara, nageenya, amanamummaa, raawwii, qorannoo fi mijatummaa fuula agarsiisaa hammata. Auto qajeelfama filachuuf barreeffama hojii/tarkaanfii jiru fayyadama; dhoksaatti moodeela biraa hin waamu yookiin beekumsa addaa hin mirkaneessu. Yaadoleen karoorsuu karoora raawwii fudhachuu dura sakatta'amanii fi jijjiiramuu danda'u.

Ogummaan gamaaggamaa xiyyeeffannoo qajeelchuuf gargaara garuu gonkumaa ragaa walabaa, daangaawwan heeyyamaa yookiin murtoo caaseffame bakka hin bu'u. Qajeelfamoota dhuunfaa akka qaama bal'ina hojichaatti ilaali: fudhatamummaa sanadaa, imaammata meeshaa, mirkaneessa eenyummaa yookiin kufaatii gamaaggamaa bira darbuuf isaanitti hin fayyadamin.

Qajeelfamoota walqabatan: [Tarree qajeelfama duraanii](../../../shared/specializations.ts).

<a id="work"></a>

## Work: gaaffii irraa gara sanadaatti

Work Git hin barbaadu. Default galmee hojii addaa uuma; Custom immoo filataa dhalootaa fayyadamuun galmee jiru filata. Save draft yaada moodeelaa malee qindaa'inoota kuusa; Start marsaa jalqabaa hojjeta.

Auto kallattiin deebisa yookiin karoora mijataa To-do dhugaa waliin dhiheessa. Brainstorm yaadota dabalataa yookiin madaallii filachuu kee dura ideas.md uuma. Research findings.md, maddoota fi daangaawwan tursiisa. Write kaayyoo irraa fi, yoo barbaachise, outline.md irraa gara sanada ibsaa yookiin draft.md tti ceesa; irra-deebiin gosoota duraanii tursiisa.

Galteewwan faayilii filataa dhalootaatiin filadhuutii @ tiin isaan eeri. Appilikeeshinichi akka galteewwan hojii hin jijjiiramneetti isaan garagalfata akkasumas oolmaa dura eenyummaa isaanii mirkaneessa. Default galmee hojii kan appilikeeshiniin abbaa ta'e uuma; heeyyamni galmee Custom eeyyama abbaa olkaawameedha. Wixinni olkaawamee hin jalqabamin galmee isaa jijjiiruu danda'a.

Garagaltoota 1–4 qindaa'ina raawwataa walaba ta'een uumi. Hojiiwwan galmeewwan wal-irra bu'an fayyadaman yeroo tokkotti wal-faana barreessuu hin danda'an. Qindoominni kun hojiiwwan ZIAForge irratti raawwatama malee sagantaalee alaa kan biroo irratti miti.

Deep Brainstorm hojjetoota walaba sadiitti durtii ta'a akkasumas hanga saddeetiitti deeggara. Tartiiba fi qindaa'ina isaanii, haaloota addaa keessatti qindaa'ina dursaa deebisanii fayyadamuu dabalatee, filadhu. Gaaffiileen hojjetootaa madda isaanii ni tursiisu; gabaasawwan bifa sirrii hin qabne yaalii tokkoon bifa-sirreeffama argatu. Kufaatiin muraasaa milkaa'ina waliigalaa jedhamee dhihaachuu mannaa ifatti mul'atee hafa.

Deep gabaasota hojjetootaa tursiifaman walitti qabuun gara brainstorm_report.md tti fida akkasumas yeroo hunda murtoo fayyadamaa gaafata. Hordoffiin xiqqaam gabaasa sana qindeessaadhaan irra deebiee ilaala; jijjiiramni guddaan marsaa biroo kan hojjetoota qorqoramanii jalqabsiisa. Meeshaaleen bu'aa gosoota isaanii ni eeggatu.

Gaheewwan furaman yeroo hojiin uumamu yookiin wixinni ifatti olkaawamu ni qorqoramu. Waamicha jalqabaa booda, tarkaanfii ofiisaa/harkaanii qofatu jijjiiramuu danda'a; gahee yookiin qindaa'inoota moodeelaa addaatiif hojii haaraa fayyadami. Qindaa'ina dursaa waliigalaa gulaaluun cal-dhisee marsawwan boodaa hin jijjiiru.

Haalli harkaanii marsawwan mijatoo gidduutti ni dhaaba, toora Write bal'aa dabalatee. Auto toora sana keessa itti fufuu danda'a. Gaaffiileen, karoorawwan raawwatamoo dhihaatan, kallattiin Brainstorm fi gamaaggamni gabaasa Deep Auto keessattillee murteewwan ifaa ta'anii hafu. Wabeeffannaan qofti sakatta'iinsi websaayitii raawwatamuu hin mirkaneessu, akkasumas faayilli baayinearii tursiifame qofti mul'annoo isaa hin mirkaneessu.

Qajeelfamoota walqabatan: [Haaloota fi murteewwan Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Qindaa'inoota dursaa, moodeelota fi heeyyama

Qindaa'inni dursaa CLI/API, moodeela, tattaaffii yaadaa fi heeyyamoota olkaawa. Miilli marii qindaa'ina dursaa, CLI, moodeela fi kutaa filannoowwanii qaba. Custom qindaa'ina dursaa malee hojjeta; Create preset filannoo ammaa olkaawa.

Tarreen kan dhufu CLI fe'ame filatame irraa yookiin API bakka deeggaramutti. Refresh filannoo jijjiiruu malee tarree haaromsa. Yoo argachuun hin danda'amne, ID moodeelaa ifa ta'e galchi; dhiheessaan ammayyuu isa deeggaruu qaba. Sadarkaaleen yaadaa moodeelaa fi CLI irratti hundaa'u. Durtii dhiheessaa tookenii none ifa ta'e irraa addadha.

Jijjiiramoota kan hojiirra oolchitu erga deebiin duubee mirkanaa'ee qofa. Dabaree socho'aa yookiin tarree hin duwwaatin keessatti jijjiiruun daangeffamaadha. Wixineewwanii fi seenaan mul'atu ni turu, garuu dhiheessitoota jijjiiruun haala isaanii kan keessoo dhuunfaa hin dabarsu.

Forge keessatti, moggaasni gahee barbaachisaadha: qophiin Planner addaa fayyadamuu danda'a. Miilli gahee mul'atu jijjiira; gamaaggamtoonni fi gargaartonni qindaa'ina adeemsa hojii keessatti filatamu. Imaammatni raawwii duraan mirkanaa'eef cufamuu danda'a.

Heeyyamoonni dhiheessitoota gidduutti garaagarummaa qabu. Read only fi Workspace write bakka adaaptarri isaan deeggarutti ni argamu. Antigravity qindaa'ina CLI dhalootaa yookiin heeyyama guutuu ifatti filatame fayyadama. Heeyyami guutuun sandbox miti.

Ogummaan qajeelfama qofa dabala malee moodeela biraa yookiin heeyyama miti. Qindaa'inonni dursaa fi gaheewwan None, Standard, Auto fi Manual ni deeggaru. Auto waamicha moodeela dabalataa malee barreeffama tarkaanfii irraa piroofaayilii filata; Manual ogummaawwan hanga afurii fi qajeelfamoota dhuunfaa fudhata. Ramaddiiwwan Planner-iin dhihaatan karoora fudhachuu dura gulaalamuu danda'u.

ID moodeelaa yookiin tattaaffiin harkaan galfame filannoo kee ta'ee hafa, garuu dhiheessichi isa diduu danda'a. Qindaa'ina dursaa waliigalaa gulaaluun marii hojjetaa jiru yookiin karoora fudhatame boodatti deebi'ee hin jijjiiru. Marii boqonnaa irra jiru ta'e jettee jijjiiruuf, to'annoowwan qindaa'ina mataa isaa fayyadamiitii mirkaneessa eegi. Filannoon cufame akka dandeettii yookiin daangaa marsaa jireenyaatti dubbifamuu qaba malee, JSON olkaawame gulaaluun bira darbamuu hin qabu.

Qajeelfamoota walqabatan: [Dandeettiiwwan dhiheessaa](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Mariiwwan, Dhaabi fi tarree

Taboota banaman, Dhiheenyaa fi wixineewwan hojii tokko jalatti ramadamu. Taba cufuun Banamaa keessaa isa balleessa garuu Dhiheenyaa keessatti isa tursiisa akkasumas adeemsa dhiheessaa isaa yookiin adeemsa hojii to'atame hin dhaabu. Seenaa barbaadi, marii irra deebi'ii bani yookiin baafata seenaa irraa taboota dabalataa hunda cufi.

Dhaabi dabaree ammaa gidduutti kuta. Ergaa itti aanu Erguu dura dhaabbachuun hanga xumuramutti eegi: beekamtiin addaan cituu adeemsi xumurame jechuu miti. Yeroo kana keessatti wixinee itti aanu barreessuu dandeessa.

Marii baramaa keessatti, Tarreen gaaffii boodaa wixinee ammaa irraa addatti olkaawa. Tarree dhaabi ergaa dabalataa tursiisa. Dhaabi fi Bahi tarree sana ni dhaabu. Erga irra deebitee jalqabdee booda, jalqaba Itti fufi, sana booda ifatti Tarree itti fufi.

Mirkanaa'aa miti jechuun gahiinsi isaa hin beekamu jechuudha. Ergaan akkasii ofumaan irra deebi'amee hin ergame: seenaa sakatta'i, yoo barbaachise barreeffama garagalchiitii qabiyyee tarreeffame sana dhiisi. Deebisanii erguun gaaffii of-eeggannoo haaraadha.

Mariiwwan marsaa to'ataman adeemsa hojii isaanii fayyadamu malee tarree baramaa miti. Marsaa hordofi marsaa ammaa agarsiisa; harkaan taba biraa filachuun hordofuu dhaaba. Galmeewwan CLI qorannoo deebii irraa addatti agarsiisu.

Deebiin Markdown mata-dureewwan, tarreewwan, gabateewwan, hidhatawwan fi koodii daangeffame agarsiisa. Kaardiiwwan meeshaa fi qorannoowwan CLI deebicha irraa adda ta'anii hafu. Yaada moodeelli gabaasee fi lakkoofsa tookenii kan mul'atan yoo dhiheessaan dhugumatti isaan ifa godhe qofaadha; sochii argaa irraa yaada dhuunfaa yookiin itti-fayyadama hin tilmaamin.

Erga ergaan hin mirkanoofne yookiin beekamtiin tarree dhufee booda, seenaa sakatta'iitii gaaffii tursiifame sana qofa bakka dhihaatetti irra deebi'ii yaali. Nagaheen tarree kuusaan qabiyyicha fudhateera jechuudha malee yaada moodeelaa xumurame jechuu miti. Qabiyyee tarreeffame kan hin mirkanoofne ifatti haquuf qofa balleessi; ergaa duraan gahe deebisee duubatti harkisuu hin danda'u.

Qajeelfamoota walqabatan: [Tarree ergaa itti-fufiinsa qabu](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Faayiloota, Git fi xumura

Faayiloonni galmee hojichaa agarsiisa. Bu'aawwan ulaagaalee waliin madaali, sanadoota baniitii garaagarummoota sakatta'i. Faayila baayinearii tursiisuun appilikeeshinii kaayyooffatame keessatti sirriitti mul'achuu isaa hin mirkaneessu.

Git haala, jijjiiramoota fi hojiiwwan bu'aalee galmaa'an waliin dhiheessa. Commit, merge fi push durtii dhaan kan harkaati; hojiiwwan ofiisaa karoora guutummaatti mirkanaa'eef filannoowwan addaati.

Mirkaneessaa fi maxxansa gidduutti faayiloota hojjetamaa jiran hin jijjiirin: mirkaneessi baayitoota sirrii waliin hidhata qaba. Wal-dhabdeen, push kufuun fi bu'aawwan hojii hin beekamne hanga murtoo ifaatti deemsa ni cufu. Auto cal-dhisee maxxansuu hin heeyyamu.

Work dameewwan Git hin uumu akkasumas xumura Git hin qabu. Sanadoota barbaachisan, gosoota fi maddoota dabalatee, galmee filatame keessaa eegi.

Gulaalaan faayilii caaslugaa dheerina maqaatiin, barbaadi fi bakka buusi, seenaa duubatti deebisuu, sarara maruu fi wixineewwan taba-tokkoon-tokkoo dhiheessa. Olkaawinsi seera qubee UTF-8/UTF-16 deeggaramu ni eega akkasumas wal-dhabdee fooyya'iinsa alaa ni dida. Seerri qubee biroo fi qabiyyeen baayinearii gulaalaa alaa barbaadu. Wixineewwan hin olkaawamin hanga abbaan olkaawutti yookiin dhiisutti appilikeeshinii Cufuu ittisu.

Caaslugaan guutuun hanga 8 MiB tti ni danda'ama. Faayiloonni barreeffamaa gurguddoon foddaalee 256 KiB keessatti banamu; 8–64 MiB caaslugaa malee guutummaatti ifatti fe'amuu danda'u. 64 MiB ol taanaan gulaallii foddaa fi barbaacha walsimsiisa itti aanu daangeffame fayyadami. Kun bifa faayila gurguddoo daangeffamaadha malee sanadoota gurguddoo hundaaf wal-qixxummaa Sublime Text miti.

Galmee bani cal-dhisee kuusaa jalqabaa qofa banuu mannaa haala hojii ammaa yookiin damee/worktree fayyadama. Tarreen faayilii galmee dhalootaa faayilichaa agarsiisuu danda'a. Kallattiiwwan eeyyamoota hojii galmaa'an irratti hundaa'uun duubeedhaan mirkanaa'u. Faayiloonni baayinearii akka barreeffama salphaatti hin gulaalaman; mul'isaa isaanii kan xiyyeeffannoo fayyadamiitii baayitoota jalqabaa eegi.

Worktree balleessuun gocha eegumsa qabu kan addaati. Isa balleessuu dura kutaalee caaseffamanii fi teerminaalota walqabatanii jiran xumuri, kutaalee boqonnaa irra jiran dabalatee. Bu'aa Git olkaawamee fi haala deebisanii argachuu sakatta'i; galmee hojii haquun hojii hin commit ta'in nageenyaan eeguu bakka hin bu'u.

Qajeelfamoota walqabatan: [Waliigaltee gulaalaa bifa qabuu](../../../shared/editor.ts) · [Imaammatoota Git](../../WORKFLOWS.md).

<a id="api"></a>

## Walqabsiisota API

Walqabsiisonni buufata OpenAI-waliin walsimu kan ifatti filatame dabala. Maqaa, URL bu'uuraa, moodeela fi yoo barbaachise furtuu galchi. Sarvaroonni hedduun URL bu'uuraa kan /v1 dhaan xumuramu barbaadu; sanada buufata keetii ilaali.

HTTP loopback irraa kan hafe HTTPS barbaachisaadha. Buufata qulqulluu ragaaleen icciitii URL keessatti hin cuubamin fayyadami. Furtuuleen icciiteessa OS deeggaramu fayyadamu akkasumas gara UI tti hin deebifaman. Buufata jijjiiruun furtuu isaa irra deebisanii galchuu barbaada. Bakka furtuu duwwaa dhiisuun furtuu olkaawame eega; Furtuu olkaawame balleessi kan jedhu ifatti isa qulqulleessa.

Waamichi API maamilummaa CLI hin fayyadamu. Meeshaaleen fi moodeelonni kutaalee dhalootaa irraa addadha, akkasumas moodeela milkaa'inaan argachuun yaada moodeelaa hin mirkaneessu. Itti fayyadamni tookenii kan mul'atu yoo dhiheessaan dhugumatti deebise qofaadha.

Ragaalee dhuunfaa barreeffama hojii yookiin qajeelfama dursaa keessatti utuu hin taane Walqabsiisota keessatti eegi. Gamaaggamtoonni dubbisa-qofaa meeshaalee faayilii API heeyyamaman qofa fudhatu; arkiteektiin gabaasaa meeshaa hin qabu. Waamichi meeshaa hin deeggaramne cal-dhifamee raawwatamuu mannaa ni didama. Sarvaroonni ulaagaalee yaadaa, deeggarsa meeshaa fi tarree moodeelaa irratti garaagarummaa qabu; dogoggora tokko waliigaltee buufata keetii mataa isaa waliin wal-bira qabi.

Qajeelfamoota walqabatan: [Walqabsiisota API](../../API_CONNECTIONS.md).

<a id="settings"></a>

## Qindaa'inoota, afaanota fi haaromsa nageenyaa

Qindaa'inonni waliigalaa bakka hojii, afaan fuula agarsiisaa fi durtiilee filatu. Walqabsiisonni buufataalee API to'ata. Qindaa'inonni dursaa fi Gareewwan gamaaggamaa qindaa'inoota gahee tursiisu. To'annoo fagootti ragaalee dhuunfaa naannoo, bal'ina sarvarii fi heeyyamoota abbaa to'ata; Updates madda/sarara gadi-lakkifamaa to'ata. About ijaarsa hojjetaa jiru isa sirrii agarsiisa.

Afaan qindaa'ina fuulaa afaan ajajaa fi haala gamaaggama galmee irraa addadha. Maqaaleen oomishaa, ID ajajaa, dabalatoonni faayilii, ID moodela dhiyeessaa fi maqaaleen fayyadamaan uumaman akkuma jiranitti adda baastoota ta'anii hafu. Gargaarsi yeroo hiikkaan ammaa jirutti afaan qindaa'ina fuulaa filatame hordofa; hiikkaan maashinii mallattoon itti godhama, Ingiliffi ammoo wabii isa bu'uuraa ta'ee hafa.

Olkaa'iin qindaa'ina mul'ate hojiirra oolcha. Kuusaa daataa irra deebisanii dhaabuun ykn gara qindaa'ina warshaatti deebisuun meetaadaataa sagantichaa balleessuu danda'a; itti yaaddee qindaa'icha duraatti deebisuu fayyadamuun dura faayiloota fi kuusaa of-eeggannoo qorame eegi. Dalagaaleen kun gochoota abbaa qabeenyaa naannooti. Yaa'a hojii fashalaa'e ykn galmee manca'e qorachuuf akka karaa gabaabaatti isaan hin fayyadamin.

Qajeelfamoota walqabatan: [Qajeelfama qindaa'ina naannoo](../../LOCALIZATION.md) · [Daataa deebisanii dhaabuu](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Gargaaraa Gargaarsaa gaafadhu

Gargaarsa baniitii, saanduqa gargaaraa isaa keessatti qindaa'ina duraa kan walqunnamsiifame filadhu, waa'ee ZIAForge gaafadhu. Deebiiwwan qajeelfama Ingiliffaa bu'uuraa isa ammaa fi afaan qindaa'ina fuulaa kee filatame fayyadamu. Qabduuleen wabii kutaa mata-dureewwan qajeelfamaa dhimmi ilaallatu waan bananiif, ibsicha wabicha waliin madaaluu dandeessa.

Gargaaraan kun haasaa dhuunfaa adda ta'e kan galmee kuufame hanga 100 fi 3 MiB qabatu eega. Gaaffii hanga qubee 12,000 galchi; Ergi gaafficha dhiheessa, Dhaabi gaaffii kee osoo hin balleessin deebii hojjetamaa jiru haqa, Qulqulleessi ammoo marii Gargaarsaa kana balleessa. Qorannoon hin ergaminii fi filannoon qindaa'ina duraa gargaarsa cufuu ykn deebisanii banuutti itti fufu, garuu qorannoon diskiitti hin kuufamu. Gargaaraan ajaja sagantichaa hin ergu, yaa'a hojii hin jijjiiru, ykn karra hin fudhatu. Gorsi mirkaneessa kallattii kan hojjetamaa, herregaa ykn walqunnamtii alaa miti.

Yeroon gargaarsaa Claude Code fi API imaammata meeshaa maleeyyii deeggaramu hojiirra oolchu. Yeroon gargaarsaa Codex fi Antigravity kan dhalataa eeyyama kompiitara dhalataa kan abbaa qabeenyaa duraan jiru barbaadu. Yoo dhaamsifame, sagantichi dhiyeessaa biraa filachuu mannaa ulaagaa dursa barbaachisu ibsa. Abbaan qabeenyaa qofatu qindaa'ina to'annaa naannootti dandeessisuu danda'a; gargaaraan ofumaan dandeessisuu hin danda'u.

Gargaarsi Codex saanduqa yaalii dubbisa qofaa fayyadama, gaaffii eeyyama meeshaa ni dida. Antigravity haala karooraa fi asxaa saanduqa yaalii dhalataa fayyadama. Haalawwan dhalataa kun wabii daangessuu sirna hojii guutuu miti. Haashii qajeelfama maddaati deebichaaf wabiin fayyadame eenyummaa isaa adda baasa; ibsi uumame ammas dogoggora qabaachuu waan danda'uuf tarkaanfii fudhachuu dura kutaa walqabatan qoradhu. Deebiiwwan duraanii gosti qajeelfama madda isaanii qajeelfama ammaa irraa yoo adda ta'e mallattoon itti godhama.

Qajeelfamoota walqabatan: [Qajeelfama bu'uuraa fi kunuunsa hiikkaa](../../HELP_MAINTENANCE.md) · [Gargaaraa sagantichaa fi eeyyamoota](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Gargaaraa fi Telegram

Gargaaraan kun qindaa'ina duraa filatamee fi API to'annaa sagantichaa isa tokkicha fayyadama. Eeyyami haala qorachuu fi eeyyami dalagaalee raawwachuu adda adda. Ajajawwanii fi bu'aawwan qoradhu: barreeffamni gargaaraa dalagaan tokko xumuramuusaa ragaa miti.

Telegram kan hayyamamu abbaa qabeenyaa naannootti argamu qofaan, mallattoo (token) boottii duraan jiru fi ID lakkoofsaa kan abbaa qabeenyaatiin. To'annaan kun haasaa dhuunfaa abbaa qabeenyaa sanaaf qofa. Boottiin hin qindeeffamin ykn hin hojjenne ergaawwan sagantichaa fudhachuu hin qabu.

Mallattoo (token) boottii haasaa idilee keessatti hin maxxansin. Walitti dhufeenya kana qindeessuun walitti dhufeenya Telegram hin mirkaneessu, akkasumas ofumaan boottii hin uumu. Waraabbiin iskiriinii fi deebiiwwan daataa iddoo hojii dhuunfaa qabaachuu danda'u.

Qindaa'ina duraa gargaaraa filadhuutii eeyyama dalagaa sagantichaa qorannoo irraa addatti kenni. Hojiin gargaaraa Codex fi Antigravity eeyyama kompiitara dhalataa kan abbaa qabeenyaa barbaada; isaan callisanii tajaajila meeshaa maleeyyii kan API ykn Claude bakka hin buufaman. Waraabbiin iskiriinii marii gargaaraa keessatti agarsiifamuu danda'a, garuu galteen moodela ammaa qaaccessa fakkii hin dabalatu. Gargaaraan fakkicha waan agarsiiseef qofa ijaan qorateera jettee hin yaadin.

Gargaaraan cuunfaawwan, hojjetamoota, haasaawwan, haala yaa'a hojii, qabiyyee adeemsaa fi foddaawwan sagantaa meeshaalee gosa qaban fayyadamuun qorachuu danda'a. Qindaa'inoota idilee hayyamaman jijjiiruu fi dalagaalee sagantichaa hayyamaman jalqabsiisuu danda'a. Mirga dhalataa kennuu, ragaawwan iccitiitiin kuufaman saaxiluu, eeyyama iddoo hojii hundee fagoodhaa jijjiiruu ykn karra Forge waan mijateef qofa mirkaneessuu hin danda'u.

Qajeelfamoota walqabatan: [Waliigaltee to'annaa sagantichaa](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Boottii Telegram dhuunfaa kee hojjechiisi

Boottii mataa keetii uumi ykn argadhu, haasaa dhuunfaa isaa jalqabi, sana booda mallattoo (token) isaa fi ID fayyadamaa Telegram lakkoofsaa kee qindaa'inoota to'annaa naannoo keessatti galchi. Walitti dhufeenyicha yeroo sagantaan akka walqunnamu barbaaddu qofa dandeessisi. ID n abbaa qabeenyaa adda baasaa fayyadamaati malee maqaa fayyadamaa ykn ID boottii miti. Ergaawwan fayyadamaa sana irraa haasaa dhuunfaa sana keessatti ergaman qofatu fudhatama.

Gosa hojjetamaa jiru, lakkoofsa pirojektii/hojjetamaa fi haalawwan hojjetamaa cuunfaatti argachuuf /start, /menu ykn /status fayyadami. Qabduuleen Pirojektoota, Hojjetamoota, Waraabbii Iskiriinii, Gargaarsa fi Afaan banu. Tarreewwan fuula tokkotti wantoota saddeet agarsiisu, qabduulee Duubatti, Haaromsi, Mana fi Kan Duraa/Itti Aanu qabu. Qabduuleen pirojektii tarree hojjetamaa calalu. Kaardiin hojjetamaa adeemsa yaa'a hojii kuufame, moodela/qindaa'ina duraa fi yoo jiraatan gaaffiiwwan eegaa jiran agarsiisa.

Haasaawwan banaa/dhiyoo fi haasaawwan sadarkaa yaa'a hojii dursee arguuf Haasaawwan hojjetamaa bani. Dursee argisiisni tokkoon tokkoo ergaawwan dhihoo kan fayyadamaa/gargaaraa hanga jahaa kan agarsiisu yoo ta'u, tokkoon tokkoon isaanii ifatti gara qubee 200 tti gabaabbatu. Yaanni dhuunfaa hin agarsiifamu. Seenaa dubbisuun dhiyeessaa hin jalqabsiisu. Dursee agarsiisonni dubbisa qofaafi: barreeffamni idilee fi /ask TEXT ammas gargaaraa sagantichaatiif ergamu malee haasaa hojjetamaa ilaalaa jirtuuf callisanii hin ergaman.

Deemsisi / Itti Fufi yaa'a hojii Code ykn Work isa ammaa irra deebisee dubbisa, yaa'a hojii kuufame kan ulaagaa guutu ni jalqabsiisa. Dhaabi jedhu ammoo akka dhaabbatu gaafata. Lamaan isaaniyyuu ulaagaalee, ibsa hojii, karoora, bu'aawwan gamaaggamaa ykn gaaffiiwwan hin fudhatan; murtoon eegaa jiru Deemsisi akka hin danda'amne dhowwa. Saganticha keessatti murtoo godhi, ykn ajaja gosa qabu kan eeyyame ifaa qabu karra fi fooyya'iinsa isaa isa ammaa wajjin fayyadami.

Afaanota qindaa'ina fuulaa 56 keessaa kamiyyuu maqaa dhalataatiin filachuuf Afaan ykn /language fayyadami. Kun boottii fi abbaa qabeenyaa kanaaf qofa filannoo kuusa. Afaan sagantichaa fayyadami filannoo kana qulqulleessa. Innis afaan sagantichaa ykn eeyyama seeninsaa hin jijjiiru; ergaawwan duraan jiran ofumaan deebisanii hin ergaman.

Sochiin baafataa ergaa qabiyyee maxxanfame isa tokkicha haaromsa. Qabduuleen eenyummaa hin mul'anne kan daqiiqaa 15 booda tajaajilaan ala ta'an qabu, yeroo tokko qofa hojjetu; kaardii jijjiiruun qabduulee duraanii gatii dhabsiisa. Qabduuleen yeroon irra darbe, dhumatan, ergaa walsimanneef fi adeemsa duraaniitiin walqabatan dalagaa raawwachuu hin danda'an. Ergaan sirreeffamuu hin dandeenye kaardii haaraan bakka bu'uu danda'a; dogoggorri sararaa hin beekamne akka ergaa haaraatti irra hin deebi'amu.

Yeroo hojiirra oolu, funaanaan kuusaa duraanii gatii dhabsiisa, ergaa dabarsuu dura fudhannaa haaromsaa galmeessa, kanaaf ajajawwan jidduutti addaan citan yeroo deebisanii jalqaban ofumaan deebisanii hin hojjetaman. Kun deebisanii taphachiisuu ittisa; xumuramuusaa wabii hin ta'u. Dogoggora booda hojii haaraa itti yaaltee kennuun dura haala/qabiyyee qoradhu. Beeksisni haala hojjetamaa ofumaan dhufu hin jiru.

Ajajawwan ifa ta'an ammas ni jiru: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot fi /ask TEXT. /new {JSON} karaa createTask gosa qabuutiin hojjetamaa uuma; /command {JSON} ammoo ajaja kaataaloogii ifa ta'e erga. Bifa yaadaatiif kaataaloogii kallattii dubbisi. Eeyyami dhimmoota duubaa fi eeyyamoonni galmee akkuma sagantichaatti hojiirra oolu.

Sagantichi gatii mallattoo boottii kuufame gara gargaaraatti yoomiyyuu hin ergu. Waraabbiiwwan iskiriinii, cuunfaawwan fi barreeffamoonni haasaa garuu odeeffannoo pirojektii dhuunfaa qabaachuu danda'u. Boottichi ykn herregni abbaa qabeenyaa yoo hin amanamne ta'e walitti dhufeenyicha naannootti dhaabi. Mallattoo saaxilame dhiyeessaa boottii waliin jijjiiri, sana booda qindaa'ina naannoo isa dhokfame haaromsi.

Qajeelfamoota walqabatan: [Boottii dhuunfaa fi ajajawwan](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Eeyyama kompiitara dhalataa abbaa qabeenyaa qofaa

Eeyyami kompiitara dhalataa dhaamee eegala. Abbaan qabeenyaa qofatu Qindaa'inoota naannoo → To'annaa fagootti dandeessisuu danda'a. Gargaaraan fi ajajawwan HTTP/MCP/Telegram asxaa kana ofiif dandeessisuu hin danda'an. Dalagaan tokko yoo dhowwame, gargaaraan qindaa'icha ibsee abbaan qabeenyaa akka murteessu gochuu qaba.

Yeroo ifatti dandeessifamu, computer.run faayilii dalagamu, tartiiba qabiyyee fi galmee hojii gonkaa filatamaa ta'e fudhata. Innis yaada qolaa (shell) hin fayyadamu, daangaa sekondii 30 qaba, akkasumas ba'icha hanga 1 MiB daangessa. Galmeen dhihaate yoo hin jirre ykn sirrii hin taane ni didama; cwd dhiisuun galmee qindaa'inoota sagantichaa fayyadama malee HOME miti. Bahiinsi (Quit) ajajawwan qabaman ni haqa, adeemsi isaanii qulqullaa'uu eega.

Daangaan dubbisuu/dalaguu sagantaa fi eeyyami dhalataa murtoowwan adda addaati. Muki hojii (worktree) dhiyeessaa daangaa hin qabne sirna faayilii irraa hin daangessu. Hojjetamichi yoo xumuramee hin barbaachisne ta'e eeyyama dhalataa dhoowwadhu, barreeffama gargaaraa akka ragaatti amanuu mannaa nagaheewwan ajajaa qoradhu.

Qajeelfamoota walqabatan: [Waliigaltee to'annaa abbaa qabeenyaa qofaa](../../../shared/control.ts).

<a id="remote"></a>

## Baafataa fi qindaa'inoota fagootti argaman

Abbaan qabeenyaa naannoo sarvaricha dandeessisa, teessoo, poortii fi daangaa isaa filata: qorannoof dubbisuu ykn gochootaaf hojjechuu. Teessoon 127.0.0.1 inni duraanii kompiitara kana irratti qofa argama. 0.0.0.0 hidhannoo sarara irra dhaggeeffata; dandeessisuun dura eeyyama sararaa qoradhu.

Baafanni tokko seensa mallattoo (token) booda qindaa'ina fuulaa sana bana. Hidhattoota uummataa ykn waraabbiiwwan iskiriinii keessatti mallattoolee hin dabalatin. HTTP qofaan daddabarsa daataa hin cufne; sarara hin amanamne irratti sarara eegame fayyadami.

Abbaan qabeenyaa qindaa'inoota biroo URL fi mallattoodhaan qindeessa. Duubni gaaffiiwwan dabarsa; kun pirojektoota isaanii gara maashinii naannootti hin waraabu. Gocha hundumaa dura qindaa'ina filatame qoradhu.

Ajajawwanii fi taateewwan gosa qaban to'annaa sagantichaa baatu. Daangaan dubbisuu jijjiirama hojjetamaa hin hayyamu. To'annaan kompiitara dhalataa filannoo abbaa qabeenyaa naannoo isa biraati, akkasumas dhaamee eegala.

Sagantichi to'annaa baafataa, Telegram fi ejensii alaatiif hojiirra turuu qaba. Qindaa'inni tokkoon tokkoo piroofaayilii dhuunfaa, haala hojjetamaa, mallattoo fi poortii sarvarii mataasaa qaba. Piroofaayilii tokko yeroo tokkotti qindaa'inoota walaba gidduutti irra deebitee hin fayyadamin. Taateewwan baafataa fi deebiiwwan ajajaa qindaa'ina filatameef kan daangeffamaniidha; UI jijjiiruun faayiloota hin jijjiiru ykn seensa dhalataa hin waraabu.

Qajeelfamoota walqabatan: [HTTP fi to'annaa qindaa'inaa](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes fi ejensota alaa biroo

API to'annaa sagantichaa isa mirkanaa'e ykn riqicha stdio MCP kan waliin jiru fayyadami. Sarvaricha naannootti dandeessisi, dubbisuu ykn hojjechuu filadhu, akkasumas maamila kilippii hunda URL fi mallattoo (token) qindaa'ina sanaatiin qindeessi. Riqicha MCP of danda'ee hojjetu deemsisuuf Node.js 22 ykn haaraa ta'etu barbaachisa; sagantaan Electron maamila ejensii keetii hin fe'u. URL baafataa qabxii dhumaa HTTP MCP dhangala'aa miti: akka ZIAFORGE_URL ta'ee riqicha stdio sanaaf dhiheessi.

Riqichi kun ziaforge_status, ziaforge_commands, ziaforge_command fi ziaforge_screenshot ifa godha. Haala fi kaataaloogii ajaja kallattii irraa eegali, sana booda hojjetamaa filatameef system.context dubbisi. Ajajawwan gosa qaban akkuma UI naannoo sanaa fooyya'iinsa, karra, galmee hojjetamaa fi qorannoo qulqulleessuu walfakkaatu hordofu.

Kaataaloogiin ajaja kallattii gargaarsa Ingiliffaa isa bu'uuraa kan ta'e documentation.guide, daandii madda isaa fi sourceSha256 of keessatti qabata. Dizaayinarri keessoo sagantichaa meeshaalee isaa irraan ragaa walfakkaataa argata. Kunis ejensonni yaadannoo duraanii irratti osoo hin hundaa'in qabiyyee guutuu oomishichaa akka argatan taasisa; barreeffamni gargaarsaa eeyyama yoomiyyuu hin kennu ykn murtoo namaa ammaa bakka hin bu'u.

Ejensonni yaad-hiddama namaa gabaabaa irraa ka'uun ulaagaalee, murtoowwan teeknikaa fi karoorsuu irratti mari'achuu qabu. Karra namaa ifa ta'e, moodelota filataman, imaammata harkaatiin/Auto fi gamaaggama barbaachisu eeguu qabu. Eeyyama uumuu, ajajawwan hin mirkanoofne ID haaraan deebisanii taphachiisuu, ykn fedhii abbaa qabeenyaatiin ala jijjiiramoota Git maxxansuu hin qaban.

Fe'iinsota baay'eef sarvaroota MCP maqaa qaban hedduu qindeessi. Qindaa'ina jijjiiruun murtoo daandii jijjiiruu qofa malee qindoomina (synchronization) miti. Fakkeenyonni qindaa'ina OpenClaw fi Hermes AGENT_CONTROL.md keessatti argamu; qindaa'inni fi walsimannaan maamila irratti hundaa'u gosa maamila fe'ameef qoratamuu qaba.

Kuusaan yeroo requestId isa alaa gaaffiiwwan daangeffaman yeroo sagantaan hojjetutti qofa irra deebii ittisa. Hojiiwwan yeroo dheeraa eenyummaa mataa isaanii fayyadamu: uumama hojjetamaatiif createRequestId, murtoowwan yaa'a hojiitiif commandId, ergaawwaniif clientMessageId fi jijjiiramoota Git tiif operationId. Mirkaneessa hin beekamne booda eenyummaa fi ba'aa duraa eegi; hojii haaraa itti yaaltee kennuun dura haala kuufame dubbisi.

Qajeelfamoota walqabatan: [Qajeelfama maamila MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI naannoo fi daangaawwan of-hojjechiisaa

Raabsaan ziaf sagantaa hojjetamaa jiruu fi yaa'a hojii kuufame isa tokkicha to'ata. Madda irraa, npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, ykn npm run ziaf -- pause --task TASK_ID fayyadami. Mirkaneessi Jalqabi milkaa'uun hojjetamichi xumuramuusaa hin agarsiisu.

--until-success yaa'a hojii kuufameef Auto itti yaadee dandeessisa, garuu gaaffiiwwan, gamaaggamni, karrarraawwan fudhannaa, daangaawwanii fi qabxiileen to'annaa ammas ni hojjatu. Ctrl+C raabsaa hordofaa jiru keessaa baasa; yaa'a hojii sagantichaa callisee hin dhaabu. Koodiiwwan ba'iinsaa, qabxii dhumaa naannoo fi dhimmoota piroofaayiliif CLI.md ilaali.

Qindaa'inni fuulaa of-hojjetootaa (automations) yeroo ammaa ibsa agarsiisaa fi lakkooftuu dalagaa naannoo qofa kuusa. Qindeessaa deddeebi'aa mirkanaa'e miti, akkasumas marsaan moodela duubaa hojjechuu isaa hin mirkaneessu. Hojiirra oolmaa dhugaatiif to'annoowwan yaa'a hojii kuufaman, ziaf ykn API mirkanaa'e fayyadamuun nagahee isaanii qoradhu. Saanduqa agarsiisaa kana qophii to'annoo malee deemuu wajjin hin walxaxin.

Qajeelfamoota walqabatan: [Ajajawwan raabsaa](../../CLI.md).

<a id="updates"></a>

## Gosa fi haaromsawwan

Waa'ee (About) gosa sirrii hojjetamaa jiru agarsiisa. Haaromsonni uummataa kuusaa gadhiifama GitHub amanamaa fi sarara tasgabbaa'aa ykn dursee mul'atu barbaadu. Qorachuun, buusuun fi fe'uun haalawwan adda addaa qabu; dogoggorri tokko haaromsi fe'ameera jechuu miti.

Fe'iinsi ofumaa gadhiifamoota macOS mallatteeffamaniif. Ijaarsi misoomaa hin mallatteeffamne karaa kana ofumaan hin fe'amu. Harkaatiin bakka buusuuf, saganticha ammaa guutummaatti cufaa meeshaa mirkanaa'e fayyadami.

Qorannoon ofumaa akkuma dandeessifameen, sana booda sa'aatii jaha jahaan adeemsifama.

Tasgabbaa'aan gadhiifamoota dursee agarsiifaman hin dabalatu; dursee agarsiifamni ammoo gadhiifamoota misoomaas ni hayyama. Qorannoon milkaa'e meetaadaataa gadhiifama jiru qofa mirkaneessa. Buusuu fi fe'uun paakeejii sirnaa fi galtee gadhiifamaa qindaa'e barbaadu. Dhiheessiin Linux DEB daandii fe'aa addaati; DEB ofumaan deemsa haaromsa macOS tiin fooyya'a jettee hin yaadin.

Qajeelfamoota walqabatan: [Qophaa'ina gadhiifamaa](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Irra deebisanii kaasuufi deebisanii dhaabuu

macOS irratti, guutummaatti cufuuf Bahi / ⌘Q fayyadami. Foddaa cufuun sagantichi akka hojjetu gochuu danda'a. Saganticha bakka buusuun dura gosa isa duraanii guutummaatti cufaa.

Banuu booda, hojjetamaa sana filadhu. Seenaan fi wixineewwan ni deebi'u. Itti Fufi qabiyyee dhalataa/naannoo deebisa garuu wixinee hin ergu, tarree hin banu ykn dalagaa hin beekamne irra deebisuuf eeyyama hin kennu.

Yoo Deebisanii Dhaabinsi (Recovery) dhufe, JSON harkaatiin hin gulaalin. Gosa sanadaa miidhame qoradhu, faayiloota duraa eegi, akkasumas kuusaa mirkanaa'e filadhu. Tarree duraanii deebisuun wantoota isaa akka hin mirkanoofnetti mallatteessa.

Yeroo dhiheessiin hin beekamnetti, yaa'i hojii hordofamu qabiyyee haaraadhaaf eeyyama ifaa barbaada ta'a. Hojiin duraanii fi yaaliin fashalaa'e ni hafu; diddaa mul'atu fudhachuun milkaa'ina sobaa irra caalaa nageenya qaba.

Faayiloota hojjetamaa fi piroofaayilii sagantaa yeroo kilippileen sagantaa hundi cufamanitti kuusaa qabadhu. Galmee waraabame jechuun deebisanii dhaabuu yaalame jechuu miti. Yoo deebisanii dhaabuun kuusaa mirkanaa'e akka filattu gaafate, faayiloota miidhaman sirriitti qabadhu. Yaa'a hojii ykn tarree duraanii deebisuun herrega hin mirkanoofne ykn dalagaalee Git irra deebi'anii taphachiisuuf eeyyama hin kennu.

Qajeelfamoota walqabatan: [Waliigaltee deebisanii dhaabuu](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Rakkoo furuu

CLI hin argamne: teerminaala idilee keessatti fe'ama fi gosa isaa qoradhu, sana booda ZIAForge deebisii jalqabi. Faayiliin dalagamu jiraachuun ati seenteetta jechuu miti. Mala seensaa dhiyeessichuma mataasaa fayyadami.

Moodelli hin argamne ykn hayyamsiisuun fashalaa'e: argannoo haaromsi, ID jiru filadhu, herrega kee fi daangaa kee qoradhu. Gaaffii hin mirkanoofne seenaa isaa qorachuun dura irra hin deebi'in.

Yaa'i hojii dhaabbate: sadarkaa ammaa, gaaffii, nagahee mirkaneessaa ykn galmeewwan CLI bani. Sababa adda ta'e fur: gaaffii deebii hin arganne, ajaja, eeyyama galmee ykn daangaa yaalii. Itti Fufi qorannoo fashalaa'e gara milkaa'inaatti jijjiiruu hin danda'u.

Galmeen dhabame ykn bakka buufame: galmee duraatiif eeyyama deebisi ykn hojjetamaa haaraa uumi. Sagantichi HOME irraa itti fufuu hin qabu. Cwd biraa yoo argite, marsicha dhaabiitii ragaalee qorannoo eegi.

Gabaasaaf, gosa Waa'ee (About), daandii, CLI/moodela, amala eegamuufi amala mul'ate, waraabbii iskiriinii fi kutaa galmee balaa hin qabne dabaladhu. Iccitiiwwan, qabiyyee dhuunfaa fi daandiiwwan maxxanfamuu hin dandeenye balleessi.

Fuulli fagoo hin argamu: abbaan qabeenyaa sarvaricha dandeessisuu mirkaneessi, teessoo fi poortii dhaggeeffatu qoradhu, sana booda mallattoo qindaa'ina sirriitiin seeni. 401 mirkaneessa seensaa agarsiisa; jijjiiramni dhowwame daangaa dubbisuu ykn to'annaa abbaa qabeenyaa qofaa ta'uu danda'a. Mallattoo jijjiiruun maamiltoota baafataa duraanii cufa. Poortii qorannoo DevTools isa addaa akka to'annaa sagantaa fagootti hin saaxilin.

Gulaalaan olkaa'uu dide: wixinee eegi, faayilii ammaa diskiirra jiru qoradhu, walitti bu'iinsa jijjiirama alaa fur. Meetaadaataa sagantichaa deebisanii barreessuun madaallii kana bira hin darbin. Yoo faayiliin guddaan guutummaatti hin banamne ta'e, gulaallii/barbaacha foddaa deeggaramu ykn gulaalaa alaa fayyadami.

Telegram hin argamu: mallattoo boottii, abbaa qabeenyaa lakkoofsaa, haasaa dhuunfaa fi haala naannootiin mirkaneessi. Webhook ykn funaanaan dorgomu walitti qabuu danquu danda'a; ZIAForge webhook ofumaan hin balleessu ykn funaanaa biraa hin dhaalu. Ajajawwan daangaa hin beekamne irratti didaman ykn addaan citan ofumaan deebisanii hin hojjetaman.

Qajeelfamoota walqabatan: [Qorannoo fi qorannoo rakkoo](../../TESTING.md).

<a id="diagnostics"></a>

## Rakkoowwan gabaasuu fi ragaa qorachuu

Ijaarsa hojjetamaa jiru isa sirrii Waa'ee (About) irraa, OS/ijaarsa arkiiteektarii, haala hojjetamaa, dhiyeessaa/moodela filatamee fi tarkaanfilee rakkoo uuman galmeessi. Bu'aa eegamuufi bu'aa mul'ate ibsi. Iddoo dhuunfaa guutuu dhiisuun, waraabbii iskiriinii balaa hin qabnee fi nagahee ajajaa ykn mirkaneessaa qabame dhiheessi.

Galmeewwan CLI, jurnaalonni taatee, barreeffamoonni moodelaa, hordoffiin baafataa fi waraabbiiwwan iskiriinii koodii madda, daandii dhuunfaa ykn mallattoolee saaxiluu danda'u. Qooduun dura qoradhuutii sirreessi. Galmee sirreessaan humna guutuun hojjetu waraabbiin iskiriinii ykn kuusaan maxxanfamuu akka danda'u hin mirkaneessu.

Gumaachitootaaf, qa:doctor eenyummaa naannoo/ijaarsaa dubbisa; qa:inspect seenaa adda baafame faayidaalee dhiyeessaa sobaa waliin bana. Meeshaan yaalii (fixture) daandii sagantichaa qorame moodela qunnamuu malee mirkaneessa. Tilmaamni kallattii, qunnamtiin Telegram, minjaalli Linux dhalataa, mallatteessuu fi qorannoon meeshaalee qindaa'anii ragaalee adda addaati. Ajajawwan irra deebiamanii hojjetamanii fi qulqulleessuuf TESTING.md ilaali.

Qajeelfamoota walqabatan: [Ajajawwan ragaa](../../TESTING.md).

<a id="privacy"></a>

## Daataa naannoo fi daangaawwan

Pirojektoonni, seenaan, karoorri, galmeewwanii fi ragaaleen qorannoo barreeffama dhuunfaa qabaachuu danda'u. Piroofaayiloota, qabannoo qullaa, furtuulee ykn galmeewwan guutuu koodii madda wajjin hin maxxansin.

Linux irratti, API, to'annaa, Telegram fi ragaawwan eenyummaa kuusuuf GNOME Secret Service ykn KWallet banaa barbaada; kuusaa iccitii deeggaramu malee, ZIAForge bakka bu'aa basic_text kan Electron fayyadamuu mannaa iccitiiwwan kana kuusuu ni dida.

Kuusaan naannoo jechuun gaaffiiwwan kompiitara kee irra qofa turu jechuu miti: CLI/API filatame dhiyeessaa isaatti erga. Galmeen hojii fi hordoffiin adeemsaa adda ba'uu OS miti. Eeyyamoota filataman qoradhu.

Gosa ragaawwanii adda baasi: Meeshaaleen yaalii (fixtures) saganticha moodela malee qoru; dhalataan kallattiin CLI/herrega dhugaa fayyadama; qorannoon meeshaalee qindaa'anii bu'aa addaa mirkaneessa. Tokko darbuun warra biraaf wabii hin ta'u.

Daangaan sagantaa, muki hojii fi qorannoon dubbisa qofaa dirqisiisa sirna hojiitiin addadha. Imaammanni gamaaggamaa/gargaaraa Antigravity sirna faayilii dubbisa qofaa taasisuu mannaa jijjiirama ragaa iddoo hojii walitti qabame keessatti argamu adda baasa. To'annaan kompiitara dhalataa sagantaalee abbaa qabeenyaan hayyamaman daangaa meeshaalee sagantichaa idilee ala hojjechiisa; yeroo hin barbaachisnetti cufaa.

Qajeelfamoota walqabatan: [Maddaa fi maxxansa](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Pirojektii madda banaa kana hubachuu fi jijjiiruu

Dursa AGENTS.md fi CONTRIBUTING.md dubbisi, sana booda daangaa madda ammaa baruuf PROJECT_MAP.md dubbisi. Waliigalteewwan gosa qabanii fi barreeffamoonni yaa'a hojii/dhiyeessaa ammaa hojiirra oolan amala sagantichaa murteessu. CONCEPT.md fi kutaaleen teerminaala duraa kan ARCHITECTURE.md fedhii seenaa qabu eegu malee waadaa gadhiifama ammaa wajjin walxaxuu hin qaban.

Maddi gargaarsa Ingiliffaa docs/help/en.json dha. USER_GUIDE.md ykn website/guide.html uumaman harkaatiin hin gulaalin. Kutaa bu'uuraa jijjiiri, waliigaltee miidhame haaromsiitii node scripts/help/generate.cjs deemsisi. Gargaarsi sagantaa keessaa madda kana dubbisa. Iddoo dabalame hojiirra oolmaa dhugaa waliin qoradhu, daangaawwan, eeyyamootaa fi daandiiwwan hin deeggaramne dabalatee.

Afaanota qindaa'ina fuulaa 56 keessaa tokkoon tokkoon isaanii haala gargaarsaa adda ta'e docs/help/locales.json keessatti qabu. Gargaarsi hir'ate ykn hin xumuramne gara Ingiliffaatti deebi'a. Qaamoleen maashiniin guutummaatti hiikaman mallattoon itti godhamee haashii madda Ingiliffaatiin hidhamu, gamaaggama namaatiin mirkanaa'eera osoo hin jedhamin. Hiikkaan namni gamaaggame dabalataan nama gamaaggame galmeessa. Hiikkaan hundi ID kutaa, dalagaalee, adda baastota faayilii/ajajaa fi daangaawwan teeknikaa eeguu, kallattii sirrii fayyadamuu, fi maddi Ingiliffaa yeroo jijjiiramu haaromfamuu qaba.

Gadhiisuun dura, bu'aa moofa'ee uumame, fakkii afaanii sirrii hin taane ykn hidhata waliigaltee naannoo cabe adda baasuuf node scripts/help/generate.cjs --check deemsisi. Qorannoon hiikkaa UI fi qorannoon amala sagantaa adda ta'anii hafu. HELP_MAINTENANCE.md adeemsa haaromsaa gumaachaa fi AI kenna; barreeffamni qajeelfamaa qorannoo hin hojjetamne tokko darbeera jedhee dubbachuu hin qabu.

Qajeelfamoota walqabatan: [Kaartaa pirojektii ammaa](../../PROJECT_MAP.md) · [Kunuunsa barreeffamoota qajeelfamaa](../../HELP_MAINTENANCE.md) · [Qajeelfama gumaachitootaa](../../../CONTRIBUTING.md) · [Qajeelfama ejensii](../../../AGENTS.md).
