<!-- Generated from docs/help/en.json; source SHA-256 1d8a8515cf743144e27893fc6fb1e85fc06b290f1744ab0ebc57665893e6d684. Do not edit this output.
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
- [API connections](#api)
- [Dejinta, luqadaha iyo dib-u-dejinta badbaadada leh](#settings)
- [Weydii kaaliyaha Caawinta](#help-assistant)
- [Kaaliyaha iyo Telegram](#assistant-control)
- [Ku shaqaysii bot-kaaga gaarka ah ee Telegram](#telegram)
- [Oggolaanshaha kombuyuutarka asalka ah ee milkiilaha kaliya](#native-permissions)
- [Birawsarka iyo tusaalooyinka meel fog](#remote)
- [OpenClaw, Hermes iyo wakiillada kale ee dibadda](#external-agents)
- [CLI maxalli ah iyo xaddidaadaha otomaatigga](#local-cli)
- [Nooca iyo cusboonaysiinta](#updates)
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

## API connections

> Hhagaha oo dhammaystiran weli looma turjumin luqaddaada interface-ka. Waxaa la muujinayaa tixraaca afka Ingiriisiga.

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

Tilmaamaha la xidhiidha: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

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

## Nooca iyo cusboonaysiinta

Ku Saabsan waxay muujinaysaa nooca saxda ah ee hadda socda. Cusboonaysiinta dadweynuhu waxay u baahan tahay keyd sii-deyn oo GitHub ah oo la aaminay iyo kanaal deggan ama horudhac ah. Hubinta, soo dejinta iyo rakibiddu waxay leeyihiin xaalado kala duwan; cilad macnaheedu maaha in cusboonaysiin la rakabay.

Rakibidda tooska ahi waxay u gaar tahay sii-deynta macOS ee saxiixan. Dhismaha horumarinta ee aan saxiixnayn si toos ah looguma rakibo habkan. Beddelidda gacanta, si buuxda uga bax arjiga hadda jira oo isticmaal farshaxan la xaqiijiyay.

Hubinta tooska ahi waxay shaqaysaa isla markiiba marka la kiciyo, ka dibna lixdii saacadoodba mar.

Deggan kama reebaysaa sii-deynta horudhaca ah; horudhac waxay sidoo kale u oggolaanaysaa sii-deynta horumarinta. Hubin guulaysatay waxay kaliya xaqiijinaysaa xog-hoosaadka sii-deynta ee la heli karo. Soo dejinta iyo rakibiddu waxay u baahan yihiin xirmada madal-shaqeedka iyo quudinta sii-deynta ee la qaabeeyay. Gaarsiinta Linux DEB waa waddo rakibe oo gooni ah; ha u qaadan in DEB si toos ah loogu cusboonaysiinayo habka cusboonaysiinta macOS.

Tilmaamaha la xidhiidha: [U diyaarsanaanta sii-deynta](../../RELEASE_READINESS.md).

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
