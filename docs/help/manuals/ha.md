<!-- Generated from docs/help/en.json; source SHA-256 c62aae118737b0c8aa69a75571d08fc21a8b86d7f369e8cf3d293550fff266f2. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: ha; served locale: ha; status: machine-translated. -->
# Jagoran mai amfani da ZIAForge

Daga manufa zuwa sakamako da aka tabbatar. Jagora mai amfani ga Code, Work da sarrafa manhaja.

Turanci shine na asali. Taimakon da aka fassara da na'ura ana yi masa lakabi daban da fassarorin da ɗan adam ya duba. Binciken atomatik ba ya tabbatar da daidaito a yaren asali.

> An fassara wannan jagorar ta hanyar inji daga ainihin tushen Turanci na yanzu. Ana maraba da sake dubawa na ɗan adam.

## Ɓangarorin jagora

- [Matakan farko](#start)
- [Shigar da fakitin tebur daidai](#install-platforms)
- [Code: hanyoyi biyar](#code)
- [Tattaunawar Forge](#forge)
- [Takardu da shawarwari](#decisions)
- [Aiwatarwa da bita](#execution)
- [Ƙungiyoyin bita na lokaci guda da masanin rahoto](#review-teams)
- [Ƙwarewar wakili da manufar faɗakarwa](#specializations)
- [Work: daga tambaya zuwa takarda](#work)
- [Saitattu, samfura da shiga](#models)
- [Tattaunawa, Tsaya da layin jira](#chat)
- [Fayiloli, Git da kammalawa](#files)
- [API connections](#api)
- [Saituna, harsuna da sake saiti mai aminci](#settings)
- [Tambayi mataimakin Taimako](#help-assistant)
- [Mataimaki da Telegram](#assistant-control)
- [Sarrafa bot ɗinka na sirri na Telegram](#telegram)
- [Izinin kwamfuta na asali na mai mallaka kawai](#native-permissions)
- [Burawza da misalai masu nisa](#remote)
- [OpenClaw, Hermes da sauran wakilai na waje](#external-agents)
- [Iyakar CLI na cikin gida da sarrafa kansa](#local-cli)
- [Version and updates](#updates)
- [Sake farawa da farfadowa](#restart)
- [Magance Matsaloli](#troubleshooting)
- [Ba da rahoton matsaloli da bincika hujjoji](#diagnostics)
- [Bayanai na gida da iyakoki](#privacy)
- [Fahimta da canza wannan aikin buɗaɗɗen tushe](#project-contributors)

<a id="start"></a>

## Matakan farko

ZIAForge yana adana tattaunawa, tsari, aiwatarwa da tabbatarwa a cikin aiki guda. Zaɓi Code don aikin Git, ko Work don takardu, bincike da sauran sakamako a cikin babban fayil na yau da kullun.

Fara da ƙaramin aiki a cikin aiki daban. Idan ka zaɓi CLI na asali, shigar da shi kuma ka shiga da asusun kansa a cikin terminal da farko. A madadin haka, saita haɗin API. Biyan kuɗin CLI da API mai biyan kuɗi hanyoyin haɗi ne daban-daban; ZIAForge ba ya shigar da kai ko canja wurin kuɗi a tsakaninsu.

1. Buɗe Saituna sannan ka duba babban fayil ɗin wurin aiki da harshe. Bayani yana nuna ainihin asalin ginin da ke gudana.
2. Don Code, ƙara ma'ajiyar Git a gefe. Don Work, zaɓi babban fayil daban yayin ƙirƙirar aikin.
3. Ajiye saiti tare da CLI, samfuri, ƙoƙarin tunani da matakin shiga. Hakanan zaka iya zaɓar Na musamman kai tsaye ba tare da adana saiti ba.
4. Ƙirƙiri aiki, zaɓi hanyarsa, matsayi da ci gaba na hannu ko na atomatik. Duba zaɓukan kafin Fara.

> Yi amfani da kayan aiki da checksum da mai kula ya bayar. Samfurin dubawa na iya kasancewa ba a sanya masa hannu ba ko kuma ba shi da tsarin sabuntawa da aka buga. Dole ne a tabbatar da goyon bayan tebur da mai ba da sabis na asali don ainihin OS, gine-gine da kayan aiki; goyon bayan tushe kaɗai ba takardar shaidar fitarwa ba ce.

Umarnai masu alaƙa: [Bayanin aiki](../../../README.md) · [Dacewar mai bayarwa](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Shigar da fakitin tebur daidai

Zaɓi fakiti don tsarin aikinka da tsarin gine-ginen CPU: x64 ko arm64. Hanyar gini na iya samar da tsarin macOS DMG/ZIP, Windows NSIS mai shigarwa/ZIP, da Linux DEB/RPM/AppImage/tar.gz/ZIP. Fayil ɗin da aka samar ko ginin giciye ba tabbaci bane cewa mai shigarwa da UI na asali sun yi nasara a kan na'urarka; duba rikodin tabbatarwa na wannan fitarwa.

Ginin macOS ta amfani da Electron 44 yana buƙatar macOS 13 ko kuma na gaba. Yi amfani da fakitin arm64 a kan Apple Silicon da fakitin x64 don Intel. Fita gaba ɗaya daga tsohuwar manhaja kafin sauyawa. Fakitin samfoti na iya zama ba a sanya musu hannu ba kuma ba a ba da sanarwa ba; kada ka ɗauki kayan ci gaba a matsayin fitowar jama'a da aka sanya wa hannu.

Windows yana buƙatar tsarin aiki da sigar Electron da aka haɗa ke goyan baya da kuma samun Git a cikin PATH. Zaɓi tsarin da ya dace. Samfurin da ba a sanya wa hannu ba ba shi da takardar shedar Authenticode. ZIP mai ɗaukuwa dole ne ya riƙe cikakken kundin adireshin manhaja da fayilolin lokacin aiki, ba kawai mai zartarwarsa ba.

Linux yana buƙatar tebur mai hoto mai dacewa, dakunan karatu na tsarin da Electron ke buƙata, da Git. Don shaidar sarrafawa da aka ɓoye, samar da ingantaccen Secret Service kamar gnome-libsecret ko KWallet; ba a karɓar tsarin basic_text mara tsaro ba. Shaidar gwajin hayaki ta headless/container ba ta tabbatar da kowane tebur ko rarrabawa ba.

Shigar da DEB tare da apt install ./file.deb, ko shigar da RPM ta hanyar manajan fakiti na rarrabawarka. AppImage yana buƙatar izinin zartarwa da goyan bayan FUSE mai dacewa; --appimage-extract-and-run madadin ne inda ake goyan bayansa. Ciro fakitin tar.gz da ZIP tare da duk fayilolinsu na lokacin aiki. Raba bayanan mai amfani da fayilolin manhaja daban yayin maye gurbin fakiti.

Don ginawa daga tushe, yi amfani da Node 24, Git da npm ci, gami da mai shigarwa na Electron na yau da kullun. Sake gina na asali yana buƙatar kayan aikin dandamali: kayan aikin layin umarni na Xcode akan macOS; MSVC C++, Windows SDK da Python akan Windows; mai fassara (compiler), make, Python, pkg-config da kayan aikin tattara fakiti da ake buƙata akan Linux. Bi PLATFORM_BUILDS.md don ainihin umarni da iyakokin dandamali na yanzu.

Ana adana nau'ikan fitarwa a tsakiya kuma abubuwan da aka fitar ba sa canzawa. Ginin tabbatarwa na CI ba mai shigarwa bane da aka buga. Rumbunan adana tushe sun ƙunshi tushe, lockfile, takardu da rubutun umarni; an cire dogaro, takaddun shaida, bayanan martaba na mai amfani da bincike na sirri. Kada ka taɓa ɗaukar ingancin ARM ko Windows na asali daga nasarar ginin x64.

Umarnai masu alaƙa: [Fakitin dandamali, abubuwan buƙata da iyakokin tabbatarwa](../../PLATFORM_BUILDS.md) · [Asalin gini da binciken fitarwa](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: hanyoyi biyar

Auto yana kimanta fa'adin aiki: tambaya mai sauƙi na iya ƙarewa da amsa, yayin da aiki mafi girma ke buƙatar shiri. Gyara kuskure yana binciken dalili kuma yana shirya gyara. Bayani dalla-dalla da farko yana farawa da mafita ta fasaha; Abubuwan buƙata da farko yana farawa da buƙatu da ƙa'idodin karɓa.

Samfura masu yawa yana amfani da mahallin daban-daban don bincike, zane, aiwatarwa da bita. Sunan hanya baya buƙatar masu samarwa daban-daban: kowane matsayi yana amfani da saitin ko tsarin Na musamman da kuka zaɓa.

Worktree yana keɓance canje-canjen Git na aiki. Reshe yana aiki a cikin zaɓaɓɓen fitarwa. Duba aikin, reshe da samfuri kafin farawa; ba a tura bayanin aikin zuwa tattaunawa ta yau da kullun ba.

Don ra'ayin da ke da samfur ko zaɓin fasaha da ba a warware ba, yi amfani da Abubuwan buƙata da farko kuma gina tushe a cikin tattaunawa. Auto yana rarraba buƙatar; ba umarni ba ne don aiwatar da kowace gajeruwar magana nan take. Ajiye daftari yana riƙe buƙatar ba tare da tuntuɓar samfuri ba; Fara yana ajiyewa kuma yana ƙaddamar da tsarin da aka sarrafa sau ɗaya. Kwasfan aiki ɗaya zuwa huɗu suna da ID na ƙirƙira masu zaman kansu da saitunan matsayi.

Umarnai masu alaƙa: [Yarjejeniyar tsarin aiki na Code](../../WORKFLOWS.md) · [Bayanin martaba na Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Tattaunawar Forge

Fara yana buɗe tattaunawa ta tsakiya. Amsa a zahiri, yi tambayoyin martani, ƙara ƙuntatawa kuma tattauna zaɓin fasaha. Tattaunawar da tambayoyin suna zama tare da aikin.

Aika rubutu baya karɓar takarda ko ba da izinin sabon shirin aiwatarwa. Fayyace abu yayin aiwatarwa da farko yana ɗan dakatar da juyowar da aka sarrafa kuma ya sake duba iyakokin da abin ya shafa. Amsar tambaya a cikin matakin da aka riga aka karɓa na iya ci gaba da wannan matakin.

Don sake duba tushen da gangan, zaɓi Abubuwan buƙata, Ƙayyadaddun bayanai ko Tsare-tsare. Sabuwar siga tana buƙatar sabuwar karɓa ta shawarwarin da suka dogara da ita. Matakan da aka kammala da shaidarsu suna nan; matakan da ba a kammala ba da aka maye gurbinsu suna zama a tarihi.

Zaman matakai da aka sarrafa sun bambanta da tattaunawa ta kyauta. Yi amfani da tattaunawar Forge maimakon aika umarni da hannu kai tsaye zuwa zaman da tsarin aiki ya mallaka.

Umarnai masu alaƙa: [Yarjejeniyar tattaunawa ta Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Takardu da shawarwari

Buɗe takarda, duba sigarta kuma yi gyare-gyare lokacin da ake buƙata. Gabatar da gyare-gyare ta hanyar tattaunawa yana haifar da sabuwar siga; ba a sake rubuta rahotanni da sakamakon da aka tabbatar ba a baya.

Kafin karɓar shirin da aka gabatar, gyara tsari, umarni, ƙa'idodin karɓa da umarnin tabbatarwa. Ba da izinin takamaiman umarnin da kuka fahimta: suna gudana ne a cikin babban fayil na aikin. Samfura masu yawa yana ba da shawarar matakin aiwatarwa ɗaya na dukkan aiki, tare da cikakkun bayanai a cikin takardunsa da umarninsa.

Amincewa shawarar kashin kai ce daban. Auto ba ya ƙetare tambayoyi ko karɓar buƙatu, bayanai dalla-dalla da tsare-tsare. Takardar da aka canza ta waje ba za ta iya sake amfani da tsohuwar amincewa ba.

Fayilolin shiri suna bayyana azaman kayan aiki (artifacts). Sigar su, matakin samarwa da hash suna ɗaure su da sakamako. Ana ajiye takardun Code a wajen worktree kuma ba sa shiga cikin commit ta atomatik.

Duba duka takardar da shawarar da aka nuna kafin karɓa. Karɓa tana ɗaure kofa ta yanzu ID, bita na tsari da hashes na takardun da aka riƙe. Nemi canje-canje lokacin da iyaka ko shaida ba daidai ba ne. Idan shawara ta zama marar aiki, sake loda yanayin da aka ajiye kafin yin sabon zaɓi; ba za a iya karɓar fayil ɗin da aka canza a ƙarƙashin tsohuwar siga ba.

Umarnai masu alaƙa: [Ƙofofin tsarin aiki da sigogin takardu](../../WORKFLOWS.md).

<a id="execution"></a>

## Aiwatarwa da bita

Abubuwan da za a yi yana nuna ainihin matakai, ƙoƙarin yanzu, tabbatarwa da sakamakon bita. Wakili da ya ce "done" ba ya kammala mataki: dole ne shaidar da shirin ke buƙata ta wanzu.

Yanayin hannu yana tsayawa a tsakanin matakan da suka cancanta. Auto yana ci gaba da matakan da aka tabbatar kuma yana ba da damar ƙayyadadden ƙoƙari. Tsaya bayan yana ƙirƙirar wurin bincike koyaushe. Dakata yana dakatar da aikin tsarin da ke gudana; rufe panel ba ya dakatar da shi.

Mai bita mai zaman kansa yana amfani da mahallin daban tare da fayiloli da sakamakon tabbatarwa. Dole ne a warware kowane binciken toshewa da ake buƙata; masu bita da yawa ba sa jefa ƙuri'a don kawar da kuskuren toshewa.

A cikin Samfura masu yawa, gyara bincike yana buƙatar takamaiman shawara. Gyara ba ya fara wani bita a ɓoye: Sake bita yana buɗe sabon zagaye. Sharhin bita na iya buƙatar mai gudanarwa ya sake tunani ba tare da maimaita aiwatarwa ba.

Ba za a iya gyara matakan da aka kammala a ɓoye ba. Tare da TDD, dole ne Jan ya gaza da gaske saboda dalilin da ake tsammani, sannan Kore ya wuce. Ƙayyadadden ƙoƙari yana hana maimaitawa mara iyaka.

Ajiye masu bita na CLI/API masu zaman kansu a Saituna → Ƙungiyoyin bita, sannan zaɓi ƙungiyar a cikin Code ko Work. Masu bita suna aiki a lokaci guda, sannan masanin rahoton ƙungiyar ya biyo baya. Hakanan zaka iya saita masu bita masu zaman kansu ba tare da adana ƙungiya ba. Masanin rahoton yana karɓar rahotanni masu tsari marasa suna kawai, ba tare da fayilolin aiki ko kayan aiki ba; wannan keɓancewar a halin yanzu yana buƙatar Claude Code ko API.

Kowane matakin aiwatarwa yana buƙatar bincike mai yiwuwa a aiwatar, bita mai zaman kanta da ake buƙata, ko duka biyun. Matakan shiri a maimakon haka suna riƙe sakamako ingantattu da rasit ɗin kayan aiki; waɗannan ba sa nuna cewa an gudanar da gwaje-gwajen aiwatarwa. Umarni yana yin nasara ne kawai lokacin da aka tabbatar da ainihin matsayin fitarsa da tsabtace tsarin da aka mallaka. Binciken Jan don TDD dole ne ya gaza yadda ya kamata kafin aiwatarwa da tabbatar da Kore; rashin fayil ɗin da za a aiwatar ko ƙarewar lokaci ba ingantaccen sakamako ba ne na Jan.

Masu kashe da'ira na asali suna tsayawa bayan ƙoƙari uku da suka gaza a mataki ɗaya ko ƙoƙari hamsin gaba ɗaya. Katsewa yana cinye ƙoƙari amma shi kansa ba ya zama ƙoƙarin da ya gaza. Iyakoki da cikakkun shaidu suna ci gaba da wanzuwa bayan sake farawa; Sake gwadawa ba ya sake saita su. Karanta gazawar da aka riƙe kafin ba da izinin wani ƙoƙari.

Umarnai masu alaƙa: [Tabbatarwa da bita](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Ƙungiyoyin bita na lokaci guda da masanin rahoto

Buɗe Saituna → Ƙungiyoyin bita kuma adana ƙungiya. Ƙara masu bita masu zaman kansu tare da nasu CLI ko API, samfuri, ƙoƙarin tunani da ƙwarewa, sannan zaɓi masanin rahoto. Zaɓi ƙungiyar a cikin tsarin bitar aikin. Mai bita na iya amfani da saitin mai aiwatarwa, kuma Na musamman yana nan; matsayi masu zaman kansu har yanzu suna da mahallin daban.

Masu bita suna aiki a lokaci guda akan shaidar aiki iri ɗaya. Ana riƙe kowane rahoto, kuskure da hukuncin da ake buƙata. Masanin yana karɓar rahotanni masu lamba marasa suna ba tare da sunayen masu bita ba, asalin samfuri ko mai bayarwa, ainihin abubuwan cikin aikin, damar shiga ma'ajiya ko kayan aiki. Yana kwatanta rahotanni kuma yana dawo da hukunci ɗaya mai tsari; ba ya gudanar da sabon bitar tushe.

Binciken toshewa ko ƙin yarda da mai bita da ake buƙata ba za a iya yafe shi ta hanyar kuri'un mafi rinjaye ko zaɓin masanin gine-gine ba. Rahotannin da suka ɓace ko marasa tsari suna hana amincewa. Bincika abubuwan da aka gano ɗai-ɗai da kuma yanke shawara gaba ɗaya kafin karɓa ko ba da izinin gyare-gyare. Ƙungiyar da aka ajiye an daidaita ta kuma an daskare ta don gudu; gyara saitin ta baya sake rubuta cikakkiyar shaida.

Masanin rahoton kawai a halin yanzu yana amfani da tsarin Claude ko API mara kayan aiki da ake goyan baya. Codex da Antigravity sun kasance a shirye a matsayin masu bita amma an ƙi su don wannan keɓantaccen matsayin masanin gine-gine har sai an sami tabbataccen kwangilar mara kayan aiki. Umarnin da ke cewa "babu kayan aiki" shi kaɗai bai isa ba.

> Tsarin zane/bita na Code Samfura masu yawa da kuma ajiyayyar ƙungiyar bita na lokaci ɗaya sarrafawa ne daban-daban. Rike zaɓaɓɓiyar manufar bita ta musamman; kada ka ɗauka cewa hanya ɗaya tana ba da damar kowane fasalin bita.

Umarnai masu alaƙa: [Tsarin ƙungiya da aka rubuta](../../../shared/review-team.ts) · [Tara bita](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Ƙwarewar wakili da manufar faɗakarwa

Samfuri shine injin aiwatarwa; ƙwarewa shine bayanin koyarwa. Zaɓi Ba komai don babu ƙarin ƙwarewa, Daidaitacce don tsohon jagora, Auto don jagora mai dacewa da aka gina a ciki, ko Na hannu don zaɓaɓɓun jagorori da ƙayyadaddun umarninku. Saitattun abubuwa na iya riƙe zaɓin.

Asalin kasida ya ƙunshi tsarin lambobi na gaba ɗaya, gine-gine, tsaro, aminci, aiki, gwaji da amfani da mu'amala. Auto yana amfani da rubutun aiki/mataki da ke akwai don zaɓar jagora; ba ya kiran wani samfuri a asirce ko tabbatar da ƙwarewa. Ana iya duba shawarwarin tsarawa da canza su kafin karɓar shirin aiwatarwa.

Ƙwarewar bita tana taimakawa wajen karkatar da hankali amma ba za ta maye gurbin shaida mai zaman kanta ba, iyakokin shiga ko hukunci mai tsari. Bi da umarni na musamman a matsayin wani ɓangare na iyakar aikin: kada a yi amfani da su don ƙetare karɓar takarda, manufar kayan aiki, tantancewa ko gazawar mai bita.

Umarnai masu alaƙa: [Kasidar faɗakarwa ta asali](../../../shared/specializations.ts).

<a id="work"></a>

## Work: daga tambaya zuwa takarda

Work ba ya buƙatar Git. Na asali yana ƙirƙirar babban fayil ɗin aiki daban; Na musamman yana zaɓar babban fayil ɗin da ke akwai ta hanyar mai zaɓe na asali. Ajiye daftari yana adana saituna ba tare da yanke shawara ba; Fara yana gudanar da kashi na farko.

Auto yana amsawa kai tsaye ko ba da shawarar tsari mai dacewa tare da ainihin Abubuwan da za a yi. Brainstorm yana ƙirƙirar ideas.md kafin ka zaɓi ƙarin ra'ayoyi ko kimantawa. Bincike yana riƙe findings.md, tushe da iyakoki. Rubuta yana motsawa daga manufa kuma, lokacin da yake da amfani, outline.md zuwa takarda mai bayyanawa ko draft.md; gyare-gyare suna riƙe da nau'ikan da suka gabata.

Zaɓi abubuwan shigar fayil ta hanyar mai ɗaukar hoto na asali kuma yi nuni da su da @. Manhajar tana kwafi su a matsayin abubuwan shigar aiki marasa canzawa kuma tana tabbatar da asalin su kafin a gudanar. Na asali yana ƙirƙirar babban fayil ɗin aiki mallakar manhaja; Samun dama ga babban fayil Na musamman kyauta ce ta mai mallakar da aka ajiye. Daftarin da aka ajiye, wanda ba a fara ba zai iya canza babban fayil ɗinsa.

Ƙirƙiri kwafi 1–4 tare da saitunan mai aiwatarwa masu zaman kansu. Ayyukan da ke amfani da manyan fayiloli masu haɗuwa ba za su iya rubutawa a lokaci guda ba. Wannan haɗin gwiwar yana aiki ne ga ayyukan ZIAForge, ba shirye-shiryen waje na yau da kullun ba.

Deep Brainstorm yana farawa da ma'aikata uku masu zaman kansu kuma yana tallafawa har zuwa takwas. Zaɓi tsarin su da saitunan su, gami da sake amfani da saiti a cikin mahallin daban. Tambayoyin ma'aikata suna riƙe asalin su; rahotannin da ba su da kyau suna samun ƙoƙarin gyara tsari sau ɗaya. Gazawar wani ɓangare tana kasancewa a bayyane maimakon a gabatar da ita a matsayin nasara baki ɗaya.

Deep yana haɗa rahotannin ma'aikatan da aka riƙe zuwa brainstorm_report.md kuma koyaushe yana neman shawarar mai amfani. Ƙaramin biyo baya yana sake duba rahoton ta hanyar mai gudanarwa; babban canji yana fara wani zagaye na daskararrun ma'aikata. Kayan tarihi suna riƙe sigogin su.

Matsayin da aka warware yana daskarewa yayin ƙirƙirar aiki ko adana daftarin aiki a bayyane. Bayan kiran farko, ci gaba na atomatik/na hannu kawai zai iya canzawa; yi amfani da sabon aiki don matsayi daban-daban ko saitunan samfuri. Gyara saitin duniya baya canza matakai na gaba a asirce.

Yanayin hannu yana tsayawa a tsakanin matakan da suka cancanta, gami da babban tsarin Rubutawa. Auto na iya ci gaba ta hanyar wannan zane. Tambayoyi, shawarwarin tsare-tsare masu yiwuwa, jagorancin Brainstorm da bita na rahoton Deep sun kasance shawarwari a bayyane koda a cikin Auto. Ambato shi kaɗai ba ya tabbatar da cewa an yi bincike ba, kuma fayil ɗin binary da aka riƙe shi kaɗai ba ya tabbatar da fassararsa.

Umarnai masu alaƙa: [Hanyoyin Work da shawarwari](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Saitattu, samfura da shiga

Saiti yana adana CLI/API, samfuri, ƙoƙarin tunani da izini. Ƙasan tattaunawa yana da sassan saiti, CLI, samfuri da zaɓuɓɓuka. Na musamman yana aiki ba tare da saiti ba; Ƙirƙiri saiti yana adana zaɓin yanzu.

Katalog ɗin ya fito ne daga zaɓaɓɓen CLI ko API da aka shigar inda ake goyan baya. Sabuntawa yana sabunta jerin ba tare da canza zaɓin ba. Idan ba a sami gano samfurin ba, shigar da takamaiman samfuri ID; dole ne mai bayarwa ya ci gaba da goyan bayan sa. Matakan tunani sun dogara da samfurin da CLI. Tsohon mai bayarwa ya bambanta da takamaiman alamar babu.

Aiwatar da canje-canje kawai bayan amincewar backend. An ƙuntata sauyawa yayin aiki mai gudana ko layin jira da ba kowa. Daftarin aiki da tarihin da ake gani suna nan, amma canza masu ba da sabis ba ya canja wurin yanayin su na sirri na ciki.

A cikin Forge, lakabin matsayi yana da mahimmanci: shiri na iya amfani da Mai tsara daban. Ƙasan yana canza matsayin da aka nuna; an zaɓi masu bita da masu taimako a cikin saitunan tsarin aiki. Manufar aiwatarwa da aka riga aka tabbatar za a iya kulle ta.

Izini ya bambanta tsakanin masu bayarwa. Karanta kawai da Rubutun wurin aiki suna samuwa inda adaftar ke goyan bayan su. Antigravity yana amfani da saitunan CLI na asali ko cikakken damar shiga da aka zaɓa a bayyane. Cikakken shiga ba akwatin yashi (sandbox) ba ne.

Kwarewa tana ƙara jagorar faɗakarwa, ba wani samfuri ko izini ba. Saitattu da matsayi suna goyan bayan Ba komai, Daidaitacce, Auto da Na hannu. Auto yana zaɓar bayanan martaba daga rubutun mataki ba tare da ƙarin kiran samfuri ba; Na hannu yana karɓar har zuwa ƙwarewa huɗu da umarni na musamman. Ayyukan da Mai tsara ya ba da shawara za a iya gyara su kafin karɓar shirin.

Samfurin da aka shigar da hannu ID ko ƙoƙari ya kasance zaɓinku ne, amma mai bayarwa na iya ƙin yarda da shi. Gyara saitin duniya baya canza tattaunawa mai gudana ko shirin da aka karɓa a baya. Don canza tattaunawar da ba ta aiki da gangan, yi amfani da nata ikon sarrafa sanyi kuma jira amincewa. Ya kamata a karanta zaɓin da aka kashe a matsayin iyaka ko iyakar rayuwa, ba a ƙetare shi ta hanyar gyara JSON da aka ajiye ba.

Umarnai masu alaƙa: [Ƙarfin mai bayarwa](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Tattaunawa, Tsaya da layin jira

Shafukan da aka buɗe, Kwanan nan da daftarin aiki na aiki ɗaya ne. Rufe shafi yana cire shi daga Buɗe amma yana riƙe shi a Kwanan nan kuma baya dakatar da aikin mai bada sabis ko tsarin aikin da aka sarrafa. Bincika tarihi, sake buɗe tattaunawa ko rufe duk ƙarin shafuka daga menu na tarihi.

Tsaya yana katse juyowar yanzu. Jira dakatarwa ta ƙare kafin Aika na gaba: amincewar katsewa ba kammala aiki ba ne. Kuna iya rubuta daftari na gaba a halin yanzu.

A cikin tattaunawa ta yau da kullun, Layin jira yana adana buƙata ta gaba daban da daftarin yanzu. Dakatar da layin jira yana riƙe ƙarin bayarwa. Tsaya da Fita suna dakatar da layin jira. Bayan sake farawa, Ci gaba da farko, sannan a bayyane Ci gaba da layin jira.

Ba a tabbatar ba yana nufin ba a san isarwa ba. Irin wannan saƙon ba a sake aika shi ta atomatik: bincika tarihi, kwafi rubutu idan ya dace kuma watsar da abin da ke cikin layin. Sake aika shi sabuwar buƙata ce ta gangan.

Tattaunawar matakai da aka sarrafa suna amfani da tsarin aikin su, ba layin jira na yau da kullun ba. Bi mataki yana nuna matakin yanzu; zaɓar wani shafin da hannu yana dakatar da biyo baya. Rubutun bayanan CLI yana nuna binciken daban da amsar.

Amsoshin Markdown suna nuna kanun labarai, lissafi, tebura, hanyoyin haɗi da lambar da aka shinge. Katunan kayan aiki da binciken CLI sun kasance daban da amsar. Tunanin da samfuri ya ruwaito da awo na token suna bayyana ne kawai lokacin da mai bayarwa ya fallasa su da gaske; kada a cire tunani mai zaman kansa ko amfani daga motsi mai rai.

Bayan rashin tabbas na aikawa ko amincewa da layin jira, bincika tarihi kuma sake gwada buƙatar da aka riƙe kawai inda aka bayar. Rasitin layin jira yana nufin ajiya ya karɓi abu, ba wai an gama tunani ba. Cire wani abu da ba a tabbatar da shi ba daga layin jira kawai a matsayin watsi da gangan; ba zai iya janye faɗakarwar da aka riga aka isar ba.

Umarnai masu alaƙa: [Layin saƙo mai ɗorewa](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Fayiloli, Git da kammalawa

Fayiloli yana nuna babban fayil na aikin. Kwatanta sakamako tare da buƙatu, buɗe takardu kuma duba bambance-bambance. Riƙe fayil ɗin binary baya tabbatar da fassarar daidai a cikin manhajar da aka nufa.

Git yana ba da matsayi, canje-canje da ayyuka tare da sakamakon da aka rubuta. Commit, haɗawa da turawa na hannu ne ta asali; ayyuka na atomatik zaɓuka ne daban don cikakken shirin da aka tabbatar.

Kada ka canza fayilolin aiki tsakanin tabbatarwa da bugawa: amincewa tana da alaƙa da ainihin bytes. Rikici, turawa da suka gaza da sakamakon aiki da ba a sani ba suna toshe ci gaba har sai an yanke shawara a bayyane. Auto ba ya ba da izinin bugawa a asirce.

Work baya ƙirƙirar rassan Git kuma ba shi da kammala Git. Ajiye takardun da ake buƙata daga babban fayil ɗin da aka zaɓa, gami da sigogi da tushe.

Editan fayil yana ba da ma'anar tsari ta hanyar tsawo, bincika da maye gurbin, tarihin warwarewa, nannade layi da daftarin aiki na kowane shafi. Adanawa yana kiyaye rufaffen UTF-8/UTF-16 da ake goyan baya kuma yana ƙin rikice-rikicen gyare-gyare na waje. Sauran ɓoye-ɓoye da abun cikin binary suna buƙatar edita na waje. Daftarin aiki da ba a adana ba yana hana manhaja Fita har sai mai shi ya ajiye ko ya jefar da su.

Cikakken tsarin rubutu yana aiki har zuwa 8 MiB. Manyan fayilolin rubutu suna buɗewa a cikin tagogin 256 KiB; Za a iya loda 8–64 MiB a bayyane gaba ɗaya ba tare da tsarin rubutu ba. Sama da 64 MiB yi amfani da gyaran taga da ƙayyadadden binciken daidaitawa na gaba. Wannan yanayin babban fayil ne mai iyaka, ba daidai yake da Sublime Text ba don manyan takardu marasa iyaka.

Buɗe babban fayil yana amfani da aikin yanzu ko mahallin reshe/worktree, maimakon buɗe ainihin ma'ajiyar kaɗai a ɓoye. Layin fayil na iya bayyana babban fayil ɗin iyaye na wannan fayil ɗin. Hanyoyi suna da inganci ta backend akan rajistar tallafin aiki. Fayilolin binary ba za a iya gyara su azaman rubutu na yau da kullun ba; yi amfani da mai duba su kuma riƙe ainihin bytes.

Cire Worktree wani aiki ne daban da aka kiyaye. Ƙare haɗaɗɗun zaman da aka tsara da tashoshi kafin cire shi, gami da zaman da ke zaman banza. Bincika sakamakon Git da aka ajiye da yanayin dawowa; share rikodin aiki ba madadin kiyaye aikin da ba a yi commit ɗinsa ba a amince.

Umarnai masu alaƙa: [Yarjejeniyar edita da aka rubuta](../../../shared/editor.ts) · [Manufofin Git](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> Ba a fassara cikakken jagorar zuwa yaren tattaunawarka ba tukuna. Ana nuna bayanin Ingilishi na asali.

Connections adds an explicitly selected OpenAI-compatible endpoint. Enter a name, base URL, model and a key if needed. Select Chat Completions for existing integrations or Responses for function rounds, provider tool progress and generated images. Existing connections retain Chat Completions until you change them explicitly. For an existing connection, Set up Responses opens a draft for that same endpoint; review the profile and click Save connection. Choose Codex connector or Grok Connector v1 only for a gateway that supports that extension. The saved key is retained when the endpoint is unchanged and the key field stays blank.

HTTPS is required except for loopback HTTP. Use a plain endpoint without credentials, queries or fragments. Redirects are refused. Keys use supported OS encryption and are never returned to the UI. Changing the endpoint requires re-entering or clearing its key. Leaving the key field blank preserves a saved key.

Workspace file tools execute in the backend-resolved local task folder, with relative paths and checks against traversal and links. Every file write needs explicit approval and an unchanged expected revision. Read-only sessions expose only read tools. In Responses, Allow local commands separately enables approved executable/argument calls on macOS and Linux. Command supervision is unavailable on Windows; the adapter does not advertise that tool there. Commands always require owner approval and are not an operating-system sandbox.

The Codex connector profile identifies that gateway’s Responses tool-progress extension. Native provider tools execute on the server, separately from caller tools on your computer. Local read-only permissions do not constrain the server. A connector cannot be selected for a report-only architect that requires all tools disabled: unsupported isolation fails rather than silently allowing native tools. Select an endpoint that can enforce the required policy.

Generated PNG, JPEG and WebP results appear as separate image cards, with Save image, outside collapsed tool output. Images are validated and kept in private application storage; model-supplied URLs and Markdown images are not fetched automatically. Opening saved history, retrying an image read and saving a cached image do not request a new generation. Results are bounded to 32 MiB and 32 million pixels per image, with a shared 512 MiB private media cache. Preserve needed images before manually clearing the private cache if it becomes full. Click a chat image to open the image viewer. Zoom in or out, choose Actual size (100%) or Fit to window, and drag to inspect a detail. Escape or Close image viewer returns to the chat. Viewing and zooming reuse the loaded private image; they do not request a new generation.

Responses conversations retain the acknowledged response identity and exact function call IDs. Interrupted inputs are not automatically resent. An uncertain local edit or command is not rerun after restart; preserve the history and explicitly create a new context after inspection. Changes to a saved transport or endpoint require explicit reconfiguration. Provider status, cancellation and expiry failures are reported without hiding them behind a CLI fallback. The chat header shows the protocol pinned to that run. After saving connection changes, open the chat’s CLI / API selector and click Apply, even if the same connection is already selected. This creates a new run with the saved configuration and retains chat history. Saving a connection alone does not migrate active chats. Older text-only image links remain text; switching protocol does not regenerate or import previous results.

API connections use their configured endpoint and authentication, separately from native CLI subscriptions. Some gateways use subscriptions internally; ZIAForge does not copy native authentication into an API. Models, tool policies, reasoning parameters and billing depend on the endpoint. Discovery alone does not prove inference. Keep keys in Connections, never in task prose or screenshots.

For Grok Connector v1, save an explicit Responses connection and use Inspect connector to read its advertised capabilities, models and usage without running inference. Model reasoning levels and context window choices come from the catalog. The optional native turn limit is 1–100. Missing quota percentages remain unknown; the usage period end is not a subscription payment or expiration date. Apply connection changes in each existing chat before they take effect there.

Grok questions appear as cards with the exact native question and option labels. Choose the requested answers or enter a custom response, then send once. Plan interviews can offer discussion or skip actions. Provider permission cards show the exact native choices and require your selection by default. These differ from local file/command approvals. Stop, expiry or restart makes old cards inactive; an uncertain submission is not repeated automatically.

In Connections, a Grok connection can enable Automatically approve one-time provider permissions; it is off by default. This applies to new chats or an existing chat after you explicitly reconfigure it with Apply. Saving the connection alone does not change a running chat. When enabled, ZIAForge automatically submits only one unambiguous, unexpired one-time permission offered by Grok and records that automatic decision before sending it. The card identifies an automatic approval. Questions and local file or command approvals still require your answer. Read-only chats keep manual provider permissions. Persistent permissions are never selected automatically; missing or ambiguous one-time choices remain manual. Old or uncertain submissions are never replayed or retried automatically.

In a Grok chat, the attachment button opens the system picker for PNG, JPEG and WebP. Four images are allowed per message, up to 16 MiB each and 20 MiB combined, with 32 million pixels per image. Private draft copies have a 128 MiB budget and belong to that chat run. They are transmitted only when you send. Failed or uncertain sends retain their draft identities. Image messages cannot use the text-only queue. Remove or explicitly discard a pending image draft before changing or resuming its run; discarding a draft does not undo an already delivered message. Accepted image messages retain private image cards for later inspection, zoom and saving.

Grok provider tools are restricted to supported web retrieval, images, interactive questions and capability-gated video generation. Local project tools still execute on the computer in the backend-selected task folder. Read-only review excludes provider image/video generation and editing, questions, local writes and commands. Tool-free Help and report-only architect sessions cannot use this connector profile. Audio generation, transcription and realtime voice are not offered; an MP4 may contain its normal audio track. A discovered tool alone is not evidence of a usable result.

For video, use a writable Grok chat, attach a reference image or continue the chat that created one, and describe the motion and desired parameters. To choose an older image explicitly, use Save image and attach the saved file. Viewing or saving the image does not regenerate it. There is no separate video-parameter form: the request uses the conversation and its native questions/permission cards. Before a new user turn, ZIAForge enables only video tools that the connector advertises as available, enabled and verified. Discovery failure leaves video unavailable for that turn. Changes in native capabilities can start a new provider context with your visible history and eligible cached images while keeping the local chat; interrupted operations are not replayed. If an image cannot fit the attachment limits, the handoff reports that omission; attach the intended reference explicitly.

The connector offers image_to_video with a required reference image, 6 or 10 seconds and 480p/720p presets. Its reference_to_video mode supports 1–15 seconds and aspect ratios 1:1, 16:9, 9:16, 4:3, 3:4, 3:2 or 2:3; the agent may generate a reference first when needed. Request the intended settings in chat. ZIAForge does not expose the separate /grok/media endpoint or its auto selector. Presets and supported parameters are provider capabilities, not a guarantee of exact pixel height, frame timing or every artistic result.

A completed Grok video appears only after the protected MP4 file is downloaded and its MIME, size, SHA-256 and structure are checked. Text saying a video is ready, an image fallback or a storage link is not a playable video. Errors remain visible without requesting a replacement generation. Use the video card controls to play, pause, seek or adjust sound when present. Playback does not start automatically. Save video opens the system destination dialog. Saved chat history retains the private MP4 after a full application Quit/restart; playback and saving use local bytes without inference or another provider download. Videos are limited to 128 MiB each within the shared 512 MiB media cache. Save needed media before manually clearing a full cache. The computer must support the video codec; unsupported or damaged files show an error.

Umarnai masu alaƙa: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## Saituna, harsuna da sake saiti mai aminci

Gabaɗayan saituna suna zaɓar wurin aiki, yaren mu'amala da abubuwan asali. Haɗi yana sarrafa ƙarshen API. Saitattu da Ƙungiyoyin bita suna riƙe saitunan matsayi. Ikon nesa yana sarrafa takaddun shaida na gida, ikon sabar da izinin mai shi; Sabuntawa yana sarrafa tushen/tashar fitarwa. Bayani yana nuna ainihin ginin da ke gudana.

Harshen fuskar manhaja ya bambanta da harshen shigarwa da matsayin bitar takardu. Sunayen samfura, lambobin umarni, ƙarin fayil, lambobin samfuran mai bayarwa da sunayen da mai amfani ya ƙirƙira suna zama masu ganowa. Taimako yana bin zaɓaɓɓen yaren fuskar manhaja lokacin da akwai fassarar yanzu; ana yi wa fassarorin inji lakabi kuma Turanci ya kasance ingantaccen ma'auni.

Ajiye yana amfani da tsarin da aka nuna. Sake saitin bayanan bayanai ko sake saitin masana'anta na iya cire bayanan martaba na manhaja; adana fayiloli da ingantaccen ajiya kafin amfani da sake saiti da gangan. Waɗannan ayyukan ayyuka ne na mai mallakar gida. Kada ka yi amfani da su azaman gajeriyar hanya don bincika aikin da ya gaza ko rikodin da ya lalace.

Umarnai masu alaƙa: [Umarnin daidaita harshe](../../LOCALIZATION.md) · [Farfado da bayanai](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Tambayi mataimakin Taimako

Buɗe Taimako, zaɓi saitin da aka ajiye wanda aka haɗa a cikin allon mataimakinsa sannan ka yi tambaya game da ZIAForge. Amsoshi suna amfani da jagorar Turanci na asali a halin yanzu da yaren da kake amfani da shi a fuskar manhaja. Maɓallan nuni na sashe suna buɗe batutuwan jagora masu dacewa, domin ka iya kwatanta bayanin da ainihin jagorar.

Wannan mataimakin yana adana keɓantacciyar tattaunawa ta sirri mai ɗaukar shigarwar da aka ajiye har zuwa 100 da MiB 3. Shigar da tambaya mai tsawon har zuwa haruffa 12,000; Aika yana gabatar da ita, Tsayar yana soke amsar da ake bayarwa yayin da yake barin tambayarka a shirye, sannan Share yana share wannan tattaunawar ta Taimako. Rubutun da ba ka aika ba da saitin da ka zaɓa suna nan ko da an rufe ko an sake buɗe Taimako a cikin zama ɗaya na manhaja, amma ba a adana rubutun a faifai ba. Mataimakin ba ya aika umarnin manhaja, canza jerin aiki ko karɓar ƙofa. Shawara ba tabbaci ba ne na aiki, asusu ko haɗin waje kai tsaye.

Zaman taimako na Claude Code da API suna aiwatar da manufar rashin amfani da kayan aiki da ake goyan baya. Zaman taimako na asali na Codex da Antigravity suna buƙatar wanzaccen izinin kwamfuta na asali na mai mallaka na cikin gida. Idan an kashe shi, manhajar tana bayyana abin da ake buƙata maimakon zaɓar wani mai ba da sabis daban. Mai mallaka ne kaɗai zai iya kunna shi a saitunan sarrafa na cikin gida; mataimakin ba zai iya kunna shi da kansa ba.

Taimakon Codex yana amfani da wurin gwaji mai karantawa kawai kuma yana ƙin buƙatun amincewa da kayan aiki. Antigravity yana amfani da yanayin tsari da tutar wurin gwajin na'ura na asali. Waɗannan halaye na asali ba cikakken garanti ba ne na killace tsarin aiki. Lambar hash ta tushen jagora tana gano ainihin jagorar da aka yi amfani da ita don amsar; bayanin da aka ƙirƙira yana iya yin kuskure, don haka bincika sassan da aka haɗa kafin ɗaukar mataki. Ana yi wa tsofaffin amsoshi alama idan sigar tushen jagorarsu ta bambanta da jagorar yanzu.

Umarnai masu alaƙa: [Ingantaccen jagora da kula da fassara](../../HELP_MAINTENANCE.md) · [Mataimakin manhaja da izini](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Mataimaki da Telegram

Mataimaki yana amfani da saitin da aka zaɓa da kuma API ɗin sarrafa manhaja iri ɗaya. Izinin bincika hali da izinin gudanar da ayyuka daban suke. Bincika umarni da sakamako: bayanin mataimaki ba hujja ba ce da ke nuna cewa an kammala aiki.

Mai mallaka na cikin gida ne kaɗai zai iya kunna Telegram, tare da wanzaccen alamar bot (token) da lambar ID ta mai mallaka. Ikon sarrafawa na tattaunawa ta sirri ce ta wannan mai mallaka. Bot ɗin da ba a saita ba ko wanda ba ya aiki bai kamata ya karɓi saƙonnin manhaja ba.

Kada ka liƙa alamar bot a tattaunawa ta yau da kullum. Saita haɗin ba ya nuna tabbacin samun damar shiga Telegram kuma ba ya ƙirƙirar bot kai tsaye. Hotunan allo da martani na iya ƙunsar bayanan sirri na filin aiki.

Zaɓi saitin mataimaki sannan ka ba da izinin gudanar da aikin manhaja daban da na bincike. Gudanar da mataimakin Codex da Antigravity yana buƙatar izinin na'ura na asali na mai mallaka; ba a maye gurbinsu a ɓoye da zaman API ko Claude maras kayan aiki ba. Za a iya nuna hotunan allo a tattaunawar mataimaki, amma shigarwar samfurin a halin yanzu ba ta haɗa da nazarin hoto ba. Kada ka ɗauka cewa mataimakin ya bincika hoto da ido kawai don ya nuna shi.

Mataimaki na iya bincika taƙaitattun bayanai, ayyuka, tattaunawa, halin jerin aiki, yanayin aiki da tagogin manhaja ta amfani da tsararrun kayan aiki. Zai iya canza saitunan yau da kullum da aka halatta sannan ya ƙaddamar da ayyukan manhaja da aka amince da su. Ba zai iya ba da haƙƙoƙin na'ura na asali ba, bayyana bayanan sirri da aka ajiye, canza izinin babban filin aiki daga nesa ko amincewa da ƙofar Forge kawai don ya dace ba.

Umarnai masu alaƙa: [Yarjejeniyar sarrafa manhaja](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Sarrafa bot ɗinka na sirri na Telegram

Ƙirƙira ko samo bot ɗinka, fara tattaunawarsa ta sirri, sannan shigar da alamarsa da lambar Telegram mai amfani ID a cikin saitunan sarrafa gida. Kunna haɗin kai kawai lokacin da kake son manhajar ta haɗa. ID na mai shi mai gano mai amfani ne, ba sunan mai amfani ko bot ID ba. Saƙonni daga wannan mai amfani ne kawai a cikin wannan tattaunawa ta sirri ake karɓa.

Yi amfani da /start, /menu ko /status don taƙaitaccen bayanin sigar da ke aiki, ƙididdigar aiki/aiki da matsayin aiki. Maɓallai suna buɗe Ayyuka, Ayyukan aiki, Hoton allo, Taimako da Yare. Jerin yana nuna abubuwa takwas a kowane shafi, tare da kewayawa na Baya, Sabuntawa, Gida da Na Baya/Na Gaba. Maɓallan aiki suna tace jerin aikin. Katin aiki yana nuna ci gaban aikin da aka ajiye, samfuri/saitin da kuma tambayoyin da ke jiran aiki lokacin da suke nan.

Buɗe Tattaunawar aiki don duba buɗaɗɗun tattaunawa/na kwanan nan da tattaunawar matakin jerin aiki. Kowane samfoti yana nuna har zuwa saƙonnin mai amfani/mataimaki na baya-bayan nan guda shida, waɗanda aka taƙaita a bayyane zuwa haruffa 200 kowannensu. Ba a nuna tunani na sirri ba. Karanta tarihi ba ya fara mai bayarwa. Samfuran duba ne kawai: rubutu na yau da kullun da /ask TEXT har yanzu suna magana ne ga mataimakin manhaja, ba tattaunawar aikin da kake kallo ba.

Gudanar / Ci gaba yana sake karanta aikin Code ko Work na yanzu kuma yana fara aikin da aka ajiye wanda ya cancanta. Dakata yana buƙatar dakatarwarsa. Babu wanda ke karɓar buƙatu, ƙayyadaddun bayanai, tsari, binciken bita ko tambayoyi; yanke shawarar da ke jiran aiki tana hana Gudanarwa. Yanke shawara a cikin manhajar, ko amfani da takamaiman umarni mai izini tare da ainihin ƙofarta da bita na yanzu.

Yi amfani da Harshe ko /language don zaɓar kowane ɗayan yarukan fuskar manhaja 56 da sunansa na asali. Wannan yana riƙe da fifiko ga wannan bot da mai shi kawai. Yi amfani da harshen manhaja yana share wannan zaɓin. Ba ya canza yaren manhajar ko izinin shiga ba; ba a sake aika saƙonnin da ke akwai kai tsaye ba.

Kewayawa yakan sabunta saƙon menu ɗaya da aka buga. Maɓallai suna da ainihin ɓoye waɗanda ke ƙarewa bayan mintuna 15 kuma ana iya amfani da su sau ɗaya; canza kati yana soke tsofaffin maɓallan sa. Maɓallan da suka ƙare, aka cinye, marasa daidaituwa da na tsarin da ya gabata ba za su iya yin aiki ba. Za a iya maye gurbin saƙon da ba za a iya gyarawa ba da sabon kati; kuskuren hanyar sadarwa da ba a sani ba ba a sake gwadawa azaman sabon saƙo ba.

Bayan kunna poller yana watsar da bayanan baya na baya kuma yana yin rikodin karɓar sabuntawa kafin aikawa domin kada a sake kunna umarnin da aka katse ta atomatik akan sake farawa. Wannan yana hana sake kunnawa; ba ya ba da tabbacin kammalawa. Bincika matsayi/mahallin kafin fitar da sabon aiki da gangan bayan kuskure. Babu sanarwar matsayin aiki ta atomatik.

Umarni na bayyane suna nan: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot da /ask TEXT. /new {JSON} yana ƙirƙirar aiki ta hanyar createTask; /command {JSON} yana aika ingantaccen umarnin kasida. Karanta kundin adireshi na yanzu don siffofin gardama. Izini ɗaya na backend da tallafin babban fayil suna aiki kamar a cikin manhajar.

Manhajar ba ta taɓa aika ƙimar alamar bot ɗin da aka adana zuwa ga mataimaki ba. Hotunan allo, taƙaitattun bayanai da rubutun tattaunawa na iya ƙunsar bayanan aikin sirri. Dakatar da haɗin gwiwa a cikin gida idan ba a amince da asusun bot ko na mai shi ba. Juya alamar da ta ɓaci tare da mai ba da bot, sannan sabunta tsarin ɓoyayyen na gida.

Umarnai masu alaƙa: [Bot na sirri da umarni](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Izinin kwamfuta na asali na mai mallaka kawai

Samun damar kwamfuta na asali yana farawa a kashe. Mai mallaka ne kaɗai zai iya kunna shi a cikin Saitunan gida → Sarrafa nesa. Mataimaki da umarnin HTTP/MCP/Telegram ba za su iya kunna wannan tutar da kansu ba. Idan aka ƙi aiki, ya kamata mataimakin ya bayyana saitin kuma ya bar mai mallaka ya yanke shawara.

Idan aka kunna a bayyane, computer.run yana karɓar fayil mai aiwatarwa, jeren gardama da zaɓin babban fayil na aiki cikakke. Ba ya amfani da fassarar harsashin kwamfuta (shell), yana da iyakar daƙiƙa 30 kuma yana iyakance fitarwa zuwa MiB 1. Ana ƙin babban fayil ɗin da ya ɓace ko mara inganci; cire cwd yana amfani da babban fayil na saitunan mallakar manhaja, ba HOME ba. Fita tana soke umarnin da aka mallaka masu aiki kuma tana jiran share tsarin su.

Iyakokin karantawa/sarrafa manhaja da samun damar asali yanke shawara ne daban. Bishiyar aiki (worktree) ba ta takura wa samun damar tsarin fayil na mai bayarwa mara iyaka ba. Soke samun damar asali bayan an gama aikin idan ba a buƙata kuma bincika rasit ɗin umarni maimakon karɓar bayanin mataimaki a matsayin hujja.

Umarnai masu alaƙa: [Yarjejeniyar sarrafawa ta mai mallaka kawai](../../../shared/control.ts).

<a id="remote"></a>

## Burawza da misalai masu nisa

Mai mallaka na cikin gida yana kunna uwar garken kuma ya zaɓi adireshinta, tashar jiragen ruwa da girmanta: karanta don dubawa ko sarrafawa don ayyuka. Tsohon adireshin 127.0.0.1 yana samuwa ne kawai a wannan kwamfutar. 0.0.0.0 yana sauraro a kan hanyoyin sadarwa; duba damar shiga hanyar sadarwa kafin kunna shi.

Burawza tana buɗe fuska ɗaya bayan shiga ta alama. Kada ka haɗa alamun shaida a cikin hanyoyin haɗin yanar gizo ko hotunan allo. HTTP kaɗai ba ya ɓoye zirga-zirga; yi amfani da kariya ta tashar sadarwa a kan hanyar sadarwa da ba a amince da ita ba.

Mai mallaka yana saita sauran misalai ta URL da alama. Backend yana wakiltar buƙatu; wannan ba ya kwafe ayyukansu zuwa na'urar gida. Bincika misalin da aka zaɓa kafin kowane aiki.

Tsararrun umarni da abubuwan da suka faru suna ɗauke da ikon sarrafa manhaja. Ƙarar karantawa ba ta ba da izinin sauye-sauyen aiki ba. Sarrafa kwamfuta na asali zaɓi ne na mai mallaka na cikin gida daban kuma yana farawa a kashe.

Dole ne manhaja ta ci gaba da gudana don sarrafa burawza, Telegram da wakilin waje. Kowane misali yana da bayanan martaba na sirri, halin aiki, alama da tashar sabar. Kada a sake amfani da bayanin martaba ɗaya a lokaci guda tsakanin misalai masu zaman kansu. Abubuwan da suka faru a burawza da martanin umarni an keɓance su ga misalin da aka zaɓa; sauya UI ba ya mayar da fayiloli ko kwafin shiga na asali.

Umarnai masu alaƙa: [HTTP da sarrafa misali](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes da sauran wakilai na waje

Yi amfani da API na sarrafa manhaja da aka tantance ko kuma gadar stdio ta MCP da ke haɗe. Kunna uwar garken a cikin gida, zaɓi karantawa ko sarrafawa sannan ka saita kowane abokin ciniki tare da wannan URL na misali da alama. Ana buƙatar Node.js 22 ko sabo don gudanar da gadar MCP mai zaman kanta; manhajar Electron ba ta sanya abokin ciniki na wakilinka ba. URL na burawza ba matsaya ce ta HTTP MCP mai yawo ba: samar da shi a matsayin ZIAFORGE_URL ga gadar stdio.

Gadar tana nuna ziaforge_status, ziaforge_commands, ziaforge_command da ziaforge_screenshot. Fara da matsayi da kundin adireshi na umarni masu aiki, sannan karanta system.context don aikin da aka zaɓa. Tsararrun umarni suna bin bita ɗaya, ƙofa, babban fayil na aiki da kuma duban tsaftacewa kamar UI na cikin gida.

Kundin umarni masu aiki ya haɗa da documentation.guide, ingantaccen taimako na Turanci, tare da hanyar tushe da sourceSha256. Masanin gine-ginen manhaja na ciki yana karɓar wannan bayanin ta kayan aikinsa. Wannan yana ba wakilai cikakken mahallin samfurin ba tare da dogara ga tsofaffin bayanin kula ba; takaddun shaida ba su taɓa ba da izinin shiga ko maye gurbin yanke shawara na mutum a halin yanzu ba.

Wakilai ya kamata su tattauna buƙatu, shawarwari na fasaha da tsare-tsare daga gajeriyar ra'ayin ɗan adam. Dole ne su kiyaye ƙofofin ɗan adam na bayyane, samfuran da aka zaɓa, manufofin hannu/Auto da bita da ake buƙata. Kada su ƙirƙira amincewa, sake kunna umarni marasa tabbas a ƙarƙashin sabon ID, ko buga canje-canjen Git ba tare da niyyar mai shi ba.

Saita sabobin MCP masu suna da yawa don shigarwa da yawa. Sauya misali shawarar tura hanya ce, ba daidaitawa ba. Misalan tsarin OpenClaw da Hermes suna cikin AGENT_CONTROL.md; dole ne a bincika takamaiman saitin abokin ciniki da dacewa don sigar abokin ciniki da aka shigar.

Ma'ajiyar waje ta requestId tana cire kwafin buƙatun da aka iyakance ne kawai yayin da manhajar ke aiki. Ayyuka masu dorewa suna amfani da ainihin bayanan kansu: createRequestId don ƙirƙirar aiki, commandId don shawarwarin jerin aiki, clientMessageId don saƙonni da operationId don maye gurbin Git. Riƙe ainihin asali da nauyin aiki bayan amincewa da ba a sani ba; karanta yanayin da aka ajiye kafin ƙaddamar da sabon aiki da gangan.

Umarnai masu alaƙa: [Umarnin abokin ciniki na MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## Iyakar CLI na cikin gida da sarrafa kansa

Mai aikawa na ziaf yana sarrafa manhaja mai aiki guda ɗaya da kuma jerin aikin da aka ajiye. Daga tushe, yi amfani da npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, ko npm run ziaf -- pause --task TASK_ID. Amincewa da Fara mai nasara ba ya nufin an kammala aikin ba.

--until-success yana kunna Auto da gangan don jerin aikin da aka ajiye, amma tambayoyi, bita, ƙofofin karɓa, iyakoki da wuraren bincike suna aiki har yanzu. Ctrl+C yana fita daga mai aikawa mai lura; ba ya dakatar da jerin aikin manhaja a ɓoye ba. Duba CLI.md don lambobin fita, matsaya ta cikin gida da sarrafa bayanan martaba.

Fannin sadarwa na sarrafa kansa a halin yanzu yana adana ma'anar nuni da ƙididdigar gudanarwa na gida. Ba ingantaccen mai tsara jadawali ba ne mai maimaitawa kuma ba ya tabbatar da cewa juyowar samfurin bango ta gudana. Don ainihin aiwatarwa yi amfani da sarrafawar jerin aiki da aka ajiye, ziaf ko ingantaccen API kuma bincika takardun karɓar su. Kada ka ɗauki allon nuni a matsayin tsara jadawalin da ba a kula da shi ba.

Umarnai masu alaƙa: [Umarnin mai aikawa](../../CLI.md).

<a id="updates"></a>

## Version and updates

> Ba a fassara cikakken jagorar zuwa yaren tattaunawarka ba tukuna. Ana nuna bayanin Ingilishi na asali.

Open Settings → Updates and choose Check for updates. The official GitHub repository ZIAForge/ZIAForge and the Stable channel are configured by default. The panel shows the running version and any newer compatible release. Preview includes prereleases; Stable excludes them. Checking never installs an update.

When an update is available, Update downloads the package for this operating system and architecture, verifies its published size and SHA-256, prepares the installer and requests a normal application restart. Save file edits first. Installation is armed only after application services stop, and the installer waits for the current process to exit. Your profile, settings, task history and project files are kept.

Supported installation paths are a writable macOS application bundle, the Windows installer, Linux AppImage and the distribution package manager for DEB/RPM. System installation or authentication prompts may still appear. A development checkout, a read-only or translocated macOS app, or an unsupported portable layout may require manual installation; the panel explains that case and links to the release. Move a macOS application out of the mounted disk image before using in-place updates.

Automatic checking and downloading is optional. When enabled, it checks immediately and every six hours. Installing and restarting remains a separate owner action. A failed download or checksum check retains the existing installation and never runs the downloaded file.

Downloaded package hashes establish that the files match the selected GitHub release. They do not replace code signing or notarization. The updater does not disable operating-system security checks. Repository and channel changes, downloads and installation are local owner actions; remote agents can read update status only.

Umarnai masu alaƙa: [Application update behavior and installation limits](../../UPDATES.md) · [Release readiness](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Sake farawa da farfadowa

A kan macOS, yi amfani da Quit / ⌘Q don cikakken rufewa. Rufe taga na iya barin manhaja tana aiki. Rufe tsohuwar sigar gaba ɗaya kafin maye gurbin manhaja.

Bayan ƙaddamarwa, zaɓi aiki iri ɗaya. Tarihi da rubuce-rubucen farko suna dawowa. Ci gaba yana mayar da mahallin na asali/na gida amma ba ya aika daftarin aiki, cire dakatarwar layi ko ba da izinin maimaita aikin da ba a sani ba.

Idan Farfadowa (Recovery) ta bayyana, kada ka gyara JSON da hannu. Bincika nau'in takardar da abin ya shafa, adana ainihin fayilolin kuma zaɓi ingantaccen ajiyar waje. Maido da tsohon layi yana nuna abubuwansa a matsayin marasa tabbas.

Lokacin da ba a san isarwa ba, tsarin aiki da ake sarrafawa na iya buƙatar takamaiman izini don sabon mahallin. Ayyukan da aka yi a baya da yunƙurin da suka gaza sun rage; ƙin yarda da aka gani ya fi aminci fiye da ƙirƙirar nasara ta ƙarya.

Ajiye fayilolin aiki da bayanin martaba na manhaja tare da rufe duk lokutan manhaja. Babban fayil da aka kwafa ba shine ingantaccen maido da aka gwada ba. Idan farfadowa ta ce ka zaɓi ingantaccen ajiya, riƙe madaidaitan fayilolin da suka lalace kuma. Maido da tsohon aiki ko layi ba ya ba da izinin sake kunna kuskure ko ayyukan Git.

Umarnai masu alaƙa: [Yarjejeniyar farfadowa](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Magance Matsaloli

Ba a sami CLI ba: duba shigarwarsa da sigarsa a cikin tashar na'ura ta yau da kullun, sannan sake kunna ZIAForge. Kasancewar fayil mai aiwatarwa ba ya nufin ka shiga ciki ba. Yi amfani da hanyar shiga ta mai ba da sabis ɗin da kanta.

Samfuri ba ya samuwa ko kuma izini ya faskara: sabunta ganowa, zaɓi ID da ke akwai kuma duba asusunka da iyakokinka. Kada ka maimaita buƙatar da ba ta da tabbas kafin bincika tarihinta.

Tsarin aiki ya tsaya: buɗe matakin yanzu, tambaya, takardar shaidar tabbatarwa ko rajistar CLI. Magance takamaiman dalili: tambayar da ba a amsa ba, umarni, izinin babban fayil ko iyakar ƙoƙari. Ci gaba ba zai iya mai da duba da ya gaza ya zama nasara ba.

Babban fayil ya ɓace ko an maye gurbinsa: maido da damar shiga ainihin babban fayil ɗin ko ƙirƙirar sabon aiki. Kada manhajar ta ci gaba daga HOME. Idan ka ga wani cwd daban, dakatar da juyawar kuma adana bincike.

Don rahoto, haɗa sigar Game da (About), hanya, CLI/samfuri, ɗabi'a da ake tsammani da ta zahiri, hoton allo da amintaccen ɓangaren rajista. Cire asirai, abun ciki na sirri da hanyoyin da ba za a iya bugawa ba.

Shafin nesa ba ya samuwa: tabbatar da cewa mai shi ya kunna sabar, bincika adireshin sauraro da tashar jiragen ruwa, sannan ka tabbatar da ingancin alamar misalin da ta dace. 401 tana nuna tantancewa; canjin da aka ƙi na iya zama iyakar karantawa ko ikon mai shi kawai. Canza alamar yana rufe abokan cinikin burawza da ke akwai. Kada ka nuna tashar binciken DevTools daban a matsayin ikon manhaja na nesa.

An ƙi adana edita: ajiye rubutun, bincika fayil ɗin da ke kan faifai a yanzu kuma warware rikicin canjin waje. Kada ka tsallake kwatancen ta hanyar sake rubuta bayanan martaba na manhaja. Idan babban fayil ɗin cikakken lodi ba ya samuwa, yi amfani da gyara taga/bincike da ake tallafawa ko edita na waje.

Telegram ba ya samuwa: tabbatar da alamar bot, lambar mai shi, tattaunawar sirri da matsayi a cikin gida. Yanar gizo (webhook) ko poller mai fafatawa na iya toshe zaɓe; ZIAForge ba ta share gidan yanar gizo kai tsaye ko karɓar wani poller ba. Umarnin da aka ƙi ko aka katse a kan iyakar da ba a sani ba ba a sake kunna su kai tsaye ba.

Umarnai masu alaƙa: [Gwajin da bincike](../../TESTING.md).

<a id="diagnostics"></a>

## Ba da rahoton matsaloli da bincika hujjoji

Rikodi ainihin sigar da ke aiki daga Game da (About), OS/tsarin gine-gine, yanayin aiki, mai bayarwa/samfurin da aka zaɓa da kuma matakan da ke sake haifar da matsalar. Bayyana sakamakon da aka zata da wanda aka gani a zahiri. Haɗa ingantaccen hoton allo da umarnin da aka riƙe ko takardar shaidar tabbatarwa, maimakon dukkan bayanan martaba na sirri.

Bayanin CLI, mujallun abubuwan da suka faru, rubutattun bayanan samfuri, bin sawun burawza da hotunan allo na iya fallasa tushe, hanyoyin sirri ko alamu. Bincika sannan ka tace kafin rabawa. Mai tace bayanan da ke aiki da iya ƙoƙari ba ya ba da tabbacin cewa hoton allo ko ma'ajiya ya dace a wallafa.

Ga masu ba da gudummawa, qa:doctor yana karanta ainihin yanayi/gina; qa:inspect yana buɗe keɓantaccen bayanin martaba tare da stubs na mai bayarwa. Kayan aikin gwaji na fixture yana tabbatar da hanyar manhaja da aka gwada ba tare da tuntuɓar samfuri ba. Ƙididdigar kai tsaye, haɗin Telegram, allon tebur na Linux na asali, sanya hannu da duba kayan aikin da aka haɗa hujjoji ne daban. Duba TESTING.md don umarni da tsaftacewa da za a iya sake haifarwa.

Umarnai masu alaƙa: [Umarnin hujjoji](../../TESTING.md).

<a id="privacy"></a>

## Bayanai na gida da iyakoki

Ayyuka, tarihi, tsare-tsare, takardu da binciken cututtuka na iya ƙunsar rubutu na sirri. Kada ka buga bayanan martaba, ɗanyen ɗauka, maɓallai ko cikakkun rajistan ayyukan tare da lambar tushe.

A kan Linux, adana bayanan shaida na API, sarrafawa, Telegram da misali yana buƙatar buɗaɗɗen Sabis na Sirri na GNOME ko KWallet; ba tare da kantin sayar da asiri da ake tallafawa ba, ZIAForge ta ƙi adana waɗannan asirin maimakon amfani da madadin basic_text na Electron.

Ajiya na gida ba ya nufin buƙatu suna kasancewa a kan kwamfutarka: CLI/API da aka zaɓa yana aika su zuwa ga mai ba da sabis ɗinsa. Babban fayil na aiki da kulawar tsari ba killace OS ba ne. Bincika izinin da aka zaɓa.

Bambance nau'ikan shaida: kayan aiki suna gwada aikace-aikacen ba tare da samfuri ba; na asali na rayuwa yana amfani da ainihin CLI/asusu; duban fakiti yana tabbatar da takamaiman kayan aiki. Wuce ɗaya ba ya ba da tabbacin sauran.

Iyakokin manhaja, worktree da shigarwa mai karantawa kawai sun bambanta da aiwatarwar tsarin aiki. Manufofin mai duba/mataimaki na Antigravity suna gano canje-canje a cikin shaidar filin aiki da aka tattara maimakon tilasta samun damar karanta fayiloli kawai. Sarrafa kwamfuta na asali yana aiwatar da shirye-shiryen da mai mallaka ya ba da izini a wajen iyakokin kayan aikin manhaja na yau da kullum; kashe shi lokacin da ba a buƙata.

Umarnai masu alaƙa: [Asali da wallafawa](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Fahimta da canza wannan aikin buɗaɗɗen tushe

Karanta AGENTS.md da CONTRIBUTING.md da farko, sannan PROJECT_MAP.md don iyakokin tushen yanzu. Yarjejeniyoyi da aka aiwatar da takaddun aiki/masu bayarwa na yanzu suna jagorantar ɗabi'a. CONCEPT.md da sassan farko na na'ura mai ba da hanya tsakanin hanyoyin sadarwa na ARCHITECTURE.md suna kiyaye niyyar tarihi kuma kada a kuskure su don iƙirarin sakin yanzu.

Tushen taimakon Turanci shine docs/help/en.json. Kada ka gyara USER_GUIDE.md ko website/guide.html da aka samar da hannu. Canja sashe na asali, sabunta kwangilar da abin ya shafa sannan ka gudanar da node scripts/help/generate.cjs. Taimakon cikin manhaja yana karanta tushe ɗaya. Bitar ƙari tare da ainihin aiwatarwa, gami da iyakoki, izini da hanyoyin da ba a tallafawa ba.

Kowanne daga cikin yarukan fuskar manhaja 56 yana da matsayin taimako daban a cikin docs/help/locales.json. Taimakon da ya ɓace ko bai cika ba yana komawa zuwa Turanci. Cikakkun sassan da inji ya fassara ana yi musu lakabi kuma an ɗaure su da lambar tushen Turanci, ba tare da iƙirarin sake dubawa na ɗan adam ba. Fassara da ɗan adam ya duba tana ƙara yin rikodin mai bitarta. Dole ne kowace fassara ta adana ID na sashe, ayyuka, bayanan fayil/umarni da iyakokin fasaha, amfani da madaidaiciyar hanya, sannan a sabunta ta lokacin da tushen Turanci ya canza.

Kafin aikawa, gudanar da node scripts/help/generate.cjs --check don gano abubuwan da aka fitar da suka tsufa, tsarin yare maras aiki ko karyewar hanyoyin kwangilar gida. Binciken fassarar UI da binciken ɗabi'ar manhaja sun kasance daban. HELP_MAINTENANCE.md yana ba da hanyar sabunta mai ba da gudummawa da AI; takardun shaida kada su yi iƙirarin gwajin da ya ci nasara wanda bai gudana ba.

Umarnai masu alaƙa: [Taswirar aikin yanzu](../../PROJECT_MAP.md) · [Kula da takardu](../../HELP_MAINTENANCE.md) · [Umarnin mai ba da gudummawa](../../../CONTRIBUTING.md) · [Umarnin wakili](../../../AGENTS.md).
