<!-- Generated from docs/help/en.json; source SHA-256 eaf22fddcc4ae04e49389249e9b06c0e4c060d2a1470f8ecbc39c46cb96868d3. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: so; served locale: so; status: machine-translated. -->
# Hagaha isticmaalaha ZIAForge

Laga bilaabo ujeeddada ilaa natiijo la xaqiijiyay. Hagaha wax ku oolka ah ee Code, Work iyo xakamaynta arjiga.

Ingiriisku waa kan asalka ah (canonical). Caawinta mashiinku turjumay si gooni ah ayaa looga suntay turjumaadaha bini'aadamku dib u eegay. Hubinta tooska ah ma caddeyso saxnaanta afka asalka ah.

> Hagahan waxaa mashiin kaga turjumay isha hadda jirta ee Ingiriisiga. Dib-u-eegis bini'aadam weli waa la soo dhoweynayaa.

## Qaybaha hagaha

- [Tallaabooyinka ugu horreeya](#start)
- [Rakib xirmada desktop-ka ee saxda ah](#install-platforms)
- [Code: shan marin](#code)
- [Wada-hadalka Forge](#forge)
- [Dukumeentiyada iyo go'aannada](#decisions)
- [Fulinta iyo dib u eegista](#execution)
- [Kooxaha dib u eegista ee barbar-socda iyo naqshadeeyaha warbixinta](#review-teams)
- [Takhasusyada wakiilka iyo siyaasadda dardar-gelinta (prompt)](#specializations)
- [Work: laga bilaabo su'aal ilaa dukumeenti](#work)
- [Hore-u-dejinta, noocyada iyo marinka](#models)
- [Wada-sheekaysiyada, Jooji iyo saf-raaca](#chat)
- [Faylasha, Git iyo dhammaystirka](#files)
- [Isku-xirrada API](#api)
- [Dejinta, luqadaha iyo dib-u-dejinta badbaadada leh](#settings)
- [Weydii kaaliyaha Caawinta](#help-assistant)
- [Kaaliyaha iyo Telegram](#assistant-control)
- [Ku shaqaysii bot-kaaga gaarka ah ee Telegram](#telegram)
- [Oggolaanshaha kombuyuutarka asalka ah ee milkiilaha kaliya](#native-permissions)
- [Birawsarka iyo tusaalooyinka meel fog](#remote)
- [OpenClaw, Hermes iyo wakiillada kale ee dibadda](#external-agents)
- [CLI maxalli ah iyo xaddidaadaha otomaatigga](#local-cli)
- [Version and updates](#updates)
- [Dib-u-bilaabista iyo soo-kabashada](#restart)
- [Xallinta ciladaha](#troubleshooting)
- [Soo sheeg dhibaatooyinka oo baar caddaynta](#diagnostics)
- [Xogta maxalliga ah iyo xuduudaha](#privacy)
- [Fahan oo wax ka beddel mashruucan il-furan](#project-contributors)

<a id="start"></a>

## Tallaabooyinka ugu horreeya

ZIAForge waxay ku haysaa wada-hadalka, qorshaynta, fulinta iyo xaqiijinta hal hawl dhexdeeda. Dooro Code mashruuc Git ah, ama Work dukumeentiyada, cilmi-baarista iyo natiijooyinka kale ee ku jira gal caadi ah.

Ka bilow hawl yar mashruuc gooni ah. Haddii aad doorato CLI asal ah, rakib oo marka hore kaga gal koontadiisa teerminaalka. Haddii kale, habee xiriirka API. Rukumashada CLI iyo API lacagta lagu bixiyo waa habab xiriir oo kala duwan; ZIAForge kuma geliso koontada mana kala wareejiso buundooyinka dhexdooda.

1. Fur Dejinta oo hubi galka goobta shaqada iyo luqadda. Ku saabsan waxay muujisaa aqoonsiga saxda ah ee dhismaha shaqaynaya.
2. Xagga Code, ku dar kaydka Git dhinaca bidix. Xagga Work, dooro gal gooni ah markaad abuurayso hawsha.
3. Kaydi hore-u-dejin leh CLI, nooc, dadaalka sababaynta iyo heerka marinka. Waxaad sidoo kale si toos ah u dooran kartaa Khaas adigoon lahayn hore-u-dejin la kaydiyay.
4. Abuur hawl, dooro marinkeeda, doorarkeeda iyo horusocodka gacanta ama tooska ah. Dib u eeg doorashooyinka ka hor inta aan la Bilaabin.

> Isticmaal artifact-ka iyo checksum-ka uu bixiyay ilaaliyuhu. Horudhacu waxa laga yaabaa inaan la saxiixin ama aanu lahayn quudin cusboonaysiin oo la daabacay. Taageerada desktop-ka iyo bixiyaha asalka ah waa in lagu xaqiijiyaa OS-ka saxda ah, qaab-dhismeedka iyo artifact-ka; taageerada ilaha oo keliya ma aha shahaadada sii-deynta.

Tilmaamaha la xidhiidha: [Dulmarka mashruuca](../../../README.md) · [Iswaafaqsanaanta bixiyaha](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Rakib xirmada desktop-ka ee saxda ah

Dooro xirmo u gaar ah nidaamkaaga hawlgalka iyo qaab-dhismeedka CPU: x64 ama arm64. Dhuumaha dhisidda (pipeline) waxay soo saari karaan qaababka macOS DMG/ZIP, Windows NSIS rakibe/ZIP, iyo Linux DEB/RPM/AppImage/tar.gz/ZIP. Fayl la sameeyay ama dhisme isku-dhafan (cross-build) ma aha caddayn muujinaysa in rakibihiisa iyo UI-giisa asalka ahi ay ku guuleysteen mashiinkaaga; la tasho diiwaanka xaqiijinta ee sii-deyntaas.

Dhismooyinka macOS ee isticmaalaya Electron 44 waxay u baahan yihiin macOS 13 ama ka dambeeya. Isticmaal xirmada arm64 ee Apple Silicon iyo xirmada x64 ee Intel. Si buuxda uga bax app duug ah ka hor inta aadan beddelin. Xirmooyinka horudhaca ahi waxay noqon karaan kuwo aan la saxiixin oo aan la caddayn (notarized); ha ku khaldin artifact horumarineed mid sii-deyn dadweyne oo la saxiixay.

Windows waxay u baahan tahay nidaam hawlgal oo uu taageero nooca Electron ee la socda iyo in Git laga heli karo PATH. Dooro qaab-dhismeedka u dhigma. Horudhac aan la saxiixin ma laha shahaadada Authenticode. ZIP la qaadi karo waa inuu hayaa galka arjiga oo dhammaystiran iyo faylasha runtime-ka, ma aha oo keliya kan la fulin karo.

Linux waxay u baahan tahay desktop garaafyo leh oo la jaanqaadi kara, maktabadaha nidaamka ee uu u baahan yahay Electron, iyo Git. Aqoonsiyada xakamaynta ee sirta ah, bixi Secret Service shaqaynaya sida gnome-libsecret ama KWallet; qaybta dambe ee basic_text ee aan ammaan ahayn lama aqbalo. Caddaynta qiiqa (smoke evidence) ee headless/container ma caddaynayso desktop kasta ama qaybin kasta (distribution).

Ku rakib DEB adigoo isticmaalaya apt install ./file.deb, ama ku rakib RPM maareeyaha xirmada ee qaybintaada. AppImage wuxuu u baahan yahay oggolaansho la fulin karo iyo taageero FUSE oo ku habboon; --appimage-extract-and-run waa beddel meelaha la taageero. Soo saar xirmooyinka tar.gz iyo ZIP oo ay la socdaan dhammaan faylashooda runtime-ka. Kala saar xogta isticmaalaha iyo faylasha arjiga marka aad beddelayso xirmo.

Si aad uga dhistid koodhka asalka ah (source), isticmaal Node 24, Git iyo npm ci, oo ay ku jiraan rakibaha caadiga ah ee Electron. Dib-u-dhiska asalka ahi wuxuu u baahan yahay qalabka goobta: qalabka laynka-amarka ee Xcode ee macOS; MSVC C++, Windows SDK iyo Python ee Windows; compiler, make, Python, pkg-config iyo qalabka baakaynta ee loo baahan yahay ee Linux. Raac PLATFORM_BUILDS.md amarrada saxda ah iyo xuduudaha goobta ee hadda jira darteed.

Noocyada sii-deynta waxaa loo qoondeeyey si dhexe natiijooyinkuna ma beddelmi karaan. Dhismaha xaqiijinta ee CI ma aha rakibe la daabacay. Kaydka ilaha (source archives) wuxuu ka kooban yahay ilaha, faylka qufulka (lockfile), dukumeentiyada iyo qoraallada; ku-tiirsanaanta, aqoonsiyada, astaamaha isticmaalaha iyo cilmi-baarista gaarka ah waa laga saaray. Weligaa ha ka dheehan ansaxinta asalka ah ee ARM ama Windows dhisme guuleystay oo x64 ah.

Tilmaamaha la xidhiidha: [Xirmooyinka goobta, shuruudaha hore iyo xadka xaqiijinta](../../PLATFORM_BUILDS.md) · [Aqoonsiga dhismaha iyo hubinta sii-deynta](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: shan marin

Auto waxay qiimeysaa baaxadda: su'aal fudud ayaa laga yaabaa inay ku dhammaato jawaab, halka hawl weyni u baahan tahay diyaar garow. Hagaaji cillad waxay baartaa sabab waxayna diyaarisaa sixitaan. Xalka farsamo marka hore wuxuu ku bilaabmaa xalka farsamada; Shuruudaha marka hore waxay ku bilaabantaa shuruudaha iyo shuruudaha aqbalaadda.

Moodal-badan wuxuu adeegsadaa xaalado kala duwan oo loogu talagalay sahaminta, naqshadaynta, fulinta iyo dib u eegista. Magaca marinku uma baahna bixiyeyaal kala duwan: door kasta wuxuu adeegsadaa qaabeynta hore loo dejiyay ama Khaaska ah ee aad doorato.

Worktree wuxuu gooni u yeelaa isbeddelada Git ee hawsha. Laantu waxay ka shaqeysaa soo-dejinta la doortay. Hubi mashruuca, laanta iyo nooca ka hor inta aadan bilaabin; sharraxaadda hawsha looma diro sidoo kale wada-sheekaysi caadi ah.

Fikradda leh doorashooyin badeecadeed ama farsamo oo aan la xallin, isticmaal Shuruudaha marka hore oo ku dhis aasaaska wada-hadal. Auto waxay kala saartaa codsiga; ma aha amar lagu fulinayo weedh kasta oo gaaban isla markiiba. Kaydi qabyo-qoraalka waxay haysaa codsiga iyada oo aan lala xiriirin nooc; Bilow wuxuu kaydiyaa oo bilaabaa qulqulka la maareeyo hal mar. Hal ilaa afar koobi oo hawsha ah waxay leeyihiin aqoonsiyo abuuris iyo goobo door oo madax-bannaan.

Tilmaamaha la xidhiidha: [Heshiiska socodka shaqada ee Code](../../WORKFLOWS.md) · [Muuqaallada dardar-gelinta (prompt) ee Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Wada-hadalka Forge

Bilow wuxuu furaa wada-hadalka dhexe. U jawaab si dabiici ah, weydii su'aalo rogan, ku dar xaddidaadyo oo ka hadal doorashooyinka farsamada. Wada-sheekaysiga iyo su'aalahu waxay la socdaan hawsha.

Dirista qoraalku ma aqbasho dukumeenti mana oggolaato qorshe fulineed oo cusub. Caddeynta inta lagu jiro fulinta waxay marka hore hakisaa wareegga la maareeyo waxayna dib u eegtaa baaxadda ay saameysay. Jawaabta su'aal ku dhex jirta tallaabo mar hore la aqbalay waxay sii wadi kartaa tallaabadaas.

Si aad ula kac ah dib ugu eegto aasaaska, dooro Shuruudaha, Faahfaahinta farsamo ama Qorshaynta. Nooc cusub wuxuu u baahan yahay aqbalaad cusub oo go'aannada ku tiirsan. Tallaabooyinka la dhammaystiray iyo caddayntoodu way sii jiraan; wejiyada aan dhammaan ee la beddelay waxay ku jiraan taariikhda.

Fadhiyada wejiga la maareeyo way ka duwan yihiin wada-sheekaysiga xorta ah. Isticmaal wada-hadalka Forge halkii aad dardar-gelinno (prompts) gacanta ah si toos ah ugu diri lahayd fadhi uu leeyahay socodka shaqadu.

Tilmaamaha la xidhiidha: [Heshiiska wada-hadalka ee Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Dukumeentiyada iyo go'aannada

Fur dukumeenti, baadh noociisa oo samee wax ka beddel marka loo baahdo. Gudbinta wax ka beddelka iyada oo loo marayo wada-hadalka waxay soo saartaa nooc cusub; warbixinnada iyo natiijooyinka la xaqiijiyay dib looma qoro gadaal ahaan.

Ka hor inta aadan aqbalin qorshe la soo jeediyay, wax ka beddel nidaamka, tilmaamaha, shuruudaha aqbalaadda iyo amarrada xaqiijinta. Oggolow amarro la taaban karo oo aad fahamsan tahay: waxay ku shaqeeyaan galka hawsha. Moodal-badan wuxuu soo jeedinayaa hal tallaabo oo fulin hawleed oo buuxda, oo faahfaahinteedu ku jirto dukumeentiyadiisa iyo tilmaamihiisa.

Oggolow waa go'aan gooni ah oo ula kac ah. Auto ma hareer marto su'aalaha ama aqbalaadda shuruudaha, faahfaahinta farsamo iyo qorshayaasha. Dukumeenti dibadda laga beddelay dib uma isticmaali karo oggolaansho hore.

Faylasha diyaarinta waxay u muuqdaan sida artifacts. Noocooda, wejiga soo saaray iyo hash-kooda ayaa ku xira natiijo. Dukumeentiyada Code waxaa lagu hayaa meel ka baxsan worktree mana galaan si toos ah commit.

Hubi labadaba dukumeentiga iyo go'aanka la muujiyay ka hor inta aadan aqbalin. Aqbalaaddu waxay isku xirtaa albaabka ID ee hadda jira, dib-u-eegista qorshaha iyo hashes-ka dukumeentiga ee la hayo. Codso isbeddello marka baaxadda ama caddayntu khaldan tahay. Haddii go'aanku noqdo mid duugoobay, dib u soo rar xaaladda la kaydiyay ka hor inta aadan samayn doorasho cusub; fayl la beddelay laguma aqbali karo nooc hore hoostiisa.

Tilmaamaha la xidhiidha: [Albaabbada socodka shaqada iyo noocyada dukumeentiga](../../WORKFLOWS.md).

<a id="execution"></a>

## Fulinta iyo dib u eegista

Wax-la-qabto waxay muujisaa tallaabooyinka dhabta ah, isku-dayga hadda socda, xaqiijinta iyo natiijooyinka dib u eegista. Wakiil leh “waa la sameeyay” ma dhammaystiro tallaabo: caddaynta qorshuhu u baahan yahay waa inay jirtaa.

Habka gacanta wuxuu hakiyaa inta u dhexeysa tallaabooyinka u qalma. Auto waxay horumarisaa tallaabooyinka la xaqiijiyay waxayna oggolaataa isku-dayo xadidan. Jooji ka dib waxay had iyo jeer abuurtaa goob hubin (checkpoint). Hakintu waxay joojisaa shaqada firfircoon ee socodka shaqada; xiritaanka guddi ma joojinayo isaga.

Dib-u-eedeeye madax-bannaan wuxuu adeegsadaa xaalad gooni ah oo ay ku jiraan faylasha iyo natiijooyinka xaqiijinta. Natiijo kasta oo xannibaysa oo loo baahan yahay waa in la xalliyaa; dhowr dib-u-eegayaal ah cod kuma baabi'iyaan qalad xannibaya.

Gudaha Moodal-badan, sixitaanka natiijooyinku wuxuu u baahan yahay go'aan cad. Sixitaanku si aamusnaan ah uma bilaabo dib u eegis kale: Dib u eeg mar kale waxay furaysaa wareeg cusub. Faallooyinka dib u eegistu waxay codsan karaan dib-u-tixgelinta isku-duwaha iyada oo aan lagu celinayn fulinta.

Tallaabooyinka la dhammaystiray lagama beddeli karo si aamusnaan ah. Iyadoo la adeegsanayo TDD, Casu waa inuu dhab ahaan u fashilmaa sababta la filayo darteed, ka dibna Cagaarku waa inuu gudbaa. Isku-dayada xadidan waxay ka hortagaan isku-dayo aan dhammaad lahayn.

Ku kaydi dib-u-eegayaasha madaxa-bannaan ee CLI/API gudaha Dejinta → Kooxaha dib u eegista, ka dibna dooro kooxda gudaha Code ama Work. Dib-u-eegayaashu waxay u shaqeeyaan si is barbar socota, waxaana ku xiga naqshadeeyaha warbixinta kooxda. Waxaad sidoo kale habeyn kartaa dib-u-eegayaal madax-bannaan adigoon haysan koox la kaydiyay. Naqshadeeyaha warbixintu wuxuu helaa oo keliya warbixinno qaabaysan oo qarsoodi ah, iyada oo aan lahayn faylasha mashruuca ama qalab; go'doomintani waxay hadda u baahan tahay Claude Code ama API.

Tallaabo kasta oo fulin ah waxay u baahan tahay hubin la fulin karo, dib u eegis madax-bannaan oo loo baahan yahay, ama labadaba. Wejiyada diyaarintu beddelkeeda waxay hayaan natiijooyin la ansixiyay iyo rasiidhada artifact; kuwani ma matalaan in tijaabooyinkii fulintu socdeen. Amar wuxuu guuleystaa oo keliya marka xaaladdiisa bixitaanka dhabta ah iyo nadiifinta habka uu leeyahay la xaqiijiyo. Hubinta Cas ee TDD waa inay si caadi ah u fashilantaa ka hor fulinta iyo xaqiijinta Cagaaran; fuliye maqan ama waqti-dhaaf ma aha natiijo Cas oo sax ah.

Dilaayaasha wareegga (circuit breakers) ee caadiga ah waxay joogsadaan ka dib saddex isku day oo fashilmay oo hal tallaabo ah ama konton isku day guud ahaan. Dhex-galku wuxuu cunaa isku day laakiin laftiisu looma tiriyo isku day fashilmay. Xuduudaha iyo caddaynta la dhammaystiray way sii jiraan dib-u-bilaabista ka dib; Dib u tijaabi ma dib u dejiso iyaga. Akhri fashilka la hayo ka hor inta aadan oggolaan isku day kale.

Tilmaamaha la xidhiidha: [Xaqiijinta iyo dib u eegista](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Kooxaha dib u eegista ee barbar-socda iyo naqshadeeyaha warbixinta

Fur Dejinta → Kooxaha dib u eegista oo kaydi koox. Ku dar dib-u-eegayaal madax-bannaan oo wata CLI ama API u gaar ah, nooca, dadaalka sababaynta iyo takhasuska, ka dibna dooro naqshadeeye warbixinta. Dooro kooxda qaabeynta dib u eegista hawsha. Hore-u-dejinta fuliyaha waxaa sidoo kale isticmaali kara dib-u-eeye, Khaasna waa la heli karaa; doorarka madaxa-bannaan waxay weli leeyihiin xaalado kala duwan.

Dib-u-eegayaashu waxay si is barbar socota ugu shaqeeyaan isla caddaynta hawsha. Warbixin kasta, qalad iyo go'aan kasta oo loo baahan yahay waa la hayaa. Naqshadeeyuhu wuxuu helaa warbixinno lambaraysan oo qarsoodi ah oo aan lahayn magacyada dib-u-eegaha, aqoonsiyada nooca ama bixiyaha, nuxurka asalka ah ee hawsha, marinka kaydka ama qalab. Wuxuu isbarbardhigayaa warbixinnada wuxuuna soo celinayaa hal go'aan oo qaabaysan; ma sameeyo dib u eegis cusub oo koodhka asalka ah.

Natiijo xannibaysa ama diidmada dib-u-eegaha loo baahan yahay laguma dhaafi karo aqlabiyad ama dookha naqshadeeyaha. Warbixinnada maqan ama khaldan waxay ka hortagaan oggolaanshaha. Baadh natiijooyinka shakhsi ahaaneed iyo go'aanka guud ka hor inta aadan aqbalin ama oggolaan sixitaannada. Koox la kaydiyay waa la xalliyaa oo loo qaboojiyaa hawsha; wax ka beddelka hore-u-dejinteeda ma dib u qoro caddaynta la dhammaystiray.

Naqshadeeyaha warbixinta-keliya wuxuu hadda isticmaalaa qaabaynta aan qalabka lahayn ee la taageero ee Claude ama API. Codex iyo Antigravity waxay sii ahaanayaan kuwo la heli karo sidii dib-u-eegayaal laakiin waa loo diiday doorkan naqshadeeye ee go'doonsan ilaa heshiis aan qalab lahayn oo la xaqiijiyay uu jiro. Dardar-gelin (prompt) leh “qalab ma jiro” oo keliya kuma filna.

> Dhuumaha naqshadaynta/dib u eegista ee Moodal-badan ee Code iyo koox dib u eegis barbar-socod ah oo la kaydiyay waa kontaroollo kala go'an. Hay siyaasadda dib u eegista khaaska ah ee la doortay; ha u qaadan in hal marin uu awood u siinayo sifo kasta oo dib u eegis ah.

Tilmaamaha la xidhiidha: [Habeynta kooxda nooca leh](../../../shared/review-team.ts) · [Isku-darka dib u eegista](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Takhasusyada wakiilka iyo siyaasadda dardar-gelinta (prompt)

Noocu waa mishiinka fulinta; takhasusku waa muuqaal tilmaameed. Dooro Midna haddii aadan rabin takhasus lagu daro, Heerka caadiga ah hagaha caadiga ah, Auto hagaha ku habboon ee ku dhex jira, ama Gacanta hagayaasha la doortay iyo tilmaamahaaga xadidan. Hore-u-dejintu way hayn kartaa xulashada.

Buug-yaraha asalka ahi wuxuu daboolayaa koodh-qorista guud, naqshad-dhismeedka, amniga, kalsoonida, waxqabadka, tijaabinta iyo isticmaalka interserfeyka. Auto waxay isticmaashaa qoraalka hawsha/tallaabada ee la heli karo si ay u doorato hage; si qarsoodi ah uma wacdo nooc kale mana caddayso khibrad. Talooyinka qorshaynta waa la baari karaa waana la beddeli karaa ka hor inta aan la aqbalin qorshaha fulinta.

Takhasusyada dib u eegistu waxay caawiyaan toosinta dareenka laakiin waligood ma beddelaan caddaynta madaxa-bannaan, xuduudaha marinka ama go'aanka qaabaysan. Ula dhaqan tilmaamaha khaaska ah sidii qayb ka mid ah baaxadda hawsha: ha u isticmaalin inaad ku hareermarto aqbalaadda dukumeentiga, siyaasadda qalabka, xaqiijinta aqoonsiga ama fashilka dib-u-eegaha.

Tilmaamaha la xidhiidha: [Buug-yaraha dardar-gelinta (prompt) ee asalka ah](../../../shared/specializations.ts).

<a id="work"></a>

## Work: laga bilaabo su'aal ilaa dukumeenti

Work uma baahna Git. Default wuxuu abuuraa gal hawleed gooni ah; Khaas wuxuu ka doortaa gal jira doortaha asalka ah. Kaydi qabyo-qoraalka waxay kaydisaa goobaha iyada oo aan inference la samayn; Bilow wuxuu wadaa wejiga koowaad.

Auto waxay kaga jawaabtaa si toos ah ama waxay soo jeedisaa qorshe ku habboon oo leh Wax-la-qabto dhab ah. Maskax-tuujintu waxay abuurtaa ideas.md ka hor inta aadan dooran fikrado dheeraad ah ama qiimeyn. Cilmi-baaristu waxay haysaa findings.md, ilaha iyo xaddidaadaha. Qor waxay ka guurtaa ujeeddada iyo, markay faa'iido leedahay, outline.md waxay u guurtaa dukumeenti sharraxaad leh ama draft.md; dib-u-eegistu waxay haysaa noocyadii hore.

Ka dooro gelinta faylka doortaha asalka ah oo ku tixraac @. App-ku wuxuu u koobiyeeyaa sidii wax-soo-gelin hawleed oo aan la beddeli karin wuxuuna xaqiijiyaa aqoonsigooda ka hor inta aan la bilaabin. Default wuxuu abuuraa gal hawleed uu arjigu leeyahay; Gelitaanka galka Khaaska ahi waa deeq milkiile oo la kaydiyay. Qabyo-qoraal la kaydiyay oo aan la bilaabin wuu beddeli karaa galkiisa.

Abuur 1–4 koobi oo leh goobo fuliye oo madax-bannaan. Hawlaha isticmaalaya galal isku dul dhacaya ma qori karaan isku mar. Iskuduwidani waxay khusaysaa hawlgallada ZIAForge, ee ma aha barnaamijyo dibadeed oo aan sabab lahayn.

Deep Brainstorm waxay u dhigantaa saddex shaqaale oo madax-bannaan waxayna taageertaa ilaa siddeed. Dooro nidaamkooda iyo qaabayntooda, oo ay ku jirto dib-u-isticmaalka hore-u-dejin xaalado gooni ah dhexdeeda. Su'aalaha shaqaaluhu waxay hayaan halka ay ka yimaadeen; warbixinnada khaldan waxay helaan hal isku day oo dib-u-hagaajin qaabka ah. Fashilka qayb ka mid ah wuxuu ahaanayaa mid muuqda halkii loo soo bandhigi lahaa sidii guul loo wada dhan yahay.

Deep waxay isku dartaa warbixinnada shaqaalaha ee la hayo brainstorm_report.md dhexdiisa waxayna had iyo jeer weydiisataa go'aanka isticmaalaha. Dabagal yar ayaa warbixinta ku dib-u-eega isku-duwaha; isbeddel weyn wuxuu bilaabaa wareeg kale oo shaqaalaha la qaboojiyay ah. Artifacts-ku waxay hayaan noocyadooda.

Doorarka la xalliyay waxay ku qaboobaan abuurista hawsha ama kaydinta qabyo-qoraalka ee cad. Ka dib wicitaanka koowaad, kaliya horusocodka tooska ah/gacanta ayaa beddelmi kara; isticmaal hawl cusub goobaha door ama nooc oo kala duwan darteed. Wax ka beddelka hore-u-dejinta guud si aamusnaan ah uma beddelo wejiyada dambe.

Habka gacanta wuxuu hakiyaa inta u dhexeysa wejiyada u qalma, oo ay ku jirto dulmar Qoraal oo weyn. Auto waxay ku sii socon kartaa dulmarkaas. Su'aalaha, qorshayaasha fulinta ee la soo jeediyay, jihada Maskax-tuujinta iyo dib u eegista warbixinta Deep waxay ahaanayaan go'aanno cad xitaa gudaha Auto. Soo xigasho oo keliya ma caddaynayso in daalacasho dhacday, fayl binary ah oo la hayo oo keliya ma caddaynayo muujintiisa.

Tilmaamaha la xidhiidha: [Hababka Work iyo go'aannada](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Hore-u-dejinta, noocyada iyo marinka

Hore-u-dejin waxay kaydisaa CLI/API, nooca, dadaalka sababaynta iyo rukhsadaha. Qeybta hoose ee wada-sheekaysigu waxay leedahay qaybaha hore loo dejiyay, CLI, nooca iyo xulashooyinka. Khaas wuxuu shaqeeyaa bilaa hore-u-dejin; Abuur hore-u-dejin waxay kaydisaa xulashada hadda jirta.

Liisku wuxuu ka yimaadaa CLI ama API ee rakiban ee la doortay meeshii la taageero. Dib-u-cusboonaysii waxay cusboonaysiisaa liiska iyada oo aan beddelin xulashada. Haddii helitaanku aanu jirin, geli nooca ID oo cad; bixiyuhu waa inuu wali taageeraa. Heerarka sababayntu waxay ku xiran yihiin nooca iyo CLI. Bixiyaha caadiga ah wuu ka duwan yahay calaamadda (token) cad ee none.

Codso isbeddellada kaliya ka dib qirashada qaybta dambe. Beddelidda waa la xaddiday inta lagu jiro wareeg firfircoon ama saf aan madhnayn. Qabyo-qoraallada iyo taariikhda muuqata way sii jiraan, laakiin beddelidda bixiyeyaasha ma wareejiso xaaladdooda hoose ee gaarka ah.

Gudaha Forge, sumadda doorku waa muhiim: diyaarintu waxay isticmaali kartaa Qorsheeye gooni ah. Qeybta hoose waxay beddeshaa doorka la muujiyay; dib-u-eegayaasha iyo caawiyayaasha waxaa lagu doortaa goobaha socodka shaqada. Xeerka fulinta mar hore la xaqiijiyay wuu qufulnaan karaa.

Rukhsaduhu way ku kala duwan yihiin bixiyeyaasha. Akhris keliya iyo Qorista goobta shaqada waa la heli karaa meesha adabtaradu taageerto. Antigravity waxay isticmaashaa goobaha asalka ah ee CLI ama marin buuxa oo si cad loo doortay. Marin buuxa ma aha sandbox.

Takhasusku wuxuu ku darayaa hagid dardar-gelin (prompt), ma aha nooc kale ama rukhsad. Hore-u-dejinta iyo doorarku waxay taageeraan Midna, Heerka caadiga ah, Auto iyo Gacanta. Auto waxay ka doorataa muuqaallada qoraalka tallaabada iyada oo aan la wicin nooc dheeraad ah; Gacanta waxay aqbashaa ilaa afar takhasus iyo tilmaamo khaas ah. Qoondeynta uu Qorsheeyuhu soo jeediyay waa la beddeli karaa ka hor inta aan la aqbalin qorshaha.

Nooca ID ama dadaalka gacanta lagu geliyo waxay ahaanayaan doorashadaada, laakiin bixiyuhu wuu diidi karaa. Wax ka beddelka hore-u-dejinta guud dib ugama beddelo wada-sheekaysi socda ama qorshe la aqbalay. Si aad u beddesho wada-sheekaysi aan shaqaynayn si ula kac ah, isticmaal xakamaynta qaabeyntiisa u gaarka ah oo sug qirashada. Xulashada naafada ah waa in loo akhriyaa sidii awood ama xad wareegga nolosha ah, ee aan lagu hareermarin wax ka beddelka JSON la kaydiyay.

Tilmaamaha la xidhiidha: [Awoodaha bixiyaha](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Wada-sheekaysiyada, Jooji iyo saf-raaca

Tab-yada furan, Kuwii ugu dambeeyay iyo qabyo-qoraalladu waxay ka tirsan yihiin hal hawl. Xiritaanka tabku wuxuu ka saarayaa Furan laakiin wuxuu ku hayaa Kuwii ugu dambeeyay mana joojinayo habka bixiyihiisa ama socodka shaqada ee la maareeyo. Raadi taariikhda, dib u fur wada-sheekaysi ama ka xir dhammaan tab-yada dheeraadka ah liiska taariikhda.

Jooji waxay dhex-gashaa wareegga hadda socda. Sug inta joojintu ka dhammaystirmayso ka hor Dirista xigta: qirashada dhex-galka ma aha dhammaystirka habka. Waxaad qori kartaa qabyo-qoraalka xiga inta lagu jiro.

Wada-sheekaysiga caadiga ah, Saf-raacu wuxuu codsi dambe u kaydiyaa si gooni ah qabyo-qoraalka hadda jira. Hakinta saf-raacu waxay haysaa gudbinta dambe. Jooji iyo Ka bax waxay hakiyaan saf-raaca. Ka dib dib-u-bilaabista, Dib-u-billow marka hore, ka dibna si cad u Sii wad saf-raaca.

Aan la hubin macnaheedu waa gudbinta lama yaqaan. Farriinta noocaas ah si toos ah dib looma diro: baadh taariikhda, koobiyeey qoraalka haddii ay habboon tahay oo iska tuur sheyga safka ku jira. Dib u diriddiisu waa codsi cusub oo ula kac ah.

Wada-sheekaysiyada wejiyada la maareeyo waxay adeegsadaan socodkooda shaqo, ee ma aha saf-raaca caadiga ah. La soco heerka waxay muujisaa wejiga hadda socda; doorashada gacanta ee tab kale waxay joojisaa la socoshada. Diiwaannada CLI waxay muujiyaan baaritaannada si gooni ah jawaabta.

Jawaabaha Markdown waxay muujiyaan cinwaannada, liisaska, miisaska, xiriiriyeyaasha iyo koodhka ku jira xeyndaabka. Kaararka qalabka iyo baaritaannada CLI waxay ka go'an yihiin jawaabta. Fikirka uu bixiyuhu soo sheegay iyo cabbirrada calaamadaha waxay soo muuqdaan oo keliya marka bixiyuhu dhab ahaan kashifo; ha ka dheehan fikirka gaarka ah ama isticmaalka dhaqdhaqaaqa sawirka (animation).

Ka dib diris aan la hubin ama qirasho saf-raac, baadh taariikhda oo dib u tijaabi oo keliya isla codsigii la hayay meeshii laga bixiyo. Rasiidka saf-raacu wuxuu ka dhigan yahay in kaydku aqbalay sheyga, ee ma aha in gunaanadku dhammaystirmay. Ka saar sheyga safka ku jira ee aan la hubin oo keliya sidii diidmo cad; kama noqon karo dardar-gelin (prompt) mar hore la gudbiyay.

Tilmaamaha la xidhiidha: [Saf-raaca farriinta ee raagaya](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Faylasha, Git iyo dhammaystirka

Faylashu waxay muujisaa galka hawsha. Isbarbar dhig natiijooyinka iyo shuruudaha, fur dukumeentiyada oo baadh farqiga (diffs). Haysashada fayl binary ah ma caddaynayso muujinta saxda ah ee arjiga la beegsanayo.

Git waxay bixisaa xaaladda, isbeddelada iyo hawlgallada leh natiijooyin la diiwaangeliyay. Commit, merge iyo push waa kuwo gacanta ah marka hore; hawlgallada tooska ah waa doorashooyin gooni ah oo loogu talagalay qorshe si buuxda loo xaqiijiyay.

Ha beddelin faylasha shaqada inta u dhexeysa xaqiijinta iyo daabacaadda: oggolaanshaha wuxuu ku xiran yahay bytes sax ah. Isku dhacyada, push-yada fashilmay iyo natiijooyinka hawlgalka ee aan la aqoon waxay xannibaan horumarka ilaa go'aan cad laga gaaro. Auto si aamusnaan ah uma oggolaato daabacaadda.

Work ma abuurto wax laamood oo Git ah mana laha gunaanad Git ah. Ka hay dukumeentiyada loo baahan yahay galka la doortay, oo ay ku jiraan noocyada iyo ilaha.

Tifaftiraha faylku wuxuu bixiyaa naxwaha luqadda marka loo eego kordhinta (extension), raadinta iyo beddelidda, taariikhda ka noqoshada, duubista xariiqda iyo qabyo-qoraallo tab kasta ah. Kaydintu waxay ilaalisaa sir-sameynta la taageero ee UTF-8/UTF-16 waxayna diidaa isku dhacyada wax ka beddelka dibadda. Sir-sameynta kale iyo nuxurka binary-ga waxay u baahan yihiin tifaftire dibadeed. Qabyo-qoraallada aan la kaydin waxay ka hortagaan Ka bixitaanka arjiga ilaa milkiiluhu kaydiyo ama iska tuuro.

Naxwaha luqadda oo buuxa ayaa la furay ilaa 8 MiB. Faylasha qoraalka ah ee ka waaweyn waxay ku furmaan daaqadaha 256 KiB; 8–64 MiB si cad ayaa loo wada rari karaa iyada oo aan lahayn naxwaha luqadda. Ka sarreeya 64 MiB isticmaal wax ka beddelka daaqadda iyo raadinta kulanka xiga ee xadidan. Kani waa hab fayl-weyn oo xadidan, ee ma aha u dhigma Sublime Text ee dukumeentiyo kasta oo waaweyn.

Fur galka wuxuu adeegsadaa hawsha hadda jirta ama xaaladda laanta/worktree, halkii uu si aamusnaan ah u furi lahaa kaydka asalka ah oo keliya. Xariiqda faylku waxay kashifi kartaa galka waalidka ee faylkaas. Waddooyinka waxaa xaqiijiya qaybta dambe iyadoo loo eegayo deeqaha hawsha ee diiwaangashan. Faylasha binary-ga ah laguma tafatiri karo qoraal cad ahaan; isticmaal daawadaha la beegsanayo oo hay bytes-ka asalka ah.

Ka saarista Worktree waa tallaabo gooni ah oo la ilaaliyo. Soo afjar fadhiyada qaabaysan iyo teerminaallada ku lifaaqan ka hor inta aadan ka saarin, oo ay ku jiraan fadhiyada aan shaqaynayn. Baadh natiijada Git ee la kaydiyay iyo xaaladda soo kabashada; tirtiridda diiwaanka hawshu ma beddesho si nabad ah u ilaalinta shaqada aan la commit-gareyn.

Tilmaamaha la xidhiidha: [Heshiiska tifaftiraha ee nooca leh](../../../shared/editor.ts) · [Xeerarka Git](../../WORKFLOWS.md).

<a id="api"></a>

## Isku-xirrada API

Qaybta Isku-xirrada waxay ku dartaa bar-dhammaad API oo si cad loo doortay. Geli magac, salka URL, nooca moodeelka iyo fure haddii loo baahdo. U dooro Chat Completions is-dhexgallada hadda jira ee la jaanqaadi kara, Responses wareegyada shaqada iyo warbaahinta bixiyaha, ama Anthropic Messages oo wata Claude Connector v1 xiriiriyahaas dartiis. Isku-xirrada hadda jira waxay sii haystaan Chat Completions ilaa aad si cad u beddesho. Isku-xirka jira dartiis, Deji Responses wuxuu furayaa qabyo-qoraal loogu talagalay isla bar-dhammaadkaas; dib u eeg astaanta gujina Keydi isku-xirka. Dooro xiriiriyaha Codex, Grok Connector v1 ama Claude Connector v1 keliya albaab marinno (gateway) taageeraya kordhinta la doortay. Furaha la keydiyay waa la xafidayaa marka bar-dhammaadku uusan isbeddelin goobta furuhuna ay bannaantahay.

HTTPS waa waajib marka laga reebo loopback HTTP. Isticmaal bar-dhammaad caadi ah oo aan lahayn xogta aqoonsiga, weydiimo ama qaybo jajab ah. Dib-u-hagaajinta lama oggola. Furayaashu waxay isticmaalaan sir-qarinta OS ee la taageero weligoodna dib looguma soo celiyo UI-ga. Beddelidda bar-dhammaadku waxay u baahan tahay dib-u-gelinta ama tirtiridda furahiisa. In goobta furaha bannaan looga tago waxay xafidaysaa fure hore loo keydiyay.

Aaladaha faylka goob-shaqeedku waxay ka shaqeeyaan gudaha gal-shaqeedka maxalliga ah ee uu xalliyay backend-ku, iyagoo wata waddooyin qaraabo ah iyo baaritaanno ka dhan ah marinka iyo xiriiriyeyaasha. Qoraal kasta oo fayl ah wuxuu u baahan yahay oggolaansho cad iyo dib-u-eegis la filayo oo aan isbeddelin. Kulamada akhriska-keliya waxay soo bandhigaan keliya aaladaha wax-akhrinta. Habka wacaha ee Responses iyo Claude dhexdiisa, Oggolow amarada maxalliga ah waxay si gaar ah u awood siisaa wicitaannada fulinta/doodda ee la oggolaaday ee macOS iyo Linux. Kormeerka amarku lama heli karo Windows dushiisa; adabterku halkaas kama xayeysiiyo aaladdaas. Amaradu had iyo jeer waxay u baahan yihiin oggolaanshaha mulkiilaha mana aha sandbox-ka nidaamka hawlgalka.

Astaanta xiriiriyaha Codex waxay aqoonsataa kordhinta horumarka aaladda Responses ee albaabkaas marinka. Aaladaha bixiyaha asalka ah waxay ka shaqeeyaan adeegaha dushiisa, si ka go'an aaladaha wacaha ee kombiyuutarkaaga. Oggolaanshaha akhriska-keliya ee maxalliga ahi ma xaddido adeegaha. Xiriiriye looma dooran karo naqshadeeye warbixin-keliya ah oo u baahan in dhammaan aaladaha la damiyo: go'doominta aan la taageerin way fashilantaa halkii ay si qarsoodi ah u oggolaan lahayd aaladaha asalka ah. Dooro bar-dhammaad fulin kara sharciga loo baahan yahay.

Natiijooyinka la soo saaray ee PNG, JPEG iyo WebP waxay u muuqdaan sidii kaadhadh sawir oo gooni ah, oo wata Keydi sawirka, kana baxsan soo-saarka aaladda ee la laabay. Sawirrada waa la xaqiijiyaa waxaana lagu hayaa kaydka codsiga ee gaarka ah; URL-yada uu moodeelku bixiyo iyo sawirrada Markdown si toos ah looma soo qaado. Furitaanka taariikhda la keydiyay, dib-u-isku-dayga akhrinta sawirka iyo keydinta sawir hore loo kaydiyay ma codsadaan soo-saaris cusub. Natiijooyinka waxay ku xaddidan yihiin 32 MiB iyo 32 milyan oo bixel sawirkiiba, iyagoo leh kayd warbaahineed oo gaar ah oo la wadaago oo dhan 512 MiB. Xafid sawirrada loo baahan yahay ka hor inta aadan gacanta ku nadiifin kaydka gaarka ah haddii uu buuxsamo. Guji sawirka wadahadalka si aad u furto daawadaha sawirka. Weynee ama yaree, dooro Baaxadda dhabta ah (100%) ama Ku habbee daaqadda, oo jiid si aad u kormeerto faahfaahin. Baxso (Escape) ama Xir daawadaha sawirka waxay dib kuugu celinaysaa wadahadalka. Daawashada iyo weyneyntu waxay dib u isticmaalaan sawirka gaarka ah ee la soo raray; ma codsadaan soo-saaris cusub.

Wadahadallada Responses waxay sii hayaan aqoonsiga jawaabta la qiray iyo aqoonsiyada saxda ah ee wicitaanka shaqada. Xogaha la dhexgalay si toos ah dib looma diro. Wax-ka-beddel ama amar maxalli ah oo aan la hubin dib looma shaqaysiiyo ka dib dib-u-bilaabista; xafid taariikhda oo si cad u samee macne cusub ka dib kormeerka. Isbeddellada lagu sameeyo gaadiidka ama bar-dhammaadka la keydiyay waxay u baahan yihiin dib-u-habeyn cad. Heerka bixiyaha, fashilaadda joojinta iyo dhicitaanka waxaa lagu soo waramiyaa iyada oo aan lagu qarinayn gadaasha beddelka CLI. Madaxa wadahadalku wuxuu muujinayaa borotokoolka ku dheggan wareeggaas. Ka dib markii aad keydiso isbeddellada isku-xirka, fur xulaha CLI / API ee wadahadalka oo guji Dabbaq, xitaa haddii isla isku-xirkaas mar hore la doortay. Tani waxay abuuraysaa wareeg cusub oo leh qaabeynta la keydiyay waxayna xafidaysaa taariikhda wadahadalka. Keydinta isku-xirka oo keliya ma wareejiso wadahadallada firfircoon. Xiriiriyeyaasha sawirka ee qoraalka keliya ah ee hore waxay ahaanayaan qoraal; beddelidda borotokoolku dib uma soo saarayso kumana soo dejinayso natiijooyinkii hore.

Isku-xirrada API waxay isticmaalaan bar-dhammaadkooda iyo aqoonsigooda la habeeyay, si ka go'an rukumashada asalka ah ee CLI. Albaabbada qaarkood waxay gudaha ku isticmaalaan rukumashooyin; ZIAForge ma koobiyeeyso aqoonsiga asalka ah gudaha API. Moodeellada, shuruucda aaladda, halbeegyada caqliga iyo biilasha waxay ku xiran yihiin bar-dhammaadka. Ogaanshaha oo keliya ma caddaynayo garashada. Furayaasha ku hay Isku-xirrada, weligaana ha gelin qoraalka hawsha ama sawirrada shaashadda.

Grok Connector v1 dartiis, keydi isku-xir Responses oo cad oo isticmaal Kormeer xiriiriyaha si aad u akhrido awoodihiisa la xayeysiiyay, moodeellada iyo isticmaalka adoon samaynayn garasho. Heerarka caqliga moodeelka iyo xulashada daaqadda macnaha guud waxay ka yimaadaan buug-yaraha. Xadka wareegga asalka ah ee ikhtiyaariga ah waa 1–100. Boqolleyda kootada ee maqan waxay ahaanayaan kuwo aan la garanayn; dhammaadka xilliga isticmaalku ma aha lacag-bixinta rukumashada ama taariikhda dhicitaanka. Ku dabaq isbeddellada isku-xirka wadahadal kasta oo jira ka hor inta aysan ka dhaqangelin halkaas.

Su'aalaha Grok waxay u muuqdaan sidii kaadhadh wata su'aasha asalka ah ee saxda ah iyo calaamadaha xulashada. Dooro jawaabaha la codsaday ama geli jawaab gaar ah, ka dibna dir hal mar. Kulamada qorshayntu waxay bixin karaan wada-hadal ama tallaabooyin ka-boodid ah. Kaadhadhka oggolaanshaha bixiyuhu waxay muujinayaan dookhyada asalka ah ee saxda ah waxayna u baahan yihiin xulashadaada si caadi ah. Kuwani way ka duwan yihiin oggolaanshaha faylka/amarka maxalliga ah. Joojinta, dhicitaanka ama dib-u-bilaabistu waxay kaadhadhkii hore ka dhigtaa kuwo aan shaqaynayn; gudbin aan la hubin si toos ah looma celiyo.

Qaybta Isku-xirrada dhexdeeda, isku-xirka Grok wuxuu awood u siin karaa Si toos ah u oggolow oggolaanshaha hal-mar ah ee bixiyaha; waa dansan yahay si caadi ah. Tani waxay khuseysaa wadahadallada cusub ama wadahadal jira ka dib marka aad si cad dib ugu habayso adoo isticmaalaya Dabbaq. Keydinta isku-xirka oo keliya ma beddelayso wadahadalka socda. Marka la hawlgeliyo, ZIAForge waxay si toos ah u gudbisaa keliya hal oggolaansho oo hal-mar ah, oo aan caddayn ahayn oo aan dhicin oo uu bixiyo Grok waxayna diiwaangelisaa go'aankaas tooska ah ka hor inta aan la dirin. Kaarku wuxuu aqoonsadaa oggolaansho toos ah. Su'aalaha iyo oggolaanshaha faylka ama amarka maxalliga ah waxay weli u baahan yihiin jawaabtaada. Wadahadallada akhriska-keliya waxay hayaan oggolaanshaha gacanta ee bixiyaha. Oggolaanshaha joogtada ah weligood si toos ah looma doorto; dookhyada hal-mar ah ee maqan ama madmadowga leh waxay ahaanayaan kuwo gacanta ah. Gudbinnadii hore ama aan la hubin weligood dib looma soo celiyo loomana dayo si toos ah.

Wadahadalka Grok dhexdiisa, badhanka ku-lifaaqa wuxuu furayaa xulaha nidaamka ee loogu talagalay PNG, JPEG iyo WebP. Afar sawir ayaa loo oggol yahay fariin kasta, ilaa 16 MiB midkiiba iyo 20 MiB wadajir ahaan, oo leh 32 milyan oo bixel sawirkiiba. Nuqullada qabyo-qoraalka gaarka ah waxay leeyihiin miisaaniyad dhan 128 MiB waxayna ka tirsan yihiin wareegga wadahadalkaas. Waxaa la gudbiyaa keliya marka aad dirto. Diritaannada fashilmay ama aan la hubin waxay sii haystaan aqoonsigooda qabyo-qoraalka. Fariimaha sawirrada leh ma isticmaali karaan safka qoraalka keliya ah. Ka saar ama si cad u tuur qabyo-qoraalka sawirka ee sugaya ka hor inta aadan beddelin ama dib u bilaabin wareeggiisa; tuurista qabyo-qoraalku kama noqonayso fariin hore loo gaarsiiyay. Fariimaha sawirka ee la aqbalay waxay sii haystaan kaararka sawirka gaarka ah ee kormeerka dambe, weyneynta iyo keydinta.

Aaladaha bixiyaha Grok waxay ku kooban yihiin soo-raadinta shabakadda ee la taageero, sawirrada, su'aalaha is-dhexgalka ah iyo soo-saarista muuqaalka ee ku xiran awoodda. Aaladaha mashruuca maxalliga ah waxay weli ka shaqeeyaan kombiyuutarka gudihiisa gal-shaqeedka uu doortay backend-ku. Dib-u-eegista akhriska-keliya waxay meesha ka saartaa soo-saarista iyo wax-ka-beddelka sawirka/muuqaalka bixiyaha, su'aalaha, qoraallada maxalliga ah iyo amarada. Kulamada Caawinta ee bilaa-aaladaha ah iyo kulamada naqshadeeyaha warbixinta-keliya ma isticmaali karaan astaanta xiriiriyahan. Soo-saarista maqalka, qoraal-u-rogidda iyo codka tooska ah lama bixiyo; MP4 waxaa laga yaabaa inuu ka koobnaado raadkiisa maqalka ee caadiga ah. Aalad la helay oo keliya ma aha caddayn natiijo la isticmaali karo.

Muuqaalka dartiis, isticmaal wadahadal Grok oo wax lagu qori karo, ku lifaaq sawir tixraac ah ama sii wad wadahadalkii abuuray mid, oo sharax dhaqdhaqaaqa iyo halbeegyada la doonayo. Si aad si cad u doorato sawir hore, isticmaal Keydi sawirka kuna lifaaq faylka la keydiyay. Daawashada ama keydinta sawirku dib uma soo saarayso isaga. Ma jiro foom halbeeg-muuqaal oo gooni ah: codsigu wuxuu isticmaalaa wadahadalka iyo kaadhadhka su'aalaha/oggolaanshaha asalka ah. Ka hor wareegga cusub ee isticmaalaha, ZIAForge waxay awood siisaa keliya aaladaha muuqaalka ee xiriiriyuhu ku xayeysiiyo inay diyaar yihiin, shaqeynayaan oo la xaqiijiyay. Fashilka ogaanshuhu wuxuu muuqaalka ka dhigayaa mid aan la heli karin wareeggaas. Isbeddelka ku yimaada awoodaha asalka ah wuxuu bilaabi karaa macnaha guud ee bixiye cusub oo wata taariikhdaada muuqata iyo sawirrada kaydsan ee u qalma isagoo ilaalinaya wadahadalka maxalliga ah; hawlgallada kala go'ay dib looma celiyo. Haddii sawirku uusan ku habboonayn xaddidaadaha ku-lifaaqa, wareejintu waxay soo sheegaysaa ka-tegitaankaas; ku lifaaq tixraaca loogu talagalay si cad.

Xiriiriyuhu wuxuu bixiyaa image_to_video oo wata sawir tixraac ah oo loo baahan yahay, 6 ama 10 ilbiriqsi iyo hababka hore loo dejiyay ee 480p/720p. Habkiisa reference_to_video wuxuu taageeraa 1–15 ilbiriqsi iyo saamiyada cabbirka 1:1, 16:9, 9:16, 4:3, 3:4, 3:2 ama 2:3; wakiilku wuxuu marka hore soo saari karaa tixraac marka loo baahdo. Ka codso dejimaha loogu talagalay wadahadalka dhexdiisa. ZIAForge ma muujiso barta-dhammaadka gaarka ah ee /grok/media ama xulaheeda tooska ah. Hababka hore loo dejiyay iyo halbeegyada la taageero waa awoodaha bixiyaha, ma aha dammaanad qaadka joogga bixel ee saxda ah, waqtiga fareemka ama natiijo kasta oo farshaxanimo.

Muuqaal Grok oo dhammaystiran wuxuu soo baxaa keliya ka dib marka faylka la ilaaliyo ee MP4 la soo dejiyo oo la hubiyo MIME-kiisa, baaxaddiisa, SHA-256 iyo qaab-dhismeedkiisa. Qoraal sheegaya in muuqaalku diyaar yahay, sawir beddel ah ama xiriiriye kayd ma aha muuqaal la daawan karo. Khaladaadku waxay ahaanayaan kuwo muuqda iyada oo aan la codsan soo-saaris beddel ah. Isticmaal koontaroollada kaarka muuqaalka si aad u daarto, u hakiso, u raadiso ama u hagaajiso codka marka uu jiro. Daawashadu si toos ah uma bilaabato. Keydi muuqaalka wuxuu furayaa wada-hadalka goobta nidaamka. Taariikhda wadahadalka ee la keydiyay waxay xafidaysaa MP4-ka gaarka ah ka dib markii codsiga gabi ahaanba laga baxo/dib loo bilaabo; daawashada iyo keydintu waxay isticmaalaan baydad maxalli ah iyada oo aan loo baahnayn garasho ama soo-dejis kale oo bixiye. Muuqaalladu waxay ku xaddidan yihiin 128 MiB midkiiba gudaha kaydka warbaahinta gaarka ah ee la wadaago ee 512 MiB. Keydi warbaahinta loo baahan yahay ka hor inta aadan gacanta ku nadiifin kaydka buuxsamay. Kombiyuutarku waa inuu taageeraa codec-ka muuqaalka; faylasha aan la taageerin ama waxyeelloobay waxay muujinayaan qalad.

Claude Connector v1 dartiis, dooro Anthropic Messages oo geli asalka HTTPS ee xiriiriyaha iyada oo aan la socon /v1. Keydi, ka dibna Kormeer xiriiriyaha si aad u akhrido aaladaha la xayeysiiyay, fursadaha moodeelka, heerka iyo isticmaalka adoon samaynayn garasho. Dooro fulinta wacaha ama midka bixiyaha-asalka ah, xulasho aalad asal ah oo cad, qaabka oggolaanshaha asalka ah, xadka wareegga/soo-saarka iyo koontaroollada fikirka ee la taageero; nidaamka soo-saarka JSON ee ikhtiyaariga ah iyo habka taariikhda-qabow sidoo kale waa la heli karaa. Dejimaha caadiga ahi waxay isticmaalaan habka wacaha, oggolaanshaha asalka ah ee gacanta ah iyo aalado asal ah oo aan jirin. Qiimaha isticmaalka ee maqan waxay ahaanayaan kuwo aan la garanayn; dib-u-dejinta isticmaalku ma aha taariikhda bixinta lacagta ama dhicitaanka rukumashada. Furaha API ee xiriiriyuhu wuxuu ka go'an yahay aqoonsigiisa dhabta ah ee rukumashada asalka ah. Ku dabaq isbeddellada la keydiyay wadahadal kasta oo jira ka hor inta aysan ka dhaqangelin halkaas.

Aaladaha wacaha Claude waxay ka shaqeeyaan galka hawsha maxalliga ah iyagoo wata oggolaansho gooni ah oo loogu talagalay qoraallada iyo amarada la taageero. Keliya WebSearch iyo WebFetch ee si cad loo doortay ayaa si asal ah ugu shaqeyn kara habka wacaha. Habka bixiyaha-asalka ah wuxuu aaladaha la doortay ku dhex wadaa goob-shaqeedka adeegaha xiriiriyaha mana bixiyo aaladaha faylka ama amarka maxalliga ah. U sharxidda galka maxalliga ah adeegaha ma siiso marin loogu galo isaga. Kulamada akhriska-keliya waxay diidaan wax-ka-beddelka asalka ah ama aaladaha la fulin karo; kulamada bilaa-aaladaha ah waa inaysan lahayn wax aalado asal ah. Kaarka horumarka aaladda adeegaha weligiis kuma fuliyo waxa ku jira kombiyuutarka. Helitaanka aaladda asalka ah iyo qaabka oggolaanshaha asalka ah waa dejimo kala duwan.

Kaadhadhka oggolaanshaha asalka ah ee Claude waxay u baahan yihiin go'aan cad oo oggolaansho ama diidmo ah marka la codsado. Ma beddeli karaan gelinta aaladda mana bixin karaan oggolaanshaha faylka/amarka maxalliga ah. Su'aalahu waxay muujinayaan qoraalka saxda ah ee la bixiyay iyo xeerarka xulashada; dooro jawaabaha ama geli jawaab gaar ah, ka dibna gudbi hal mar. Xulashada oggolaanshaha tooska ah ee Grok ma khuseyso Claude. Dhicitaanka, Joojinta, dib-u-bilaabista ama gaarsiinta aan la hubin waxay kaadhadhkii hore ka dhigtaa kuwo aan shaqaynayn. Sii wadashadu waxay xafidaysaa jawaabta la leeyahay iyo qaabeynta ku dheggan; codsiyada, aaladaha iyo jawaabaha kala go'ay dib looma celiyo. Habka macnaha guud ee taariikhda-qabow waa soo-dejis lumis leh oo cad, ma aha soo-kabashada kalfadhi asal ah. Jooji waxay tirtirtaa hawlgalka la leeyahay marka jawaabtiisa la ogaado; kama noqonayso saamaynta dhammaystiran mana joojiso adeegyada aan xiriirka la lahayn. Joojinta aan la hubin waxay ahaanaysaa mid muuqata.

Wadahadalka Claude dhexdiisa, xulayaasha lifaaqa nidaamku waxay aqbalaan sawirrada PNG, JPEG, GIF iyo WebP, PDF iyo dukumiintiyada qoraalka ee UTF-8. Qoraalku wuxuu leeyahay afar meelood oo lifaaqa la wadaago ah. Sawirrada iyo PDF-yadu waxay oggol yihiin 16 MiB midkiiba; dukumiintiyada qoraalku waxay oggol yihiin 1 MiB. Sawirradu waxay oggol yihiin 32 milyan oo bixel. Qabyo-qoraalka sawirka iyo qabyo-qoraalka dukumiintiga mid kasta wuxuu oggol yahay 20 MiB wadajir ahaan waxayna leeyihiin miisaaniyad kaydinta gaarka ah oo kala go'an oo dhan 128 MiB. Codsigu wuxuu kaloo leeyahay xad la furay oo wadajir ah oo dhan 32 MiB, iyadoo culayska codsiga siraysan laga yaabo inuu yareeyo. Nuqullada gaarka ahi waxay ka tirsan yihiin wareegga wadahadalka hadda socda waxaana la gudbiyaa keliya marka aad dirto. Diritaannada fashilmay ama aan la hubin waxay sii haystaan aqoonsigooda qabyo-qoraalka; fariimaha lifaaqa leh ma geli karaan safka qoraalka keliya ah. Ka saar ama si cad u tuur lifaaqyada sugaya ka hor inta aadan beddelin ama dib u bilaabin wareegga. Sawirrada la aqbalay waxay weli diyaar u yihiin horudhac gaar ah iyo keydin; dukumiintiyada laguma dhex daro sidii PDF ama HTML.

Aaladaha adeegaha ee Claude waxay abuuri karaan faylal la soo dejisan karo. Kaarka faylku wuxuu soo baxaa ka dib marka nuxurkiisa la ilaaliyo la soo dejiyo oo la hubiyo MIME-kiisa, baaxaddiisa saxda ah iyo SHA-256. Wuxuu ka baxsan yahay soo-saarka aaladda ee la laabay wuxuuna muujinayaa magaca, baaxadda, nooca iyo xogta dib-u-eegista ama beddelidda ee la bixiyay. Isticmaal Keydi si aad u doorato meel loo socdo wada-hadalka nidaamka dhexdiisa. Nooc cusub oo aan la beddeli karin wuxuu noocii hore ka dhigayaa mid diyaar ah. Faylashu waxay oggol yihiin 128 MiB midkiiba gudaha kaydka artifact-ka gaarka ah ee kala go'an ee 1 GiB; keydi faylasha loo baahan yahay ka hor inta aadan gacanta ku nadiifin kaydka buuxsamay. Taariikhda la kaydiyay iyo keydintu ma codsadaan garasho ama soo-dejis kale. Dhammaan kaadhadhka artifact-ku waa kuwo Keydin-keliya ah, oo ay ku jiraan PDF; HTML, SVG iyo qaababka aan la garanayn waxay ahaanayaan soo-dejisyo caadi ah weligoodna lama fuliyo. URL-yada uu moodeelku bixiyo iyo sawirrada Markdown si toos ah looma soo qaado. Faylasha ay aaladaha adeeguhu sameeyeen kama tarjumayaan soo-saarista asalka ah ee sawirka, muuqaalka, maqalka ama hadalka ee Claude.

Tilmaamaha la xidhiidha: [Isku-xirrada API](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md) · [Claude Connector v1](../../CLAUDE_CONNECTOR_V1.md).

<a id="settings"></a>

## Dejinta, luqadaha iyo dib-u-dejinta badbaadada leh

Dejinta guud waxay doorataa goobta shaqada, luqadda interserfeyka iyo kuwa caadiga ah. Xiriirradu waxay maareeyaan dhibcaha dhamaadka ee API. Hore-u-dejinta iyo Kooxaha dib u eegistu waxay hayaan qaabaynta doorka. Xakamaynta fog waxay maaraysaa aqoonsiyada maxalliga ah, baaxadda adeegaha iyo rukhsadaha milkiilaha; Cusboonaysiintu waxay maaraysaa ilaha/kanaalka sii-deynta. Ku saabsan waxay muujisaa dhismaha saxda ah ee shaqaynaya.

Luqadda muuqaalka waxay ka go'an tahay luqadda qoraalka dalabka iyo heerka dib-u-eegista dukumentiyada. Magacyada wax-soo-saarka, aqoonsiyada amarka, kordhinta faylasha, aqoonsiyada nooca bixiyaha, iyo magacyada uu isticmaaluhu abuuray waxay ahaanayaan aqoonsiyo ahaan sidooda. Caawintu waxay raacaysaa luqadda muuqaalka ee la doortay marka uu jiro turjumaad hadda shaqaynaya; turjumaadaha mashiinka waa la calaamadeeyaa, Ingiriiskuna wuxuu ahaanayaa tixraaca rasmiga ah ee asalka ah.

Kaydi waxay dhaqangelisaa qaabeynta muuqata. Dib-u-dejinta keydka xogta ama dib-u-dejinta warshadda waxay meesha ka saari kartaa xog-hoosaadka arjiga; ilaali faylasha iyo kayd la tijaabiyay ka hor inta aanad si ku-talagal ah u isticmaalin dib-u-dejinta. Hawlgalladani waa tallaabooyin uu leeyahay milkiilaha maxalliga ah. Ha u isticmaalin sidii waddo gaaban oo lagu baaro hab-shaqeed fashilmay ama diiwaan kharribmay.

Tilmaamaha la xidhiidha: [Tilmaamaha maxalliyeynta](../../LOCALIZATION.md) · [Soo-kabashada xogta](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Weydii kaaliyaha Caawinta

Fur Caawinta, ka dooro qaabeynta hore ee ku xiran ee la keydiyay qeybta kaaliyaheeda, oo wax ka weydii ZIAForge. Jawaabuhu waxay isticmaalaan hagaha Ingiriisiga ee rasmiga ah ee hadda jira iyo luqadda muuqaalka ee aad dooratay. Badhamada tixraaca qaybaha waxay furaan mawduucyada hagaha ee khuseeya, si aad sharraxaadda u barbar-dhigto tixraaca.

Kaaliyahani waxa uu hayaa wada-hadal gaar ah oo gooni ah oo gaaraya ilaa 100 qoraal oo la keydiyay iyo 3 MiB. Gali su'aal gaareysa ilaa 12,000 xaraf; Dir ayaa weydiinaysa, Jooji waxay baabi'inaysaa jawaabta socota iyadoo su'aashaadu kuu diyaarsan tahay, Nadiifina waxay tirtiraysaa wada-hadalkan Caawinta. Qabyo-qoraalkaaga aan la dirin iyo xulashada qaabeynta hore waxay sii jirayaan marka la xiro ama dib loo furo Caawinta isla fadhiga arjiga dhexdiisa, laakiin qabyo-qoraalka laguma kaydiyo disk-ga. Kaaliyuhu ma diro amarada arjiga, ma beddelo hab-shaqeedka, mana aqbalo albaab-hubineed. Taladu ma aha xaqiijin toos ah oo ku saabsan hawl, koonto ama xiriir dibadeed.

Fadhiyada Caawinta ee Claude Code iyo API waxay dhaqangeliyaan xeerka la taageeray ee aan qalabka lahayn. Fadhiyada Caawinta asalka ah ee Codex iyo Antigravity waxay u baahan yihiin oggolaanshaha kombuyuutarka asalka ah ee milkiilaha maxalliga ah ee jira. Haddii la damiyo, arjigu wuxuu sharraxayaa shuruudda hordhaca ah halkii uu ka dooran lahaa bixiye kale. Kaliya milkiilaha ayaa ka kicin kara habaynta maamulka maxalliga ah; kaaliyuhu iskii uma kicin karo.

Caawinta Codex waxay isticmaashaa aag go'doonsan oo wax-akhris kaliya ah waxayna diiddaa codsiyada oggolaanshaha qalabka. Antigravity waxa ay isticmaashaa habka qorshaha iyo calanka aagga go'doonsan ee asalka ah. Hababkan asalka ahi ma aha dammaanad buuxda oo xaddidaadda nidaamka qalliinka ah. Hash-ka hagaha asalka ah wuxuu aqoonsanayaa tixraaca loo adeegsaday jawaabta; sharrax la soo saaray weli wuu khaldanaan karaa, sidaas darteed baar qaybaha ku xiran ka hor inta aanad ficil qaadin. Jawaabihii hore waa la calaamadeeyaa marka nooca hagaha asalka ahi uu ka duwan yahay hagaha hadda jira.

Tilmaamaha la xidhiidha: [Hagaha rasmiga ah iyo daryeelka turjumaada](../../HELP_MAINTENANCE.md) · [Kaaliyaha arjiga iyo oggolaanshaha](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Kaaliyaha iyo Telegram

Kaaliyuhu wuxuu isticmaalaa qaabeynta hore ee la doortay iyo isla API maamulka arjiga. Oggolaanshaha lagu baarayo xaaladda iyo oggolaanshaha lagu fulinayo hawlgallada way kala go'an yihiin. Baar amarada iyo natiijooyinka: qoraalka kaaliyuhu caddayn uma aha in ficilku dhammaaday.

Telegram waxa kicin kara oo kaliya milkiilaha maxalliga ah, isaga oo isticmaalaya token-ka bot-ka ee jira iyo ID tiro ah ee milkiilaha. Maamulku waxa uu gaar u yahay wada-sheekaysiga gaarka ah ee milkiilahaas. Bot aan la qaabayn ama aan shaqaynayn waa inuusan helin fariimaha arjiga.

Ha ku dhajin token-ka bot-ka wada-sheekaysiga caadiga ah. Qaabaynta isku-xirku ma caddaynayso xiriirka Telegram si toos ahna uma abuurto bot. Shaashad-qaadista iyo jawaabuhu waxay ka koobnaan karaan xog gaar ah oo ku saabsan goobta shaqada.

Dooro qaabeynta hore ee kaaliyaha oo bixi oggolaanshaha hawlgalka arjiga si ka go'an baaritaanka. Fulinta kaaliyaha ee Codex iyo Antigravity waxay u baahan yihiin oggolaanshaha asalka ah ee milkiilaha; laguma beddelo si aamusan fadhi API ama Claude oo aan qalab lahayn. Sawirrada shaashadda waxaa lagu muujin karaa wada-hadalka kaaliyaha, laakiin xogta hadda loo geliyo moodalka kuma jiraan falanqaynta sawirka. Ha u qaadanin in kaaliyuhu si muuqaal ah u baaray sawir sababtoo ah kaliya wuu soo bandhigay.

Kaaliyuhu wuxuu baari karaa soo-koobitaannada, hawlaha, wada-hadallada, xaaladda hab-shaqeedka, macnaha guud ee hawsha iyo daaqadaha arjiga isaga oo adeegsanaya aalado noocaysan. Wuxuu beddeli karaa habaynta caadiga ah ee la oggol yahay wuxuuna bilaabi karaa hawlgallada arjiga ee la fasaxay. Ma bixin karo xuquuqda asalka ah, ma kashifi karo aqoonsiyada kaydsan, meel fog kama beddeli karo oggolaanshaha goobta shaqada ee asalka ah, mana oggolaan karo albaabka Forge sababtoo ah kaliya way ku habboon tahay.

Tilmaamaha la xidhiidha: [Heshiiska maamulka arjiga](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Ku shaqaysii bot-kaaga gaarka ah ee Telegram

Abuur ama hel bot kuu gaar ah, bilow wada-sheekaysigiisa gaarka ah, oo geli token-kiisa iyo Telegram isticmaale ee ID lambar ah habaynta maamulka maxalliga ah. Kici isku-xirka kaliya marka aad doonayso in arjigu xirmo. ID milkiilaha waa aqoonsi isticmaale, ma aha magac isticmaale ama ID bot. Kaliya fariimaha ka yimaada isticmaalahaas ee ku jira isla wada-sheekaysigaas gaarka ah ayaa la aqbalayaa.

Isticmaal /start, /menu ama /status si aad u hesho dulmar ku saabsan nooca socda, tirada mashruuca/hawsha iyo xaaladaha hawsha. Badhamadu waxay furaan Mashaariicda, Hawlaha, Shaashad-qaadista, Caawinta iyo Luqadda. Liisasku waxay muujinayaan siddeed shay bog kasta, iyadoo ay la socdaan hagidda Dib, Dib-u-cusboonaysii, Hoyga iyo Hore/Xiga. Badhamada mashruucu waxay kala shaandheeyaan liiska hawlaha. Kaarka hawshu wuxuu muujinayaa horumarka hab-shaqeedka ee la kaydiyay, moodalka/qaabeynta hore iyo su'aalaha taagan haddii ay jiraan.

Fur Wada-hadallada hawsha si aad u aragto dulmar ku saabsan wada-hadallada furan/dhowaan dhacay iyo wada-hadallada wejiga hab-shaqeedka. Dulmar kastaa wuxuu muujinayaa ilaa lixdii fariimood ee ugu dambeeyay ee isticmaalaha/kaaliyaha, kuwaas oo si muuqata loo gaabiyay ilaa 200 xaraf midkiiba. Sababaynta gaarka ah lama muujiyo. Akhrinta taariikhdu ma bilowdo bixiye. Dulmaradu waa kuwo wax-akhris kaliya ah: qoraalka caadiga ah iyo /ask TEXT weli waxay la hadlayaan kaaliyaha arjiga, marnaba si dadban ulama hadlayaan wada-hadalka hawsha ee aad eegayso.

Orod / Sii wad waxay dib u akhrisaa hab-shaqeedka hadda ee Code ama Work waxayna bilaabaysaa hab-shaqeed la keydiyay oo u qalma. Haki waxay codsanaysaa hakadkiisa. Labadooduba ma aqbalaan shuruudo, faahfaahin farsamo, qorshe, natiijooyinka dib-u-eegista ama su'aalo; go'aan taagan ayaa ka hortagaya Orod. Go'aamada ka gaar arjiga dhexdiisa, ama isticmaal amar noocaysan oo si cad loo fasaxay oo wata albaab-hubineedkiisa iyo dib-u-eegistiisa saxda ah ee hadda.

Isticmaal Luqadda ama /language si aad u doorato mid ka mid ah 56-ka luqadood ee muuqaalka magaceeda asalka ah. Tani waxay dookha u kaydinaysaa bot-kan iyo milkiilaha oo kaliya. Isticmaal luqadda arjiga waxay tirtiraysaa dookhaas. Ma beddelayso luqadda arjiga ama oggolaanshaha gelitaanka midna; fariimaha jira si toos ah dib looma soo diro.

Hagiddu caadi ahaan waxay cusboonaysiisaa isla fariinta liiska ee la daabacay. Badhamadu waxay leeyihiin aqoonsiyo aan la daalacan karin oo dhacaya 15 daqiiqo ka dib waxaana la isticmaali karaa hal mar; beddelidda kaarku waxay burinaysaa badhamadiisii hore. Badhamada dhacay, la isticmaalay, fariintoodu is-waafaqi weyday, iyo kuwii hab-socodkii hore ma samayn karaan wax ficil ah. Fariin aan gabi ahaanba la sixi karin waxaa lagu beddeli karaa kaar cusub; cilad shabakadeed oo aan la garanayn dib looma tijaabiyo sidii fariin cusub.

Marka la hawlgeliyo, soo-ururiyaha xogta wuxuu tuuraa shaqooyinkii hore ee xayirmay wuxuuna diiwaangeliyaa aqbalaadda cusboonaysiinta ka hor dirista si amaradii go'ay aan si toos ah dib loogu celin marka dib loo bilaabo. Tani waxay ka hortagtaa dib-u-celinta; ma dammaanad qaadayso dhammaystirka. Hubi xaaladda/macnaha guud ka hor inta aanad si ku-talagal ah u bixin shaqo cusub cilad ka dib. Ma jiraan ogeysiisyo toos ah oo ku saabsan xaaladda hawsha.

Amarada tooska ah weli way diyaar yihiin: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot iyo /ask TEXT. /new {JSON} waxay ku abuurtaa hawl iyada oo adeegsanaysa createTask noocaysan; /command {JSON} waxay dirtaa amar buug-liisheed oo toos ah. Akhri buug-liiska tooska ah si aad u aragto qaababka doodaha. Isla oggolaanshaha dambe iyo bixinta fayl-galka ayaa khuseeya sida arjiga dhexdiisa.

Arjigu marnaba uma diro qiimayaasha token-ka bot-ka ee kaydsan kaaliyaha. Shaashad-qaadista, soo-koobitaannada iyo qoraalka wada-hadalku si kastaba ha ahaatee waxay ka koobnaan karaan xog gaar ah oo mashruuca ku saabsan. Jooji isku-xirka heer maxalli ah haddii aan bot-ka ama koontada milkiilaha mar dambe la aamini karin. Ku beddel token-ka baxsaday bixiyaha bot-ka, ka dibna cusboonaysii qaabeyntiisa maxalliga ah ee sir-qoridda leh.

Tilmaamaha la xidhiidha: [Bot-ka gaarka ah iyo amarada](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Oggolaanshaha kombuyuutarka asalka ah ee milkiilaha kaliya

Gelitaanka kombuyuutarka asalka ahi wuxuu ku bilowdaa isagoo damisan. Kaliya milkiilaha ayaa ka kicin kara Habaynta maxalliga ah → Maamulka meel fog. Kaaliyaha iyo amarada HTTP/MCP/Telegram iskood uma kicin karaan calankan. Haddii hawlgal la diido, kaaliyuhu waa inuu sharraxaa habaynta oo uu u daayaa milkiiluhu inuu go'aansado.

Marka si cad loo kiciyo, computer.run waxay aqbashaa fayl la fulin karo, qaab-dhismeedka doodaha iyo fayl-galka shaqada ee saxda ah oo ikhtiyaari ah. Ma isticmaasho wax dhex-gelin qolof ah, waxay leedahay xaddid 30 ilbiriqsi ah waxayna natiijada ku xaddidaysaa 1 MiB. Fayl-gal la bixiyay oo maqan ama aan sax ahayn waa la diidayaa; ka tagidda cwd waxay isticmaashaa fayl-galka habaynta ee uu arjigu leeyahay, ma aha HOME. Ka bax waxay baabi'inaysaa amarada firfircoon ee la leeyahay waxayna sugaysaa nadiifinta hannaankooda.

Baaxadda akhriska/shaqada ee arjiga iyo gelitaanka asalka ahi waa go'aanno kala go'an. Geed-shaqeedku ma xaddidayo gelitaanka nidaamka faylka ee bixiye aan la xaddidin. Ka noqo gelitaanka asalka ah hawsha ka dib haddii aan mar dambe loo baahnayn, oo baar rasiidhada amarka halkii aad qoraalka kaaliyaha u qaadan lahayd caddayn.

Tilmaamaha la xidhiidha: [Heshiiska maamulka ee milkiilaha kaliya](../../../shared/control.ts).

<a id="remote"></a>

## Birawsarka iyo tusaalooyinka meel fog

Milkiilaha maxalliga ahi wuxuu kiciyaa adeegaha wuxuuna doortaa cinwaankiisa, dekeddiisa iyo baaxaddiisa: wax-akhri si aad u baarto ama shaqee si aad ficillo u samayso. Cinwaanka caadiga ah ee 127.0.0.1 waxa laga heli karaa kombuyuutarkan oo kaliya. 0.0.0.0 waxay wax ka dhagaysataa is-dhexgalka shabakadda; dib u eeg gelitaanka shabakadda ka hor inta aanad kicin.

Birawsarku wuxuu furaa isla muuqaalka ka dib marka lagu galo token. Ha ku darin token-nada xiriiriyeyaasha guud ama shaashad-qaadista. HTTP kaligeed ma sir-qariso taraafikada; isticmaal marin la ilaaliyo marka aad ku jirto shabakad aan la aamini karin.

Milkiiluhu wuxuu ku qaabeeyaa tusaalooyinka kale URL iyo token. Qaybta dambe waxay wakiil ka noqotaa codsiyada; tani mashaariicdooda uma soo guuriso mashiinka maxalliga ah. Hubi tusaalaha la doortay ka hor ficil kasta.

Amarada noocaysan iyo dhacdooyinku waxay wataan maamulka arjiga. Baaxadda akhrisku ma oggolaato wax-ka-beddelka hawsha. Maamulka kombuyuutarka asalka ahi waa doorasho gooni ah oo milkiilaha maxalliga ah wuxuuna ku bilowdaa isagoo damisan.

Arjigu waa inuu shaqeeyaa si loo maamulo birawsarka, Telegram iyo wakiillada dibadda. Tusaale kastaa wuxuu leeyahay borofayl u gaar ah, xaalad hawleed, token iyo deked adeegaha. Ha ku wada isticmaalin hal borofayl isku mar tusaalooyin madax-bannaan dhexdooda. Dhacdooyinka birawsarka iyo jawaabaha amarku waxay ku kooban yihiin tusaalaha la doortay; beddelidda UI-ga meel kale uma wareejiso faylasha mana nuquliso gelitaanka asalka ah.

Tilmaamaha la xidhiidha: [HTTP iyo maamulka tusaalaha](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes iyo wakiillada kale ee dibadda

Isticmaal API maamulka arjiga ee la xaqiijiyay ama buundada stdio ee MCP ee la socota. Kici adeegaha heer maxalli ah, dooro wax-akhri ama shaqee oo u qaabee macmiil kasta URL iyo token-ka tusaalahaas. Node.js 22 ama ka cusub ayaa loo baahan yahay si loo kiciyo buundada madaxa-bannaan ee MCP; arjiga Electron ma rakibo macmiilkaaga wakiilka. Birawsarka URL ma aha barta dhammaadka ee HTTP MCP ee la daawan karo: u sii geli sidii ZIAFORGE_URL buundada stdio.

Buuladu waxay soo bandhigtaa ziaforge_status, ziaforge_commands, ziaforge_command iyo ziaforge_screenshot. Ka bilow xaaladda iyo buug-liiska amarka tooska ah, ka dibna akhri system.context ee hawsha la doortay. Amarada noocaysan waxay raacaan isla dib-u-eegista, albaabka, fayl-galka hawsha iyo hubinta nadiifinta sida UI-ga maxalliga ah.

Buug-liiska amarka tooska ah waxaa ku jira documentation.guide, oo ah caawinta Ingiriisiga ee rasmiga ah, oo wadata waddadeeda asalka ah iyo sourceSha256. Injineerka qaab-dhismeedka gudaha ee arjigu wuxuu isla tixraacan ka helaa qalabkiisa. Tani waxay wakiillada siinaysaa macnaha guud ee wax-soo-saarka oo dhan iyadoon lagu tiirsanayn qoraallo hore; dukumentiyadu marnaba ma bixiyaan oggolaansho gelitaan mana beddelaan go'aan qof bini'aadam ah oo hadda jira.

Wakiilladu waa inay ka wada hadlaan shuruudaha, go'aannada farsamo iyo qorshaynta fikrad kooban oo bini'aadam ka timid. Waa inay dhowraan albaab-hubineedada bini'aadamka ee cad, moodallada la doortay, xeerka gacanta/Auto iyo dib-u-eegista loo baahan yahay. Waa inaysan been-abuurin oggolaansho, dib u soo celin amarro aan la hubin iyagoo wata ID cusub, ama aysan daabicin isbeddellada Git iyadoo aan la helin ujeeddada milkiilaha.

U qaabee dhowr adeegto MCP oo magac leh dhowr rakibidood. Beddelidda tusaalaha waa go'aan waddo-maris ah, ma aha is-waafajin. Tusaalooyinka qaabaynta OpenClaw iyo Hermes waxay ku jiraan AGENT_CONTROL.md; diyaarinta gaarka u ah macmiilka iyo is-waafaqsanaanta waa in loo baaro nooca macmiilka ee rakiban.

Kaydka ku-meel-gaarka ah ee dibadda ee requestId waxa uu ka hortagaa soo-noqnoqoshada koox codsiyo ah oo xaddidan oo kaliya inta uu arjigu shaqaynayo. Hawlgallada waara waxay isticmaalaan aqoonsiyadooda: createRequestId ee abuurista hawsha, commandId ee go'aannada hab-shaqeedka, clientMessageId ee fariimaha iyo operationId ee wax-ka-beddelka Git. Xafid aqoonsiga asalka ah iyo xogta rarka ka dib qirasho aan la garanayn; akhri xaaladda la kaydiyay ka hor inta aanad si ku-talagal ah u soo saarin shaqo cusub.

Tilmaamaha la xidhiidha: [Tilmaamaha macmiilka MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI maxalli ah iyo xaddidaadaha otomaatigga

Diraha ziaf wuxuu maamulaa isla arjiga shaqaynaya iyo hab-shaqeedka la kaydiyay. Laga bilaabo koodhka asalka ah, isticmaal npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, ama npm run ziaf -- pause --task TASK_ID. Qirasho guul leh oo Bilow ah macnaheedu maaha in hawshu dhammaatay.

--until-success waxay si ku-talagal ah u kicinaysaa Auto ee hab-shaqeedka la kaydiyay, laakiin su'aalaha, dib-u-eegista, albaabbada aqbalaadda, xaddidaadaha iyo baraha hubinta weli way khuseeyaan. Ctrl+C waxay ka baxaysaa diraha goob-joogga ah; si dadban uma joojinayso hab-shaqeedka arjiga. Eeg CLI.md si aad u aragto koodhadhka bixitaanka, barta dhammaadka ee maxalliga ah iyo maaraynta borofaylka.

Muuqaalka Otomaatigga hadda wuxuu kaydiyaa qeexitaannada muujinta iyo tiriyeyaasha socodka maxalliga ah. Ma aha jadwal-sameeye soo-noqnoqda oo la xaqiijiyay mana caddaynayo in wareegga moodalka asalka ah uu shaqeeyay. Fulinta dhabta ah, isticmaal kontaroolada hab-shaqeedka ee la kaydiyay, ziaf ama API-ga la xaqiijiyay oo baar rasiidhadooda. Ha ku khaldin muraayadda bandhigga jadwal-samaynta aan lala socon.

Tilmaamaha la xidhiidha: [Amarada diraha](../../CLI.md).

<a id="updates"></a>

## Version and updates

> Hhagaha oo dhammaystiran weli looma turjumin luqaddaada interface-ka. Waxaa la muujinayaa tixraaca afka Ingiriisiga.

Open Settings → Updates and choose Check for updates. The official GitHub repository ZIAForge/ZIAForge and the Stable channel are configured by default. The panel shows the running version and any newer compatible release. Preview includes prereleases; Stable excludes them. Checking never installs an update.

When an update is available, Update downloads the package for this operating system and architecture, verifies its published size and SHA-256, prepares the installer and requests a normal application restart. Save file edits first. Installation is armed only after application services stop, and the installer waits for the current process to exit. Your profile, settings, task history and project files are kept.

Supported installation paths are a writable macOS application bundle, the Windows installer, Linux AppImage and the distribution package manager for DEB/RPM. System installation or authentication prompts may still appear. A development checkout, a read-only or translocated macOS app, or an unsupported portable layout may require manual installation; the panel explains that case and links to the release. Move a macOS application out of the mounted disk image before using in-place updates.

Automatic checking and downloading is optional. When enabled, it checks immediately and every six hours. Installing and restarting remains a separate owner action. A failed download or checksum check retains the existing installation and never runs the downloaded file.

Downloaded package hashes establish that the files match the selected GitHub release. They do not replace code signing or notarization. The updater does not disable operating-system security checks. Repository and channel changes, downloads and installation are local owner actions; remote agents can read update status only.

Tilmaamaha la xidhiidha: [Application update behavior and installation limits](../../UPDATES.md) · [Release readiness](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Dib-u-bilaabista iyo soo-kabashada

Gudaha macOS, isticmaal Ka bax / ⌘Q si buuxda loo damiyo. Xiritaanka daaqadda waxaa laga yaabaa inay ka tagto arjiga oo shaqaynaya. Si buuxda uga bax noocii hore ka hor inta aanad beddelin arjiga.

Furitaanka ka dib, dooro isla hawshii. Taariikhda iyo qabyo-qoraalladu way soo noqdaan. Dib-u-billowgu wuxuu soo celiyaa macnaha guud ee asalka/maxalliga ah laakiin ma diro qabyo-qoraal, ma hakad-ka-saaro safka mana oggolaado in lagu celiyo hawlgal aan la garanayn.

Haddii Soo-kabashadu soo baxdo, ha ku sixin JSON gacantaada. Baar nooca dukumentiga ay saameysay, xafid faylashii asalka ahaa oo dooro kayd la xaqiijiyay. Soo celinta saf hore waxay shayyadiisa u calaamadeysaa kuwo aan la hubin.

Marka gaarsiinta aan la garanayn, hab-shaqeed la maareeyay wuxuu u baahan karaa oggolaansho cad si loo helo macne guud oo cusub. Shaqadii hore iyo isku-dayadii fashilmay way sii jiraan; diidmo muuqata ayaa ka ammaan badan guul been-abuur ah.

Kaydi faylasha hawsha iyo borofaylka arjiga iyadoo dhammaan tusaalooyinka arjiga la xiray. Fayl-gal la koobiyeeyay ma aha soo-celin la tijaabiyay. Haddii soo-kabashadu ku weydiiso inaad doorato kayd la xaqiijiyay, xafid sidoo kale isla faylashii waxyeelladu gaartay. Soo celinta hab-shaqeed ama saf hore ma oggolaato dib-u-celinta qiyaasid aan la hubin ama hawlgallada Git.

Tilmaamaha la xidhiidha: [Heshiiska soo-kabashada](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Xallinta ciladaha

CLI lama helin: ka hubi rakibaaddeeda iyo nooceeda terminal-ka caadiga ah, ka dibna dib u bilow ZIAForge. Jiritaanka fayl la fulin karo macnaheedu maaha inaad gashay. Isticmaal habka gelitaanka ee uu leeyahay bixiyaha laftiisu.

Moodalku ma heli karo ama oggolaanshihii wuu fashilmay: cusboonaysii daah-furka, dooro ID la heli karo oo hubi koontadaada iyo xaddidaadahaaga. Ha ku celin codsi aan la hubin ka hor inta aanad baarin taariikhdiisa.

Hab-shaqeedku wuu istaagay: fur wejiga hadda, su'aasha, rasiidka xaqiijinta ama diiwaannada CLI. Wax ka qabo sababta gaarka ah: su'aal aan laga jawaabin, amar, oggolaanshaha fayl-galka ama xaddidka isku-dayga. Sii wad ma u rogi karto hubin fashilantay guul.

Fayl-galkii waa maqan yahay ama waa la beddelay: soo celi gelitaanka fayl-galkii asalka ahaa ama abuur hawl cusub. Arjigu waa inuusan ka sii socon HOME. Haddii aad aragto cwd kale, jooji wareegga oo ilaali xogta baaritaanka.

Warbixin ahaan, ku dar nooca Ku Saabsan, waddada, CLI/moodalka, hab-dhaqanka la filayay iyo midka dhabta ah, shaashad-qaadis iyo qayb diiwaan oo ammaan ah. Ka saar siraha, xogta shakhsiga ah iyo waddooyinka aan la daabici karin.

Bogga fog lama heli karo: xaqiiji in milkiiluhu kiciyay adeegaha, hubi cinwaanka iyo dekedda wax dhegeysanaya, ka dibna ku xaqiiji token-ka saxda ah ee tusaalaha. 401 waxay muujinaysaa xaqiijinta; wax-ka-beddelka la diiday waxa uu noqon karaa baaxadda akhriska ama maamul u gaar ah milkiilaha. Beddelidda token-ku waxay xirtaa macaamiisha birawsarka ee hadda jira. Ha u soo bandhigin dekedda gaarka ah ee baaritaanka DevTools sidii maamulka arjiga ee fog.

Kaydinta tifaftiraha waa la diiday: xafid qabyo-qoraalka, baar faylka hadda ku jira disk-ga oo xalli khilaafka isbeddelka dibadda. Ha ka boodin is-barbardhigga adigoo dib u qoraya xog-hoosaadka arjiga. Haddii raridda buuxda ee faylka weyn aan la heli karin, isticmaal daaqadda wax-ka-beddelka/raadinta ee la taageeray ama tifaftire dibadeed.

Telegram lama heli karo: ka xaqiiji heer maxalli ah token-ka bot-ka, milkiilaha tirada ah, wada-sheekaysiga gaarka ah iyo xaaladda. Webhook ama poller tartamaya waxay xannibi karaan ururinta xogta; ZIAForge si toos ah uma tirtirto webhook mana la wareegto poller kale. Amarada la diiday ama lagu dhex gooyay xad aan la garanayn si toos ah dib looma celiyo.

Tilmaamaha la xidhiidha: [Tijaabada iyo baaritaanka](../../TESTING.md).

<a id="diagnostics"></a>

## Soo sheeg dhibaatooyinka oo baar caddaynta

Diiwaangeli dhismaha saxda ah ee socda ee laga helo Ku Saabsan, OS/qaab-dhismeedka, habka hawsha, bixiyaha/moodalka la doortay iyo tallaabooyinka dib u soo saaraya dhibaatada. Sharrax natiijada la filayay iyo natiijada la arkay. Ku dar shaashad-qaadis ammaan ah iyo amarkii la hayay ee khuseeyay ama rasiidka xaqiijinta, halkii aad ka dari lahayd borofayl gaar ah oo dhan.

Diiwaannada CLI, xusuus-qoryada dhacdooyinka, qoraallada moodalka, raadadka birawsarka iyo shaashad-qaadistu waxay kashifi karaan koodhka asalka ah, waddooyinka shakhsiga ah ama token-nada. Baar oo qari ka hor inta aanad wadaagin. Qariye diiwaanka oo dadaal-ugu-fiican ah ma xaqiijinayo in shaashad-qaadis ama kayd la daabici karo.

Wadayaasha wax ku darsada, qa:doctor waxay akhrisaa aqoonsiga deegaanka/dhismaha; qa:inspect waxay furaysaa borofayl go'doon ah oo wata tusaalooyin bixiye. Qalab tijaabo wuxuu caddaynayaa waddada arjiga ee la tijaabiyay isagoon la xiriirin moodal. Qiyaasidda tooska ah, xiriirka Telegram, miiska Linux ee asalka ah, saxiixa iyo hubinta farshaxanka la baakadeeyay waa caddaymo kala go'an. Eeg TESTING.md si aad u aragto amarada dib loo soo saari karo iyo nadiifinta.

Tilmaamaha la xidhiidha: [Amarada caddaynta](../../TESTING.md).

<a id="privacy"></a>

## Xogta maxalliga ah iyo xuduudaha

Mashaariicda, taariikhda, qorshayaasha, dukumentiyada iyo baaritaannada waxaa ku jiri kara qoraal gaar ah. Ha daabicin borofayllada, xogta cayriin ee la qabtay, furayaasha ama diiwaannada buuxa ee wata koodhka asalka ah.

Gudaha Linux, kaydinta API, maamulka, Telegram iyo aqoonsiyada tusaalaha waxay u baahan yihiin Adeegga Sirta ee GNOME ama KWallet oo furan; haddii aan la helin keyd sir ah oo la taageeray, ZIAForge waxay diidaysaa inay kaydiso sirahan halkii ay ka isticmaali lahayd kaydka ku-meel-gaarka ah ee Electron ee basic_text.

Kaydinta maxalliga ahi macnaheedu maaha in codsiyadu ku hadhayaan kombuyuutarkaaga: CLI/API la doortay waxay u diraysaa bixiyaheeda. Fayl-galka shaqada iyo ilaalinta hab-socodku ma aha go'doomin OS ah. Baar oggolaanshaha la doortay.

Kala saar noocyada caddaynta: qalabka tijaabada wuxuu tijaabiyaa arjiga iyadoon moodal la adeegsan; tijaabada tooska ah ee asalka ahi waxay hawlgelisaa CLI/koonto dhab ah; hubinta la baakadeeyayna waxay xaqiijisaa farshaxan gaar ah. Ku guulaysiga midkood ma dammaanad qaadayo kuwa kale.

Baaxadda arjiga, geed-shaqeedka iyo qoraalka dalabka ee akhriska kaliya ah way ka duwan yihiin dhaqangelinta nidaamka qalliinka. Xeerarka dib-u-eegaha/caawiyaha ee Antigravity waxay ogaadaan isbeddellada caddaynta goobta shaqada ee la ururiyay halkii ay ku qasbi lahaayeen gelitaanka akhriska kaliya ee nidaamka faylka. Maamulka kombuyuutarka asalka ahi wuxuu barnaamijyada uu milkiiluhu oggolaaday ku fuliyaa bannaanka xadka qalabka arjiga ee caadiga ah; demi marka aan mar dambe loo baahnayn.

Tilmaamaha la xidhiidha: [Asalka iyo daabacaadda](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Fahan oo wax ka beddel mashruucan il-furan

Marka hore akhri AGENTS.md iyo CONTRIBUTING.md, ka dibna PROJECT_MAP.md si aad u aragto xuduudaha koodhka asalka ah ee hadda. Heshiisyada noocaysan ee la fuliyay iyo dukumentiyada hab-shaqeedka/bixiyaha ee hadda jira ayaa maamula hab-dhaqanka. CONCEPT.md iyo qaybaha terminal-ka ee ARCHITECTURE.md waxay xafidaan ujeeddadii hore waana inaan lagu khaldin sheegashooyinka sii-deynta hadda.

Isha caawinta Ingiriisigu waa docs/help/en.json. Ha ku sixin gacanta USER_GUIDE.md ama website/guide.html ee la soo saaray. Beddel qaybta rasmiga ah, cusboonaysii heshiiska ay saameysay oo kici node scripts/help/generate.cjs. Caawinta arjiga dhexdiisa waxay akhrisaa isla ishaas. Dib u eeg waxyaabaha lagu daray adigoo la barbardhigaya hirgelinta dhabta ah, oo ay ku jiraan xaddidaadaha, oggolaanshaha iyo waddooyinka aan la taageerin.

Mid kasta oo ka mid ah 56-ka aag-luqadeed ee muuqaalka waxa uu leeyahay xaalad caawimo oo gooni ah gudaha docs/help/locales.json. Caawinta maqan ama aan dhammaystirnayn waxay dib ugu noqotaa Ingiriisiga. Qoraallada buuxa ee mashiinku turjumay waa la calaamadeeyay waxaana lagu xiray hash-ka isha Ingiriisiga, iyadoon la sheegan dib-u-eegis bini'aadam. Turjumaadda uu bini'aadam dib u eegay waxay intaas dheer u diiwaangelisaa qofkii dib u eegay. Turjumaad kasta waa inay ilaalisaa aqoonsiyada qaybaha, ficillada, aqoonsiyada faylka/amarka iyo xaddidaadaha farsamo, isticmaashaa jihada saxda ah, lana cusboonaysiiyaa marka isha Ingiriisigu isbeddesho.

Ka hor inta aan la dhoofin, kici node scripts/help/generate.cjs --check si aad u ogaato xogta la soo saaray ee duugowday, qaab-dhismeedyada goob-luqadeedka ee aan saxda ahayn ama xiriiriyeyaasha heshiiska maxalliga ah ee jaban. Hubinta turjumaada UI iyo hubinta hab-dhaqanka arjiga way kala go'an yihiin. HELP_MAINTENANCE.md waxay bixisaa habraaca cusboonaysiinta ee wax-ku-darsadaha iyo AI; dukumentiyadu waa inaysan sheegan tijaabo guulaysatay oo aan la kicin.

Tilmaamaha la xidhiidha: [Khariidadda mashruuca ee hadda](../../PROJECT_MAP.md) · [Daryeelka dukumentiyada](../../HELP_MAINTENANCE.md) · [Tilmaamaha wax-ku-darsadaha](../../../CONTRIBUTING.md) · [Tilmaamaha wakiilka](../../../AGENTS.md).
