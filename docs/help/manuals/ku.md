<!-- Generated from docs/help/en.json; source SHA-256 eaf22fddcc4ae04e49389249e9b06c0e4c060d2a1470f8ecbc39c46cb96868d3. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: ku; served locale: ku; status: machine-translated. -->
# Rêbera bikarhêner a ZIAForge

Ji mexsedê ber bi encamek kontrolkirî. Rêberek pratîkî ji bo kontrola Code, Work û bernameyê.

Îngilîzî çavkaniya resen e. Alîkariya bi wergera makîneyê ji wergerên ji aliyê mirovan ve hatine vekolîn cuda tê nîşankirin. Kontrolên otomatîk rastbûna zimanê zikmakî tesdîq nakin.

> Ev rêber ji çavkaniya heyî ya îngilîzî bi wergera makîneyê hatiye wergerandin. Nirxandina mirovî hîn jî bi xêr hatî ye.

## Beşên rêberê

- [Gavên pêşîn](#start)
- [Pakêta sermaseyê ya rast saz bikin](#install-platforms)
- [Code: pênc rê](#code)
- [Nîqaşa Forge](#forge)
- [Belge û biryar](#decisions)
- [Pêkanîn û vekolîn](#execution)
- [Tîmên nirxandinê yên paralel û mîmarê raporê](#review-teams)
- [Pisporiyên ajanan û rêbaza daxwazê](#specializations)
- [Work: ji pirsê ber bi belgeyê ve](#work)
- [Pêşsazkirin, model û gihîştin](#models)
- [Sohbet, Stop û dorik](#chat)
- [Pel, Git û temamkirin](#files)
- [Girêdanên APIyê](#api)
- [Mîheng, ziman û sifirkirina ewle](#settings)
- [Ji alîkarê Alîkariyê bipirsin](#help-assistant)
- [Alîkar û Telegram](#assistant-control)
- [Bota xwe ya taybet a Telegram bixebitînin](#telegram)
- [Destûra komputera xwemalî ya tenê-xwedî](#native-permissions)
- [Gerok û cawên ji dûr ve](#remote)
- [OpenClaw, Hermes û ajansên din ên derve](#external-agents)
- [CLI a herêmî û sînorên otomasyonê](#local-cli)
- [Version and updates](#updates)
- [Ji nû ve destpêkirin û vegerandin](#restart)
- [Çareserkirina pirsgirêkan](#troubleshooting)
- [Pirsgirêkan ragihînin û delîlan venêrin](#diagnostics)
- [Daneyên herêmî û sînor](#privacy)
- [Vê projeya çavkanî-vekirî fam bikin û biguherînin](#project-contributors)

<a id="start"></a>

## Gavên pêşîn

ZIAForge nîqaş, plansazî, pêkanîn û piştrastkirinê di peywirekê de dihêle. Ji bo projeyek Git Code hilbijêrin, an jî ji bo belge, lêkolîn û encamên din ên di peldankek asayî de Work hilbijêrin.

Di projeyek cuda de bi peywirek piçûk dest pê bikin. Ger hûn CLI a xwemalî hilbijêrin, pêşî wê saz bikin û bi hesabê wê bixwe di termînalekê de têkevinê. Wekî din, girêdanek API mîheng bikin. Abonetiya CLI û API a bi drav rêbazên girêdanê yên cuda ne; ZIAForge we naxe hesabê an krediyan di navbera wan de naguhezîne.

1. Settings vekin û peldanka qada xebatê û ziman kontrol bikin. About nasnameya rastîn a guhertoya heyî nîşan dide.
2. Ji bo Code, depoyek Git di darika teniştê de zêde bikin. Ji bo Work, dema afirandina peywirê peldankek cuda hilbijêrin.
3. Pêşsazkirinek bi CLI, model, hewldana sedemgirtinê û asta gihîştinê tomar bikin. Hûn dikarin bêyî pêşsazkirinek tomarkirî rasterast Custom jî hilbijêrin.
4. Peywirek biafirînin, rêya wê, rolan û pêşveçûna destanî an otomatîk hilbijêrin. Berî Start hilbijartinan kontrol bikin.

> Berhem û kontrola hejmarî (checksum) ya ku ji hêla parêzvan ve hatî peyda kirin bikar bînin. Pêşdîtinek dibe ku neîmzekirî be an kanala nûvekirinê ya weşandî jê kêm be. Piştgiriya sermaseyê û dabînkerê xwemalî divê ji bo OS, mîmarî û berhema rastîn were piştrastkirin; tenê piştgiriya çavkaniyê ne sertîfîkaya weşanê ye.

Rêwerzên têkildar: [Pêşdîtina projeyê](../../../README.md) · [Lihevhatina dabînkeran](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Pakêta sermaseyê ya rast saz bikin

Ji bo pergala xebitandinê û mîmariya CPU ya xwe pakêtekê hilbijêrin: x64 an arm64. Xeta avakirinê dikare formatên macOS DMG/ZIP, Windows NSIS sazkirin/ZIP, û Linux DEB/RPM/AppImage/tar.gz/ZIP hilberîne. Pelek çêkirî an avakirina xaçerêk (cross-build) ne delîl e ku sazkera wê û UI a xwemalî li ser cîhaza we bi ser ketiye; serî li tomara piştrastkirinê ya wê weşanê bidin.

Avakirinên macOS ên ku Electron 44 bikar tînin pêdivî bi macOS 13 an nûtir hene. Li ser Apple Silicon pakêta arm64 û ji bo Intel pakêta x64 bikar bînin. Berî guhertinê sepanek kevn bi tevahî bigirin. Pakêtên pêşdîtinê dibe ku nehatibin îmzekirin û pejirandin (notarized); berhemek pêşveçûnê bi weşanek giştî ya îmzekirî re tevlihev nekin.

Windows pêdivî bi pergalek xebitandinê ya piştgirîkirî ji hêla guhertoya Electron a pêvekirî ve heye û divê Git di PATH de peyda bibe. Mîmariya hevaheng hilbijêrin. Pêşdîtinek bêîmze sertîfîkaya Authenticode nîne. ZIP a gerok divê pelrêça tevahî ya bernameyê û pelên dema xebitandinê biparêze, ne tenê pelê wê yê pêkanînbar.

Linux hewceyê maseyek grafîkî ya hevaheng, pirtûkxaneyên pergalê yên ji hêla Electron ve têne xwestin, û Git e. Ji bo bawernameyên kontrolê yên şîfrekirî, Secret Service a dixebite wekî gnome-libsecret an KWallet peyda bikin; pişta neewle ya basic_text nayê qebûlkirin. Delîlên ceribandina bilez ên bêserî/konteyner her mase an dabeşkirinê tesdîq nakin.

DEB bi apt install ./file.deb saz bikin, an bi rêya rêveberê pakêtan ê dabeşkirina xwe RPM saz bikin. AppImage hewceyê destûra pêkanînê û piştgiriya FUSE ya guncav e; --appimage-extract-and-run li cihê ku tê piştgirîkirin alternatîfek e. Pakêtên tar.gz û ZIP bi hemû pelên wan ên dema xebitandinê derxînin. Dema guhertina pakêtekê daneyên bikarhêner û pelên bernameyê ji hev cuda bihêlin.

Ji bo avakirina ji çavkaniyê, Node 24, Git û npm ci bikar bînin, tevî sazkera asayî ya Electron. Avakirinên xwemalî hewceyê amûrên platformê ne: amûrên rêzika fermanê ya Xcode li ser macOS; MSVC C++, Windows SDK û Python li ser Windows; berhevker, make, Python, pkg-config û amûrên pakêtê yên pêwîst li ser Linux. Ji bo fermanên rastîn û sînorên heyî yên platformê PLATFORM_BUILDS.md bişopînin.

Guhertoyên weşanê bi awayekî navendî têne veqetandin û encam nayên guhertin. Avakirina piştrastkirinê ya CI sazkerek weşandî nîne. Arşîvên çavkaniyê çavkanî, lockfile, belge û skrîptan dihewînin; pêbawerî, bawername, profîlên bikarhêner û lêkolînên taybet nayên girtin. Qet pejirandina xwemalî ya ARM an Windows ji avakirinek serkeftî ya x64 dernexînin.

Rêwerzên têkildar: [Pakêtên platformê, pêdiviyên pêşîn û sînorên piştrastkirinê](../../PLATFORM_BUILDS.md) · [Nasnameya avakirinê û kontrolên weşanê](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: pênc rê

Auto çarçoveyê dinirxîne: pirsek hêsan dibe ku bi bersivekê biqede, lê peywirek mezintir hewceyê amadekariyê ye. Fix a bug li sedemekê dikole û sererastkirinekê amade dike. Spec first bi çareseriya teknîkî dest pê dike; Requirements first bi daxwaz û pîvanên pejirandinê dest pê dike.

Piralî-model ji bo keşif, sêwirandin, pêkanîn û vekolînê çarçoveyên cuda bikar tîne. Navê rêyê pêdivî bi dabînkerên cuda nake: her rolek pêşsazkirî an mîhengkirina Custom a ku hûn hildibijêrin bikar tîne.

Worktree guhertinên Git ên peywirekê veqetandî dike. Branch di checkout a hilbijartî de dixebite. Berî destpêkirinê proje, şax û modelê kontrol bikin; danasîna peywirê ji sohbatek asayî re jî nayê şandin.

Ji bo ramanek bi vebijarkên hilber an teknîkî yên nezelal, Requirements first bikar bînin û bingeha wê di nîqaşê de ava bikin. Auto daxwazê polen dike; ew ne fermanek e ku her hevoka kurt yekser were bicîhanîn. Save draft daxwazê bêyî têkiliya bi modelekê re diparêze; Start herikîna birêvebirî carekê tomar dike û dide destpêkirin. Yek heta çar nusxeyên peywirê xwedî nasnameyên çêkirinê û mîhengên rolê yên serbixwe ne.

Rêwerzên têkildar: [Peymana herikîna xebatê ya Code](../../WORKFLOWS.md) · [Profîlên daxwazê yên Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Nîqaşa Forge

Start nîqaşa navendî vedike. Bi awayekî xwezayî bersiv bidin, pirsên berevajî bipirsin, sînoran zêde bikin û li ser vebijarkên teknîkî nîqaş bikin. Axaftin û pirs bi peywirê re dimînin.

Şandina metnê belgeyekê napejirîne an planek pêkanînê ya nû erê nake. Zelalkirinek di dema pêkanînê de pêşî gera birêvebirî radiwestîne û çarçoveya bandorbûyî ji nû ve vedikole. Bersivek ji pirsekê re di nav gavek berê pejirandî de dikare wê gavê bidomîne.

Ji bo ku hûn bi zanebûn vegerin ser bingehê, Requirements, Specification an Planning hilbijêrin. Guhertoyek nû hewceyê pejirandina nû ya biryarên girêdayî ye. Gavên temamkirî û delîlên wan dimînin; qonaxên neqediyayî yên ku cîhê wan hatiye guhertin di dîrokê de dimînin.

Danişînên qonaxa birêvebirî ji sohbata azad cuda ne. Li şûna ku hûn bi destan daxwazan rasterast ji danişînek xwedan herikîna xebatê re bişînin, nîqaşa Forge bikar bînin.

Rêwerzên têkildar: [Peymana nîqaşê ya Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Belge û biryar

Belgeyek vekin, guhertoya wê kontrol bikin û dema ku hewce be sererastkirinan bikin. Şandina sererastkirinan bi rêya nîqaşê guhertoyek nû çêdike; rapor û encamên piştrastkirî paşverû nayên ji nû ve nivîsandin.

Berî pejirandina planek pêşniyarkirî, rêz, talîmat, pîvanên pejirandinê û fermanên piştrastkirinê biguherînin. Fermanên berbiçav ên ku hûn jê fam dikin erê bikin: ew di peldanka peywirê de dixebitin. Piralî-model pêngavek pêkanîna hemû-peywirê pêşniyar dike, digel hûrguliyên di belge û talîmatên wê de.

Approve biryarek serbixwe û bi zanebûn e. Auto pirsan an pejirandina pêdiviyan, taybetmendiyan û planan derbas nake. Belgeyek ku ji derve ve hatiye guhertin nikare erêkirinek kevn ji nû ve bikar bîne.

Pelên amadekariyê wekî berhem xuya dibin. Guhertoya wan, qonaxa hilberandinê û hash wan bi encamekê ve girêdidin. Belgeyên Code li derveyî worktree têne girtin û bixweber nakevin nav komîtekê.

Berî pejirandinê hem belgeyê û hem jî biryara nîşandayî kontrol bikin. Pejirandin ID a dergehê heyî, guhertoya planê û hashên belgeyên parastî bi hev ve girêdide. Dema ku çarçove an delîl xelet bin guhertinan bixwazin. Ger biryarek kevnar bûbe, berî ku hilbijartinek nû bikin rewşa tomarkirî ji nû ve bar bikin; pelek guhertî di bin guhertoyek berê de nayê pejirandin.

Rêwerzên têkildar: [Dergehên herikîna xebatê û guhertoyên belgeyan](../../WORKFLOWS.md).

<a id="execution"></a>

## Pêkanîn û vekolîn

To-do gavên rastîn, hewildana heyî, encamên piştrastkirin û nirxandinê nîşan dide. Ajanek ku dibêje “done” gavekê temam nake: divê delîlên pêwîst ên planê hebin.

Moda Manual di navbera gavên guncav de disekine. Auto gavên piştrastkirî pêşve dibe û destûrê dide ceribandinên bisînor. Stop after her dem xalek kontrolê diafirîne. Pause xebata çalak a herikîna xebatê radiwestîne; girtina panelekê wê ranowestîne.

Nirxênerek serbixwe çarçoveyek cuda bi pel û encamên piştrastkirinê bikar tîne. Divê her dîtina astengker a pêwîst were çareserkirin; gelek nirxêner bi dengdanê xeletiyek astengker ji holê ranakin.

Di Piralî-model de, sererastkirina dîtinan pêdivî bi biryarek eşkere heye. Sererastkirinek bi bêdengî vekolînek din nade destpêkirin: Review again dewrek nû vedike. Şîroveyên nirxandinê dikarin daxwaza ji nû ve nirxandina koordînator bikin bêyî ku pêkanîn were dubarekirin.

Gavên temamkirî bi bêdengî nayên sererastkirin. Bi TDD re, divê Red bi rastî ji ber sedema çaverêkirî têk biçe, paşê divê Green derbas bibe. Hewldanên sînorkirî pêşî li ceribandinên bêdawî digirin.

Nirxênerên serbixwe yên CLI/API di Settings → Review teams de tomar bikin, paşê tîmê di Code an Work de hilbijêrin. Nirxêner bi hevre dimeşin, li dû wan mîmarê raporê yê tîmê tê. Hûn dikarin bêyî tîmek tomarkirî jî nirxênerên serbixwe mîheng bikin. Mîmarê raporê tenê raporên bênav ên sazkirî werdigire, bêyî pelên projeyê an amûran; ev tecrîd niha hewceyê Claude Code an API ye.

Her gavek pêkanînê hewceyê kontrola pêkanînbar, nirxandina serbixwe ya pêwîst, an herduyan e. Qonaxên amadekariyê li şûna wê encamên pejirandî û wergirtinên berheman diparêzin; ev îdia nakin ku ceribandinên pêkanînê meşiyane. Fermana tenê dema ku rewşa derketinê ya rastîn û paqijkirina pêvajoya xwedan were pejirandin biser dikeve. Divê kontrolek Red ji bo TDD berî pêkanîn û piştrastkirina Green bi awayekî asayî têk biçe; pelek pêkanînbar a wenda an dema derbasbûyî ne encamek Red a derbasdar e.

Veqetênerên şebekeyê yên standard piştî sê ceribandinên neserkeftî li ser gavekê an jî bi giştî piştî pêncî ceribandinan radiwestin. Qutbûn ceribandinekê dixwe lê bixwe wekî ceribandinek neserkeftî nayê hejmartin. Sînor û delîlên temamkirî piştî destpêkirina nû jî dimînin; Retry wan ji nû ve saz nake. Berî ku destûrê bidin ceribandinek din, têkçûna tomarkirî bixwînin.

Rêwerzên têkildar: [Piştrastkirin û vekolîn](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Tîmên nirxandinê yên paralel û mîmarê raporê

Settings → Review teams vekin û tîmek tomar bikin. Nirxênerên serbixwe bi CLI an API, model, hewldana sedemgirtinê û pisporiya wan bixwe zêde bikin, paşê mîmarek raporê hilbijêrin. Tîmê di mîhengên nirxandinê yên peywirê de hilbijêrin. Pêşsazkirina bicîhker jî dikare ji hêla nirxênerek ve were bikar anîn, û Custom peyda dimîne; rolên serbixwe hîn jî xwedî çarçoveyên cuda ne.

Nirxêner li ser heman delîlên peywirê bi paralelî dixebitin. Her raporek pêwîst, çewtî û biryar tê parastin. Mîmar raporên bênav ên jimartî bêyî navên nirxêneran, nasnameyên model an dabînkeran, naveroka peywirê ya orîjînal, gihîştina depoyê an amûran werdigire. Ew raporan berhev dike û biryarek pêkhatî ya yekane vedigerîne; ew nirxandinek nû ya çavkaniyê pêk naîne.

Dîtinek astengker an redkirina nirxênerek pêwîst bi dengdana piranî an tercîha mîmar nayê betalkirin. Raporên wenda an xirabûyî rê li ber erêkirinê digirin. Berî pejirandin an destûrdana sererastkirinan, dîtinên kesane û biryara giştî kontrol bikin. Tîmek tomarkirî ji bo meşandinê tête zelalkirin û cemidandin; guhertina pêşsazkirina wê delîlên temamkirî ji nû ve nanivîse.

Mîmarê tenê-rapor niha mîhengên bêamûr ên piştgirîkirî yên Claude an API bikar tîne. Codex û Antigravity wekî nirxêner peyda dimînin lê ji bo vê rola mîmar a veqetandî têne redkirin heya ku peymanek bêamûr a pejirandî hebe. Daxwazek ku tenê dibêje "amûr tune ne" bi serê xwe têrê nake.

> Xeta sêwirandin/nirxandinê ya Piralî-model a Code û tîmek nirxandinê ya paralel a tomarkirî kontrolên cuda ne. Rêbaza nirxandinê ya xwerû ya hilbijartî biparêzin; nefikirin ku yek rê her taybetmendiya nirxandinê çalak dike.

Rêwerzên têkildar: [Mîhengkirina tîmê ya cureyî](../../../shared/review-team.ts) · [Komkirina nirxandinê](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Pisporiyên ajanan û rêbaza daxwazê

Model motora pêkanînê ye; pisporî profîlek talîmatê ye. Ji bo pisporiyek zêde nekirî None, ji bo rêbera standard Standard, ji bo rêbernameyek çêkirî ya peywendîdar Auto, an ji bo rêberên hilbijartî û talîmatên xwe yên bisînor Manual hilbijêrin. Pêşsazkirin dikarin hilbijartinê biparêzin.

Kataloga orîjînal kodkirina giştî, mîmarî, ewlehî, pêbawerî, performans, ceribandin û bikêrhatina navrûyê digire nav xwe. Auto metna peywirê/gavê ya berdest bikar tîne da ku rêberek hilbijêre; ew bi dizî modelek din bang nake an pisporiyê piştrast nake. Pêşniyarên plansaziyê berî pejirandina plana pêkanînê dikarin werin kontrolkirin û guhertin.

Pisporiyên nirxandinê dibin alîkar ku bal were kişandin lê qet şûna delîlên serbixwe, sînorên gihîştinê an biryara pêkhatî nagirin. Talîmatên xwerû wekî beşek ji çarçoveya peywirê bihesibînin: wan ji bo derbaskirina pejirandina belgeyê, rêbaza amûrê, erêkirinê an têkçûnên nirxêner bikar neynin.

Rêwerzên têkildar: [Kataloga daxwazên orîjînal](../../../shared/specializations.ts).

<a id="work"></a>

## Work: ji pirsê ber bi belgeyê ve

Work pêdivî bi Git nake. Default peldankek peywirê ya cuda diafirîne; Custom bi rêya hilbijêrê xwemalî peldankek heyî hildibijêre. Save draft mîhengan bêyî encamderxistinê diparêze; Start qonaxa yekem dide meşandin.

Auto rasterast bersivê dide an planek guncav bi To-doyên rastîn pêşniyar dike. Brainstorm berî ku hûn ramanên bêtir an nirxandinê hilbijêrin ideas.md diafirîne. Research findings.md, çavkanî û sînoran diparêze. Write ji mebestê û, gava ku bikêr be, ji outline.md ber bi belgeyek danasînê an draft.md ve diçe; guhertin guhertoyên berê diparêzin.

Ketinên pelan bi rêya hilbijêrê xwemalî hilbijêrin û bi @ wan nîşan bidin. Bername wan wekî ketinên peywirê yên naguherbar kopî dike û berî meşandinê nasnameya wan piştrast dike. Default peldankek peywirê ya xwedan-bername diafirîne; gihîştina peldanka Custom destûrek tomarkirî ya xwedan e. Pêşnivîsek tomarkirî ya nedestpêkirî dikare peldanka xwe biguherîne.

Bi mîhengên bicîhker ên serbixwe 1–4 nusxeyan biafirînin. Peywirên ku peldankên li ser hev bikar tînin nikarin di heman demê de binivîsin. Ev hevrêzî li ser operasyonên ZIAForge derbas dibe, ne li ser bernameyên derveyî yên serbixwe.

Deep Brainstorm bi standardî sê xebatkarên serbixwe bikar tîne û heta heştan piştgirî dike. Rêz û veavakirinên wan hilbijêrin, tevî ji nû ve bikaranîna pêşsazkirinek di çarçoveyên cuda de. Pirsên xebatkaran eslê xwe diparêzin; raporên xirabûyî yek ceribandina çêkirina formatê werdigirin. Têkçûna qismî li şûna ku wekî serkeftinek yekdeng broke were pêşkêşkirin xuya dimîne.

Deep raporên xebatkaran ên tomarkirî di nav brainstorm_report.md de dike yek û her dem biryarek bikarhêner dixwaze. Şopandinek piçûk bi rêya koordînator raporê sererast dike; guhertinek mezin xulek din a xebatkarên cemidandî dide destpêkirin. Berhem guhertoyên xwe diparêzin.

Rolên zelalkirî di dema afirandina peywirê an tomarkirina eşkere ya pêşnivîsê de têne cemidandin. Piştî banga yekem, tenê pêşveçûna otomatîk/destanî dikare were guhertin; ji bo mîhengên rol an modelê yên cuda peywirek nû bikar bînin. Guhertina pêşsazkirinek gerdûnî qonaxên paşê bi bêdengî naguherîne.

Moda Manual di navbera qonaxên guncav de disekine, tevî çarçoveyek berfireh a Write. Auto dikare di wê çarçoveyê de berdewam bike. Pirs, planên pêkanînbar ên pêşniyarkirî, rêça Brainstorm û nirxandina rapora Deep di Auto de jî biryarên eşkere dimînin. Tenê jêgirtinek îspat nake ku gerok xebitiye, û tenê pelek bînarî ya tomarkirî xuyangkirina wê îspat nake.

Rêwerzên têkildar: [Mod û biryarên Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Pêşsazkirin, model û gihîştin

Pêşsazkirinek CLI/API, model, hewldana sedemgirtinê û destûran tomar dike. Binê sohbetê beşên pêşsazkirin, CLI, model û vebijarkan dihewîne. Custom bêyî pêşsazkirinek dixebite; Create preset hilbijartina heyî tomar dike.

Katalog ji CLI an API a sazkirî ya hilbijartî tê li cihê ku tê piştgirîkirin. Refresh lîsteyê bêyî guhertina hilbijartinê nû dike. Ger keşifkirin peyda nebe, ID a modelek eşkere binivîse; divê dabînker hîn jî wê piştgirî bike. Asta sedemgirtinê bi model û CLI ve girêdayî ye. Standarda dabînker ji nîşana none ya eşkere cuda ye.

Guhertinan tenê piştî pejirandina backendê bisepînin. Guhertin di dema gera çalak an dorika nevala de sînorkirî ye. Pêşnivîs û dîroka xuya dimînin, lê guhertina dabînkeran rewşa wan a navxweyî ya taybet naguhezîne.

Di Forge de, etîketa rolê girîng e: amadekariyê dikare Planner a cuda bikar bîne. Binî rola nîşandayî diguherîne; nirxêner û alîkar di mîhengên herikîna xebatê de têne hilbijartin. Rêbaza ji bo pêkanîna ku berê hatiye piştrastkirin dibe ku were kilîtkirin.

Destûr di navbera dabînkeran de ji hev cuda ne. Read only û Workspace write li cihê ku adapter wan piştgirî dike peyda dibin. Antigravity mîhengên xwemalî yên CLI an gihîştina tevahî ya bi awayekî eşkere hilbijartî bikar tîne. Gihîştina tevahî ne qada parastî (sandbox) ye.

Pisporî rêberiya daxwazê zêde dike, ne modelek an destûrek din. Pêşsazkirin û rol piştgiriyê didin None, Standard, Auto û Manual. Auto profîlan ji metna gavê bêyî bangek modelê ya zêde hildibijêre; Manual heta çar pisporiyan û talîmatên xwerû qebûl dike. Erkên ku ji hêla Planner ve hatine pêşniyarkirin berî pejirandina planê dikarin werin guheztin.

ID a modelek an hewldanek ku bi destan hatiye nivîsandin wekî hilbijartina we dimîne, lê dabînker dibe ku wê red bike. Guhertina pêşsazkirinek gerdûnî sohbatek xebitî an planek pejirandî paşverû naguherîne. Ji bo guhertina sohbetek bêkar bi zanebûn, kontrolên mîhengên wê bixwe bikar bînin û li benda pejirandinê bin. Vebijarkek neçalak divê wekî sînorek kabiliyet an heyama jiyanê were xwendin, ne ku bi sererastkirina JSON a tomarkirî were derbaskirin.

Rêwerzên têkildar: [Kabiliyetên dabînkeran](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Sohbet, Stop û dorik

Hilpekînên vekirî, Dawî û pêşnivîs aîdî peywirekê ne. Girtina hilpekînekê wê ji Vekin radike lê di Dawî de dihêle û pêvajoya dabînkerê wê an herikîna xebatê ya birêvebirî ranowestîne. Ji pêşeka dîrokê li dîrokê bigerin, sohbetek ji nû ve vekin an hemû hilpekînên zêde bigirin.

Stop gera heyî qut dike. Berî Send a din li bendê bin ku rawestandin biqede: erêkirina qutkirinê ne qedandina pêvajoyê ye. Di vê navberê de hûn dikarin pêşnivîsa din binivîsin.

Di sohbata asayî de, Queue daxwazek paşerojê ji pêşnivîsa heyî cuda tomar dike. Pause queue şandina bêtir radiwestîne. Stop û Quit dorikê dixin nav rawestanê. Piştî destpêkirina nû, pêşî Resume bikin, paşê bi awayekî eşkere Continue queue bikar bînin.

Uncertain tê wê wateyê ku radestkirin nayê zanîn. Peyamek wiha bixweber ji nû ve nayê şandin: li dîrokê binerin, ger guncav be metnê kopî bikin û hêmana di dorikê de red bikin. Şandina wê ya ji nû ve daxwazek nû ya bi zanebûn e.

Sohbetên qonaxa birêvebirî herikîna xebata xwe bikar tînin, ne dorika asayî. Follow stage qonaxa heyî nîşan dide; bi destan hilbijartina hilpekînek din şopandinê radiwestîne. Tomarên CLI tespîtan ji bersivê cuda nîşan didin.

Bersivên Markdown sernivîs, lîste, tablo, girêdan û kodên dorpêçkirî nîşan didin. Kartên amûran û tespîtên CLI ji bersivê cuda dimînin. Raman û pîvanên tokenan ên ku ji hêla modelê ve têne ragihandin tenê gava ku dabînker bi rastî wan nîşan bide xuya dibin; ji anîmasyonê ramanên taybet an karanînê dernexînin.

Piştî şandineke nediyar an erêkirina dorikê, dîrokê kontrol bikin û tenê heman daxwaza tomarkirî li cihê ku tê pêşkêşkirin ji nû ve biceribînin. Wergirtina dorikê tê wê wateyê ku depoyê hêman qebûl kiriye, ne ku derxistina encamê qediyaye. Hêmanek nediyar a di dorikê de tenê wekî redkirinek eşkere derxînin; ew nikare daxwazek ku berê hatiye radestkirin paşve bikişîne.

Rêwerzên têkildar: [Dorika peyaman a mayînde](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Pel, Git û temamkirin

Files peldanka peywirê nîşan dide. Encamên bi pêdiviyan re bidin ber hev, belgeyan vekin û diffan kontrol bikin. Parastina pelek bînarî xuyangkirina rast di sepana wê ya armanc de îspat nake.

Git rewş, guhertin û operasyonan bi encamên tomarkirî peyda dike. Commit, merge û push bi standardî destanî ne; operasyonên otomatîk ji bo planek bi tevahî piştrastkirî vebijarkên cuda ne.

Di navbera piştrastkirin û weşandinê de pelên xebatê neguherînin: pejirandin bi baytên teqez ve girêdayî ye. Nakokî, pushên têkçûyî û encamên nenas ên operasyonan pêşveçûnê asteng dikin heya ku biryarek eşkere were dayîn. Auto bi bêdengî destûra weşandinê nade.

Work ti şaxên Git çênake û ti qedandina Git nîne. Belgeyên pêwîst ji peldanka hilbijartî, tevî guherto û çavkaniyan, biparêzin.

Edîtorê pelan rêzimana li gorî dirêjkirinê, lêgerîn û guhertin, dîroka vegerandinê, pêçana rêzikan û pêşnivîsên ji bo her hilpekînê peyda dike. Tomarkirin şîfrekirina UTF-8/UTF-16 a piştgirîkirî diparêze û nakokiyên guhertina derveyî red dike. Şîfrekirinên din û naveroka bînarî hewceyê edîtorek derveyî ne. Pêşnivîsên nehatine tomarkirin rê li ber Quit a bernameyê digirin heya ku xwedan wan tomar bike an bavêje.

Rêzimana tevahî heta 8 MiB çalak e. Pelên metnê yên mezintir di pencereyên 256 KiB de vedibin; 8–64 MiB dikare bi awayekî eşkere bi tevahî bêyî rêziman were barkirin. Ji 64 MiB jor ve sererastkirina pencereyê û lêgerîna hevahengiya din a bisînor bikar bînin. Ev modek pelê mezin a sînorkirî ye, ne hevsengiya Sublime Text ji bo belgeyên bêsînor mezin.

Peldanka vekirî li şûna ku bi bêdengî tenê depoya orîjînal veke, peywira heyî an çarçoveya şax/worktree bikar tîne. Rêzikek pelê dikare pelrêça sereke ya wî pelî nîşan bide. Rê li hember destûrên peywirê yên tomarkirî ji hêla backend ve têne pejirandin. Pelên bînarî wekî metna sade nayên guherandin; temaşekerê wan ê armanc bikar bînin û baytên orîjînal biparêzin.

Rakirina worktree çalakiyek parastî ya cuda ye. Berî rakirina wê, danişînên sazkirî yên girêdayî û termînalan bi dawî bikin, tevî danişînên ku bêkar in. Encama tomarkirî ya Git û rewşa başbûnê kontrol bikin; jêbirina tomara peywirê ne şûna parastina ewle ya karê nehatî komîtkirin e.

Rêwerzên têkildar: [Peymana edîtorê ya cureyî](../../../shared/editor.ts) · [Siyasetên Git](../../WORKFLOWS.md).

<a id="api"></a>

## Girêdanên APIyê

Beşa Girêdanan xaleke dawî ya APIyê ya bi awayekî eşkere hatiye hilbijartin zêde dike. Navekî, bingeha URLyê, model û heke pêwîst be mifteyekê binivîse. Ji bo entegrasyonên lihevhatî yên heyî Chat Completions hilbijêre, ji bo dewreyên fonksiyonan û medyaya dabînker Responses, an jî ji bo wî girêderî ligel Claude Connector v1ê Anthropic Messages hilbijêre. Girêdanên heyî heta ku tu wan bi awayekî eşkere neguherînî Chat Completions diparêzin. Ji bo girêdaneke heyî, Veavakirina Responses ji bo heman xala dawî pêşnûmeyekê vedike; profîlê binirxîne û li ser Tomarkirina girêdanê bitikîne. Girêderê Codexê, Grok Connector v1 an jî Claude Connector v1 tenê ji bo dergehekî ku piştevaniya pêveka hilbijartî dike hilbijêre. Dema ku xala dawî neyê guhertin û qada mifteyê vala bimîne, mifteya tomarkirî tê parastin.

Ji bilî HTTPya loopbackê, HTTPS pêwîst e. Xaleke dawî ya xwerû bêyî bawername, lêpirsîn an perçeyan bi kar bîne. Ji nû ve arastekirin tên redkirin. Mifte şîfrekirina piştgirîkirî ya OSê bi kar tînin û ti carî li UIyê nayên vegerandin. Guhertina xala dawî ji nû ve nivîsandin an paqijkirina mifteya wê ferz dike. Vala hiştina qada mifteyê mifteya tomarkirî diparêze.

Amûrên pelên qada xebatê di peldanka erkê ya herêmî ya ji aliyê backendê ve hatiye diyarkirin de, bi rêyên rêjeyî û kontrolên li dijî derbasbûn û lînkan dixebitin. Her nivîsandineke pelê pêdivî bi erêkirina eşkere û guhertoyeke çaverêkirî ya neguhertî heye. Danişînên tenê-xwendinê tenê amûrên xwendinê pêşkêş dikin. Di Responses û moda gazîker a Claudeê de, Destûr bide fermanên herêmî bi awayekî cuda bangên bernameyên xebitandinê/argumanan ên erêkirî li ser macOS û Linuxê çalak dike. Çavdêriya fermanan li ser Windowsê peyda nabe; adapter li wir wî amûrî ranagihîne. Ferman her tim hewceyî erêkirina xwedî ne û qadeke parastî ya pergala xebitandinê (sandbox) nînin.

Profîla girêder a Codexê pêveka pêşveçûna amûrê ya Responses a wî dergehî destnîşan dike. Amûrên resen ên dabînker li ser pêşkêşker dixebitin, cuda ji amûrên gazîker ên li ser komputera te. Destûrên tenê-xwendinê yên herêmî pêşkêşker sînordar nakin. Girêderek nikare ji bo mîmarekî tenê-rapor ê ku hewce dike hemû amûr bêbandor bin were hilbijartin: veqetandina piştgirînekirî li şûna ku bêdeng rê bide amûrên resen, bi ser nakeve. Xaleke dawî ya ku dikare polîtîkaya pêwîst bisepîne hilbijêre.

Encamên hilberandî yên PNG, JPEG û WebP wekî kartên wêneyan ên cuda, bi Wêneyê tomar bike re, li derveyî derketina amûrê ya qatkirî xuya dibin. Wêne tên piştrastkirin û di embarkirina sepana taybet de tên parastin; URLyên ji hêla modelê ve hatine dabînkirin û wêneyên Markdown bixweber nayên anîn. Vekirina dîroka tomarkirî, ji nû ve ceribandina xwendina wêneyekî û tomarkirina wêneyekî kaşkirî daxwaza hilberîneke nû nakin. Encam bi 32 MiB û 32 mîlyon pîkselî ji bo her wêneyekî ve, bi kaşeke medyaya taybet a hevpar a 512 MiB ve sînorkirî ne. Heke kaşa taybet tije bibe, berî ku wê bi awayekî destî paqij bikî, wêneyên pêwîst biparêze. Li ser wêneyekî sohbetê bitikîne da ku nîşandêrê wêneyan vekî. Nêzîk an dûr bike, Mezinahiya rastîn (100%) an Li gorî pencereyê saz bike hilbijêre, û bikişîne da ku hûrgiliyekê kontrol bikî. Bi Escape an Nîşandêrê wêneyan bigire vegere ser sohbetê. Dîtin û mezin/biçûkkirin wêneyê taybet ê barkirî ji nû ve bi kar tînin; ew daxwaza hilberîneke nû nakin.

Danûstandinên Responses nasnameya bersivê ya pejirandî û nasnameyên bangkirina fonksiyonê yên tam diparêzin. Têketinên qutbûyî bixweber ji nû ve nayên şandin. Guherandinek an fermaneke herêmî ya ne diyar piştî destpêkirinê ji nû ve nayê xebitandin; dîrokê biparêze û piştî lêkolînê bi awayekî eşkere çarçoveyeke nû biafirîne. Guhertinên di veguhestin an xala dawî ya tomarkirî de pêdivî bi vesazkirina eşkere hene. Rewşa dabînker, betalkirin û têkçûnên bidawîbûna demê bêyî ku li pişt paşveketina CLIyê werin veşartin tên ragihandin. Sernivîsa sohbetê protokola ku bi wê xebitandinê ve hatiye girêdan nîşan dide. Piştî tomarkirina guhertinên girêdanê, hilbijêrê CLI / API yê sohbetê veke û li ser Bisepîne bitikîne, hetta heke heman girêdan berê hatibe hilbijartin jî. Ev xebitandineke nû bi veavakirina tomarkirî diafirîne û dîroka sohbetê diparêze. Tomarkirina girêdanekê bi serê xwe sohbetên çalak koç nake. Girêdanên wêneyan ên kevntir ên tenê-nivîs wekî nivîs dimînin; guhertina protokolê encamên berê ji nû ve çê nake an naîne.

Girêdanên APIyê xala xwe ya dawî ya veavakirinê û erêkirina nasnameyê, cuda ji abonetiyên resen ên CLIyê bi kar tînin. Hin dergeh di hindur de abonetiyan bi kar tînin; ZIAForge erêkirina nasnameyê ya resen li nav APIyê kopî nake. Model, polîtîkayên amûran, parametreyên ramanê û fatûrekirin bi xala dawî ve girêdayî ne. Kifşkirin bi serê xwe encamderxistinê piştrast nake. Mifteyan di beşa Girêdanan de biparêze, ti carî naxe nav nivîsa erkê an dîmenên ekranê.

Ji bo Grok Connector v1, girêdaneke Responses a eşkere tomar bike û Girêder kontrol bike bi kar bîne da ku bêyî meşandina encamderxistinê qabiliyetên wê yên ragihandî, model û bikaranînê bixwînî. Astên ramanê yên modelê û bijardeyên pencereya naverokê ji katalogê tên. Sînorê dorvegereke resen ê vebijarkî 1–100 e. Rêjeyên kotayê yên kêm nenas dimînin; dawiya heyama bikaranînê ne dayina abonetiyê an dîroka qedandinê ye. Guhertinên girêdanê berî ku li wir bikevin meriyetê di her sohbeteke heyî de bisepîne.

Pirsên Grokê wekî kartên bi pirs û etîketên vebijarkê yên resen ên tam xuya dibin. Bersivên têne xwestin hilbijêre an bersiveke xwerû binivîse, paşê carekê bişîne. Hevpeyvînên planê dikarin nîqaş an çalakiyên derbaskirinê pêşkêş bikin. Kartên destûra dabînker bijardeyên resen ên tam nîşan didin û bi standardî hilbijartina te hewce dikin. Ev ji erêkirinên pel/fermanê yên herêmî cuda ne. Rawestandin, qedandina demê an ji nû ve destpêkirin kartên kevin neçalak dike; şandineke ne diyar bixweber nayê dubarekirin.

Di beşa Girêdanan de, girêdaneke Grokê dikare Destûrên dabînker ên yekcarî bixweber erê bike çalak bike; ew bixweber girtî ye. Ev ji bo sohbetên nû an jî ji bo sohbeteke heyî piştî ku tu wê bi Bisepîne bi awayekî eşkere ji nû ve veavakî derbas dibe. Tomarkirina girêdanê bi serê xwe sohbeteke ku dixebite naguherîne. Gava çalak be, ZIAForge tenê yek destûra yekcarî ya nezelal û dema wê neqediyayî ya ku ji hêla Grokê ve hatibe pêşkêşkirin bixweber dişîne û berî şandinê wê biryara bixweber tomar dike. Kart erêkirineke bixweber destnîşan dike. Pirs û erêkirinên pel an fermanan ên herêmî dîsa jî hewceyî bersiva te ne. Sohbetên tenê-xwendinê destûrên destî yên dabînker diparêzin. Destûrên berdewam ti carî bixweber nayên hilbijartin; bijardeyên yekcarî yên kêm an ne diyar destî dimînin. Şandinên kevin an ne diyar ti carî bixweber ji nû ve nayên lîstin an ceribandin.

Di sohbeteke Grokê de, bişkoka pêvekê hilbijêrê pergalê ji bo PNG, JPEG û WebP vedike. Di her peyamekê de çar wêne tên destûrkirin, her yek heta 16 MiB û bi giştî 20 MiB, bi her wêneyekê re 32 mîlyon pîksel. Kopiyên pêşnûmeyê yên taybet budceyeke 128 MiB hene û aîdî wê xebitandina sohbetê ne. Ew tenê gava ku tu bişînî tên veguhestin. Şandinên biserneketî an ne diyar nasnameyên pêşnûmeya xwe diparêzin. Peyamên wêneyan nikarin rêza tenê-nivîs bi kar bînin. Berî guhertin an domandina xebitandina wê, pêşnûmeyeke wêneyê ya li bendê rake an jî bi awayekî eşkere bavêje; avêtina pêşnûmeyekê peyameke ku berê hatiye radestkirin betal nake. Peyamên wêneyan ên pejirandî ji bo lêkolîn, mezin/biçûkkirin û tomarkirina paşê kartên wêneyan ên taybet diparêzin.

Amûrên dabînkerê yên Grokê bi bidestxistina webê ya piştgirîkirî, wêne, pirsên înteraktîf û hilberîna vîdyoyê ya bi qabiliyetê ve girêdayî sînorkirî ne. Amûrên projeyê yên herêmî dîsa jî li ser komputerê di peldanka erkê ya ji aliyê backendê ve hatiye hilbijartin de tên xebitandin. Nirxandina tenê-xwendinê hilberîn û sererastkirina wêne/vîdyoyan ya dabînker, pirs, nivîsînên herêmî û fermanan li derve dihêle. Danişînên Alîkariyê yên bê amûr û yên mîmarê tenê-rapor nikarin vê profîla girêder bi kar bînin. Hilberîna dengî, veguhestina deng bo nivîsê û dengê zindî nayên pêşkêşkirin; dibe ku pelekî MP4 şopa xwe ya dengî ya asayî bihewîne. Amûreke kifşkirî bi serê xwe delîla encameke bikêrhatî nîne.

Ji bo vîdyoyê, sohbeteke nivîsandî ya Grokê bi kar bîne, wêneyekî çavkaniyê pêve bike an sohbeta ku ew çêkiriye bidomîne, û livîn û parametreyên tê xwestin bîne ziman. Ji bo hilbijartina wêneyekî kevntir bi awayekî eşkere, Tomarkirina wêneyê bi kar bîne û pelê tomarkirî pêve bike. Dîtin an tomarkirina wêneyê wî ji nû ve çê nake. Formeke parametreya vîdyoyê ya cuda nîne: daxwaz sohbetê û kartên wê yên pirs/destûran ên resen bi kar tîne. Berî dorvegereke nû ya bikarhêner, ZIAForge tenê wan amûrên vîdyoyê çalak dike yên ku girêder wekî berdest, çalak û piştrastkirî radigihîne. Têkçûna kifşkirinê vîdyoyê ji bo wê dorvegerê neberdest dihêle. Guhertinên di qabiliyetên resen de dikarin ligel parastina sohbeta herêmî, bi dîroka te ya xuyayî û wêneyên kaşkirî yên minasib re naverokeke nû ya dabînker bidin destpêkirin; çalakiyên qutbûyî ji nû ve nayên xebitandin. Heke wêneyek negihîje sînorên pêvekê, veguhestin wê kêmasiyê radigihîne; çavkaniya armanckirî bi awayekî eşkere pêve bike.

Girêder image_to_video bi wêneyekî çavkaniyê yê pêwîst, 6 an 10 saniyan û pêşsaziyên 480p/720p pêşkêş dike. Moda wê ya reference_to_video piştevaniya 1–15 saniyan û rêjeyên dîmenê yên 1:1, 16:9, 9:16, 4:3, 3:4, 3:2 an 2:3 dike; dema pêwîst be dibe ku ajans pêşî çavkaniyekê hilberîne. Sazkirinên têne xwestin di sohbetê de bixwaze. ZIAForge xala dawî ya cuda ya /grok/media an hilbijêrê wê yê xweser nîşan nade. Pêşsazî û parametreyên piştgirîkirî qabiliyetên dabînker in, ne garantiya bilindahiya tam a pîkselan, dema freyman an hemû encamên hunerî ne.

Vîdyoyeke temamkirî ya Grokê tenê piştî ku pelê parastî yê MP4 hate daxistin û MIME, mezinahî, SHA-256 û avahiya wê hatin kontrolkirin xuya dibe. Nivîsa ku dibêje vîdyoyek amade ye, paşveketina wêneyekî an girêdaneke embarkirinê ne vîdyoyeke lêdanê ye. Çewtî bêyî xwestina hilberîneke cihgirtî xuyayî dimînin. Kontrolên karta vîdyoyê bi kar bîne da ku lê bidî, rawestînî, lê bigerî an dema hebe deng rast bikî. Lêdan bixweber dest pê nake. Tomarkirina vîdyoyê diyaloga cihê armancê ya pergalê vedike. Dîroka sohbetê ya tomarkirî piştî Derketin/ji nû ve destpêkirina tevahî ya bernameyê MP4ya taybet diparêze; lêdan û tomarkirin baytên herêmî bêyî encamderxistin an daxistineke din a dabînker bi kar tînin. Vîdyo di hundirê kaşa medyaya taybet a hevpar a 512 MiB de bi her yek 128 MiB re sînorkirî ne. Berî paqijkirina destî ya kaşeke tije, medyaya pêwîst tomar bike. Pêdivî ye ku komputer piştevaniya kodeka vîdyoyê bike; pelên piştgirînekirî an xisardîtî çewtiyekê nîşan didin.

Ji bo Claude Connector v1, Anthropic Messages hilbijêre û çavkaniya HTTPS ya girêder bêyî /v1 binivîse. Tomar bike, paşê Girêder kontrol bike bi kar bîne da ku amûrên hatine ragihandin, vebijarkên modelê, rewş û bikaranînê bêyî encamderxistinê bixwînî. Xebitandina gazîker an ya resen a dabînker, hilbijartineke amûra resen a eşkere, moda destûra resen, sînorên dorveger/derketinê û kontrolên ramanê yên piştgirîkirî hilbijêre; şemayeke derketinê ya JSON ya vebijarkî û moda dîroka sar jî berdest in. Vebijarkên standard moda gazîker, destûrên resen ên destî û ti amûrên resen bi kar tînin. Nirxên bikaranînê yên kêm nenas dimînin; ji nû ve destpêkirina bikaranînê ne dîroka dayinê an betalbûna abonetiyê ye. Mifteya APIyê ya girêder ji erêkirina abonetiya wê ya resen cuda dimîne. Berî ku bikevin meriyetê, guhertinên tomarkirî di her sohbeteke heyî de bisepîne.

Amûrên gazîker ên Claudeê di peldanka erkê ya herêmî de bi erêkirinên cuda ji bo nivîsandin û fermanên piştgirîkirî dixebitin. Tenê WebSearch û WebFetch ên bi awayekî eşkere hatine hilbijartin dikarin di moda gazîker de bi awayekî resen bixebitin. Moda resen a dabînker amûrên hilbijartî di qada xebatê ya pêşkêşkerê girêder de dimeşîne û ti amûrên pel an fermanan ên herêmî dabîn nake. Wesifkirina peldanka herêmî ji pêşkêşker re destûra gihîştina wê nade. Danişînên tenê-xwendinê amûrên sererastkirinê an yên xebitandinê yên resen red dikin; di danişînên bê amûr de divê ti amûrên resen neyên hilbijartin. Karta pêşveçûna amûrê ya pêşkêşker ti carî naveroka xwe li ser komputerê naxebitîne. Berdestbûna amûra resen û moda destûra resen sazûmanên cuda ne.

Kartên destûra resen ên Claudeê gava ku bê xwestin biryareke eşkere ya destûrdayîn an redkirinê ferz dikin. Ew nikarin şûna têketina amûrê bigirin an destûra pel/fermanê ya herêmî bidin. Pirs teksta tam a hatiye pêşkêşkirin û rêzikên hilbijartinê nîşan didin; bersivan hilbijêre an bersiveke taybet binivîse, paşê carekê bişîne. Vebijarka destûra bixweber a Grokê ji bo Claudeê derbas nabe. Qedandina demê, Rawestandin, ji nû ve destpêkirin an radestkirina ne diyar kartên kevin neçalak dike. Berdewamî bersiva xwedîderketî û veavakirina pînekirî diparêze; daxwaz, amûr û bersivên qutbûyî ji nû ve nayên lîstin. Moda naverokê ya dîroka sar îthalkirineke biwinda ya eşkere ye, ne vegerandina danişîneke resen e. Rawestandin gava bersiva wê tê zanîn çalakiya xwedîderketî betal dike; ew bandorên temamkirî paşve naxe an xizmetên negirêdayî ranawestîne. Betalkirina ne diyar xuyayî dimîne.

Di sohbeteke Claudeê de, hilbijêrên pêvekê yên pergalê wêneyên PNG, JPEG, GIF û WebP, belgeyên nivîsê yên PDF û UTF-8 qebûl dikin. Afirîner xwedî çar cîhên pêvekê yên hevpar e. Wêne û PDF ji bo her yekê 16 MiB destûr didin; belgeyên nivîsê 1 MiB destûr didin. Wêne rê didin 32 mîlyon pîksel. Pêşnûmeyên wêneyan û pêşnûmeyên belgeyan her yek bi giştî rê didin 20 MiB û xwedî budceyên embarkirina taybet ên cuda yên 128 MiB ne. Daxwaz di heman demê de xwedî sînorekî deşîfrekirî yê hevpar ê 32 MiB ye, ku bargiraniya daxwaza kodkirî dibe ku wê kêm bike. Kopiyên taybet aîdî xebitandina sohbetê ya heyî ne û tenê gava ku tu bişînî tên veguhestin. Şandinên têkçûyî an ne diyar nasnameyên pêşnûmeya xwe diparêzin; peyamên pêvekan nikarin bikevin rêza tenê-nivîs. Berî guhertin an domandina xebitandinê pêvekên li bendê rake an bi awayekî eşkere bavêje. Wêneyên pejirandî ji bo pêşdîtina taybet û tomarkirinê berdest dimînin; belge wekî PDF an HTML nayên bicîkirin.

Amûrên pêşkêşker ên Claudeê dikarin pelên daxistinê çêbikin. Kartekî pelê piştî ku naveroka wê ya parastî hate daxistin û MIME, mezinahiya tam û SHA-256 hatin kontrolkirin xuya dibe. Ew li derveyî derketina amûrê ya qatkirî dimîne û nav, mezinahî, cure û metadataya guhertoya dabînkirî an cihgirtî nîşan dide. Ji bo hilbijartina cihekî di diyaloga pergalê de Tomar bike bi kar bîne. Guhertoyeke nûtir a neguhêrbar guhertoya berê berdest dihêle. Pel di hundirê kaşa berhemên taybet a cuda ya 1 GiB de ji bo her yekê 128 MiB destûr didin; berî paqijkirina destî ya kaşeke tije, pelên pêwîst tomar bike. Dîroka kaşkirî û tomarkirin encamderxistin an daxistineke din naxwazin. Hemû kartên berheman tenê ji bo tomarkirinê ne, di nav de PDF jî; HTML, SVG û formatên nenas wekî daxistinên giştî dimînin û ti carî nayên xebitandin. URLyên ku ji aliyê modelê ve hatine pêşkêşkirin û wêneyên Markdownê bixweber nayên anîn. Pelên ku ji aliyê amûrên pêşkêşker ve hatine çêkirin nayê wateya hilberîna wêne, vîdyo, deng an axaftinê ya resen a Claudeê.

Rêwerzên têkildar: [Girêdanên APIyê](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md) · [Claude Connector v1](../../CLAUDE_CONNECTOR_V1.md).

<a id="settings"></a>

## Mîheng, ziman û sifirkirina ewle

Mîhengên Giştî qada xebatê, zimanê navrûyê û standardan hildibijêrin. Connections nuqteyên dawî yên API birêve dibe. Presets û Review teams mîhengên rolê diparêzin. Remote control bawernameyên herêmî, çarçoveya pêşkêşker û destûrên xwedan birêve dibe; Updates çavkanî/kanala weşanê birêve dibe. About guhertoya rastîn a avakirina dixebite nîşan dide.

Zimanê navrûyê ji zimanê daxwazê (prompt) û rewşa venêrîna belgekirinê cuda ye. Navên berheman, nasnameyên fermanan, pêvekên pelan, nasnameyên modelên dabînker û navên ji aliyê bikarhêner ve hatine çêkirin wekî nasnav dimînin. Dema ku wergereke heyî hebe, Alîkarî li gorî zimanê navrûyê yê hilbijartî tevdigere; wergerên makîneyê tên nîşankirin û îngilîzî wekî referansa bingehîn dimîne.

Tomarkirin veavakirina nîşandankirî bi kar tîne. Ji nû ve sazkirina danegehê an vegerandina kargehê dikare metamagahiya sepanê jê bibe; berî ku bi zanebûn vesazkirinê bi kar bînin, pelan û kopiyeke ceribandî ya hilanînê biparêzin. Ev operasyon çalakiyên xwediyê herêmî ne. Wan wekî rêyeke kin ji bo lêkolîna herikîneke têkçûyî ya xebatê an tomoreke xerabûyî bi kar neynin.

Rêwerzên têkildar: [Rêwerzên herêmîkirinê](../../LOCALIZATION.md) · [Vegerandina daneyan](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Ji alîkarê Alîkariyê bipirsin

Alîkariyê vekin, di panela alîkarê wê de pêşsaziyeke girêdayî ya tomarkirî hilbijêrin û li ser ZIAForge bipirsin. Bersiv rêberê fermî yê îngilîzî yê niha û zimanê rûyê yê hilbijartî bi kar tînin. Bişkokên çavkaniya beşê mijarên rêberê yên peywendîdar vedikin, da ku hûn karibin ravekirinê bi çavkaniyê re bidin ber hev.

Ev alîkar sohbeteke taybet a cihê ya heta 100 tomarên tomarkirî û 3 MiB diparêze. Pirsek heta 12,000 tîpan binivîsin; Şandin dipirse, Rawestandin bersiva çalak betal dike dema ku pirsa we li ber dest dihêle, û Paqijkirin vê sohbeta Alîkariyê radike. Pêşnûmaya we ya neşandî û pêşsaziya hilbijartî di heman danişîna sepanê de li hember girtin an ji nû ve vekirina Alîkariyê dimînin, lê pêşnûma li ser dîskê nayê tomarkirin. Alîkar fermanên sepanê naşîne, herikîna xebatê naguherîne an dergehekê napejirîne. Şîret ne verastkirina zindî ya peywir, hesab an girêdana derve ye.

Danişînên Alîkariyê yên Claude Code û API polîtîkaya bê-amûr a piştgirîkirî bi cih tînin. Danişînên Alîkariyê yên xwemalî yên Codex û Antigravity pêdivî bi destûra komputerê ya xwemalî ya xwediyê herêmî ya heyî hene. Heke ew neçalak be, sepan li şûna hilbijartina dabînkerekî cuda, şertê bingehîn rave dike. Tenê xwedî dikare wê di mîhengên kontrola herêmî de çalak bike; alîkar nikare wê bi xwe çalak bike.

Alîkariya Codex qada parastî (sandbox) ya tenê-xwendinê bi kar tîne û daxwazên pejirandina amûran red dike. Antigravity moda planê û nîşana xwe ya qada parastî ya xwemalî bi kar tîne. Ev modên xwemalî ne misogeriya gerdûnî ya sînordarkirina pergala xebitandinê ne. Haşa rêberê çavkaniyê referansa ku ji bo bersivê hatiye bikaranîn destnîşan dike; ravekirineke hatî çêkirin dîsa jî dibe ku çewt be, lewma berî çalaniyê beşên wê yên girêdayî kontrol bikin. Bersivên kevn dema ku guhertoya rêberê çavkaniya wan ji rêberê heyî cuda be tên nîşankirin.

Rêwerzên têkildar: [Rêberê fermî û domandina wergerê](../../HELP_MAINTENANCE.md) · [Alîkarê sepanê û destûr](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Alîkar û Telegram

Alîkar pêşsaziya hilbijartî û heman API a kontrolkirina sepanê bi kar tîne. Destûra venêrîna rewşê û destûra pêkanîna operasyonan ji hev cuda ne. Ferman û encaman kontrol bikin: nivîsa alîkar ne belgeya temambûna çalakiyekê ye.

Telegram tenê ji aliyê xwediyê herêmî ve tê çalakkirin, bi rêya nîşana (token) bota heyî û ID ya jimareyî ya xwedî. Kontrol ji bo sohbeta taybet a wî xwediyî ye. Boteke nehatibe mîhengkirin an neçalak divê peyamên sepanê nestîne.

Nîşana botê li nav sohbeta asayî pêve nekin. Mîhengkirina entegrasyonê pêwendiya Telegram piştrast nake û bixweber botekê çênake. Wêneyên ekranê û bersiv dikarin daneyên taybet ên qada xebatê (workspace) dihewînin.

Pêşsaziyeke alîkar hilbijêrin û destûra operasyona sepanê ji venêrînê cuda bidin. Xebitandina alîkarê Codex û Antigravity pêdivî bi destûra xwemalî ya xwedî heye; ew bixweber li şûna danişîneke API an Claude ya bêteqil nayên danîn. Wêneyên ekranê dikarin di sohbeta alîkar de werin nîşandan, lê têketina modelê ya niha analîza dîtbarî di nav xwe de nagire. Tenê ji ber ku wêneyek hate nîşandan, nefikirin ku alîkar bi dîtbarî lê nihêriye.

Alîkar dikare bi rêya amûrên tîpkirî kurte, peywir, sohbet, rewşa herikîna xebatê, naveroka pêvajoyê û paceyên sepanê kontrol bike. Ew dikare mîhengên asayî yên destûrdar biguherîne û operasyonên erêkirî yên sepanê bide destpêkirin. Ew nikare destûrên xwemalî bide, pêbaweriyên tomarkirî eşkere bike, destûra qada xebatê ya bingehîn ji dûr ve biguherîne, an dergeheke Forge tenê ji ber hêsaniyê bipejirîne.

Rêwerzên têkildar: [Peymana kontrolkirina sepanê](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Bota xwe ya taybet a Telegram bixebitînin

Bota xwe çêbikin an bi dest bixin, sohbeta wê ya taybet bidin destpêkirin, û nîşana wê ligel ID ya bikarhênerê xwe ya jimareyî ya Telegram di mîhengên kontrola herêmî de binivîsin. Entegrasyonê tenê dema ku hûn bixwazin sepan pê ve were girêdan çalak bikin. ID ya xwedî nasnameya bikarhêner e, ne navekî bikarhêner an ID ya botê ye. Tenê peyamên ji wî bikarhênerî yên di heman sohbeta taybet de tên qebûlkirin.

Ji bo kurteya guhertoya xebitandinê, hejmara proje/peywiran û rewşa peywiran /start, /menu an /status bi kar bînin. Bişkok Proje, Peywir, Wêneya ekranê, Alîkarî û Ziman vedikin. Lîste di her rûpelê de heşt tiştan nîşan didin, bi navîgasyona Paşve, Nûkirin, Mal û Ya Berê/Ya Piştî. Bişkokên projeyê lîsteya peywiran parzûn dikin. Qerta peywirê pêşveçûna herikîna xebatê ya tomarkirî, model/pêşsazî û pirsên li bendê heke hebin nîşan dide.

Sohbetên peywirekê vekin da ku pêşdîtina sohbetên vekirî/dawî û sohbetên qonaxa herikîna xebatê bibînin. Her pêşdîtin heta şeş peyamên dawî yên bikarhêner/alîkar nîşan dide, ku her yek bi eşkereyî heta 200 tîpan hatiye kurtkirin. Ramana taybet nayê nîşandan. Xwendina dîrokê dabînkerekî nade destpêkirin. Pêşdîtin tenê-xwendin in: nivîsa asayî û /ask TEXT dîsa jî xîtabî alîkarê sepanê dikin, tu carî bixweber xîtabî sohbeta peywirê ya ku hûn lê temaşe dikin nakin.

Bixebitîne / Berdewam bike herikîna xebatê ya Code an Work ya heyî ji nû ve dixwîne û herikîneke guncan a tomarkirî dide destpêkirin. Rawestandin daxwaza rawestandina wê dike. Yek jî daxwaz, taybetmendî, plan, encamên nirxandinê an pirsan napejirîne; biryareke li bendê rê li ber Bixebitîne digire. Biryaran di nav sepanê de bidin, an fermaneke tîpkirî ya bi eşkereyî destûrdar ligel dergeh û revîzyona wê ya tam a heyî bi kar bînin.

Ziman an /language bi kar bînin da ku yek ji wan 56 zimanên navrûyê bi navê wî yê xwemalî hilbijêrin. Ev yek tercîhekê tenê ji bo vê botê û xwedî tomar dike. Zimanê sepanê bi kar bîne vê tercîhê paqij dike. Ew ne zimanê sepanê û ne jî destûrên gihîştinê diguherîne; peyamên heyî bixweber ji nû ve nayên şandin.

Navîgasyon bi gelemperî heman peyama pêşeka weşandî nû dike. Nasnameyên bişkokan nenas in ku piştî 15 xulekan dema wan derbas dibe û carekê dikarin werin bikaranîn; guhertina qertekê bişkokên wê yên kevn betal dike. Bişkokên dema wan derbasbûyî, bikarhatî, bi peyamê re nelihev û yên pêvajoya berê nikarin çalakiyekê pêk bînin. Peyamek ku bi teqezî nayê guherandin dikare bi qerteke nû were guhertin; çewtiyeke torê ya nediyar wekî peyameke nû ji nû ve nayê ceribandin.

Dema çalakkirinê de, wergir koma berê paşguh dike û pejirandina nûvekirinê berî şandinê tomar dike da ku fermanên qutbûyî di dema ji nû ve destpêkirinê de bixweber ji nû ve neyên xebitandin. Ev rê li ber dubarekirinê digire; lê temambûnê garantî nake. Berî ku hûn piştî çewtiyekê bi zanebûn karekî nû bidin destpêkirin, rewş/çarçoveyê kontrol bikin. Agahdariyên bixweber ên rewşa peywirê tune ne.

Fermanên eşkere li ber dest dimînin: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot û /ask TEXT. /new {JSON} bi rêya createTask a tîpkirî peywirekê çêdike; /command {JSON} fermana katalogê ya eşkere dişîne. Ji bo şêweyên parametreyan kataloga zindî bixwînin. Heman destûrdana paşperdeyê û destûrên peldankê yên di sepanê de derbas dibin.

Sepan tu carî nirxên nîşana botê ya tomarkirî ji alîkar re naşîne. Dîmenên ekranê, kurte û nivîsa sohbetê dîsa jî dikarin agahdariyên taybet ên projeyê di nav xwe de bigirin. Heke êdî bawerî bi botê an hesabê xwedî nemîne, entegrasyonê li herêmê rawestînin. Nîşaneke eşkerebûyî li ba dabînkerê botê biguherînin, paşê veavakirina wê ya şîfrekirî ya herêmî nû bikin.

Rêwerzên têkildar: [Bota taybet û ferman](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Destûra komputera xwemalî ya tenê-xwedî

Gihîştina komputera xwemalî neçalak dest pê dike. Tenê xwedî dikare wê di Mîhengên herêmî → Kontrola dûr de çalak bike. Alîkar û fermanên HTTP/MCP/Telegram nikarin vê nîşanê ji bo xwe çalak bikin. Heke operasyonek were redkirin, divê alîkar mîhengê rave bike û biryarê ji xwedî re bihêle.

Dema ku bi eşkereyî were çalakkirin, computer.run bernameyeke cîbicîkar, rêza parametreyan û peldanka xebatê ya mutleq a vebijarkî qebûl dike. Ew ti şîrovekirina qalika fermanan (shell) bi kar naîne, xwedî sînorekî 30-saniyeyî ye û derketinê bi 1 MiB sînordar dike. Peldankeke xebatê ya wenda an nederbasdar tê redkirin; heke cwd neyê diyarkirin, peldanka mîhengan a girêdayî sepanê tê bikaranîn, ne HOME. Derketin fermanên çalak ên aydî xwe betal dike û li benda paqijkirina pêvajoya wan dimîne.

Qada xwendin/xebitandinê ya sepanê û gihîştina xwemalî biryarên ji hev cuda ne. Dareke xebatê (worktree) gihîştina pergala pelan a dabînkerê bêsînor sînordar nake. Gihîştina xwemalî piştî peywirê heke êdî ne hewce be betal bikin, û li şûna ku nivîsa alîkar wekî delîl qebûl bikin, wergirtinên fermanan kontrol bikin.

Rêwerzên têkildar: [Peymana kontrolê ya tenê-xwedî](../../../shared/control.ts).

<a id="remote"></a>

## Gerok û cawên ji dûr ve

Xwediyê herêmî pêşkêşkerê çalak dike û navnîşan, bender (port) û qada wê hildibijêre: xwendin ji bo venêrînê an xebitandin ji bo çalakiyan. Navnîşana standart a 127.0.0.1 tenê li ser vê komputerê heye. 0.0.0.0 li ser navrûyên torê guhdarî dike; berî çalakkirina wê gihîştina torê venêrin.

Gerokek piştî têketina bi nîşanê (token) heman navrûyê vedike. Nîşanan nexin nav lînkên gelemperî an dîmenên ekranê. HTTP bi tena serê xwe trafîkê şîfre nake; li ser toreke nebawer kanaleke parastî bi kar bînin.

Xwedî cawên din bi URL û nîşanê mîheng dike. Paşperde (backend) daxwazan derbas dike; ev yek projeyên wan li ser makîneya herêmî kopî nake. Berî her çalakiyekê cawê hilbijartî kontrol bikin.

Ferman û bûyerên tîpkirî kontrola sepanê hildigirin. Qada xwendinê destûra guhertina peywirê nade. Kontrola komputera xwemalî tercîheke cuda ya xwediyê herêmî ye û neçalak dest pê dike.

Divê sepan ji bo kontrola gerok, Telegram û ajansên derve vekirî bimîne. Her caw xwedî profîla xwe ya taybet, rewşa peywirê, nîşan û bendera pêşkêşkerê ye. Di heman demê de yek profîlê di navbera cawên serbixwe de ji nû ve bi kar neynin. Bûyerên gerokê û bersivên fermanan tenê ji bo cawê hilbijartî ne; guhertina UI pelan bar nake an têketina xwemalî kopî nake.

Rêwerzên têkildar: [HTTP û kontrola caw](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes û ajansên din ên derve

API ya kontrola sepanê ya piştrastkirî an pira hevgirtî ya stdio ya MCP bi kar bînin. Pêşkêşkerê li herêmê çalak bikin, bixwîne (read) an bixebitîne (operate) hilbijêrin û her xerîdarekî bi URL û nîşana wî cawî mîheng bikin. Ji bo xebitandina pira serbixwe ya MCP Node.js 22 an nûtir hewce ye; sepana Electron xerîdarê ajansê we saz nake. URL a gerokê ne xala dawî ya HTTP MCP a herikbar e: wê wekî ZIAFORGE_URL bide pira stdio.

Pir ziaforge_status, ziaforge_commands, ziaforge_command û ziaforge_screenshot pêşkêş dike. Bi rewşê û kataloga fermanan a zindî dest pê bikin, paşê ji bo peywira hilbijartî system.context bixwînin. Fermanên tîpkirî heman kontrolên revîzyon, dergeh, peldanka peywirê û paqijkirinê yên UI a herêmî dişopînin.

Kataloga fermanan a zindî documentation.guide dihewîne, ku ew alîkariya fermî ya îngilîzî ye ligel riya çavkaniyê û sourceSha256. Endezyarê navxweyî yê sepanê bi rêya amûrên xwe heman çavkaniyê distîne. Ev yek çarçoveya tevahî ya hilberê bêyî pêbaweriya bi têbiniyên kevn dide ajansan; belgekirin tu carî destûrê nade an şûna biryara mirovî ya heyî nagire.

Divê ajans daxwaz, biryarên teknîkî û plansaziyê li ser bingeha ramaneke kurt a mirov nîqaş bikin. Divê ew dergehên mirovî yên eşkere, modelên hilbijartî, siyaseta destî/Auto û vekolîna pêwîst biparêzin. Divê ew erêkirinê ji xwe dernexînin, fermanên nediyar di bin ID ya nû de ji nû ve nexebitînin, an guhertinên Git bêyî niyeta xwedî neweşînin.

Ji bo çend sazûmanan çend pêşkêşkerên binavkirî yên MCP mîheng bikin. Guhertina cawan biryareke arastekirinê ye, ne hevdengkirin e. Mînakên veavakirina OpenClaw û Hermes di AGENT_CONTROL.md de ne; sazkirin û hevahengiya taybet a xerîdar divê li gorî guhertoya sazkirî ya xerîdar were kontrolkirin.

Bîrgeha demkî ya derve ya requestId tenê komek daxwazên bisînor dema ku sepan dixebite ji nû ve dubarebûnê paqij dike. Operasyonên mayînde nasnameyên xwe bi kar tînin: createRequestId ji bo afirandina peywirê, commandId ji bo biryarên herikîna xebatê, clientMessageId ji bo peyaman û operationId ji bo guhertinên Git. Piştî pejirandineke nediyar, nasname û barê orîjînal biparêzin; berî ku bi zanebûn xebatek nû bidin destpêkirin, rewşa tomarkirî bixwînin.

Rêwerzên têkildar: [Rêwerzên xerîdarê MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI a herêmî û sînorên otomasyonê

Belavkerê ziaf heman sepana dixebite û herikîna xebatê ya tomarkirî kontrol dike. Ji koda çavkaniyê, van bi kar bînin: npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, an npm run ziaf -- pause --task TASK_ID. Pejirandineke serkeftî ya Destpêkirinê nayê wateya ku peywir qediya ye.

--until-success bi zanebûn Auto ji bo herikîna xebatê ya tomarkirî çalak dike, lê pirs, venêrîn, dergehên pejirandinê, sînor û xalên kontrolê hîn jî derbasdar in. Ctrl+C ji belavkerê çavdêriyê derdikeve; ew herikîna xebatê ya sepanê bixweber nasekinîne. Ji bo kodên derketinê, xala dawî ya herêmî û birêvebirina profîlê li CLI.md binêrin.

Rûyê Otomasyonan niha pênaseyên nîşandanê û hejmarên xebitandinê yên herêmî diparêze. Ew ne plansazekî dubarebûyî yê erêkirî ye û îsbat nake ku dora modelekê li paşperdeyê xebitiye. Ji bo cîbicîkirina rastîn kontrolên herikîna xebatê ya tomarkirî, ziaf an API ya piştrastkirî bi kar bînin û wergirtinên wan venêrin. Panela nîşandanê bi plansaziya bêçavdêrî tevlihev nekin.

Rêwerzên têkildar: [Fermanên belavkerê](../../CLI.md).

<a id="updates"></a>

## Version and updates

> Tevahiya rêberê hîn li zimanê navbera te nehatiye wergerandin. Çavkaniya îngilîzî tê nîşandan.

Open Settings → Updates and choose Check for updates. The official GitHub repository ZIAForge/ZIAForge and the Stable channel are configured by default. The panel shows the running version and any newer compatible release. Preview includes prereleases; Stable excludes them. Checking never installs an update.

When an update is available, Update downloads the package for this operating system and architecture, verifies its published size and SHA-256, prepares the installer and requests a normal application restart. Save file edits first. Installation is armed only after application services stop, and the installer waits for the current process to exit. Your profile, settings, task history and project files are kept.

Supported installation paths are a writable macOS application bundle, the Windows installer, Linux AppImage and the distribution package manager for DEB/RPM. System installation or authentication prompts may still appear. A development checkout, a read-only or translocated macOS app, or an unsupported portable layout may require manual installation; the panel explains that case and links to the release. Move a macOS application out of the mounted disk image before using in-place updates.

Automatic checking and downloading is optional. When enabled, it checks immediately and every six hours. Installing and restarting remains a separate owner action. A failed download or checksum check retains the existing installation and never runs the downloaded file.

Downloaded package hashes establish that the files match the selected GitHub release. They do not replace code signing or notarization. The updater does not disable operating-system security checks. Repository and channel changes, downloads and installation are local owner actions; remote agents can read update status only.

Rêwerzên têkildar: [Application update behavior and installation limits](../../UPDATES.md) · [Release readiness](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Ji nû ve destpêkirin û vegerandin

Li ser macOSê, ji bo girtina tam Quit / ⌘Q bi kar bînin. Girtina pencereyê dibe ku bihêle sepan vekirî bimîne. Berî guhertina sepanê guhertoya kevn bi tevahî bigirin.

Piştî vebûnê, heman peywirê hilbijêrin. Dîrok û pêşnûma vedigerin. Berdewamkirin çarçoveyeke xwemalî/herêmî vedigerîne lê pêşnûmayekê naşîne, dorê ji rawestanê dernaxe an destûra dubarekirina operasyoneke nenas nade.

Heke Vegerandin (Recovery) xuya bibe, JSON bi destan sererast nekin. Cûreya belgeya bandordar venêrin, pelên orîjînal biparêzin û hilanîneke piştrastkirî hilbijêrin. Vegerandina dorek kevn tiştên wê wekî nediyar nîşan dike.

Dema ku gihandina daxwazê nediyar be, dibe ku herikîna xebatê ya birêvebirî ji bo çarçoveyeke nû hewceyî destûreke eşkere be. Xebata berê û ceribandinên neserkeftî dimînin; redkirineke eşkere ji serkeftineke sexte ewletir e.

Gava ku hemû cawên sepanê girtî bin, pelên peywirê û profîla sepanê hilînin (backup). Peldankek kopîkirî nayê wateya vegerandineke ceribandî. Heke vegerandin daxwaz bike ku hûn hilanîneke derbasdar hilbijêrin, pelên xisardîtî yên tam jî biparêzin. Vegerandina herikîna xebatê an dorek kevn destûra dubarekirina derhênana nediyar an operasyonên Git nade.

Rêwerzên têkildar: [Peymana vegerandinê](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Çareserkirina pirsgirêkan

CLI nehate dîtin: sazkirin û guhertoya wê di termînaleke asayî de kontrol bikin, paşê ZIAForge ji nû ve bidin destpêkirin. Hebûna pelekî cîbicîkar nayê wê wateyê ku hûn têketî ne. Mekanîzmaya têketinê ya dabînker bi xwe bi kar bînin.

Model nayê dîtin an destûrdayîn têk çû: lêgerînê nû bikin, ID ya berdest hilbijêrin û hesab û sînorên xwe kontrol bikin. Berî ku hûn dîroka wê venêrin, daxwazeke nediyar dubare nekin.

Herikîna xebatê sekinî: qonaxa niha, pirs, wergirtina verastkirinê an tomarên CLI vekin. Sedema taybet çareser bikin: pirsek bêbersiv, ferman, destûra peldankê an sînorê hewildanê. Berdewamkirin nikare kontrola têkçûyî bike serkeftin.

Peldank wenda ye an hatiye guhertin: gihîştina peldanka orîjînal vegerînin an peywireke nû çêbikin. Divê sepan ji HOME berdewam neke. Heke hûn cwd-yek din bibînin, dorê rawestînin û tespîtan biparêzin.

Ji bo raporekê, guhertoya Derbarê, rêç, CLI/model, tevgera çaverêkirî û ya rastîn, wêneyekî ekranê û parçeyekî ewle yê tomarê bi cih bikin. Nepenî, naveroka kesane û rêyên ku nikarin werin weşandin jê bibin.

Rûpela ji dûr ve nayê dîtin: piştrast bikin ku xwedî pêşkêşker çalak kiriye, navnîşan û bendera guhdarîkirinê kontrol bikin, paşê bi nîşana rast a caw xwe piştrast bikin. 401 nîşana piştrastkirinê ye; guhertineke redkirî dibe ku ji ber qada xwendinê an kontrola tenê-xwedî be. Guhertina nîşanê xerîdarên heyî yên gerokê digire. Bendera vekolînê ya cuda ya DevTools wekî kontrola sepanê ya ji dûr ve eşkere nekin.

Tomarkirina edîtorê hate redkirin: pêşnûmayê biparêzin, pelê heyî yê li ser dîskê kontrol bikin û nakokiya guhertina derveyî çareser bikin. Bi ji nû ve nivîsandina metamagahiya sepanê berhevdanê derbas nekin. Heke barkirina tevahî ya pelê mezin ne li ber dest be, sererastkirin/lêgerîna pencereyê ya piştgirîkirî an edîtorekî derve bi kar bînin.

Telegram nayê dîtin: nîşana botê, xwediyê jimareyî, sohbeta taybet û rewşê li herêmê piştrast bikin. Webhook an wergirekî din dikare rê li ber wergirtinê bigire; ZIAForge bixweber webhookekê jê nabe an dest naxe ser wergirekî din. Fermanên li sînorekî nediyar hatine redkirin an qutkirin bixweber ji nû ve nayên xebitandin.

Rêwerzên têkildar: [Ceribandin û tespîtkirin](../../TESTING.md).

<a id="diagnostics"></a>

## Pirsgirêkan ragihînin û delîlan venêrin

Guhertoya tam a xebatê ji Beşa Derbarê, OS/avahîsazî, moda peywirê, dabînker/modela hilbijartî û gavên ku pirsgirêkê dubare dikin tomar bikin. Encama çaverêkirî û encama dîtî bînin ziman. Li şûna hemû profîla xwe ya taybet, wêneyekî ewle yê ekranê û ferman an wergirtina verastkirinê ya têkildar pêve bikin.

Tomarên CLI, rojnivîskên bûyeran, deqnûsên modelê, şopên gerokê û dîmenên ekranê dikarin koda çavkaniyê, rêyên kesane an nîşanan (tokens) eşkere bikin. Berî parvekirinê venêrin û sererast bikin. Parzûnkerê tomarkirinê yê herî baş jî dîmenek an arşîvekê wekî parvekirî piştrast nake.

Ji bo beşdaran, qa:doctor nasnameya jîngehê/avakirinê dixwîne; qa:inspect profîleke veqetandî bi stûbên dabînker re vedike. Pêvekek (fixture) riya sepana ceribandî bêyî têkiliya bi modelê re diselimîne. Nirxandina zindî, girêdana Telegram, sermaseya xwemalî ya Linux, îmzekirin û kontrolên berhemên paketkirî delîlên cuda ne. Ji bo fermanên dubarebar û paqijkirinê li TESTING.md binêrin.

Rêwerzên têkildar: [Fermanên delîlan](../../TESTING.md).

<a id="privacy"></a>

## Daneyên herêmî û sînor

Projeyan, dîrok, plan, belge û tespît dikarin nivîsa taybet di nav xwe de bigirin. Profîl, dîmenên xam, mifte an tomarên temam ligel koda çavkaniyê neweşînin.

Li ser Linuxê, tomarkirina nasnameyên API, kontrol, Telegram û yên caw pêdivî bi Servîsa Razan a GNOME ya vekirî an KWallet heye; bêyî depoya razan a piştgirîkirî, ZIAForge li şûna bikaranîna çareseriya paşveçûnê ya basic_text a Electronê tomarkirina van razan red dike.

Depokirina herêmî nayê wê wateyê ku daxwaz li ser komputera we dimînin: CLI/API ya hilbijartî wan ji dabînkerê xwe re dişîne. Peldanka xebatê û çavdêriya pêvajoyê ne veqetandina OS ne. Destûrên hilbijartî kontrol bikin.

Cureyên delîlan ji hev cuda bikin: pêvek (fixtures) sepanê bêyî modelekê diceribînin; xwemalî ya zindî CLI/hesabekî rastîn dixebitîne; kontrolên paketkirî berhemeke taybet erê dikin. Derbaskirina yekê ya yên din garantî nake.

Qada sepanê, dareke xebatê (worktree) û rêwerzeke tenê-xwendinê ji pêkanîna pergala xebitandinê cuda ne. Siyasetên vekoler/alîkar ên Antigravity li şûna ferzkirina gihîştina pergala pelan a tenê-xwendinê, guhertinên di delîlên qada xebatê yên berhevkirî de dibînin. Kontrola komputera xwemalî bernameyên ji aliyê xwedî ve hatine destûrdan li derveyî sînorê amûrên asayî yên sepanê bi cih tîne; gava ku êdî ne hewce be wê bigirin.

Rêwerzên têkildar: [Çavkanî û weşandin](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Vê projeya çavkanî-vekirî fam bikin û biguherînin

Pêşî AGENTS.md û CONTRIBUTING.md, paşê ji bo sînorên çavkaniya heyî PROJECT_MAP.md bixwînin. Peymanên tîpkirî yên hatine bicîhanîn û belgeyên herikîna xebatê/dabînker ên niha tevgerê diyar dikin. CONCEPT.md û beşên berê-termînal ên ARCHITECTURE.md niyeta dîrokî diparêzin û divê wekî daxwazên weşana heyî neyên dîtin.

Çavkaniya alîkariya îngilîzî docs/help/en.json e. Pelên hilberandî yên USER_GUIDE.md an website/guide.html bi destan sererast nekin. Beşa fermî biguherînin, peymana bandordar nû bikin û fermana node scripts/help/generate.cjs bixebitînin. Alîkariya nav-sepanê heman çavkaniyê dixwîne. Zêdekirinan bi pêkanîna rastîn re binirxînin, tevî sînor, destûr û rêyên nepiştgirîkirî.

Her yek ji 56 zimanên rûyê di docs/help/locales.json de xwedî rewşeke alîkariyê ya cuda ye. Alîkariya kêm an netemam vedigere ser îngilîzî. Naverokên temam ên bi wergera makîneyê hatine wergerandin têne nîşankirin û bi haşa çavkaniya îngilîzî ve têne girêdan, bêyî îdiaya nirxandina mirovî. Wergera ku ji aliyê mirov ve hatiye nirxandin zêdetirî vê nirxandêrê xwe tomar dike. Her werger divê nasnameyên beşan, çalakiyan, nasnameyên pel/fermanan û sînorên teknîkî biparêze, rêça rast bi kar bîne, û dema çavkaniya wê ya îngilîzî biguhere were nûkirin.

Beriya weşandinê, node scripts/help/generate.cjs --check bixebitînin da ku berhemên kevnar ên hilberandî, çarçoveyên zimanî yên nederbasdar an girêdanên peymana herêmî yên şikestî bibînin. Kontrolên wergera UI û kontrolên tevgera sepanê ji hev cuda dimînin. HELP_MAINTENANCE.md rêbaza nûvekirina beşdar û AI nîşan dide; divê belgekirin îdiaya ceribandineke serkeftî ya nehatiye kirin neke.

Rêwerzên têkildar: [Nexşeya projeyê ya niha](../../PROJECT_MAP.md) · [Domandina belgekirinê](../../HELP_MAINTENANCE.md) · [Rêwerzên beşdaran](../../../CONTRIBUTING.md) · [Rêwerzên ajansan](../../../AGENTS.md).
