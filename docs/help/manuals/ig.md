<!-- Generated from docs/help/en.json; source SHA-256 eaf22fddcc4ae04e49389249e9b06c0e4c060d2a1470f8ecbc39c46cb96868d3. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: ig; served locale: ig; status: machine-translated. -->
# Akwụkwọ ntuziaka onye ọrụ ZIAForge

Site n'uche gaa na nsonaazụ enyochara. Ntuziaka bara uru maka Code, Work na nchịkwa ngwa.

Bekee bụ nke kachasị mkpa. E ji akara dị iche mara enyemaka sụgharịrị site na igwe karịa nsụgharị nke mmadụ nyochara. Nlele akpaaka anaghị agba akaebe maka izi ezi asụsụ ala.

> A sụgharịrị ntuziaka a site na igwe site na isi mmalite Bekee dị ugbu a. A ka na-anabata nyocha mmadụ.

## Nkebi nke ntuziaka

- [Nzọụkwụ mbụ](#start)
- [Wụnye ngwugwu desktọọpụ ziri ezi](#install-platforms)
- [Code: ụzọ ise](#code)
- [Mkparịta ụka Forge](#forge)
- [Dọkụmentị na mkpebi](#decisions)
- [Mmezu na nyocha](#execution)
- [Ndị otu nyocha n'otu oge na onye nhazi mkpesa](#review-teams)
- [Ọkachamara onye nnọchi anya na amụma arịrịọ](#specializations)
- [Work: site na ajụjụ gaa na dọkụmentị](#work)
- [Preset, ụdị na ohere](#models)
- [Nkata, Kwụsị na ahịrị](#chat)
- [Faịlụ, Git na mmecha](#files)
- [Njikọ API](#api)
- [Ntọala, asụsụ na nrụpụtaghachi dị nchebe](#settings)
- [Jụọ onye inyeaka Enyemaka](#help-assistant)
- [Onye inyeaka na Telegram](#assistant-control)
- [Jikwaa bot Telegram nkeonwe gị](#telegram)
- [Ikike kọmputa nna naanị onye nwe ya](#native-permissions)
- [Ihe nchọgharị na ihe ndị dịpụrụ adịpụ](#remote)
- [OpenClaw, Hermes na ndị ọrụ mpụga ndị ọzọ](#external-agents)
- [CLI mpaghara na oke akpaaka](#local-cli)
- [Version and updates](#updates)
- [Malitegharịa ma gbakee](#restart)
- [Nchọpụta nsogbu](#troubleshooting)
- [Kpesa nsogbu ma nyochaa ihe akaebe](#diagnostics)
- [Data mpaghara na oke](#privacy)
- [Ghọta ma gbanwee ọrụ mepere emepe a](#project-contributors)

<a id="start"></a>

## Nzọụkwụ mbụ

ZIAForge na-edebe mkparịta ụka, nhazi, mmezu na nkwenye n'otu ọrụ. Họrọ Code maka ọrụ Git, ma ọ bụ Work maka dọkụmentị, nyocha na nsonaazụ ndị ọzọ na folda nkịtị.

Malite na obere ọrụ na ọrụ dị iche. Ọ bụrụ na ị họrọ CLI ala, buru ụzọ wụnye ya ma banye na akaụntụ nke ya na terminal. N'aka nke ọzọ, hazie njikọ API. Ndenye aha CLI na API akwụ ụgwọ bụ ụzọ njikọ dị iche iche; ZIAForge anaghị abanye gị ma ọ bụ bufee ego n'etiti ha.

1. Meghee Ntọala ma lelee folda ebe ọrụ na asụsụ. Maka na-egosi ezigbo njirimara nke owuwu na-agba ọsọ.
2. Maka Code, gbakwunye ebe nchekwa Git n'akụkụ akụkụ. Maka Work, họrọ folda dị iche mgbe ị na-eke ọrụ.
3. Chekwaa preset nwere CLI, ụdị, mbọ ezi uche na ọkwa ohere. Ị nwekwara ike họrọ Onye ahọpụtara ozugbo na-enweghị preset echekwara.
4. Mepụta ọrụ, họrọ ụzọ ya, ọrụ na ọganihu nke aka ma ọ bụ nke akpaaka. Nyochaa nhọrọ ndị ahụ tupu Mmalite.

> Jiri ihe arụpụtara na checksum nke onye na-elekọta nyere. Nlele anya nwere ike ọ gaghị abụ nke a bịanyere aka na ya ma ọ bụ enweghị ndepụta nri mmelite e bipụtara. Nkwado desktọọpụ na onye na-eweta ala ga-enwerịrị nkwenye maka ezigbo OS, nhazi na ihe arụpụtara; nkwado isi mmalite naanị abụghị asambodo mwepụta.

Ntuziaka ndị metụtara: [Nchịkọta ọrụ](../../../README.md) · [Ndakọrịta onye na-eweta](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Wụnye ngwugwu desktọọpụ ziri ezi

Họrọ ngwugwu maka sistemụ arụmọrụ gị na nhazi CPU: x64 ma ọ bụ arm64. Usoro owuwu nwere ike iwepụta usoro macOS DMG/ZIP, Windows NSIS installer/ZIP, na Linux DEB/RPM/AppImage/tar.gz/ZIP. Faịlụ ewepụtara ma ọ bụ owuwu gafere abụghị ihe akaebe na ihe nrụnye ya na UI ala gafere na igwe gị; lelee ndekọ nkwenye nke mwepụta ahụ.

Owuwu macOS na-eji Electron 44 chọrọ macOS 13 ma ọ bụ karịa. Jiri ngwugwu arm64 na Apple Silicon yana ngwugwu x64 maka Intel. Pụọ kpamkpam na ngwa ochie tupu ngbanwe. Ngwugwu nlele anya nwere ike ọ gaghị abụ nke a bịanyere aka na ya ma bụrụ nke a na-amataghị; emehiela ihe arụpụtara mmepe maka mwepụta ọha nke a bịanyere aka na ya.

Windows chọrọ sistemụ arụmọrụ nke ụdị Electron jikọtara na-akwado yana Git dị na PATH. Họrọ nhazi dakọtara. Nlele anya a na-edeghị aka enweghị asambodo Authenticode. ZIP na-ebugharị ebugharị ga-ejigiderịrị ndekọ ngwa zuru oke na faịlụ oge ịgba ọsọ, ọ bụghị naanị ihe a na-arụ ọrụ ya.

Linux chọrọ desktọọpụ eserese dakọtara, ọba akwụkwọ sistemụ nke Electron chọrọ, yana Git. Maka asambodo njikwa ezoro ezo, nye Ọrụ Nzuzo na-arụ ọrụ dịka gnome-libsecret ma ọ bụ KWallet; anaghị anabata backend na-enweghị nchekwa basic_text. Ihe akaebe anwụrụ ọkụ na-enweghị isi/akpa anaghị agba akaebe desktọọpụ ma ọ bụ nkesa ọ bụla.

Wụnye DEB na apt install ./file.deb, ma ọ bụ wụnye RPM site na njikwa ngwugwu nkesa gị. AppImage chọrọ ikike ịgba ọsọ yana nkwado FUSE kwesịrị ekwesị; --appimage-extract-and-run bụ ụzọ ọzọ ebe akwadoro ya. Wepụ ngwugwu tar.gz na ZIP yana faịlụ oge ịgba ọsọ ha niile. Debe data onye ọrụ na faịlụ ngwa iche mgbe ị na-edochi ngwugwu.

Iji wuo site na isi mmalite, jiri Node 24, Git na npm ci, gụnyere ihe nrụnye Electron nkịtị. Mwughachi ala chọrọ ngwaọrụ ikpo okwu: Ngwaọrụ ahịrị iwu Xcode na macOS; MSVC C++, Windows SDK na Python na Windows; ihe nchịkọta, make, Python, pkg-config na ngwa nkwakọ ngwaahịa achọrọ na Linux. Soro PLATFORM_BUILDS.md maka ezigbo iwu na oke ikpo okwu ugbu a.

A na-edebe ụdị mwepụta n'etiti na ihe ndị na-apụta anaghị agbanwe agbanwe. Owuwu nkwenye CI abụghị ihe nrụnye e bipụtara. Ebe nchekwa isi mmalite nwere isi mmalite, lockfile, akwụkwọ ndekọ na edemede; ewepụrụ ndabere, asambodo, profaịlụ onye ọrụ na nyocha nkeonwe. Ekwubila na nkwenye ARM ma ọ bụ Windows ala dị n'ihi owuwu x64 gara nke ọma.

Ntuziaka ndị metụtara: [Ngwugwu ikpo okwu, ihe ndị dị mkpa na oke nkwenye](../../PLATFORM_BUILDS.md) · [Mmata owuwu na nlele mwepụta](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: ụzọ ise

Auto na-enyocha oke ọrụ: ajụjụ dị mfe nwere ike iji azịza mechie, ebe ọrụ buru ibu chọrọ nkwadebe. Dozie ahụhụ na-enyocha ihe kpatara ya ma kwado mmezi. Nkọwa buru ụzọ na-amalite site na ngwọta teknụzụ; Ihe achọrọ buru ụzọ na-amalite site na ihe achọrọ na njirisi nnabata.

Multi-model na-eji ọnọdụ dị iche iche maka nyocha, nhazi, mmejuputa na nyocha. Aha ụzọ ahụ anaghị achọ ndị na-eweta dị iche iche: ọrụ nke ọ bụla na-eji preset ma ọ bụ nhazi Nke Onye ahọpụtara gị.

Worktree na-ewepụ mgbanwe Git nke otu ọrụ iche. Alaka na-arụ ọrụ na nlele ahọpụtara. Lelee ọrụ, alaka na ụdị tupu ịmalite; anaghị eziga nkọwa ọrụ ahụ na nkata nkịtị.

Maka echiche nwere nhọrọ ngwaahịa ma ọ bụ teknụzụ a na-edozi teghị, jiri Ihe achọrọ buru ụzọ ma wulite ntọala na mkparịta ụka. Auto na-ekewa arịrịọ ahụ; ọ bụghị iwu imejuputa ahịrịokwu mkpirikpi ọ bụla ozugbo. Chekwaa ndepụta nhazi na-ejigide arịrịọ ahụ na-enweghị ịkpọtụrụ ụdị; Mmalite na-echekwa ma na-ebupụta usoro a na-achịkwa otu ugboro. Otu ruo anọ nke mbipụta ọrụ nwere NJ okike nweere onwe ha na ntọala ọrụ.

Ntuziaka ndị metụtara: [Nkwekọrịta usoro ọrụ Code](../../WORKFLOWS.md) · [Profaịlụ arịrịọ Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Mkparịta ụka Forge

Mmalite na-emepe mkparịta ụka etiti. Zaghachi n'ụzọ nkịtị, jụọ ajụjụ ndị ọzọ, tinye ihe mgbochi ma kwurịta nhọrọ teknụzụ. Mkparịta ụka na ajụjụ na-adịgide n'ọrụ ahụ.

Izi ederede anaghị anabata dọkụmentị ma ọ bụ nye ikike maka atụmatụ mmejuputa ọhụrụ. Nkọwapụta n'oge mmezu na-ebu ụzọ kwụsịtụ ntụgharị a na-achịkwa ma legharịa anya na oke metụtara. Azịza nye ajụjụ dị n'ime usoro a nabatarala nwere ike ịga n'ihu n'usoro ahụ.

Iji kpachapụ anya legharịa anya na ntọala, họrọ Ihe achọrọ, Nkọwapụta ma ọ bụ Nhazi. Ụdị ọhụrụ chọrọ nnabata ọhụrụ nke mkpebi ndị dabere na ya. Usoro emechara na ihe akaebe ha na-adịgide; ngalaba ndị a na-emebeghị nke ewepụrụ na-anọ na akụkọ ihe mere eme.

Nnọkọ ngalaba a na-achịkwa dị iche na nkata efu. Jiri mkparịta ụka Forge kama iziga arịrịọ aka ozugbo na nnọkọ nke usoro ọrụ nwere.

Ntuziaka ndị metụtara: [Nkwekọrịta mkparịta ụka Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Dọkụmentị na mkpebi

Meghee dọkụmentị, nyochaa ụdị ya ma mee mgbanwe mgbe achọrọ. Nyefee mgbanwe site na mkparịta ụka na-ewepụta ụdị ọhụrụ; a naghị edeghachi akụkọ na nsonaazụ enyochara n'oge gara aga.

Tupu ịnakwere atụmatụ a tụrụ aro, dezie usoro, ntuziaka, njirisi nnabata na iwu nkwenye. Nye ikike iwu doro anya ị ghọtara: ha na-agba na folda ọrụ. Multi-model na-atụpụta otu usoro mmejuputa ọrụ niile, nwere nkọwa na dọkụmentị na ntuziaka ya.

Nkwado bụ mkpebi kpachapụrụ anya dị iche. Auto anaghị agafe ajụjụ ma ọ bụ nnabata nke ihe achọrọ, nkọwapụta na atụmatụ. Dọkụmentị agbanwere site n'èzí apụghị iji nkwado ochie mee ihe ọzọ.

Faịlụ nkwadebe na-apụta dị ka ihe arụpụtara. Ụdị ha, ngalaba na-emepụta na hash na-ejikọ ha na nsonaazụ. A na-edebe dọkụmentị Code na mpụga worktree ma ha anaghị abanye na ntinye n'akpaaka.

Lelee ma dọkụmentị ma mkpebi egosiri tupu ịnakwere. Nnabata na-ejikọ ID ọnụ ụzọ dị ugbu a, nyocha atụmatụ na hash dọkụmentị echekwara. Rịọ mgbanwe mgbe oke ọrụ ma ọ bụ ihe akaebe na-ezighi ezi. Ọ bụrụ na mkpebi aghọọla ihe mgbe ochie, bugharịa ọnọdụ echekwara tupu ịme nhọrọ ọhụrụ; enweghị ike ịnabata faịlụ agbanwere n'okpuru ụdị mbụ.

Ntuziaka ndị metụtara: [Ọnụ ụzọ usoro ọrụ na ụdị dọkụmentị](../../WORKFLOWS.md).

<a id="execution"></a>

## Mmezu na nyocha

Ihe a ga-eme na-egosi ezigbo usoro, mbọ dị ugbu a, nkwenye na nsonaazụ nyocha. Onye ọrụ na-ekwu "emechara" anaghị emecha usoro: ihe akaebe achọrọ nke atụmatụ ahụ ga-adịrịrị.

Ụdị ntuziaka na-akwụsịtụ n'etiti usoro ruru eru. Auto na-akwalite usoro enyochara ma na-enye ohere maka mbọ amachiri oke. Kwụsị mgbe na-emepụta ebe nlele mgbe niile. Kwụsịtụ na-akwụsị ọrụ usoro ọrụ na-arụsi ọrụ ike; imechi panel anaghị akwụsị ya.

Onye nyocha nweere onwe ya na-eji ọnọdụ dị iche nwere faịlụ na nsonaazụ nkwenye. A ghaghị idozi nchọpụta ọ bụla na-egbochi achọrọ; ọtụtụ ndị nyocha anaghị eji ntuli aka wepụ njehie na-egbochi.

Na Multi-model, imezi nchọpụta chọrọ mkpebi doro anya. Mmezi anaghị amalite nyocha ọzọ na nzuzo: Nyochaa ọzọ na-emepe okirikiri ọhụrụ. Okwu nyocha nwere ike ịrịọ onye nhazi ka ọ chegharịa na-enweghị ikwughachi mmejuputa.

Enweghị ike idezi usoro emechara na nzuzo. Na TDD, Red ga-adarịrị n'ezie n'ihi ihe a tụrụ anya ya, mgbe ahụ Green ga-agafe. Mbọ amachiri oke na-egbochi mbọ na-adịghị agwụ agwụ.

Chekwaa ndị nyocha CLI/API nweere onwe ha na Ntọala → Ndị otu nyocha, wee họrọ otu ahụ na Code ma ọ bụ Work. Ndị nyocha na-agba n'otu oge, onye nhazi mkpesa nke otu ahụ na-esochi ya. Ị nwekwara ike hazie ndị nyocha nweere onwe ha na-enweghị otu echekwara. Onye nhazi mkpesa na-enweta naanị akụkọ ahaziri ahazi nke amaghi aha ha, na-enweghị faịlụ ọrụ ma ọ bụ ngwaọrụ; nkewapụ a chọrọ ugbu a Claude Code ma ọ bụ API.

Usoro mmejuputa nke ọ bụla chọrọ nlele a na-arụ ọrụ, nyocha nweere onwe ya achọrọ, ma ọ bụ ha abụọ. Ngalaba nkwadebe na-ejigide nsonaazụ enyochara na akwụkwọ nnata ihe arụpụtara; ndị a anaghị eme ka à ga-asị na ule mmejuputa gbara. Iwu na-aga nke ọma naanị mgbe akwadoro ọnọdụ ọpụpụ ya n'ezie na mkpochapụ usoro nke ya. Nlele Red maka TDD ga-ada nke ọma tupu mmejuputa na nkwenye Green; ihe a na-arụ ọrụ na-efu efu ma ọ bụ oge gafere abụghị nsonaazụ Red ziri ezi.

Ndị na-emebi sekit ndabara na-akwụsị mgbe mbọ atọ dara n'otu usoro ma ọ bụ mbọ iri ise na mkpokọta. Nkwụsịtụ na-eri otu mbọ mana n'onwe ya anaghị agụta dị ka mbọ dara ada. Oke na ihe akaebe emechara na-adịgide mgbe amalitela ọzọ; Nwaa ọzọ anaghị emegharị ha. Gụọ ọdịda echekwara tupu ịnye ikike mbọ ọzọ.

Ntuziaka ndị metụtara: [Nkwenye na nyocha](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Ndị otu nyocha n'otu oge na onye nhazi mkpesa

Meghee Ntọala → Ndị otu nyocha ma chekwaa otu. Tinye ndị nyocha nweere onwe ha nwere CLI ma ọ bụ API nke ha, ụdị, mbọ ezi uche na ọkachamara, wee họrọ onye nhazi mkpesa. Họrọ otu ahụ na nhazi nyocha nke ọrụ ahụ. Onye nyocha nwekwara ike iji preset onye na-eme ihe, na Onye ahọpụtara ka dị; ọrụ nweere onwe ha ka nwere ọnọdụ dị iche iche.

Ndị nyocha na-agba n'otu oge na otu ihe akaebe ọrụ. A na-edobe akụkọ, njehie na mkpebi ọ bụla achọrọ. Onye nhazi na-enweta akụkọ nọmba amaghi aha na-enweghị aha ndị nyocha, njirimara ụdị ma ọ bụ onye na-eweta, ọdịnaya ọrụ mbụ, ohere nchekwa ma ọ bụ ngwaọrụ. Ọ na-atụnyere akụkọ ma na-eweghachi otu mkpebi ahaziri ahazi; ọ naghị eduzi nyocha isi mmalite ọhụrụ.

Nchọpụta na-egbochi ma ọ bụ ọjụjụ onye nyocha achọrọ enweghị ike iwepụ site na votu ka n'ọnụ ọgụgụ ma ọ bụ mmasị onye nhazi. Akụkọ na-efu efu ma ọ bụ mebiri emebi na-egbochi nkwado. Nyochaa nchọpụta nke ọ bụla na mkpebi mkpokọta tupu ịnakwere ma ọ bụ nye ikike mmezi. A na-edozi otu echekwara ma kpụkọọ ya maka ọsọ ahụ; idezi preset ya anaghị edegharị ihe akaebe emechara.

Onye nhazi naanị mkpesa na-eji nhazi Claude ma ọ bụ API akwadoro na-enweghị ngwaọrụ ugbu a. Codex na Antigravity ka dị ka ndị nyocha mana a jụrụ ha maka ọrụ onye nhazi dịpụrụ adịpụ ruo mgbe nkwekọrịta enweghị ngwaọrụ enyochara dị. Arịrịọ na-ekwu "ọ nweghị ngwaọrụ" naanị ezughi oke.

> Nchịkwa usoro nhazi/nyocha nke Multi-model Code na otu nyocha n'otu oge echekwara bụ njikwa dị iche iche. Debe amụma nyocha omenala ahọpụtara; echela na otu ụzọ na-eme ka njirimara nyocha ọ bụla nwee ike.

Ntuziaka ndị metụtara: [Nhazi otu nwere ụdị](../../../shared/review-team.ts) · [Mgbakọta nyocha](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Ọkachamara onye nnọchi anya na amụma arịrịọ

Ụdị bụ igwe na-arụ ọrụ; ọpụrụiche bụ profaịlụ ntuziaka. Họrọ Ọ nweghị maka enweghị ọkachamara agbakwunyere, Ọkọlọtọ maka ntuziaka ndabara, Auto maka ntuziaka dị n'ime dị mkpa, ma ọ bụ Ntuziaka maka ntuziaka ahọpụtara yana ntuziaka nke gị nwere oke. Presets nwere ike ijigide nhọrọ ahụ.

Katalọgụ mbụ na-ekpuchi ntinye koodu n'ozuzu, ụkpụrụ ụlọ, nchekwa, ntụkwasị obi, arụmọrụ, ule na ojiji interface. Auto na-eji ederede ọrụ/usoro dịnụ họrọ ntuziaka; ọ naghị akpọ ụdị ọzọ na nzuzo ma ọ bụ gbaa akaebe maka nka. Enwere ike inyocha na ịgbanwe aro nhazi tupu ịnakwere atụmatụ mmejuputa.

Ọkachamara nyocha na-enyere aka iduzi nlebara anya mana anaghị anọchi ihe akaebe nweere onwe ya, oke ohere ma ọ bụ mkpebi ahaziri ahazi. Were ntuziaka omenala dị ka akụkụ nke oke ọrụ: ejila ha gafee nnabata dọkụmentị, amụma ngwaọrụ, nyocha ma ọ bụ ọdịda ndị nyocha.

Ntuziaka ndị metụtara: [Katalọgụ arịrịọ mbụ](../../../shared/specializations.ts).

<a id="work"></a>

## Work: site na ajụjụ gaa na dọkụmentị

Work anaghị achọ Git. Ndabara na-emepụta folda ọrụ dị iche; Onye ahọpụtara na-ahọrọ folda dị ugbu a site na onye na-ahọrọ ala. Chekwaa ndepụta nhazi na-echekwa ntọala na-enweghị nkwubi okwu; Mmalite na-agba ngalaba mbụ.

Auto na-aza ozugbo ma ọ bụ na-atụpụta atụmatụ kwesịrị ekwesị nwere ezigbo Ihe a ga-eme. Brainstorm na-emepụta ideas.md tupu ị họrọ echiche ndị ọzọ ma ọ bụ nyocha. Nnyocha na-ejigide findings.md, ebe e si nweta ya na oke. Dee na-esi na ebumnuche pụọ yana, mgbe ọ bara uru, outline.md gaa na dọkụmentị nkọwa ma ọ bụ draft.md; nyocha na-ejigide ụdị gara aga.

Họrọ ntinye faịlụ site na onye na-ahọrọ ala ma zoo aka na ha na @. Ngwa na-edetuo ha dị ka ntinye ọrụ na-agbanwe agbanwe ma na-akwado njirimara ha tupu ọsọ. Ndabara na-emepụta folda ọrụ nke ngwa nwere; ohere folda Onye ahọpụtara bụ onyinye onye nwe echekwara. Ndepụta nhazi echekwara, nke a na-amalitebeghị nwere ike ịgbanwe folda ya.

Mepụta mbipụta 1–4 nwere ntọala onye na-eme ihe nweere onwe ya. Ọrụ na-eji folda na-ekpuchi ibe ha apụghị ide n'otu oge. Nhazi a metụtara ọrụ ZIAForge, ọ bụghị mmemme mpụga aka ike.

Deep Brainstorm na-adabere na ndị ọrụ nweere onwe ha atọ ma na-akwado ruo asatọ. Họrọ usoro ha na nhazi ha, gụnyere iji preset eme ihe ọzọ n'ọnọdụ dị iche iche. Ajụjụ ndị ọrụ na-ejigide mmalite ha; akụkọ mebiri emebi na-enweta otu mbọ nrụzi usoro. Ọdịda akụkụ na-anọgide na-ahụ anya kama igosi ya dị ka ọganiihu ọnụ.

Deep na-ejikọta akụkọ ndị ọrụ echekwara n'ime brainstorm_report.md ma na-arịọ mgbe niile maka mkpebi onye ọrụ. Obere nsonazụ na-emegharị akụkọ ahụ site n'aka onye nhazi; mgbanwe dị ukwuu na-amalite agba ọzọ nke ndị ọrụ kpụkọrọ akpụkọ. Ihe arụpụtara na-edobe ụdị ha.

Ọrụ ndị edoziri na-akpụkọ na okike ọrụ ma ọ bụ nchekwa ndepụta nhazi doro anya. Mgbe ọkpụkpọ mbụ gasịrị, naanị ọganihu akpaaka/nke aka nwere ike ịgbanwe; jiri ọrụ ọhụrụ maka ntọala ọrụ ma ọ bụ ụdị dị iche iche. Idezi preset zuru ụwa ọnụ anaghị agbanwe ngalaba ndị na-esote na nzuzo.

Ụdị ntuziaka na-akwụsịtụ n'etiti ngalaba ruru eru, gụnyere ndepụta Dee buru ibu. Auto nwere ike ịga n'ihu site na ndepụta ahụ. Ajụjụ, atụmatụ a na-arụ ọrụ a tụrụ aro, ntụzịaka Brainstorm na nyocha akụkọ Deep na-anọgide na-abụ mkpebi doro anya ọbụna na Auto. Nkwupụta naanị anaghị agba akaebe na nchọgharị mere, na faịlụ ọnụọgụ abụọ echekwara naanị anaghị agba akaebe ngosipụta ya.

Ntuziaka ndị metụtara: [Ụdị Work na mkpebi](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Preset, ụdị na ohere

Preset na-echekwa CLI/API, ụdị, mbọ ezi uche na ikike. Ala nkata nwere ngalaba preset, CLI, ụdị na nhọrọ. Onye ahọpụtara na-arụ ọrụ na-enweghị preset; Mepụta preset na-echekwa nhọrọ dị ugbu a.

Katalọgụ ahụ sitere na CLI ma ọ bụ API arụnyere ahọpụtara ebe akwadoro ya. Mee ka ọ dị ọhụrụ na-emelite ndepụta ahụ na-enweghị ịgbanwe nhọrọ ahụ. Ọ bụrụ na nchọpụta adịghị, tinye ID ụdị doro anya; onye na-eweta ga-akwadokwarịrị ya. Ọkwa ezi uche dabere na ụdị na CLI. Ndabara onye na-eweta dị iche na akara none doro anya.

Tinye mgbanwe naanị mgbe nkwenye backend gasịrị. Amachibidoro ịgbanwe n'oge ntụgharị na-arụ ọrụ ma ọ bụ ahịrị na-abụghị nke efu. Ndepụta nhazi na akụkọ ihe mere eme a na-ahụ anya na-adịgide, mana ịgbanwe ndị na-eweta anaghị ebufe ọnọdụ ime ha nkeonwe.

Na Forge, akara ọrụ dị mkpa: nkwadebe nwere ike iji Onye Nhazi dị iche. Ala na-agbanwe ọrụ egosiri; a na-ahọrọ ndị nyocha na ndị enyemaka na ntọala usoro ọrụ. Enwere ike ịkpọchi atumatu maka mmejuputa enyochalarị.

Ikike dị iche n'etiti ndị na-eweta. Naanị ịgụ na Ebe ọrụ ide dị ebe ihe nkwụnye na-akwado ha. Antigravity na-eji ntọala CLI ala ma ọ bụ ohere zuru oke ahọpụtara nke ọma. Ohere zuru oke abụghị igbe ájá.

Ọkachamara na-agbakwunye nduzi arịrịọ, ọ bụghị ụdị ọzọ ma ọ bụ ikike. Preset na ọrụ na-akwado Ọ nweghị, Ọkọlọtọ, Auto na Ntuziaka. Auto na-ahọrọ profaịlụ site na ederede usoro na-enweghị oku ụdị ọzọ; Ntuziaka na-anabata ruo ọpụrụiche anọ na ntuziaka omenala. Enwere ike idezi ọrụ ndị Onye Nhazi tụrụ aro tupu ịnakwere atụmatụ ahụ.

ID ụdị ma ọ bụ mbọ ejiri aka tinye ka bụ nhọrọ gị, mana onye na-eweta nwere ike ịjụ ya. Idezi preset zuru ụwa ọnụ anaghị agbanwe nkata na-agba ọsọ ma ọ bụ atụmatụ a nabatara n'oge gara aga. Iji kpachapụ anya gbanwee mkparịta ụka na-adịghị arụ ọrụ, jiri njikwa nhazi nke ya ma chere nkwenye. Ekwesịrị ịgụ nhọrọ nwere nkwarụ dị ka ike ma ọ bụ oke usoro ndụ, ọ bụghị ịgafe ya site na idezi JSON echekwara.

Ntuziaka ndị metụtara: [Ikike onye na-eweta](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Nkata, Kwụsị na ahịrị

Taabụ mepere emepe, Nke na-adịbeghị anya na ndepụta nhazi bụ nke otu ọrụ. Mmechi taabụ na-ewepụ ya na Meghee mana na-edobe ya na Nke na-adịbeghị anya ma ọ naghị akwụsị usoro onye na-eweta ya ma ọ bụ usoro ọrụ a na-achịkwa. Chọọ akụkọ ihe mere eme, meghee nkata ọzọ ma ọ bụ mechie taabụ niile agbakwunyere na menu akụkọ ihe mere eme.

Kwụsị na-akwụsị ntụgharị dị ugbu a. Chere ka nkwụsị mechaa tupu Zipu ọzọ: nkwenye nkwụsị abụghị mmecha usoro. Ị nwere ike pịnye ndepụta nhazi na-esote ka ọ dị ugbu a.

Na nkata nkịtị, Ahịrị na-echekwa arịrịọ na-esote iche na ndepụta nhazi dị ugbu a. Kwụsịtụ ahịrị na-ejide nnyefe ọzọ. Kwụsị na Pụọ na-akwụsịtụ ahịrị ahụ. Mgbe mmalitegharị gasịrị, Malitegharịa buru ụzọ, wee Gaa n'ihu n'ahịrị n'ụzọ doro anya.

Ejighị n'aka pụtara na amataghị nnyefe. A naghị eziga ozi dị otú ahụ na akpaaka: nyochaa akụkọ ihe mere eme, detuo ederede ma ọ bụrụ na o kwesịrị ma wepụ ihe dị n'ahịrị ahụ. Iziga ya ọzọ bụ arịrịọ ọhụrụ kpachapụrụ anya.

Nkata ngalaba a na-achịkwa na-eji usoro ọrụ ha, ọ bụghị ahịrị nkịtị. Soro ogbo na-egosi ngalaba dị ugbu a; iji aka họrọ taabụ ọzọ na-akwụsị isochi. Ndekọ CLI na-egosi nchọpụta iche na azịza ya.

Azịza Markdown na-egosipụta isiokwu, ndepụta, tebụl, njikọ na koodu e mechiri emechi. Kaadị ngwaọrụ na nchọpụta CLI na-anọpụ iche na azịza ya. Echiche nke ụdị kọrọ na ọnụ ọgụgụ akara na-apụta naanị mgbe onye na-eweta wepụtara ha n'ezie; ekwubila echiche nzuzo ma ọ bụ ojiji site na ngosi mmegharị.

Mgbe izipu ma ọ bụ nkwenye ahịrị na-ejighị n'aka gasịrị, nyochaa akụkọ ihe mere eme ma nwaa naanị otu arịrịọ echekwara ebe enyere ya. Nnata ahịrị pụtara na ebe nchekwa nabatara ihe ahụ, ọ bụghị na nkwubi okwu agwụla. Wepụ ihe dị n'ahịrị na-ejighị n'aka naanị dị ka nchụpụ doro anya; ọ pụghị ịweghachi arịrịọ e zigagoro.

Ntuziaka ndị metụtara: [Ahịrị ozi na-adịgide adịgide](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Faịlụ, Git na mmecha

Faịlụ na-egosi folda ọrụ. Tụlee nsonaazụ na ihe achọrọ, meghee dọkụmentị ma nyochaa ọdịiche. Idobe faịlụ ọnụọgụ abụọ anaghị agba akaebe maka ngosipụta ziri ezi na ngwa ebumnuche ya.

Git na-enye ọnọdụ, mgbanwe na ọrụ yana nsonaazụ edere. Ntinye, njikọta na mbubata bụ nke aka site na ndabara; ọrụ akpaaka bụ nhọrọ dị iche iche maka atụmatụ enyochara nke ọma.

Agbanwela faịlụ na-arụ ọrụ n'etiti nkwenye na mbipụta: ejikọtara nkwado na baiti ziri ezi. Esemokwu, mbubata dara ada na nsonaazụ ọrụ amaghị na-egbochi ọganihu ruo mgbe mkpebi doro anya. Auto anaghị enye ikike ibipụta na nzuzo.

Work anaghị emepụta alaka Git ọ bụla ma enweghị nmecha Git. Debe dọkụmentị achọrọ site na folda ahọpụtara, gụnyere ụdị na ebe e si nweta ha.

Onye nchịkọta akụkọ faịlụ na-enye syntax site na ndọtị, nchọta na nnọchi, akụkọ ihe mere eme nke mmeghari, mkpuchi ahịrị na ndepụta nhazi kwa taabụ. Nchekwa na-echekwa koodu UTF-8/UTF-16 akwadoro ma na-ajụ esemokwu mgbanwe mpụga. Koodu ndị ọzọ na ọdịnaya ọnụọgụ abụọ chọrọ onye nchịkọta akụkọ mpụga. Ndepụta nhazi a na-echekwaghị na-egbochi ngwa Ịpụ ruo mgbe onye nwe ya chekwara ma ọ bụ tụfuo ha.

A na-enyere syntax zuru ezu aka ruru 8 MiB. Faịlụ ederede buru ibu na-emepe na windo 256 KiB; Enwere ike ibunye 8–64 MiB n'uju na-enweghị syntax. N'elu 64 MiB jiri ndezi windo na nchọta egwuregwu na-esote nwere oke. Nke a bụ ụdị faịlụ buru ibu nwere oke, ọ bụghị nhata Sublime Text maka dọkụmentị buru ibu n'ụzọ aka ike.

Meghee folda na-eji ọnọdụ ọrụ dị ugbu a ma ọ bụ alaka/worktree, kama imepe naanị ebe nchekwa mbụ na nzuzo. Ahịrị faịlụ nwere ike ikpughe ndekọ nne na nna nke faịlụ ahụ. Backend na-akwado ụzọ megide onyinye ọrụ edebanyere aha. Faịlụ ọnụọgụ abụọ anaghị edezi dị ka ederede doro anya; jiri ihe nlere ebumnuche ha ma dowe baiti mbụ.

Mwepụ Worktree bụ omume nchebe dị iche. Kwụsị nnọkọ ahaziri ahazi na ọnụ na-ejikọta tupu iwepụ ya, gụnyere nnọkọ na-adịghị arụ ọrụ. Nyochaa nsonaazụ Git echekwara na ọnọdụ mgbake; ihichapụ ndekọ ọrụ abụghị ihe ngbanwe maka ichekwa ọrụ a na-etinyebeghị n'enweghị nsogbu.

Ntuziaka ndị metụtara: [Nkwekọrịta onye nchịkọta akụkọ ụdị](../../../shared/editor.ts) · [Atumatu Git](../../WORKFLOWS.md).

<a id="api"></a>

## Njikọ API

Njikọ na-agbakwunye ebe nkwụsị API ahọpụtara nke ọma. Tinye aha, URL ntọala, ihe nlereanya na igodo ma ọ bụrụ na achọrọ ya. Họrọ Chat Completions maka njikọ dị adị dakọtara, Nzaghachi maka usoro ọrụ na mgbasa ozi onye na-eweta, ma ọ bụ Anthropic Messages nwere Claude Connector v1 maka njikọ ahụ. Njikọ ndị dị adị na-ejigide Chat Completions ruo mgbe ị gbanwere ha n'ụzọ doro anya. Maka njikọ dị adị, Hazie Nzaghachi na-emepe edemede maka otu ebe nkwụsị ahụ; nyochaa profaịlụ wee pịa Chekwaa njikọ. Họrọ njikọ Codex, Grok Connector v1 ma ọ bụ Claude Connector v1 naanị maka ọnụ ụzọ ámá na-akwado ndọtị ahọpụtara. A na-ejigide igodo echekwara mgbe a gbanweghị ebe nkwụsị ma oghere igodo na-adị oghere.

A chọrọ HTTPS ma e wezụga maka HTTP loopback. Jiri ebe nkwụsị dị larịị na-enweghị asambodo, ajụjụ ma ọ bụ iberibe. A jụrụ ntụgharị ọzọ. Igodo na-eji izo ya ezo OS akwadoro ma anaghị eweghachi ya na UI. Ịgbanwe ebe nkwụsị chọrọ itinyegharị ma ọ bụ ikpochapụ igodo ya. Ịhapụ oghere igodo na-echekwa igodo echekwara.

Ngwaọrụ faịlụ ebe ọrụ na-arụ ọrụ na nchekwa ọrụ mpaghara emeziri na azụ, nwere ụzọ ndị metụtara yana nlele megide ngafe na njikọ. Edemede faịlụ ọ bụla chọrọ nkwado doro anya yana nlegharị anya a tụrụ anya ya agbanwebeghị. Oge naanị-ọgụgụ na-ekpughe naanị ngwaọrụ ọgụgụ. Na Nzaghachi na ọnọdụ onye na-akpọ oku Claude, Kwe ka iwu mpaghara na-enyere aka iche iche n'ịkpọ oku nwere ike ime/arụmụka akwadoro na macOS na Linux. Nlekọta iwu adịghị na Windows; ihe nkwụnye anaghị akpọsa ngwaọrụ ahụ n'ebe ahụ. Iwu na-achọ nkwado onye nwe mgbe niile ma ọ bụghị igbe ájá sistemụ arụmọrụ.

Profaịlụ njikọ Codex na-akọwapụta ndọtị ọganihu ngwaọrụ Nzaghachi nke ọnụ ụzọ ámá ahụ. Ngwaọrụ ndị na-eweta obodo na-arụ ọrụ na sava ahụ, iche na ngwaọrụ onye na-akpọ oku na kọmputa gị. Ikike naanị-ọgụgụ nke mpaghara anaghị egbochi sava ahụ. Enweghị ike ịhọrọ njikọ maka onye nhazi akụkọ naanị nke chọrọ ka agbanyụọ ngwaọrụ niile: ikewapụ na-akwadoghị na-ada kama ịhapụ ngwaọrụ obodo na nzuzo. Họrọ ebe nkwụsị nke nwere ike ịmanye amụma achọrọ.

Nsonaazụ PNG, JPEG na WebP emepụtara na-apụta dị ka kaadị onyonyo dị iche, nwere Chekwaa onyonyo, n'èzí mmepụta ngwaọrụ adakpọrọ. A na-akwado onyonyo ma na-edebe ha na nchekwa ngwa nzuzo; anaghị eweghachi URL nke ihe nlereanya nyere yana onyonyo Markdown na akpaghị aka. Imepe akụkọ echekwara, ịnwale ọgụgụ onyonyo ọzọ na ịchekwa onyonyo echekwara anaghị arịọ ọgbọ ọhụrụ. A na-ejedebe nsonaazụ na 32 MiB na nde pikselụ 32 n'otu onyonyo, nwere ebe nchekwa mgbasa ozi nzuzo 512 MiB ekekọrịtara. Chekwaa onyonyo achọrọ tupu iji aka kpochapụ ebe nchekwa nzuzo ma ọ bụrụ na ọ juru. Pịa onyonyo nkata iji mepee ihe nlere onyonyo. Bugharịa nso ma ọ bụ pụọ, họrọ Nha n'ezie (100%) ma ọ bụ Mee ka dabara na windo, ma dọrọ iji nyochaa nkọwa. Escape ma ọ bụ Mechie ihe nlere onyonyo na-alaghachi na nkata. Ikiri na mbugharị na-ejikwa onyonyo nzuzo ebugoro; ha anaghị arịọ ọgbọ ọhụrụ.

Mkparịta ụka Nzaghachi na-ejigide njirimara nzaghachi anabatara yana ID oku ọrụ ziri ezi. Anaghị eziga ntinye ndị akwụsịrị na akpaghị aka. Ndezi ma ọ bụ iwu mpaghara na-ejighị n'aka anaghị agba ọsọ ọzọ mgbe emechara malitegharịa; chekwaa akụkọ ihe mere eme ma mepụta ọnọdụ ọhụrụ n'ụzọ doro anya mgbe nyochachara. Mgbanwe na njem ma ọ bụ ebe nkwụsị echekwara chọrọ nhazigharị doro anya. A na-akọ akụkọ banyere ọnọdụ onye na-eweta, nkagbu na mmebi oge na-enweghị izochi ha n'azụ nkwado CLI. Isi nkata na-egosi usoro iwu agbakwunyere na ọsọ ahụ. Mgbe ị chekwasịrị mgbanwe njikọ, mepee ihe nhọrọ CLI / API nke nkata ahụ wee pịa Tinye, ọ bụrụgodị na ahọpụtaralarị otu njikọ ahụ. Nke a na-emepụta ọsọ ọhụrụ nwere nhazi echekwara ma na-ejigide akụkọ nkata. Ịchekwa njikọ naanị anaghị ebugharị nkata na-arụ ọrụ. Njikọ onyonyo ederede naanị nke ochie na-anọgide na ederede; ịgbanwe usoro iwu anaghị ewepụta ọzọ ma ọ bụ bubata nsonaazụ gara aga.

Njikọ API na-eji ebe nkwụsị ha ahaziri na nkwenye, iche na ndenye aha CLI nke ala. Ụfọdụ ọnụ ụzọ ámá na-eji ndenye aha n'ime; ZIAForge anaghị edegharị nkwenye ala n'ime API. Ụdị, amụma ngwaọrụ, parampat echiche na ịgba ụgwọ dabere na ebe nkwụsị. Nchọpụta naanị anaghị egosi nkwubi okwu. Debe igodo na Njikọ, ọ bụghị na ederede ọrụ ma ọ bụ nseta ihuenyo.

Maka Grok Connector v1, chekwaa njikọ Nzaghachi doro anya wee jiri Nyochaa njikọ gụọ ikike ya akpọsara, ụdị na ojiji na-enweghị ịgba ọsọ nkwubi okwu. Ọkwa echiche ihe nlereanya na nhọrọ windo gburugburu na-abịa site na katalọgụ. Oke ntụgharị ala nke nhọrọ bụ 1–100. Pasentị oke na-efu na-anọgide na-amaghị; njedebe oge ojiji abụghị ịkwụ ụgwọ ndenye aha ma ọ bụ ụbọchị njedebe. Tinye mgbanwe njikọ na nkata ọ bụla dị adị tupu ha arụ ọrụ n'ebe ahụ.

Ajụjụ Grok na-apụta dị ka kaadị nwere ajụjụ ala na aha nhọrọ ziri ezi. Họrọ azịza ndị a rịọrọ ma ọ bụ tinye nzaghachi omenala, wee zipụ otu ugboro. Ajụjụ ọnụ atụmatụ nwere ike inye mkparịta ụka ma ọ bụ mebie omume. Kaadị ikike onye na-eweta na-egosi nhọrọ ala ziri ezi ma chọọ nhọrọ gị na ndabara. Ndị a dị iche na nkwado faịlụ/iwu mpaghara. Kwụsị, ngwụcha ma ọ bụ malitegharịa na-eme ka kaadị ochie ghara ịrụ ọrụ; a naghị emegharị ntinye na-ejighị n'aka na akpaghị aka.

Na Njikọ, njikọ Grok nwere ike ime ka Kwado ikike onye na-eweta otu oge na akpaghị aka; a gbanyụrụ ya na ndabara. Nke a na-emetụta nkata ọhụrụ ma ọ bụ nkata dị adị mgbe i jiri Tinye hazigharịa ya n'ụzọ doro anya. Ịchekwa njikọ naanị anaghị agbanwe nkata na-agba ọsọ. Mgbe agbanyere ya, ZIAForge na-eziga na akpaghị aka naanị otu ikike na-enweghị mgbagha, nke na-akwụsịbeghị otu oge nke Grok nyere ma na-edekọ mkpebi akpaghị aka ahụ tupu iziga ya. Kaadị ahụ na-achọpụta nkwado akpaaka. Ajụjụ na nkwado faịlụ ma ọ bụ iwu mpaghara ka chọrọ azịza gị. Nkata naanị-ọgụgụ na-edobe ikike onye na-eweta aka. A naghị ahọpụta ikike na-adịgide adịgide na akpaghị aka; nhọrọ otu oge na-efu ma ọ bụ na-edoghị anya na-anọgide na-abụ nke aka. A naghị akpọgharị ntinye ochie ma ọ bụ nke na-ejighị n'aka ma ọ bụ nwalegharịa na akpaghị aka.

Na nkata Grok, bọtịnụ mgbakwunye na-emepe ihe nhọrọ sistemụ maka PNG, JPEG na WebP. A na-ekwe ka onyonyo anọ n'otu ozi, ruru 16 MiB nke ọ bụla yana 20 MiB jikọtara ọnụ, nwere nde pikselụ 32 n'otu onyonyo. Ndepụta mbipụta nzuzo nwere mmefu ego 128 MiB ma bụrụ nke oge nkata ahụ. A na-ebuga ha naanị mgbe ị zipụrụ. Nzipu dara ada ma ọ bụ nke na-ejighị n'aka na-ejigide njirimara mbipụta ha. Ozi onyonyo enweghị ike iji ahịrị ederede naanị. Wepụ ma ọ bụ tụfuo edemede onyonyo na-echere tupu ị gbanwee ma ọ bụ malitegharịa ọsọ ya; ịtụfu edemede anaghị ewepụ ozi ezigaralarị. Ozi onyonyo anabatara na-ejigide kaadị onyonyo nzuzo maka nyocha oge ọzọ, mbugharị na nchekwa.

A machibidoro ngwaọrụ ndị na-eweta Grok na nchọta weebụ akwadoro, onyonyo, ajụjụ mmekọrịta yana ọgbọ vidiyo nwere ikike. Ngwaọrụ ọrụ mpaghara ka na-arụ ọrụ na kọmputa na nchekwa ọrụ azụ ahọpụtara. Nyocha naanị-ọgụgụ na-ewepu ọgbọ na ndezi onyonyo/vidiyo nke onye na-eweta, ajụjụ, ederede mpaghara na iwu. Oge Enyemaka na-enweghị ngwaọrụ yana oge onye nlekọta akụkọ naanị enweghị ike iji profaịlụ njikọ a. Anaghị enye ọgbọ ọdịyo, ntụgharị okwu na olu oge; MP4 nwere ike ịnwe ụzọ ọdịyo ya nkịtị. Ngwaọrụ achọpụtara naanị abụghị ihe akaebe nke nsonaazụ nwere ike iji.

Maka vidiyo, jiri nkata Grok nwere ike ide, tinye onyonyo ntụaka ma ọ bụ gaa n'ihu na nkata mepụtara otu, ma kọwaa mmegharị ahụ na parampat achọrọ. Iji họrọ onyonyo ochie n'ụzọ doro anya, jiri Chekwaa onyonyo wee tinye faịlụ echekwara. Ikiri ma ọ bụ chekwaa onyonyo anaghị ewepụta ya ọzọ. Enweghị fọm parampat vidiyo dị iche: arịrịọ ahụ na-eji mkparịta ụka ahụ na kaadị ajụjụ/ikike nke ya. Tupu ntụgharị onye ọrụ ọhụrụ, ZIAForge na-enyere naanị ngwaọrụ vidiyo aka nke njikọ ahụ na-akpọsa dị ka ndị dịnụ, ndị agbanyere na ndị enyochara. Ọdịda nchọpụta na-ahapụ vidiyo adịghị maka ntụgharị ahụ. Mgbanwe na ikike nke ala nwere ike ịmalite ọnọdụ ọhụrụ nke onye na-eweta ya na akụkọ ihe mere eme gị a na-ahụ anya yana onyonyo echekwara tozuru etozu mgbe ị na-ejigide nkata mpaghara; anaghị akpọgharị arụmọrụ akwụsịrị. Ọ bụrụ na onyonyo enweghị ike iru oke mgbakwunye, nyefe na-akọ nkwụsị ahụ; tinye ntụaka e bu n'obi n'ụzọ doro anya.

Njikọ ahụ na-enye image_to_video nwere onyonyo ntụaka achọrọ, sekọnd 6 ma ọ bụ 10 yana ntọala 480p/720p. Ụdị reference_to_video ya na-akwado sekọnd 1–15 yana nha akụkụ 1:1, 16:9, 9:16, 4:3, 3:4, 3:2 ma ọ bụ 2:3; onye ọrụ nwere ike ibu ụzọ mepụta ntụaka mgbe achọrọ ya. Rịọ ntọala ndị e bu n'obi na nkata. ZIAForge anaghị ekpughe ebe nkwụsị dị iche /grok/media ma ọ bụ ihe nhọrọ akpaaka ya. Nhazi mbụ na parampat akwadoro bụ ikike onye na-eweta, ọ bụghị nkwa nke ịdị elu pikselụ ziri ezi, oge etiti ma ọ bụ nsonaazụ nka ọ bụla.

Vidiyo Grok zuru ezu na-apụta naanị mgbe ebudatara faịlụ MP4 echekwara wee lelee MIME, nha, SHA-256 na nhazi ya. Ederede na-ekwu na vidiyo adịla njikere, onyonyo mberede ma ọ bụ njikọ nchekwa abụghị vidiyo a na-egwu egwu. Njehie na-anọgide na-ahụ anya na-enweghị ịrịọ ọgbọ nnọchi. Jiri njikwa kaadị vidiyo kpọọ, kwụsịtụ, chọọ ma ọ bụ gbanwee ụda mgbe ọ dị. Ọkpụkpọ anaghị amalite na akpaghị aka. Chekwaa vidiyo na-emepe igbe okwu ebe sistemụ. Akụkọ nkata echekwara na-ejigide MP4 nzuzo mgbe ngwa mechiri/malitegharịa kpamkpam; ịkpọ egwu na nchekwa na-eji bayịtị mpaghara na-enweghị nkwubi okwu ma ọ bụ nbudata onye ọzọ na-eweta. A na-ejedebe vidiyo na 128 MiB nke ọ bụla n'ime ebe nchekwa mgbasa ozi 512 MiB nkekọrịta. Chekwaa mgbasa ozi achọrọ tupu iji aka kpochapụ ebe nchekwa zuru oke. Kọmputa ga-akwadoro koodek vidiyo; faịlụ ndị anaghị akwado ma ọ bụ mebiri emebi na-egosi njehie.

Maka Claude Connector v1, họrọ Anthropic Messages wee tinye mmalite HTTPS nke njikọ ahụ na-enweghị /v1. Chekwaa, wee Nyochaa njikọ iji gụọ ngwaọrụ akpọsara, nhọrọ ihe nlereanya, ọnọdụ na ojiji na-enweghị nkwubi okwu. Họrọ igbu oge onye na-akpọ oku ma ọ bụ nke onye na-eweta, nhọrọ ngwaọrụ ala doro anya, ọnọdụ ikike ala, njedebe ntụgharị/mmepụta yana njikwa echiche akwadoro; atụmatụ mmepụta JSON nhọrọ na ọnọdụ akụkọ ihe mere eme oyi dịkwa. Ntọala ndabara na-eji ọnọdụ onye na-akpọ oku, ikike ala aka yana enweghị ngwaọrụ ala. Ụkpụrụ ojiji na-efu ka amabeghị; nrụpụta ojiji abụghị ụbọchị ịkwụ ụgwọ ma ọ bụ ụbọchị njedebe ndenye aha. Igodo API nke njikọ ahụ ka dị iche na nkwenye ndenye aha nke ala ya. Tinye mgbanwe echekwara na nkata ọ bụla dị adị tupu ha arụ ọrụ n'ebe ahụ.

Ngwaọrụ onye na-akpọ oku Claude na-arụ ọrụ na nchekwa ọrụ mpaghara yana nkwado dị iche iche maka ide na iwu akwadoro. Naanị WebSearch na WebFetch ahọpụtara nke ọma nwere ike na-agba ọsọ na ọnọdụ onye na-akpọ oku. Ọnọdụ onye na-eweta obodo na-agba ọsọ ngwaọrụ ahọpụtara na oghere ọrụ nkesa nke njikọ ahụ ma ghara ịnye faịlụ mpaghara ma ọ bụ ngwaọrụ iwu. Ịkọwa nchekwa mpaghara na nkesa anaghị enye ohere ịbanye na ya. Oge naanị-ọgụgụ na-ajụ ndezi ala ma ọ bụ ngwaọrụ enwere ike ime; oge na-enweghị ngwaọrụ na-amachibido ngwaọrụ ala ọ bụla. Kaadị ọganihu ngwaọrụ nkesa anaghị eme ihe dị n'ime ya na kọmputa. Nnweta ngwaọrụ ala na ọnọdụ ikike ala bụ ntọala dị iche iche.

Kaadị ikike obodo Claude chọrọ mkpebi ikwe ka ma ọ bụ ịgọnarị doro anya mgbe achọrọ ya. Ha enweghị ike dochie ntinye ngwaọrụ ma ọ bụ nye nkwado faịlụ/iwu mpaghara. Ajụjụ na-egosi ederede enyere na iwu nhọrọ; họrọ azịza ma ọ bụ tinye nzaghachi omenala, wee nyefee otu ugboro. Nhọrọ ikike akpaaka Grok anaghị emetụta Claude. Ọgwụgwụ oge, Kwụsị, malitegharịa ma ọ bụ nnyefe na-ejighị n'aka na-eme ka kaadị ochie ghara ịrụ ọrụ. Ịga n'ihu na-ejigide nzaghachi nke aka ya na nhazi a phiniri; arịrịọ ndị akwụsịrị, ngwaọrụ na azịza anaghị akpọgharị. Ọnọdụ gburugburu ebe obibi nke akụkọ ihe mere eme oyi bụ mbubata na-efunahụ nke doro anya, ọ bụghị mgbake nke nnọkọ ala. Kwụsị na-akagbu ọrụ nke ya mgbe amatara nzaghachi ya; ọ naghị emebi mmetụta ndị mechara ma ọ bụ kwụsị ọrụ na-enweghị njikọ. Nkagbu na-ejighị n'aka na-anọgide na-ahụ anya.

Na nkata Claude, ndị na-ahọrọ mgbakwunye sistemụ na-anabata onyonyo PNG, JPEG, GIF na WebP, akwụkwọ ederede PDF na UTF-8. Onye na-ede ihe nwere oghere mgbakwunye anọ ekekọrịtara. Onyonyo na PDF na-enye ohere 16 MiB nke ọ bụla; akwụkwọ ederede na-enye ohere 1 MiB. Onyonyo na-enye ohere nde pikselụ 32. Ndepụta onyonyo na ndepụta akwụkwọ ọ bụla na-enye ohere 20 MiB jikọtara ma nwee mmefu ego nchekwa nzuzo 128 MiB dị iche. Arịrịọ ahụ nwekwara oke ngbanwe jikọtara ọnụ 32 MiB, yana ibu arịrịọ ezoro ezo nwere ike ibelata ya. Mbipụta nzuzo bụ nke oge nkata ugbu a ma na-ebufe naanị mgbe ị zipụrụ. Nzipu dara ada ma ọ bụ nke na-ejighị n'aka na-ejigide njirimara mbipụta ha; ozi mgbakwunye enweghị ike ịbanye na ahịrị ederede naanị. Wepụ ma ọ bụ tụfuo mgbakwunye na-echere tupu ị gbanwee ma ọ bụ malitegharịa ọsọ ahụ. Onyonyo anabatara na-adị maka nlele na nchekwa nzuzo; anaghị etinye akwụkwọ dị ka PDF ma ọ bụ HTML.

Ngwaọrụ nkesa Claude nwere ike ịmepụta faịlụ enwere ike ibudata. Kaadị faịlụ na-apụta naanị mgbe ebudatara ọdịnaya ya echekwara wee lelee MIME, nha ziri ezi yana SHA-256 ya. Ọ na-anọ n'èzí mmepụta ngwaọrụ adakpọrọ ma na-egosi aha, nha, ụdị yana nlegharị anya ma ọ bụ metadata nnọchi ewepụtara. Jiri Chekwaa họrọ ebe na igbe okwu sistemụ. Ụdị ọhụrụ na-adịghị agbanwe agbanwe na-eme ka ụdị mbụ dịnụ. Faịlụ na-enye ohere 128 MiB nke ọ bụla n'ime ebe nchekwa ihe arịa nzuzo 1 GiB dị iche; chekwaa faịlụ ndị achọrọ tupu iji aka kpochapụ ebe nchekwa zuru oke. Akụkọ ihe mere eme echekwara na nchekwa anaghị arịọ nkwubi okwu ma ọ bụ nbudata ọzọ. Kaadị ihe arịa niile bụ Chekwaa naanị, gụnyere PDF; HTML, SVG na usoro amaghị na-anọgide na nbudata izugbe ma anaghị egbu ha mgbe ọ bụla. URLs na onyonyo Markdown nke ihe nlereanya nyere anaghị eweghachi na akpaghị aka. Faịlụ ndị ngwaọrụ nkesa mere anaghị egosi foto, vidiyo, ọdịyo ma ọ bụ ọgbọ okwu Claude.

Ntuziaka ndị metụtara: [Njikọ API](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md) · [Claude Connector v1](../../CLAUDE_CONNECTOR_V1.md).

<a id="settings"></a>

## Ntọala, asụsụ na nrụpụtaghachi dị nchebe

Ntọala izugbe na-ahọrọ ebe ọrụ, asụsụ interface na ndabara. Njikọ na-ejikwa ebe njedebe API. Preset na Ndị otu nyocha na-ejigide nhazi ọrụ. Nchịkwa dịpụrụ adịpụ na-ejikwa asambodo mpaghara, oke sava na ikike onye nwe ya; Mmelite na-ejikwa ebe / ọwa mwepụta. Maka na-egosi ezigbo owuwu na-agba ọsọ.

Asụsụ interface dị iche na asụsụ ozugbo yana ọnọdụ nyocha akwụkwọ. Aha ngwaahịa, ID iwu, ndọtị faịlụ, ID ihe nlereanya onye na-eweta yana aha onye ọrụ mepụtara na-anọgide dị ka ihe njirimara. Enyemaka na-agbaso asụsụ interface ahọpụtara mgbe nsụgharị dị ugbu a dị; a na-akpọ nsụgharị igwe akara ma Bekee ka bụ ntụaka a kwadoro.

Chekwaa na-emetụta nhazi egosipụtara. Ntọgharị nchekwa data ma ọ bụ ntọgharị ụlọ ọrụ nwere ike iwepụ metadata ngwa; chekwaa faịlụ yana nkwado a nwalere tupu ị jiri ntọgharị n'ama ama. Ọrụ ndị a bụ omume onye nwe mpaghara. Ejila ha dị ka ụzọ mkpirikpi iji nyochaa usoro ọrụ dara ada ma ọ bụ ndekọ mebiri emebi.

Ntuziaka ndị metụtara: [Ntuziaka ime obodo](../../LOCALIZATION.md) · [Mgbake data](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Jụọ onye inyeaka Enyemaka

Mepee Enyemaka, họrọ nhazi jikọrọ echekwara na panel onye inyeaka ya ma jụọ maka ZIAForge. Azịza na-eji ntuziaka Bekee a kwadoro ugbu a yana asụsụ interface ị họọrọ. Bọtịnụ ntụaka ngalaba na-emepe isiokwu ntuziaka dị mkpa, ka ị nwee ike iji nkọwa tụnyere ntụaka.

Onye inyeaka a na-edebe mkparịta ụka nzuzo dị iche nke ruru ihe ntinye echekwara 100 yana 3 MiB. Tinye ajụjụ ruru ihe odide 12,000; Zipu na-ajụ ya, Kwụsị na-akagbu azịza na-arụ ọrụ mgbe ọ ka na-edebe ajụjụ gị, yana Hichapụ na-ewepụ mkparịta ụka Enyemaka a. Ndepụta gị a zighị na nhọrọ nhazi na-adịgide ma ị mechie ma ọ bụ mepeghee Enyemaka n'otu nnọkọ ngwa ahụ, mana echekwaghị ndepụta ahụ na diski. Onye inyeaka anaghị eziga iwu ngwa, gbanwee usoro ọrụ ma ọ bụ kwado ọnụ ụzọ. Ndụmọdụ abụghị nkwenye dị ndụ nke ọrụ, akaụntụ ma ọ bụ njikọ mpụga.

Nnọkọ Enyemaka Claude Code na API na-amanye amụma anaghị akwado ngwaọrụ. Nnọkọ Enyemaka Codex na Antigravity nna chọrọ ikike kọmputa nna nke onye nwe mpaghara dị adị. Ọ bụrụ na agbanyụrụ ya, ngwa ahụ na-akọwa ihe achọrọ kama ịhọrọ onye na-eweta ọzọ. Naanị onye nwe ya nwere ike ịgbalite ya na ntọala njikwa mpaghara; onye inyeaka enweghị ike ịgbalite ya n'onwe ya.

Enyemaka Codex na-eji sandbox na-agụ naanị ihe ma na-ajụ arịrịọ nkwado ngwaọrụ. Antigravity na-eji usoro atụmatụ yana ọkọlọtọ sandbox nna ya. Ụdị nna ndị a abụghị nkwa zuru ụwa ọnụ nke mgbochi sistemụ arụmọrụ. Hash ntuziaka mmalite na-akọwapụta ntụaka ejiri maka azịza ahụ; nkọwa ewepụtara nwere ike ịbụ nke mehiere, yabụ nyochaa ngalaba jikọtara ya tupu ime ihe. A na-akara azịza ochie akara mgbe ụdị ntuziaka mmalite ha dị iche na ntuziaka dị ugbu a.

Ntuziaka ndị metụtara: [Ntuziaka a kwadoro na mmezi nsụgharị](../../HELP_MAINTENANCE.md) · [Onye inyeaka ngwa na ikike](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Onye inyeaka na Telegram

Onye inyeaka na-eji nhazi echekwara ahọpụtara yana otu API njikwa ngwa ahụ. Ikike inyocha ọnọdụ yana ikike ịrụ ọrụ dị iche. Nyochaa iwu na nsonaazụ: nkọwa onye inyeaka abụghị ihe akaebe na arụchara ihe omume.

Naanị onye nwe mpaghara nwere ike ịgbalite Telegram, jiri token bot dị adị yana ọnụọgụ ID nke onye nwe ya. Njikwa bụ maka nkata nzuzo nke onye nwe ya ahụ. Bot a hazighị ma ọ bụ nke anaghị arụ ọrụ agaghị anata ozi ngwa ọ bụla.

Etinyela token bot n'ime nkata nkịtị. Ịhazi njikọ ahụ anaghị egosi na Telegram jikọrọ ma ọ naghị emepụta bot na-akpaghị aka. Nseta ihuenyo na azịza nwere ike ịnwe data ebe ọrụ nzuzo.

Họrọ nhazi onye inyeaka ma nye ikike ịrụ ọrụ ngwa iche site na nyocha. Mgbakọta onye inyeaka Codex na Antigravity chọrọ ikike kọmputa nna nke onye nwe ya; a naghị eji nwayọọ were nnọkọ API ma ọ bụ Claude na-enweghị ngwaọrụ dochie ha. Enwere ike igosipụta nseta ihuenyo na mkparịta ụka onye inyeaka, mana ntinye ihe nlereanya dị ugbu a anaghị agụnye nyocha foto. Echela na onye inyeaka jiri anya nyochaa foto naanị n'ihi na o gosipụtara ya.

Onye inyeaka nwere ike inyocha nchịkọta, ọrụ, nkata, ọnọdụ usoro ọrụ, gburugburu usoro na windo ngwa site na ngwaọrụ a pịnyere ụdị ha. Ọ nwere ike ịgbanwe ntọala nkịtị enyere ikike ma bido ọrụ ngwa enyere ikike. Ọ nweghị ike inye ikike nna, ikpughe nzuzo echekwara, gbanwee ikike nchekwa mgbọrọgwụ site n'ebe dị anya ma ọ bụ kwado ọnụ ụzọ Forge naanị n'ihi na ọ dabara adaba.

Ntuziaka ndị metụtara: [Nkwekọrịta njikwa ngwa](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Jikwaa bot Telegram nkeonwe gị

Mepụta ma ọ bụ nweta bot nke aka gị, malite nkata nzuzo ya, ma tinye token ya na ọnụọgụ Telegram onye ọrụ gị ID na ntọala njikwa mpaghara. Gbalite njikọ ahụ naanị mgbe ị bu n'obi ka ngwa ahụ jikọọ. Onye nwe ID bụ njirimara onye ọrụ, ọ bụghị aha njirimara ma ọ bụ bot ID. Naanị ozi sitere n'aka onye ọrụ ahụ n'otu nkata nzuzo ahụ ka a na-anabata.

Jiri /start, /menu ma ọ bụ /status maka nchịkọta nke ụdị na-agba ọsọ, ọnụọgụ ọrụ/ọrụ na ọnọdụ ọrụ. Bọtịnụ na-emepe Ọrụ, Ihe Omume, Nseta ihuenyo, Enyemaka na Asụsụ. Ndepụta na-egosi ihe asatọ kwa ibe, nwere nsoroụzọ Azụ, Mee ka ọ dị ọhụrụ, Ụlọ na Nke gara aga/Nke ọzọ. Bọtịnụ ọrụ na-enyocha ndepụta ọrụ. Kaadị ọrụ na-egosi ọganihu usoro ọrụ ya echekwara, ihe nlereanya/nhazi na ajụjụ na-echere mgbe ha dị.

Mepee Nkata nke ọrụ iji lelee mkparịta ụka mepere emepe/na nso nso a yana nkata akụkụ usoro ọrụ. Nlele nke ọ bụla na-egosi ihe ruru ozi isii kachasị ọhụrụ sitere n'aka onye ọrụ/onye inyeaka, nke e mere ka ọ dị mkpirikpi n'ụzọ doro anya na mkpụrụedemede 200 nke ọ bụla. A naghị egosi echiche nzuzo. Ịgụ akụkọ ihe mere eme anaghị amalite onye na-eweta. Nlele bụ naanị ịgụ: ederede nkịtị na /ask TEXT ka na-agwa onye inyeaka ngwa okwu, ọ dịghị mgbe ha na-agwa nkata ọrụ ị na-elele okwu n'amaghị ama.

Gbaa / Gaa n'ihu na-agụgharị usoro ọrụ Code ma ọ bụ Work dị ugbu a ma na-amalite usoro ọrụ echekwara tozuru oke. Kwụsịtụ na-arịọ nkwụsịtụ ya. Ọ dịghị nke na-anabata ihe achọrọ, nkọwa, atụmatụ, nchọpụta nyocha ma ọ bụ ajụjụ; mkpebi na-echere na-egbochi Gbaa. Mee mkpebi na ngwa ahụ, ma ọ bụ jiri iwu a pịnyere ụdị ya enyere ikike n'ụzọ doro anya nwere ọnụ ụzọ na ntụgharị ya ugbu a.

Jiri Asụsụ ma ọ bụ /language họrọ nke ọ bụla n'ime asụsụ interface 56 site na aha nna ya. Nke a na-echekwa mmasị maka naanị bot a na onye nwe ya. Jiri asụsụ ngwa na-ewepụ mmasị ahụ. Ọ naghị agbanwe asụsụ ngwa ma ọ bụ ikike ịnweta; ozi dị adị anaghị ezigagharị na-akpaghị aka.

Nsoroụzọ na-emekarị ka otu ozi menu ebipụtara dị ọhụrụ. Bọtịnụ nwere njirimara doro anya nke na-agwụcha mgbe nkeji 15 gachara ma enwere ike iji ya otu ugboro; ịgbanwe kaadị na-eme ka bọtịnụ ochie ya ghara ịdị irè. Bọtịnụ agwụla, nke ejirila, nke na-ekwekọghị na ozi na nke usoro gara aga enweghị ike ịrụ ọrụ. Enwere ike iji kaadị ọhụrụ dochie ozi a na-apụghị idezi kpamkpam; a naghị anwa njehie netwọk a na-amaghị dị ka ozi ọhụrụ.

Mgbe agbalitere ya, onye na-enyocha na-atụfu azụ azụ gara aga ma na-edekọ nnabata mmelite tupu izipu ka a ghara ịmegharị iwu ndị akwụsịrị na-akpaghị aka mgbe amalitegharịrị. Nke a na-egbochi imegharị; ọ naghị ekwe nkwa mmecha. Lelee ọnọdụ/gburugburu tupu ị kpachapụ anya nye ọrụ ọhụrụ mgbe njehie gasịrị. Enweghị ọkwa ọkwa ọrụ na-akpaghị aka.

Iwu doro anya ka dị: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot na /ask TEXT. /new {JSON} na-emepụta ọrụ site na createTask a pịnyere; /command {JSON} na-eziga iwu katalọgụ doro anya. Gụọ katalọgụ dị ndụ maka ụdị arụmụka. Otu ikike backend na onyinye nchekwa na-emetụta dịka na ngwa ahụ.

Ngwa ahụ anaghị eziga ụkpụrụ token bot echekwara na onye inyeaka. Nseta ihuenyo, nchịkọta na ederede mkparịta ụka nwere ike ịnwe ozi ọrụ nzuzo. Kwụsị njikọ ahụ na mpaghara ma ọ bụrụ na atụkwasịghị akaụntụ bot ma ọ bụ onye nwe ya obi ọzọ. Gbanwee token e bipụtara na onye na-eweta bot, wee melite nhazi ezoro ezo nke mpaghara ya.

Ntuziaka ndị metụtara: [Bot nzuzo na iwu](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Ikike kọmputa nna naanị onye nwe ya

Nnweta kọmputa nna na-amalite n'ịbụ nke agbanyụrụ. Naanị onye nwe ya nwere ike ịgbalite ya na Ntọala mpaghara → Njikwa anya. Onye inyeaka na iwu HTTP/MCP/Telegram enweghị ike ịgbalite ọkọlọtọ a maka onwe ha. Ọ bụrụ na ajụrụ ọrụ, onye inyeaka kwesịrị ịkọwa ntọala ahụ ma kwe ka onye nwe ya kpebie.

Mgbe agbanyere ya n'ụzọ doro anya, computer.run na-anabata faịlụ a na-egbu egbu, usoro arụmụka na nchekwa ọrụ zuru oke nke nhọrọ. Ọ naghị eji nkọwa shea, nwere oke nke sekọnd 30 ma na-ejide nsonaazụ na 1 MiB. A na-ajụ nchekwa enyere ma ọ bụrụ na ọ dịghị ma ọ bụ na ọ dịghị mma; ịhapụ cwd na-eji nchekwa ntọala nke ngwa nwere, ọ bụghị HOME. Kwụsị na-akagbu iwu ndị na-arụ ọrụ nke nwere ma na-eche nchacha usoro ha.

Oke ịgụ/ịrụ ọrụ ngwa na ohere nna bụ mkpebi dị iche iche. Osisi ọrụ anaghị egbochi ohere sistemụ faịlụ nke onye na-eweta nwere ohere zuru oke. Kagbuo ohere nna mgbe arụchara ọrụ ma ọ bụrụ na achọkwaghị ya, ma nyochaa akwụkwọ nnata iwu kama ịnakwere nkọwa onye inyeaka dị ka ihe akaebe.

Ntuziaka ndị metụtara: [Nkwekọrịta njikwa naanị onye nwe ya](../../../shared/control.ts).

<a id="remote"></a>

## Ihe nchọgharị na ihe ndị dịpụrụ adịpụ

Onye nwe mpaghara na-agbalite sava ahụ ma họrọ adreesị ya, ọdụ ụgbọ mmiri na oke ya: gụọ maka nyocha ma ọ bụ rụọ ọrụ maka omume. Adreesị ndabara 127.0.0.1 dị naanị na kọmputa a. 0.0.0.0 na-ege ntị na interface netwọk; nyochaa ohere netwọk tupu ịgbalite ya.

Ihe nchọgharị na-emepe otu interface ahụ mgbe abanyere na token. Etinyela token na njikọ ọha ma ọ bụ nseta ihuenyo. HTTP naanị anaghị ezobe okporo ụzọ; jiri ọwa echedoro n'elu netwọk a na-atụkwasịghị obi.

Onye nwe ya na-ahazi ihe ndị ọzọ site na URL na token. Backend na-anọchite anya arịrịọ; nke a anaghị eṅomi ọrụ ha n'ime igwe mpaghara. Lelee ihe ahọpụtara tupu omume ọ bụla.

Iwu na ihe omume a pịnyere na-ebu njikwa ngwa. Oke ịgụ ihe anaghị enye ikike mgbanwe ọrụ. Njikwa kọmputa nna bụ nhọrọ onye nwe mpaghara dị iche ma na-amalite n'ịbụ nke agbanyụrụ.

Ngwa ahụ ga-anọgide na-agba ọsọ maka ihe nchọgharị, Telegram na njikwa ndị ọrụ mpụga. Ihe ọ bụla nwere profaịlụ nzuzo nke ya, ọnọdụ ọrụ, token na ọdụ ụgbọ mmiri sava. Ejila otu profaịlụ n'otu oge n'etiti ihe ndị nọọrọ onwe ha. Ihe omume nchọgharị na azịza iwu nwere oke na ihe ahọpụtara; ịgbanwe UI anaghị ebugharị faịlụ ma ọ bụ detuo nbanye nna.

Ntuziaka ndị metụtara: [HTTP na njikwa ihe](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes na ndị ọrụ mpụga ndị ọzọ

Jiri API njikwa ngwa enyere ikike ma ọ bụ akwa mmiri stdio MCP agbakọtara. Gbalite sava ahụ na mpaghara, họrọ ịgụ ma ọ bụ rụọ ọrụ ma hazie onye ahịa ọ bụla na URL na token nke ihe ahụ. A chọrọ Node.js 22 ma ọ bụ nke kachasị ọhụrụ iji gbaa akwa mmiri MCP nọrọ onwe ya; ngwa Electron anaghị arụnye onye ahịa gị. URL ihe nchọgharị abụghị ebe ngwụcha HTTP MCP nwere ike ịkwanye: nye ya dị ka ZIAFORGE_URL na akwa mmiri stdio.

Akwa mmiri ahụ na-ekpughe ziaforge_status, ziaforge_commands, ziaforge_command na ziaforge_screenshot. Bido site na ọnọdụ na katalọgụ iwu dị ndụ, wee gụọ system.context maka ọrụ ahọpụtara. Iwu a pịnyere na-agbaso otu nlele ntụgharị, ọnụ ụzọ, nchekwa ọrụ na nhicha dị ka UI mpaghara.

Katalọgụ iwu dị ndụ na-agụnye documentation.guide, enyemaka Bekee a kwadoro, nwere ụzọ mmalite ya na sourceSha256. Onye na-ese ụkpụrụ ngwa dị n'ime na-anata otu ntụaka ahụ site na ngwaọrụ ya. Nke a na-enye ndị ọrụ gburugburu ngwaahịa ahụ dum n'adabereghị na ndetu ochie; akwụkwọ anaghị enye ohere ma ọ bụ dochie mkpebi mmadụ ugbu a.

Ndị ọrụ kwesịrị ikwurịta ihe achọrọ, mkpebi teknụzụ na nhazi site na obere echiche mmadụ. Ha ga-echekwabarịrị ọnụ ụzọ mmadụ pụtara ìhè, ụdị ndị ahọpụtara, amụma ntuziaka/Auto na nyocha achọrọ. Ha agaghị echepụta nkwado, kpọgharịa iwu na-edoghị anya n'okpuru ID ọhụrụ, ma ọ bụ bipụta mgbanwe Git n'enweghị ebumnuche onye nwe ya.

Hazie ọtụtụ sava MCP akpọrọ aha maka nrụnye dị iche iche. Mgbanwe ihe bụ mkpebi ụzọ, ọ bụghị mmekọrịta. Ihe atụ nhazi OpenClaw na Hermes dị na AGENT_CONTROL.md; a ga-enyocharịrị nhazi na ndakọrịta nke onye ahịa maka ụdị onye ahịa arụnyere.

Ebe nchekwa requestId dị n'èzí na-ewepụ naanị arịrịọ ndị nwere oke mgbe ngwa na-agba. Ọrụ na-adịgide adịgide na-eji njirimara nke ha: createRequestId maka imepụta ọrụ, commandId maka mkpebi usoro ọrụ, clientMessageId maka ozi na operationId maka mgbanwe Git. Chekwaa njirimara mbụ na ibu arọ mgbe nkwenye na-amaghị gasịrị; gụọ ọnọdụ echekwara tupu ị nye ọrụ ọhụrụ n'ama ama.

Ntuziaka ndị metụtara: [Ntuziaka onye ahịa MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI mpaghara na oke akpaaka

Onye mgbasa ozi ziaf na-achịkwa otu ngwa na-agba ọsọ na usoro ọrụ echekwara. Site na mmalite koodu, jiri npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, ma ọ bụ npm run ziaf -- pause --task TASK_ID. Nkwenye mmalite gara nke ọma apụtaghị na arụchara ọrụ ahụ.

--until-success na-ama ụma mee ka Auto rụọ ọrụ maka usoro ọrụ echekwara, mana ajụjụ, nyocha, ọnụ ụzọ nnabata, oke na ebe nlele ka na-emetụta. Ctrl+C na-apụ na onye nkesa na-ekiri; ọ naghị akwụsị usoro ọrụ ngwa n'onwe ya. Lee CLI.md maka koodu ọpụpụ, ebe ngwụcha mpaghara na njikwa profaịlụ.

Interface akpaaka ugbu a na-echekwa nkọwa ngosi na ọnụọgụ ọsọ mpaghara. Ọ bụghị onye nhazi oge ugboro ugboro enyere asambodo ma ọ naghị egosi na ntụgharị ihe nlereanya ndabere gbara. Maka ogbugbu n'ezie, jiri njikwa usoro ọrụ echekwara, ziaf ma ọ bụ API enyere ikike ma nyochaa akwụkwọ nnata ha. Akpọla panel ngosi ahụ dị ka nhazi oge na-enweghị nlekọta.

Ntuziaka ndị metụtara: [Iwu onye mgbasa ozi](../../CLI.md).

<a id="updates"></a>

## Version and updates

> Atụgharịbeghị ntuziaka zuru oke n'asụsụ interface gị. Na-egosi ntụaka Bekee.

Open Settings → Updates and choose Check for updates. The official GitHub repository ZIAForge/ZIAForge and the Stable channel are configured by default. The panel shows the running version and any newer compatible release. Preview includes prereleases; Stable excludes them. Checking never installs an update.

When an update is available, Update downloads the package for this operating system and architecture, verifies its published size and SHA-256, prepares the installer and requests a normal application restart. Save file edits first. Installation is armed only after application services stop, and the installer waits for the current process to exit. Your profile, settings, task history and project files are kept.

Supported installation paths are a writable macOS application bundle, the Windows installer, Linux AppImage and the distribution package manager for DEB/RPM. System installation or authentication prompts may still appear. A development checkout, a read-only or translocated macOS app, or an unsupported portable layout may require manual installation; the panel explains that case and links to the release. Move a macOS application out of the mounted disk image before using in-place updates.

Automatic checking and downloading is optional. When enabled, it checks immediately and every six hours. Installing and restarting remains a separate owner action. A failed download or checksum check retains the existing installation and never runs the downloaded file.

Downloaded package hashes establish that the files match the selected GitHub release. They do not replace code signing or notarization. The updater does not disable operating-system security checks. Repository and channel changes, downloads and installation are local owner actions; remote agents can read update status only.

Ntuziaka ndị metụtara: [Application update behavior and installation limits](../../UPDATES.md) · [Release readiness](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Malitegharịa ma gbakee

Na macOS, jiri Kwụsị / ⌘Q maka mmechi zuru oke. Imechi windo nwere ike ịhapụ ngwa ahụ ka ọ na-agba ọsọ. Gbanyụọ ụdị ochie kpamkpam tupu ị dochie ngwa ahụ.

Mgbe emechara mmalite, họrọ otu ọrụ ahụ. Akụkọ ihe mere eme na ndepụta na-alọghachi. Maliteghachi na-eweghachi gburugburu nna/mpaghara mana ọ naghị eziga ndepụta, wepụ nkwụsịtụ n'ahịrị ma ọ bụ nye ikike imegharị ọrụ a na-amaghị.

Ọ bụrụ na Mgbake apụta, ejila aka dezie JSON. Nyochaa ụdị akwụkwọ ahụ metụtara, chekwaa faịlụ mbụ ma họrọ nkwado a kwadoro. Iweghachi ahịrị ochie na-akara ihe ya dị ka ihe na-ejighị n'aka.

Mgbe a na-amaghị nnyefe, usoro ọrụ a na-achịkwa nwere ike ịchọ ikike doro anya maka gburugburu ọhụrụ. Ọrụ ndị mbụ na mbọ ndị dara ada na-adịgide; nchụpụ a na-ahụ anya dị nchebe karịa ọganiihu emepụtara emepụta.

Kwado faịlụ ọrụ na profaịlụ ngwa na ihe ngwa niile mechiri emechi. Nchekwa e depụtara abụghị nweghachi a nwalere. Ọ bụrụ na mgbake agwa gị ka ị họrọ nkwado a kwadoro, jigidekwa faịlụ ndị mebiri emebi kpọmkwem. Iweghachi usoro ọrụ ochie ma ọ bụ ahịrị anaghị enye ikike ịmegharị nkwubi okwu na-ejighị n'aka ma ọ bụ arụmọrụ Git.

Ntuziaka ndị metụtara: [Nkwekọrịta mgbake](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Nchọpụta nsogbu

Ahụghị CLI: lelee ntinye na ụdị ya na ọdụ nkịtị, wee malitegharịa ZIAForge. Ịbụ onye na-egbu egbu apụtaghị na ị banyela. Jiri usoro nbanye nke onye na-eweta n'onwe ya.

Ihe nlereanya adịghị ma ọ bụ ikike dara: mee ka nchọpụta dị ọhụrụ, họrọ ID dịnụ ma lelee akaụntụ gị na oke gị. Ekwughachila arịrịọ na-ejighị n'aka tupu inyocha akụkọ ihe mere eme ya.

Usoro ọrụ kwụsịrị: mepee akụkụ dị ugbu a, ajụjụ, akwụkwọ nnabata nkwenye ma ọ bụ ndekọ CLI. Leba anya n'ihe kpatara ya: ajụjụ a na-azaghị, iwu, ikike nchekwa ma ọ bụ oke mbọ. Gaa n'ihu enweghị ike ime ka nlele dara ada bụrụ ihe ịga nke ọma.

Nchekwa na-efu ma ọ bụ dochie ya: weghachi ohere na nchekwa mbụ ma ọ bụ mepụta ọrụ ọhụrụ. Ngwa ahụ agaghị aga n'ihu site na HOME. Ọ bụrụ na ị hụ cwd ọzọ, kwụsị ntụgharị ma chekwaa nchọpụta.

Maka mkpesa, tinye ụdị Maka, ụzọ, CLI/ihe nlereanya, omume a tụrụ anya ya na nke mere eme, nseta ihuenyo na akụkụ ndekọ dị nchebe. Wepụ ihe nzuzo, ọdịnaya nkeonwe na ụzọ ndị na-enweghị ike ibipụta.

Ibe dị anya adịghị: nyochaa na onye nwe ya gbanyere sava ahụ, lelee adreesị na ọdụ ụgbọ mmiri na-ege ntị, wee jiri token ihe ziri ezi nyochaa. 401 na-egosi nyocha; mgbanwe a jụrụ nwere ike ịbụ oke ịgụ ma ọ bụ njikwa naanị onye nwe ya. Ịgbanwe token na-emechi ndị ahịa nchọgharị dị adị. Ekpughela ọdụ nyocha DevTools dị iche dị ka njikwa ngwa dịpụrụ adịpụ.

Ajụrụ nchekwa onye ndezi: jigide ndepụta ahụ, nyochaa faịlụ dị ugbu a na diski ma dozie esemokwu mgbanwe mpụga. Elegharala ntụnyere ahụ anya site n'idegharị metadata ngwa. Ọ bụrụ na nbudata faịlụ buru ibu adịghị, jiri ndezi windo/ọchụchọ akwadoro ma ọ bụ onye ndezi mpụga.

Telegram adịghị: kwado token bot, ọnụọgụ onye nwe ya, nkata nzuzo na ọnọdụ na mpaghara. Webhook ma ọ bụ poller na-asọ mpi nwere ike igbochi ntuli aka; ZIAForge anaghị ehichapụ webhook na-akpaghị aka ma ọ bụ weghara poller ọzọ. Iwu ndị a jụrụ ma ọ bụ kwụsịtụrụ n'oke a na-amaghị agaghị agbagharị na-akpaghị aka.

Ntuziaka ndị metụtara: [Nnwale na nchọpụta](../../TESTING.md).

<a id="diagnostics"></a>

## Kpesa nsogbu ma nyochaa ihe akaebe

Dekọọ kpọmkwem ụdị na-agba ọsọ site na Maka, OS/usoro ihe owuwu, ụdị ọrụ, onye na-eweta/ihe nlereanya ahọpụtara yana usoro na-emepụtaghachi nsogbu ahụ. Kọwaa nsonaazụ a tụrụ anya ya na nsonaazụ ahụrụ. Tinye nseta ihuenyo dị nchebe yana akwụkwọ iwu ma ọ bụ nkwenye dị mkpa e debere, kama profaịlụ nzuzo dum.

Ndekọ CLI, akwụkwọ akụkọ ihe omume, ndekọ ihe nlereanya, nledo ihe nchọgharị na nseta ihuenyo nwere ike ikpughe koodu mmalite, ụzọ onwe ma ọ bụ token. Nyochaa ma wepụ ozi nzuzo tupu ị kesaa. Ihe na-ewepụ ozi nzuzo na ndekọ site na mbọ kacha mma anaghị agba akaebe na nseta ihuenyo ma ọ bụ ebe nchekwa dabara ibipụta.

Maka ndị na-enye aka, qa:doctor na-agụ njirimara gburugburu/mwube; qa:inspect na-emepe profaịlụ dịpụrụ adịpụ nwere stubs nke onye na-eweta. Fixture na-egosi ụzọ ngwa a nwalere na-akpọtụrụghị ihe nlereanya. Ntụle dị ndụ, njikọ Telegram, desktọọpụ Linux nna, nbinye aka na nlele ngwugwu arụpụtara bụ ihe akaebe dị iche iche. Lee TESTING.md maka iwu enwere ike imepụtaghachi na nhicha.

Ntuziaka ndị metụtara: [Iwu ihe akaebe](../../TESTING.md).

<a id="privacy"></a>

## Data mpaghara na oke

Ọrụ, akụkọ ihe mere eme, atụmatụ, akwụkwọ na nchọpụta nwere ike ịnwe ederede nzuzo. Ebipụtala profaịlụ, ihe onyonyo mbụ, mkpịsị ugodi ma ọ bụ ndekọ zuru ezu nwere koodu mmalite.

Na Linux, ịchekwa API, njikwa, Telegram na nzere ihe chọrọ GNOME Secret Service ma ọ bụ KWallet emepere emepe; na-enweghị ụlogwa ahịa nzuzo a kwadoro, ZIAForge na-ajụ ịchekwa nzuzo ndị a kama iji ihe nkwado basic_text nke Electron.

Nchekwa mpaghara apụtaghị na arịrịọ na-adị na kọmputa gị: CLI/API ahọpụtara na-eziga ha na onye na-eweta ya. Nchekwa ọrụ na nlekọta usoro abụghị iche iche nke OS. Nyochaa ikike ahọpụtara.

Kwapụta ụdị ihe akaebe: fixtures na-anwale ngwa na-enweghị ihe nlereanya; ndụ nna na-emega CLI/akaụntụ n'ezie; nlele ngwugwu na-akwado otu arụpụtara. Ịgafe otu anaghị ekwe nkwa ndị ọzọ.

Oke ngwa, osisi ọrụ na ntinye ọgụgụ naanị dị iche na mmanye sistemụ arụmọrụ. Amụma onye nyocha/onye inyeaka Antigravity na-achọpụta mgbanwe na ihe akaebe ebe ọrụ anakọtara kama ịmanye ohere ọgụgụ naanị na sistemụ faịlụ. Njikwa kọmputa nna na-eme mmemme ndị onye nwe ya nyere ikike n'èzí oke ngwaọrụ ngwa nkịtị; gbanyụọ ya mgbe achọkwaghị ya.

Ntuziaka ndị metụtara: [Mmalite na mbipụta](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Ghọta ma gbanwee ọrụ mepere emepe a

Gụọ AGENTS.md na CONTRIBUTING.md buru ụzọ, wee gụọ PROJECT_MAP.md maka oke koodu mmalite ugbu a. Nkwekọrịta a pịnyere ụdị ha arụnyere na akwụkwọ usoro ọrụ/onye na-eweta ugbu a na-achịkwa omume. CONCEPT.md na akụkụ ndị mbụ na-ebute ọdụ ụgbọ mmiri ụzọ nke ARCHITECTURE.md na-echekwa ebumnuche akụkọ ihe mere eme ma e kwesịghị ịgbagwoju ha anya maka nkwupụta ntọhapụ ugbu a.

Mmalite enyemaka Bekee bụ docs/help/en.json. Ejila aka dezie USER_GUIDE.md ma ọ bụ website/guide.html ewepụtara. Gbanwee ngalaba a kwadoro, melite nkwekọrịta metụtara ya ma gbaa node scripts/help/generate.cjs. Enyemaka dị n'ime ngwa na-agụ otu mmalite ahụ. Nyochaa mgbakwunye na mmejuputa n'ezie, gụnyere oke, ikike na ụzọ anaghị akwado.

Nke ọ bụla n'ime mpaghara interface 56 nwere ọnọdụ enyemaka dị iche na docs/help/locales.json. Enyemaka na-efu ma ọ bụ na-ezughị ezu na-adaba na Bekee. Akụkụ zuru ezu nke igwe sụgharịrị ka akpọrọ akara ma kee ya na hash mmalite Bekee, na-enweghị nkwupụta nyocha mmadụ. Nsụgharị nke mmadụ nyochara na-edekọkwa onye nyocha ya. Nsụgharị ọ bụla ga-echekwabarịrị ID ngalaba, omume, njirimara faịlụ/iwu na oke teknụzụ, jiri ezigbo ntụzịaka, ma bụrụ nke a na-eme ka ọ dị ọhụrụ mgbe isi mmalite Bekee ya gbanwere.

Tupu ị bupu, gbaa node scripts/help/generate.cjs --check iji chọpụta mmepụta ochie ewepụtara, nhazi mpaghara na-adịghị mma ma ọ bụ njikọ nkwekọrịta mpaghara mebiri emebi. Nlele nsụgharị UI na nlele omume ngwa ka dị iche. HELP_MAINTENANCE.md na-enye usoro mmelite maka onye na-enye aka na AI; akwụkwọ agaghị ekwu na ule agafeela ma ọ bụrụ na agbaghị ya.

Ntuziaka ndị metụtara: [Maapụ ọrụ ugbu a](../../PROJECT_MAP.md) · [Mmezi akwụkwọ](../../HELP_MAINTENANCE.md) · [Ntuziaka onye na-enye aka](../../../CONTRIBUTING.md) · [Ntuziaka onye ọrụ](../../../AGENTS.md).
