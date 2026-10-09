<!-- Generated from docs/help/en.json; source SHA-256 eaf22fddcc4ae04e49389249e9b06c0e4c060d2a1470f8ecbc39c46cb96868d3. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: uz; served locale: uz; status: machine-translated. -->
# ZIAForge foydalanuvchi qoʻllanmasi

Maqsaddan tasdiqlangan natijagacha. Code, Work va ilovani boshqarish boʻyicha amaliy qoʻllanma.

Ingliz tili asosiy hisoblanadi. Mashina orqali tarjima qilingan yordam matnlari inson tomonidan tekshirilgan tarjimalardan alohida belgilanadi. Avtomatlashtirilgan tekshiruvlar ona tilidagi aniqlikni kafolatlamaydi.

> Ushbu qo‘llanma joriy inglizcha manbadan mashina yordamida tarjima qilingan. Insoniy ko‘rib chiqish hamon mamnuniyat bilan qabul qilinadi.

## Qo‘llanma bo‘limlari

- [Dastlabki qadamlar](#start)
- [Toʻgʻri desktop paketini oʻrnatish](#install-platforms)
- [Code: beshta yoʻnalish](#code)
- [Forge muhokamasi](#forge)
- [Hujjatlar va qarorlar](#decisions)
- [Ijro va koʻrib chiqish](#execution)
- [Parallel taqriz guruhlari va hisobot meʼmori](#review-teams)
- [Agent ixtisoslashuvlari va soʻrovlar siyosati](#specializations)
- [Work: savoldan hujjatgacha](#work)
- [Oldindan oʻrnatishlar, modellar va kirish huquqi](#models)
- [Chatlar, Stop va navbat](#chat)
- [Fayllar, Git va yakunlash](#files)
- [API ulanishlari](#api)
- [Sozlamalar, tillar va xavfsiz tiklash](#settings)
- [Yordamchi assistentdan so‘rang](#help-assistant)
- [Yordamchi va Telegram](#assistant-control)
- [Shaxsiy Telegram botingizni boshqaring](#telegram)
- [Faqat egalik qiluvchi uchun mahalliy kompyuter ruxsati](#native-permissions)
- [Brauzer va masofaviy instansiyalar](#remote)
- [OpenClaw, Hermes va boshqa tashqi agentlar](#external-agents)
- [Mahalliy CLI va avtomatlashtirish cheklovlari](#local-cli)
- [Version and updates](#updates)
- [Qayta ishga tushirish va tiklash](#restart)
- [Nosozliklarni aniqlash va bartaraf etish](#troubleshooting)
- [Muammolar haqida xabar berish va dalillarni tekshirish](#diagnostics)
- [Mahalliy ma’lumotlar va chegaralar](#privacy)
- [Ushbu ochiq kodli loyihani tushunish va o‘zgartirish](#project-contributors)

<a id="start"></a>

## Dastlabki qadamlar

ZIAForge muhokama, rejalashtirish, bajarish va tekshirishni bitta topshiriqda saqlaydi. Git loyihasi uchun Code ni, oddiy papkadagi hujjatlar, tadqiqotlar va boshqa natijalar uchun esa Work ni tanlang.

Alohida loyihada kichik topshiriqdan boshlang. Agar mahalliy CLI ni tanlasangiz, avval uni oʻrnating va terminalda uning shaxsiy hisobi bilan tizimga kiring. Shu bilan bir qatorda, API ulanishini sozlang. CLI obunasi va pullik API alohida ulanish usullari hisoblanadi; ZIAForge sizni tizimga kiritmaydi yoki ular orasida kreditlarni oʻtkazmaydi.

1. Sozlamalarni oching hamda ishchi maydon papkasi va tilni tekshiring. Dastur haqida boʻlimi ishlayotgan yigʻmaning aniq identifikatsiyasini koʻrsatadi.
2. Code uchun yon paneldagi Git omborini qoʻshing. Work uchun topshiriq yaratishda alohida papkani tanlang.
3. CLI, model, mulohaza yuritish kuchi va kirish darajasi bilan oldindan oʻrnatishni saqlang. Shuningdek, saqlangan oldindan oʻrnatishsiz toʻgʻridan-toʻgʻri Maxsus sozlamani tanlashingiz mumkin.
4. Topshiriq yarating, uning yoʻnalishini, rollarini hamda qoʻlda yoki avtomatik davom ettirishni tanlang. Boshlashdan oldin tanlovlarni koʻrib chiqing.

> Tizim taʼminotchisi tomonidan taqdim etilgan artefakt va nazorat summasidan foydalaning. Dastlabki koʻrish versiyasi imzolanmagan boʻlishi yoki eʼlon qilingan yangilanish lentasiga ega boʻlmasligi mumkin. Desktop va mahalliy provayder yordami aynan oʻsha OS, arxitektura va artefakt uchun tekshirilishi kerak; manba qoʻllab-quvvatlanishining oʻzi reliz sertifikatsiyasi hisoblanmaydi.

Tegishli ko‘rsatmalar: [Loyiha haqida umumiy maʼlumot](../../../README.md) · [Provayderning mosligi](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Toʻgʻri desktop paketini oʻrnatish

Operatsion tizimingiz va CPU arxitekturangiz uchun paketni tanlang: x64 yoki arm64. Yigʻish konveyeri macOS DMG/ZIP, Windows NSIS oʻrnatuvchi/ZIP hamda Linux DEB/RPM/AppImage/tar.gz/ZIP formatlarini ishlab chiqarishi mumkin. Yaratilgan fayl yoki kross-yigʻma uning oʻrnatuvchisi va mahalliy UI sizning mashinangizda sinovdan oʻtganligining isboti emas; ushbu relizning tekshirish yozuviga qarang.

Electron 44 dan foydalanuvchi macOS yigʻmalari macOS 13 yoki undan keyingi versiyasini talab qiladi. Apple Silicon uchun arm64 paketidan, Intel uchun esa x64 paketidan foydalaning. Yangisini almashtirishdan oldin eski ilovadan toʻliq chiqing. Dastlabki koʻrish paketlari imzolanmagan va notarial tasdiqlanmagan boʻlishi mumkin; ishlab chiqish artefaktini imzolangan ommaviy reliz bilan adashtirmang.

Windows uchun toʻplamga kiritilgan Electron versiyasi tomonidan qoʻllab-quvvatlanadigan operatsion tizim va PATH da mavjud boʻlgan Git kerak. Mos arxitekturani tanlang. Imzolanmagan dastlabki koʻrinish Authenticode sertifikatiga ega emas. Portativ ZIP faqat ijro etuvchi faylni emas, balki toʻliq ilova katalogini va ish vaqti fayllarini saqlashi kerak.

Linux uchun mos keluvchi grafik interfeys, Electron talab qiladigan tizim kutubxonalari va Git kerak. Shifrlangan boshqaruv hisob maʼlumotlari uchun gnome-libsecret yoki KWallet kabi ishlaydigan Secret Service taqdim eting; xavfsiz boʻlmagan basic_text backend qabul qilinmaydi. Displeysiz/konteynerdagi dastlabki sinov dalillari har bir ish stoli yoki distributivni tasdiqlamaydi.

DEB ni apt install ./file.deb bilan oʻrnating yoki distributivingizning paket menejeri orqali RPM ni oʻrnating. AppImage ijro etish ruxsati va mos FUSE yordamini talab qiladi; qoʻllab-quvvatlanadigan joyda --appimage-extract-and-run muqobil hisoblanadi. tar.gz va ZIP paketlarini barcha ish vaqti fayllari bilan birga arxivdan chiqaring. Paketni almashtirishda foydalanuvchi maʼlumotlari va ilova fayllarini alohida saqlang.

Manbadan yigʻish uchun Node 24, Git va npm ci, jumladan odatiy Electron oʻrnatuvchisidan foydalaning. Mahalliy qayta yigʻishlar platforma vositalarini talab qiladi: macOS da Xcode buyruqlar qatori vositalari; Windows da MSVC C++, Windows SDK va Python; Linux da kompilyator, make, Python, pkg-config va kerakli paketlash vositalari. Aniq buyruqlar va joriy platforma cheklovlari uchun PLATFORM_BUILDS.md ga amal qiling.

Reliz versiyalari markazlashtirilgan tarzda band qilinadi va natijalar oʻzgarmasdir. CI tekshiruv yigʻmasi eʼlon qilingan oʻrnatuvchi emas. Manba arxivlarida manba kodi, lockfile, hujjatlar va skriptlar mavjud; bogʻliqliklar, hisob maʼlumotlari, foydalanuvchi profillari va shaxsiy tadqiqotlar chiqarib tashlanadi. Muvaffaqiyatli x64 yigʻmasidan hech qachon mahalliy ARM yoki Windows tasdiqlangan degan xulosa chiqarmang.

Tegishli ko‘rsatmalar: [Platforma paketlari, dastlabki talablar va tekshirish cheklovlari](../../PLATFORM_BUILDS.md) · [Tuzilma identifikatsiyasi va reliz tekshiruvlari](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: beshta yoʻnalish

Auto qamrovni baholaydi: oddiy savol javob bilan yakunlanishi mumkin, kattaroq topshiriq esa tayyorgarlikni talab qiladi. Xatoni tuzatish sababni oʻrganadi va tuzatishni tayyorlaydi. Avval spetsifikatsiya texnik yechimdan boshlanadi; Avval talablar esa talablar va qabul qilish mezonlaridan boshlanadi.

Koʻp modelli marshrut tadqiqot, loyihalash, amalga oshirish va koʻrib chiqish uchun alohida kontekstlardan foydalanadi. Marshrut nomi turli provayderlarni talab qilmaydi: har bir rol siz tanlagan oldindan oʻrnatilgan yoki Maxsus konfiguratsiyadan foydalanadi.

Worktree topshiriqning Git oʻzgarishlarini ajratib qoʻyadi. Tarmoq tanlangan ishchi nusxada ishlaydi. Ishni boshlashdan oldin loyiha, tarmoq va modelni tekshiring; topshiriq tavsifi oddiy chatga ham qoʻshib yuborilmaydi.

Yechilmagan mahsulot yoki texnik tanlovlarga ega gʻoya uchun Avval talablar rejimidan foydalaning va poydevorni muhokamada quring. Auto soʻrovni tasniflaydi; u har bir qisqa iborani darhol amalga oshirish uchun buyruq emas. Qoralamani saqlash modelga murojaat qilmasdan soʻrovni saqlab qoladi; Boshlash esa boshqariladigan oqimni bir marta saqlaydi va ishga tushiradi. Birdan toʻrttagacha topshiriq nusxalari mustaqil yaratish identifikatorlari va rol sozlamalariga ega boʻladi.

Tegishli ko‘rsatmalar: [Code ish oqimi shartnomasi](../../WORKFLOWS.md) · [Code soʻrov profillari](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Forge muhokamasi

Boshlash markaziy muhokamani ochadi. Tabiiy javob bering, qarshi savollar bering, cheklovlar qoʻshing va texnik tanlovlarni muhokama qiling. Suhbat va savollar topshiriq bilan birga qoladi.

Matn yuborish hujjatni qabul qilmaydi yoki yangi amalga oshirish rejasiga ruxsat bermaydi. Amalga oshirish vaqtidagi oydinlik kiritish birinchi navbatda boshqariladigan navbatni pauza qiladi va taʼsirlangan qamrovni qayta koʻrib chiqadi. Allaqachon qabul qilingan qadam doirasidagi savolga berilgan javob ushbu qadamni davom ettirishi mumkin.

Poydevorni qasddan qayta koʻrib chiqish uchun Talablar, Spetsifikatsiya yoki Rejalashtirishni tanlang. Yangi versiya bogʻliq qarorlarni yangidan qabul qilishni talab qiladi. Bajarilgan qadamlar va ularning dalillari qoladi; oʻrnini bosgan tugallanmagan bosqichlar tarixda qoladi.

Boshqariladigan bosqich seanslari erkin chatdan farq qiladi. Ish oqimiga tegishli seansga toʻgʻridan-toʻgʻri qoʻlda soʻrovlar yuborish oʻrniga Forge muhokamasidan foydalaning.

Tegishli ko‘rsatmalar: [Forge muhokama shartnomasi](../../WORKFLOWS.md).

<a id="decisions"></a>

## Hujjatlar va qarorlar

Hujjatni oching, uning versiyasini tekshiring va kerak boʻlganda tahrirlar kiriting. Muhokama orqali tahrirlarni yuborish yangi versiyani yaratadi; hisobotlar va tasdiqlangan natijalar orqaga qaytarilib qayta yozilmaydi.

Taklif etilgan rejani qabul qilishdan oldin ketma-ketlikni, koʻrsatmalarni, qabul qilish mezonlarini va tekshirish buyruqlarini tahrirlang. Oʻzingiz tushungan aniq buyruqlarga ruxsat bering: ular topshiriq papkasida ishlaydi. Koʻp modelli marshrut butun topshiriqni amalga oshirish boʻyicha bitta qadamni taklif qiladi, uning tafsilotlari esa hujjatlari va koʻrsatmalarida boʻladi.

Tasdiqlash alohida, qasddan qilingan qarordir. Auto savollarni yoki talablar, spetsifikatsiyalar va rejalarni qabul qilishni chetlab oʻtmaydi. Tashqi tomondan oʻzgartirilgan hujjat eski tasdiqni qayta ishlata olmaydi.

Tayyorgarlik fayllari artefakt sifatida paydo boʻladi. Ularning versiyasi, yaratuvchi bosqichi va xeshi ularni natija bilan bogʻlaydi. Code hujjatlari worktree tashqarisida saqlanadi va commit tarkibiga avtomatik ravishda kirmaydi.

Qabul qilishdan oldin ham hujjatni, ham koʻrsatilgan qarorni tekshiring. Qabul qilish joriy nazorat nuqtasi ID sini, reja tahririni va saqlangan hujjat xeshlarini bogʻlaydi. Qamrov yoki dalillar notoʻgʻri boʻlsa, oʻzgartirishlarni soʻrang. Agar qaror eskirgan boʻlsa, yangi tanlov qilishdan oldin saqlangan holatni qayta yuklang; oʻzgartirilgan faylni oldingi versiya boʻyicha qabul qilib boʻlmaydi.

Tegishli ko‘rsatmalar: [Ish oqimi nazorat nuqtalari va hujjat versiyalari](../../WORKFLOWS.md).

<a id="execution"></a>

## Ijro va koʻrib chiqish

Reja real qadamlarni, joriy urinishni, tekshirish va koʻrib chiqish natijalarini koʻrsatadi. Agentning “bajarildi” deyishi qadamni yakunlamaydi: rejaning talab qilingan dalillari mavjud boʻlishi kerak.

Qoʻlda boshqarish rejimi mos qadamlar orasida pauza qiladi. Auto tekshirilgan qadamlarni oldinga siljitadi va cheklangan qayta urinishlarga ruxsat beradi. Keyin toʻxtatish har doim nazorat nuqtasini yaratadi. Pauza ish oqimining faol ishini toʻxtatadi; panelni yopish uni toʻxtatmaydi.

Mustaqil taqrizchi fayllar va tekshirish natijalari bilan alohida kontekstdan foydalanadi. Har bir talab qilingan toʻsqinlik qiluvchi topilma hal qilinishi kerak; bir nechta taqrizchilar toʻsqinlik qiluvchi xatoni ovoz berish orqali bekor qila olmaydi.

Koʻp modelli rejimda topilmalarni tuzatish aniq qarorni talab qiladi. Tuzatish boshqa koʻrib chiqishni bildirmasdan boshlamaydi: Qayta koʻrib chiqish yangi siklni ochadi. Koʻrib chiqish sharhlari bajarishni takrorlamasdan muvofiqlashtiruvchidan qayta koʻrib chiqishni soʻrashi mumkin.

Tugallangan qadamlarni bildirmasdan tahrirlab boʻlmaydi. TDD bilan Qizil kutilgan sababga koʻra haqiqatan ham muvaffaqiyatsiz boʻlishi, keyin esa Yashil oʻtishi kerak. Cheklangan urinishlar cheksiz qayta urinishlarning oldini oladi.

Mustaqil CLI/API taqrizchilarini Sozlamalar → Taqriz guruhlari boʻlimida saqlang, soʻngra guruhni Code yoki Work boʻlimida tanlang. Taqrizchilar parallel ravishda ishlaydi, ularning ketidan esa jamoaning hisobot meʼmori keladi. Shuningdek, saqlangan guruhsiz ham mustaqil taqrizchilarni sozlashingiz mumkin. Hisobot meʼmori hech qanday loyiha fayllari yoki asboblarisiz, faqat anonim tuzilgan hisobotlarni oladi; bu izolyatsiya hozirda Claude Code yoki API ni talab qiladi.

Har bir amalga oshirish bosqichi bajariladigan tekshiruvni, talab qilinadigan mustaqil koʻrib chiqishni yoki ikkalasini ham talab qiladi. Tayyorgarlik bosqichlari buning oʻrniga tasdiqlangan natijalarni va artefakt kvitansiyalarini saqlab qoladi; bular amalga oshirish testlari oʻtkazilgandek koʻrsatmaydi. Buyruq faqat uning haqiqiy chiqish holati va tegishli jarayonni tozalash tasdiqlangandagina muvaffaqiyatli boʻladi. TDD uchun Qizil tekshiruv amalga oshirishdan va Yashil tekshiruvdan oldin odatdagidek muvaffaqiyatsiz boʻlishi kerak; bajariladigan faylning yoʻqligi yoki taymout haqiqiy Qizil natija hisoblanmaydi.

Standart zanjir uzgichlar bir bosqichda uchta muvaffaqiyatsiz urinishdan yoki jami ellikta urinishdan keyin toʻxtaydi. Uzilish urinishni sarflaydi, lekin oʻz-oʻzidan muvaffaqiyatsiz urinish hisoblanmaydi. Cheklovlar va toʻplangan dalillar qayta ishga tushirishdan keyin ham saqlanadi; Qayta urinish ularni tiklamaydi. Boshqa urinishga ruxsat berishdan oldin saqlangan nosozlikni oʻqing.

Tegishli ko‘rsatmalar: [Tekshirish va koʻrib chiqish](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Parallel taqriz guruhlari va hisobot meʼmori

Sozlamalar → Taqriz guruhlari boʻlimini oching va jamoani saqlang. Oʻzlarining CLI yoki API, modeli, mulohaza yuritish kuchi va ixtisoslashuviga ega mustaqil taqrizchilarni qoʻshing, soʻngra hisobot meʼmorini tanlang. Guruhni topshiriqning taqriz konfiguratsiyasida tanlang. Bajaruvchi uchun oldindan oʻrnatish taqrizchi tomonidan ham ishlatilishi mumkin, va Maxsus sozlama mavjud boʻlib qoladi; mustaqil rollar baribir alohida kontekstlarga ega boʻladi.

Taqrizchilar bir xil topshiriq dalillari ustida parallel ravishda ishlaydi. Har bir talab qilingan hisobot, xato va xulosa saqlanadi. Meʼmor taqrizchilarning ismlari, model yoki provayder identifikatorlari, topshiriqning asl mazmuni, omborga kirish huquqi yoki asboblarsiz anonim raqamlangan hisobotlarni oladi. U hisobotlarni taqqoslaydi va bitta tuzilgan xulosani qaytaradi; u manbani qaytadan yangi koʻrib chiqishni oʻtkazmaydi.

Toʻsqinlik qiluvchi topilma yoki talab qilinadigan taqrizchining rad etishi koʻpchilik ovozi yoki meʼmorning xohishi bilan bekor qilinishi mumkin emas. Yoʻqolgan yoki notoʻgʻri tuzilgan hisobotlar tasdiqlashga toʻsqinlik qiladi. Qabul qilishdan yoki tuzatishlarga ruxsat berishdan oldin alohida topilmalarni va umumiy qarorni koʻrib chiqing. Saqlangan jamoa ishga tushirish uchun aniqlanadi va muzlatiladi; uning oldindan oʻrnatilishini tahrirlash tugallangan dalillarni qayta yozmaydi.

Faqat hisobot beruvchi meʼmor hozirda qoʻllab-quvvatlanadigan Claude yoki API asboblarsiz konfiguratsiyalaridan foydalanadi. Codex va Antigravity taqrizchi sifatida mavjud boʻlib qoladi, ammo tasdiqlangan asboblarsiz shartnoma mavjud boʻlmaguncha ushbu izolyatsiya qilingan meʼmor roli uchun rad etiladi. Faqat “asboblar yoʻq” degan soʻrovning oʻzi yetarli emas.

> Code Koʻp modelli marshrutning loyihalash/koʻrib chiqish konveyeri va saqlangan parallel taqriz guruhi alohida boshqaruv elementlaridir. Tanlangan maxsus koʻrib chiqish siyosatini saqlab qoling; bitta yoʻnalish har bir koʻrib chiqish funksiyasini yoqadi deb oʻylamang.

Tegishli ko‘rsatmalar: [Tiplashtirilgan guruh konfiguratsiyasi](../../../shared/review-team.ts) · [Taqrizlarni birlashtirish](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Agent ixtisoslashuvlari va soʻrovlar siyosati

Model bu bajaruvchi dvigatel; ixtisoslashuv esa koʻrsatmalar profilidir. Qoʻshimcha ixtisoslashuvsiz boʻlishi uchun Hech narsa, standart qoʻllanma uchun Standart, tegishli oʻrnatilgan qoʻllanma uchun Auto yoki tanlangan qoʻllanmalar va oʻzingizning chegaralangan koʻrsatmalaringiz uchun Qoʻlda rejimini tanlang. Oldindan oʻrnatishlar tanlovni saqlab qolishi mumkin.

Asl katalog umumiy dasturlash, arxitektura, xavfsizlik, ishonchlilik, unumdorlik, testlash va interfeysdan foydalanish qulayligini qamrab oladi. Auto qoʻllanmani tanlash uchun mavjud topshiriq/qadam matnidan foydalanadi; u yashirincha boshqa modelni chaqirmaydi yoki tajribani tasdiqlamaydi. Rejalashtirish boʻyicha takliflar amalga oshirish rejasini qabul qilishdan oldin tekshirilishi va oʻzgartirilishi mumkin.

Taqriz ixtisoslashuvlari eʼtiborni qaratishga yordam beradi, lekin hech qachon mustaqil dalillar, kirish cheklovlari yoki tuzilgan xulosaning oʻrnini bosa olmaydi. Maxsus koʻrsatmalarga topshiriq qamrovining bir qismi sifatida qarang: hujjatlarni qabul qilish, asboblar siyosati, autentifikatsiya yoki taqrizchi nosozliklarini chetlab oʻtish uchun ulardan foydalanmang.

Tegishli ko‘rsatmalar: [Asl soʻrovlar katalogi](../../../shared/specializations.ts).

<a id="work"></a>

## Work: savoldan hujjatgacha

Work rejimi Git ni talab qilmaydi. Standart alohida topshiriq papkasini yaratadi; Maxsus mahalliy tanlov vositasi orqali mavjud papkani tanlaydi. Qoralamani saqlash xulosa chiqarmasdan sozlamalarni saqlaydi; Boshlash birinchi bosqichni ishga tushiradi.

Auto toʻgʻridan-toʻgʻri javob beradi yoki real Rejalar bilan mos rejani taklif qiladi. Fikrlar boʻroni koʻproq gʻoyalar yoki baholashni tanlashingizdan oldin ideas.md ni yaratadi. Tadqiqot findings.md, manbalar va cheklovlarni saqlab qoladi. Yozish maqsaddan va foydali boʻlganda outline.md dan tavsifiy hujjatga yoki draft.md ga oʻtadi; tahrirlar oldingi versiyalarni saqlab qoladi.

Mahalliy tanlovchi orqali kiruvchi fayllarni tanlang va ularga @ bilan murojaat qiling. Ilova ularni oʻzgarmas topshiriq kirishlari sifatida nusxalaydi va ishga tushirishdan oldin ularning identifikatsiyasini tekshiradi. Standart ilovaga tegishli topshiriq papkasini yaratadi; Maxsus papkaga kirish esa saqlangan egasining ruxsati hisoblanadi. Saqlangan, ishga tushirilmagan qoralama oʻz papkasini oʻzgartirishi mumkin.

Mustaqil bajaruvchi sozlamalari bilan 1–4 ta nusxa yarating. Bir-birini qoplovchi papkalardan foydalanadigan topshiriqlar bir vaqtda yoza olmaydi. Bu muvofiqlashtirish ixtiyoriy tashqi dasturlarga emas, balki ZIAForge operatsiyalariga taalluqlidir.

Chuqur fikrlar boʻroni sukut boʻyicha uchta mustaqil ishchidan foydalanadi va sakkiztagacha qoʻllab-quvvatlaydi. Ularning tartibini va konfiguratsiyasini, jumladan, alohida kontekstlarda oldindan oʻrnatishni qayta ishlatishni tanlang. Ishchi savollari oʻz kelib chiqishini saqlab qoladi; notoʻgʻri shakllangan hisobotlar bitta formatni tuzatish urinishiga ega boʻladi. Qisman muvaffaqiyatsizlik bir ovozdan erishilgan muvaffaqiyat sifatida taqdim etilmasdan, koʻrinadigan boʻlib qoladi.

Chuqur rejim saqlangan ishchi hisobotlarini brainstorm_report.md ga birlashtiradi va har doim foydalanuvchidan qaror soʻraydi. Kichik kuzatuv hisobotni muvofiqlashtiruvchi orqali qayta koʻrib chiqadi; katta oʻzgarish esa muzlatilgan ishchilarning yana bir bosqichini boshlaydi. Artefaktlar oʻz versiyalarini saqlab qoladi.

Belgilangan rollar topshiriq yaratishda yoki qoralamani aniq saqlashda muzlatiladi. Birinchi chaqiruvdan soʻng faqat avtomatik/qoʻlda davom ettirish oʻzgarishi mumkin; turli rol yoki model sozlamalari uchun yangi topshiriqdan foydalaning. Global oldindan oʻrnatishni tahrirlash keyingi bosqichlarni bildirmasdan oʻzgartirmaydi.

Qoʻlda boshqarish rejimi mos bosqichlar, jumladan, muhim Yozish rejasi oʻrtasida pauza qiladi. Auto ushbu reja orqali davom etishi mumkin. Savollar, taklif qilingan bajariladigan rejalar, Fikrlar boʻroni yoʻnalishi va Chuqur hisobotni koʻrib chiqish hatto Auto da ham aniq qarorlar boʻlib qoladi. Faqat iqtibosning oʻzi koʻrib chiqish sodir boʻlganligini isbotlamaydi va saqlangan ikkilik faylning oʻzi uning render qilinganligini isbotlamaydi.

Tegishli ko‘rsatmalar: [Work rejimlari va qarorlari](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Oldindan oʻrnatishlar, modellar va kirish huquqi

Oldindan oʻrnatish CLI/API, model, mulohaza yuritish kuchi va ruxsatlarni saqlaydi. Chat ostki qismida oldindan oʻrnatish, CLI, model va parametrlar boʻlimlari mavjud. Maxsus oldindan oʻrnatishsiz ishlaydi; Oldindan oʻrnatish yaratish joriy tanlovni saqlaydi.

Katalog qoʻllab-quvvatlanadigan joyda tanlangan oʻrnatilgan CLI yoki API dan keladi. Yangilash tanlovni oʻzgartirmasdan roʻyxatni yangilaydi. Agar aniqlash imkoni boʻlmasa, aniq model ID sini kiriting; provayder baribir uni qoʻllab-quvvatlashi kerak. Mulohaza yuritish darajalari modelga va CLI ga bogʻliq. Provayder sukut boʻyicha sozlamasi aniq hech qanday tokenidan farq qiladi.

Oʻzgarishlarni faqat backend tasdigʻidan keyin qoʻllang. Faol navbat yoki boʻsh boʻlmagan navbat paytida almashtirish cheklangan. Qoralamalar va koʻrinadigan tarix saqlanib qoladi, lekin provayderlarni oʻzgartirish ularning shaxsiy ichki holatini oʻtkazmaydi.

Forge da rol yorligʻi muhim: tayyorgarlik alohida Rejalashtiruvchidan foydalanishi mumkin. Ostki qism koʻrsatilgan rolni oʻzgartiradi; taqrizchilar va yordamchilar ish oqimi sozlamalarida tanlanadi. Allaqachon tasdiqlangan amalga oshirish siyosati qulflangan boʻlishi mumkin.

Ruxsatlar provayderlar orasida farq qiladi. Faqat oʻqish va Ishchi maydonga yozish adapter ularni qoʻllab-quvvatlaydigan joyda mavjud. Antigravity mahalliy CLI sozlamalaridan yoki aniq tanlangan toʻliq kirishdan foydalanadi. Toʻliq kirish sandbox emas.

Ixtisoslashuv boshqa model yoki ruxsatni emas, balki soʻrov boʻyicha yoʻriqnomani qoʻshadi. Oldindan oʻrnatishlar va rollar Hech narsa, Standart, Auto va Qoʻlda rejimlarini qoʻllab-quvvatlaydi. Auto qoʻshimcha model chaqiruvisiz qadam matnidan profillarni tanlaydi; Qoʻlda rejimi toʻrttagacha mutaxassislik va maxsus koʻrsatmalarni qabul qiladi. Rejalashtiruvchi tomonidan taklif qilingan topshiriqlarni rejani qabul qilishdan oldin tahrirlash mumkin.

Qoʻlda kiritilgan model ID si yoki harakati sizning tanlovingiz boʻlib qoladi, lekin provayder uni rad etishi mumkin. Global oldindan oʻrnatishni tahrirlash ishlayotgan chatni yoki qabul qilingan rejani orqaga qaytarib oʻzgartirmaydi. Boʻsh turgan suhbatni qasddan oʻzgartirish uchun uning shaxsiy konfiguratsiya boshqaruvlaridan foydalaning va tasdiqni kuting. Oʻchirilgan parametrni saqlangan JSON ni tahrirlash orqali chetlab oʻtmasdan, imkoniyat yoki hayotiy sikl cheklovi sifatida qabul qilish kerak.

Tegishli ko‘rsatmalar: [Provayder imkoniyatlari](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Chatlar, Stop va navbat

Ochiq vkladkalar, Yaqinda ishlatilganlar va qoralamalar bitta topshiriqqa tegishli. Vkladkani yopish uni Ochiq roʻyxatidan olib tashlaydi, lekin uni Yaqinda ishlatilganlar roʻyxatida saqlab qoladi va uning provayder jarayonini yoki boshqariladigan ish oqimini toʻxtatmaydi. Tarix menyusidan tarixni qidiring, chatni qayta oching yoki barcha qoʻshimcha vkladkalarni yoping.

Stop joriy navbatni toʻxtatadi. Keyingi Yuborishdan oldin toʻxtatish tugashini kuting: uzilishni tasdiqlash jarayon tugaganligini anglatmaydi. Shu vaqt ichida keyingi qoralamani kiritishingiz mumkin.

Oddiy chatda Navbat keyingi soʻrovni joriy qoralamadan alohida saqlaydi. Navbatni pauza qilish keyingi yetkazib berishni ushlab turadi. Stop va Chiqish navbatni pauza qiladi. Qayta ishga tushirilgandan soʻng, avval Davom ettirish, keyin esa Navbatni davom ettirishni aniq bosing.

Noaniq holat yetkazib berish nomaʼlumligini bildiradi. Bunday xabar avtomatik ravishda qayta yuborilmaydi: tarixni koʻrib chiqing, zarur boʻlsa matnni nusxalang va navbatdagi elementni bekor qiling. Uni qayta yuborish yangi qasddan qilingan soʻrov hisoblanadi.

Boshqariladigan bosqich chatlari oddiy navbatdan emas, balki oʻzlarining ish oqimidan foydalanadi. Bosqichni kuzatish joriy bosqichni koʻrsatadi; boshqa vkladkani qoʻlda tanlash kuzatishni toʻxtatadi. CLI jurnallari diagnostikani javobdan alohida koʻrsatadi.

Markdown javoblari sarlavhalar, roʻyxatlar, jadvallar, havolalar va oʻralgan kod bloklarini aks ettiradi. Asbob kartalari va CLI diagnostikasi javobdan alohida qoladi. Model tomonidan bildirilgan fikrlash va token koʻrsatkichlari faqat provayder ularni haqiqatan ham taqdim etgandagina koʻrsatiladi; animatsiyadan shaxsiy mulohaza yoki foydalanish xulosasini chiqarmang.

Noaniq yuborish yoki navbat tasdigʻidan soʻng, tarixni koʻrib chiqing va taklif qilingan joyda faqat saqlangan bir xil soʻrovni qayta urinib koʻring. Navbat kvitansiyasi saqlash joyi elementni qabul qilganini bildiradi, xulosa chiqarish tugaganini emas. Noaniq navbatdagi elementni faqat aniq bekor qilish orqali olib tashlang; u allaqachon yetkazilgan soʻrovni qaytarib ololmaydi.

Tegishli ko‘rsatmalar: [Chidamli xabarlar navbati](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Fayllar, Git va yakunlash

Fayllar boʻlimi topshiriq papkasini koʻrsatadi. Natijalarni talablar bilan solishtiring, hujjatlarni oching va farqlarni tekshiring. Ikkilik faylni saqlab qolish uning maqsadli ilovada toʻgʻri koʻrinishini isbotlamaydi.

Git holat, oʻzgarishlar va qayd etilgan natijalar bilan amallarni taqdim etadi. Commit, birlashtirish va push qilish sukut boʻyicha qoʻlda bajariladi; avtomatik amallar toʻliq tasdiqlangan reja uchun alohida tanlovlardir.

Tekshirish va eʼlon qilish oraligʻida ishchi fayllarni oʻzgartirmang: tasdiqlash aniq baytlarga bogʻlangan. Mojarolar, muvaffaqiyatsiz push amallari va nomaʼlum amal natijalari aniq qaror qabul qilinmaguncha rivojlanishni toʻsib qoʻyadi. Auto eʼlon qilishga bildirmasdan ruxsat bermaydi.

Work hech qanday Git tarmoqlarini yaratmaydi va hech qanday Git yakunlashiga ega emas. Tanlangan papkadan talab qilinadigan hujjatlarni, jumladan versiyalar va manbalarni saqlab qoling.

Fayl tahrirlovchisi kengaytma boʻyicha sintaksisni, qidirish va almashtirishni, bekor qilish tarixini, qatorlarni oʻrashni va har bir vkladka uchun qoralamalarni taqdim etadi. Saqlashlar qoʻllab-quvvatlanadigan UTF-8/UTF-16 kodlashini saqlaydi va tashqi oʻzgartirish mojarolarini rad etadi. Boshqa kodlashlar va ikkilik kontent tashqi tahrirlovchini talab qiladi. Saqlanmagan qoralamalar egasi ularni saqlamaguncha yoki bekor qilmaguncha ilovani Chiqishdan toʻxtatib turadi.

Toʻliq sintaksis 8 MiB gacha yoqilgan. Kattaroq matnli fayllar 256 KiB oynalarda ochiladi; 8–64 MiB sintaksissiz toʻliq yuklanishi mumkin. 64 MiB dan yuqori boʻlgan fayllar uchun oynali tahrirlash va chegaralangan keyingi moslikni qidirishdan foydalaning. Bu cheklangan katta fayl rejimi boʻlib, ixtiyoriy ravishda katta hujjatlar uchun Sublime Text tengligi emas.

Jildni ochish faqat asl omborni bildirmasdan ochish oʻrniga, joriy topshiriq yoki tarmoq/worktree kontekstidan foydalanadi. Fayl qatori ushbu faylning asosiy katalogini koʻrsatishi mumkin. Yoʻllar backend tomonidan roʻyxatdan oʻtgan topshiriq ruxsatnomalariga qarshi tasdiqlanadi. Ikkilik fayllar oddiy matn sifatida tahrirlanmaydi; ularning maqsadli koʻruvchisidan foydalaning va asl baytlarni saqlab qoling.

Worktree-ni olib tashlash alohida himoyalangan harakatdir. Uni olib tashlashdan oldin biriktirilgan tuzilgan seanslar va terminallarni, shu jumladan boʻsh turgan seanslarni ham tugating. Saqlangan Git natijasini va tiklash holatini tekshiring; topshiriq yozuvini oʻchirish topshirilmagan ishni xavfsiz saqlashning oʻrnini bosa olmaydi.

Tegishli ko‘rsatmalar: [Tipga ega tahrirlovchi shartnomasi](../../../shared/editor.ts) · [Git siyosatlari](../../WORKFLOWS.md).

<a id="api"></a>

## API ulanishlari

Ulanishlar aniq tanlangan API oxirgi nuqtasini qoʻshadi. Nom, asosiy URL, model va agar kerak boʻlsa, kalitni kiriting. Mavjud mos integratsiyalar uchun Chat Completions, funksiya raundlari va provayder media fayllari uchun Responses yoki ushbu konnektor uchun Claude Connector v1 bilan birga Anthropic Messages ni tanlang. Mavjud ulanishlar siz ularni aniq oʻzgartirmaguningizcha Chat Completions ni saqlab qoladi. Mavjud ulanish uchun Responses-ni sozlash xuddi shu oxirgi nuqta uchun qoralama ochadi; profilni koʻrib chiqing va Ulanishni saqlash tugmasini bosing. Codex konnektori, Grok Connector v1 yoki Claude Connector v1 ni faqat tanlangan kengaytmani qoʻllab-quvvatlaydigan shlyuz uchun tanlang. Oxirgi nuqta oʻzgarmaganda va kalit maydoni boʻsh qoldirilganda saqlangan kalit saqlanib qoladi.

Loopback HTTP dan tashqari HTTPS talab qilinadi. Hisob maʼlumotlari, soʻrovlar yoki fragmentlarsiz oddiy oxirgi nuqtadan foydalaning. Qayta yoʻnaltirishlar rad etiladi. Kalitlar qoʻllab-quvvatlanadigan OS shifrlashidan foydalanadi va hech qachon UI ga qaytarilmaydi. Oxirgi nuqtani oʻzgartirish uning kalitini qayta kiritish yoki tozalashni talab qiladi. Kalit maydonini boʻsh qoldirish saqlangan kalitni saqlab qoladi.

Ish maydoni fayl vositalari backend tomonidan aniqlangan mahalliy vazifa papkasida, nisbiy yoʻllar hamda yoʻlni kesib oʻtish va havolalarga qarshi tekshiruvlar bilan bajariladi. Har bir fayl yozilishi aniq tasdiqlashni va oʻzgarmagan kutilayotgan tahrirni talab qiladi. Faqat oʻqish uchun moʻljallangan seanslar faqat oʻqish vositalarini taqdim etadi. Responses va Claude chaqiruvchi rejimida Mahalliy buyruqlarga ruxsat berish alohida ravishda macOS va Linux tizimlarida tasdiqlangan bajariluvchi fayl/argument chaqiruvlarini yoqadi. Buyruq nazorati Windows da mavjud emas; adapter u yerda bu vositani eʼlon qilmaydi. Buyruqlar har doim egasining tasdiqlashini talab qiladi va operatsion tizim qumdoni hisoblanmaydi.

Codex konnektori profili ushbu shlyuzning Responses vosita-jarayoni kengaytmasini aniqlaydi. Provayderning mahalliy vositalari kompyuteringizdagi chaqiruvchi vositalaridan alohida tarzda serverda bajariladi. Mahalliy faqat oʻqish ruxsatlari serverni cheklamaydi. Barcha vositalar oʻchirilishini talab qiladigan faqat hisobot beruvchi arxitektor uchun konnektor tanlanishi mumkin emas: qoʻllab-quvvatlanmaydigan izolyatsiya mahalliy vositalarga jimgina ruxsat berish oʻrniga xatolik bilan yakunlanadi. Kerakli siyosatni majburiy qila oladigan oxirgi nuqtani tanlang.

Yaratilgan PNG, JPEG va WebP natijalari yigʻilgan vosita chiqishidan tashqarida, Rasmni saqlash bilan alohida rasm kartalari sifatida koʻrinadi. Rasmlar tekshiriladi va ilovaning shaxsiy xotirasida saqlanadi; model tomonidan taqdim etilgan URL manzillar va Markdown rasmlari avtomatik ravishda yuklab olinmaydi. Saqlangan tarixni ochish, rasmni oʻqishni qayta urinish va keshdagi rasmni saqlash yangi generatsiyani soʻramaydi. Natijalar har bir rasm uchun 32 MiB va 32 million piksel bilan cheklangan boʻlib, umumiy 512 MiB shaxsiy media keshiga ega. Agar shaxsiy kesh toʻlib qolsa, uni qoʻlda tozalashdan oldin kerakli rasmlarni saqlab qoling. Rasm koʻruvchini ochish uchun chatdagi rasm ustiga bosing. Kattalashtiring yoki kichiklashtiring, Haqiqiy oʻlcham (100%) yoki Oynaga moslashtirish ni tanlang va tafsilotni koʻrish uchun suring. Escape yoki Rasm koʻruvchini yopish chatga qaytaradi. Koʻrish va masshtabni oʻzgartirish yuklangan shaxsiy rasmdan qayta foydalanadi; ular yangi generatsiyani soʻramaydi.

Responses suhbatlari tasdiqlangan javob identifikatorini va aniq funksiya chaqiruvi ID larini saqlab qoladi. Uzilib qolgan kiritishlar avtomatik ravishda qayta yuborilmaydi. Noaniq mahalliy tahrir yoki buyruq qayta ishga tushirilgandan soʻng qayta bajarilmaydi; tarixni saqlang va tekshiruvdan soʻng yangi kontekstni aniq yarating. Saqlangan transport yoki oxirgi nuqtadagi oʻzgarishlar aniq qayta sozlashni talab qiladi. Provayder holati, bekor qilish va muddati oʻtishdagi xatoliklar CLI zaxirasiga yashirilmasdan xabar qilinadi. Chat sarlavhasi ushbu ishga tushirishga biriktirilgan protokolni koʻrsatadi. Ulanish oʻzgarishlarini saqlagandan soʻng, chatning CLI / API tanlagichini oching va hatto xuddi shu ulanish allaqachon tanlangan boʻlsa ham, Qoʻllash tugmasini bosing. Bu saqlangan konfiguratsiya bilan yangi ishga tushirishni yaratadi va chat tarixini saqlab qoladi. Faqat ulanishni saqlash faol chatlarni koʻchirmaydi. Eski faqat matnli rasm havolalari matnligicha qoladi; protokolni almashtirish oldingi natijalarni qayta yaratmaydi yoki import qilmaydi.

API ulanishlari mahalliy CLI obunalaridan alohida holda oʻzlarining sozlangan oxirgi nuqtasi va autentifikatsiyasidan foydalanadi. Baʼzi shlyuzlar obunalardan ichki foydalanadi; ZIAForge mahalliy autentifikatsiyani API ga nusxalamaydi. Modellar, vositalar siyosati, mantiqiy xulosa parametrlari va hisob-kitoblar oxirgi nuqtaga bogʻliq. Faqat aniqlashning oʻzi xulosa chiqarishni isbotlamaydi. Kalitlarni Ulanishlar boʻlimida saqlang, hech qachon vazifa matnida yoki skrinshotlarda saqlamang.

Grok Connector v1 uchun aniq Responses ulanishini saqlang va xulosa chiqarishni bajarmasdan eʼlon qilingan imkoniyatlari, modellari hamda foydalanish hajmini oʻqish uchun Konnektorni tekshirish dan foydalaning. Modelning mantiqiy fikrlash darajalari va kontekst oynasi tanlovlari katalogdan olinadi. Ixtiyoriy mahalliy navbat chegarasi 1–100 ni tashkil qiladi. Yetishmayotgan kvota foizlari nomaʼlumligicha qoladi; foydalanish davrining tugashi obuna toʻlovi yoki amal qilish muddatining tugash sanasi emas. Ulanish oʻzgarishlari kuchga kirishi uchun ularni har bir mavjud chatda Qoʻllang.

Grok savollari aniq mahalliy savol va variant yorliqlari bilan kartalar sifatida paydo boʻladi. Soʻralgan javoblarni tanlang yoki maxsus javob kiriting, soʻngra bir marta yuboring. Reja intervyulari muhokama qilish yoki oʻtkazib yuborish amallarini taklif qilishi mumkin. Provayder ruxsat kartalari aniq mahalliy tanlovlarni koʻrsatadi va sukut boʻyicha tanlovingizni talab qiladi. Bular mahalliy fayl/buyruq tasdiqlaridan farq qiladi. Toʻxtatish, muddat tugashi yoki qayta ishga tushirish eski kartalarni nofaol qiladi; noaniq yuborish avtomatik ravishda takrorlanmaydi.

Ulanishlar boʻlimida Grok ulanishi Bir martalik provayder ruxsatlarini avtomatik tasdiqlash parametrini yoqishi mumkin; u sukut boʻyicha oʻchiq boʻladi. Bu yangi chatlarga yoki siz uni Qoʻllash orqali aniq qayta sozlaganingizdan soʻng mavjud chatga taalluqlidir. Faqat ulanishni saqlash ishlab turgan chatni oʻzgartirmaydi. Yoqilganda, ZIAForge faqat Grok tomonidan taklif qilingan bitta aniq, muddati oʻtmagan bir martalik ruxsatni avtomatik ravishda yuboradi va uni yuborishdan oldin ushbu avtomatik qarorni yozib oladi. Karta avtomatik tasdiqlashni koʻrsatadi. Savollar va mahalliy fayl yoki buyruq tasdiqlari hali ham javobingizni talab qiladi. Faqat oʻqish uchun chatlar qoʻlda provayder ruxsatlarini saqlab qoladi. Doimiy ruxsatlar hech qachon avtomatik ravishda tanlanmaydi; yetishmayotgan yoki noaniq bir martalik tanlovlar qoʻlda qoladi. Eski yoki noaniq yuborishlar hech qachon avtomatik tarzda qayta ijro etilmaydi yoki qayta urinilmaydi.

Grok chatida biriktirma tugmasi PNG, JPEG va WebP uchun tizim tanlagichini ochadi. Har bir xabar uchun toʻrttagacha rasmga ruxsat beriladi, har biri 16 MiB gacha va jami 20 MiB gacha boʻlib, har bir rasm uchun 32 million piksel ruxsat etiladi. Shaxsiy qoralama nusxalari 128 MiB hajmga ega va ushbu chat ishiga tegishli boʻladi. Ular faqat siz yuborganingizda uzatiladi. Muvaffaqiyatsiz yoki noaniq yuborishlar qoralama identifikatorlarini saqlab qoladi. Rasm xabarlari faqat matnli navbatdan foydalana olmaydi. Ishni oʻzgartirish yoki davom ettirishdan oldin kutilayotgan rasm qoralamasini olib tashlang yoki aniq bekor qiling; qoralamani bekor qilish allaqachon yetkazilgan xabarni bekor qilmaydi. Qabul qilingan rasm xabarlari keyinchalik koʻrish, masshtablash va saqlash uchun shaxsiy rasm kartalarini saqlab qoladi.

Grok provayder vositalari qoʻllab-quvvatlanadigan veb-qidiruv, rasmlar, interaktiv savollar va imkoniyatlar bilan cheklangan video yaratish bilan chegaralangan. Mahalliy loyiha vositalari hamon kompyuterda backend tomonidan tanlangan vazifa papkasida bajariladi. Faqat oʻqish uchun tekshiruv provayderning rasm/video yaratish va tahrirlashini, savollarni, mahalliy yozishlarni va buyruqlarni istisno qiladi. Vositalarsiz Yordam va faqat hisobot beruvchi arxitektor seanslari ushbu konnektor profilidan foydalana olmaydi. Ovoz yaratish, transkripsiya va real vaqtda ovozli muloqot taklif etilmaydi; MP4 oʻzining oddiy audio trekini oʻz ichiga olishi mumkin. Faqat aniqlangan vositaning oʻzi foydalanish mumkin boʻlgan natijaning dalili emas.

Video uchun yozish mumkin boʻlgan Grok chatidan foydalaning, havola rasmni biriktiring yoki shunday rasm yaratilgan chatni davom ettiring va harakat hamda kerakli parametrlarni tasvirlab bering. Eski rasmni aniq tanlash uchun Rasmni saqlash dan foydalaning va saqlangan faylni biriktiring. Rasmni koʻrish yoki saqlash uni qayta yaratmaydi. Alohida video parametrlari formasi mavjud emas: soʻrov suhbatdan va uning mahalliy savollari/ruxsatnomalar kartalaridan foydalanadi. Yangi foydalanuvchi navbatidan oldin ZIAForge faqat konnektor tomonidan mavjud, yoqilgan va tekshirilgan deb eʼlon qilingan video vositalarini yoqadi. Aniqlashdagi nosozlik ushbu navbat uchun videoni mavjud boʻlmagan holatda qoldiradi. Mahalliy imkoniyatlardagi oʻzgarishlar mahalliy chatni saqlab qolgan holda, koʻrinadigan tarixingiz va mos keladigan keshdagi rasmlar bilan yangi provayder kontekstini boshlashi mumkin; uzilib qolgan operatsiyalar qayta ijro etilmaydi. Agar rasm biriktirma cheklovlariga sigʻmasa, oʻtkazish ushbu tushirib qoldirish haqida xabar beradi; moʻljallangan havolani aniq biriktiring.

Konnektor talab qilinadigan havola rasm, 6 yoki 10 soniya hamda 480p/720p oldindan sozlamalari bilan image_to_video ni taklif qiladi. Uning reference_to_video rejimi 1–15 soniyani va 1:1, 16:9, 9:16, 4:3, 3:4, 3:2 yoki 2:3 tomonlar nisbatlarini qoʻllab-quvvatlaydi; agent kerak boʻlganda avval havola yaratishi mumkin. Kerakli sozlamalarni chatda soʻrang. ZIAForge alohida /grok/media oxirgi nuqtasini yoki uning avto tanlagichini taqdim etmaydi. Oldindan sozlamalar va qoʻllab-quvvatlanadigan parametrlar provayder imkoniyatlari boʻlib, aniq piksel balandligi, kadrlar vaqti yoki har qanday badiiy natijaning kafolati emas.

Tayyorlangan Grok videosi faqat himoyalangan MP4 fayli yuklab olinganidan va uning MIME turi, hajmi, SHA-256 va tuzilishi tekshirilgandan soʻnggina paydo boʻladi. Video tayyor ekanligini bildiruvchi matn, zaxira rasm yoki saqlash havolasi ijro etiladigan video hisoblanmaydi. Xatolar almashtirish generatsiyasini soʻramasdan koʻrinib turadi. Mavjud boʻlganda ijro etish, pauza qilish, oʻtkazish yoki ovozni sozlash uchun video kartasi boshqaruvlaridan foydalaning. Ijro etish avtomatik tarzda boshlanmaydi. Videoni saqlash tizim manzil dialogini ochadi. Saqlangan chat tarixi ilovadan toʻliq Chiqish/qayta ishga tushirishdan keyin shaxsiy MP4 ni saqlab qoladi; ijro etish va saqlash xulosa chiqarishsiz yoki boshqa provayder yuklab olishisiz mahalliy baytlardan foydalanadi. Videolar umumiy 512 MiB media keshida har biri 128 MiB bilan cheklangan. Toʻlgan keshni qoʻlda tozalashdan oldin kerakli media fayllarni saqlab qoling. Kompyuter video kodekini qoʻllab-quvvatlashi kerak; qoʻllab-quvvatlanmaydigan yoki buzilgan fayllar xatolikni koʻrsatadi.

Claude Connector v1 uchun Anthropic Messages ni tanlang va konnektorning HTTPS manzilini /v1 siz kiriting. Saqlang, soʻngra xulosa chiqarishsiz eʼlon qilingan vositalar, model variantlari, holat va foydalanishni oʻqish uchun Konnektorni tekshirish dan foydalaning. Chaqiruvchi yoki provayder-mahalliy bajarilishini, aniq mahalliy vosita tanlovini, mahalliy ruxsat rejimini, navbat/chiqish chegaralarini va qoʻllab-quvvatlanadigan fikrlash boshqaruvlarini tanlang; ixtiyoriy JSON chiqish sxemasi va sovuq tarix rejimi ham mavjud. Standart sozlamalar chaqiruvchi rejimidan, qoʻlda beriladigan mahalliy ruxsatlardan va mahalliy vositalarning yoʻqligidan foydalanadi. Yetishmayotgan foydalanish qiymatlari nomaʼlumligicha qoladi; foydalanishni qayta tiklash toʻlov yoki obuna muddati tugash sanasi emas. Konnektorning API kaliti uning mahalliy obuna autentifikatsiyasidan alohida qoladi. Saqlangan oʻzgarishlar kuchga kirishi uchun ularni har bir mavjud chatda Qoʻllang.

Claude chaqiruvchi vositalari mahalliy vazifa papkasida yozishlar va qoʻllab-quvvatlanadigan buyruqlar uchun alohida tasdiqlar bilan ishlaydi. Chaqiruvchi rejimida faqat aniq tanlangan WebSearch va WebFetch mahalliy ravishda ishlay oladi. Provayder-mahalliy rejimi tanlangan vositalarni konnektorning server ish maydonida ishga tushiradi va hech qanday mahalliy fayl yoki buyruq vositalarini taqdim etmaydi. Serverga mahalliy papkani tasvirlash unga kirish huquqini bermaydi. Faqat oʻqish uchun moʻljallangan seanslar mahalliy tahrirlash yoki bajariladigan vositalarni rad etadi; vositalarsiz seanslar hech qanday mahalliy vositalar boʻlmasligini talab qiladi. Server vosita-jarayoni kartasi hech qachon oʻz tarkibini kompyuterda bajarmaydi. Mahalliy vositalar mavjudligi va mahalliy ruxsat rejimi alohida sozlamalardir.

Claude mahalliy ruxsat kartalari soʻralganda aniq ruxsat berish yoki rad etish qarorini talab qiladi. Ular vosita kiritishini almashtira olmaydi yoki mahalliy fayl/buyruq tasdiqlashini bera olmaydi. Savollar aniq taklif qilingan matn va tanlash qoidalarini koʻrsatadi; javoblarni tanlang yoki maxsus javob kiriting, soʻngra bir marta yuboring. Grok avtomatik ruxsat berish parametri Claude ga taalluqli emas. Muddat tugashi, Toʻxtatish, qayta ishga tushirish yoki noaniq yetkazib berish eski kartalarni nofaol qiladi. Davom ettirish tegishli javob va biriktirilgan konfiguratsiyani saqlab qoladi; uzilib qolgan soʻrovlar, vositalar va javoblar qayta ijro etilmaydi. Sovuq tarix kontekst rejimi bu aniq yoʻqotishli importdir, mahalliy seansni tiklash emas. Toʻxtatish uning javobi maʼlum boʻlganda tegishli operatsiyani bekor qiladi; u bajarilgan natijalarni bekor qilmaydi yoki aloqador boʻlmagan xizmatlarni toʻxtatmaydi. Noaniq bekor qilish koʻrinib turadi.

Claude chatida tizim biriktirma tanlagichlari PNG, JPEG, GIF va WebP rasmlarini, PDF va UTF-8 matnli hujjatlarini qabul qiladi. Xabar muharririda toʻrtta umumiy biriktirma uyasi mavjud. Rasmlar va PDF lar har biri uchun 16 MiB ga ruxsat beradi; matnli hujjatlar 1 MiB ga ruxsat beradi. Rasmlar 32 million pikselga ruxsat beradi. Rasm qoralamalari va hujjat qoralamalari har biri umumiy 20 MiB ga ruxsat beradi va alohida 128 MiB shaxsiy saqlash hajmiga ega. Soʻrov, shuningdek, umumiy dekodlangan 32 MiB chegarasiga ega boʻlib, kodlangan soʻrovning qoʻshimcha xarajatlari uni kamaytirishi mumkin. Shaxsiy nusxalar joriy chat ishiga tegishli boʻlib, faqat siz yuborganingizda uzatiladi. Muvaffaqiyatsiz yoki noaniq yuborishlar oʻz qoralama identifikatorlarini saqlab qoladi; biriktirmali xabarlar faqat matnli navbatga kira olmaydi. Ishni oʻzgartirish yoki davom ettirishdan oldin kutilayotgan biriktirmalarni olib tashlang yoki aniq bekor qiling. Qabul qilingan rasmlar shaxsiy koʻrib chiqish va saqlash uchun ochiq qoladi; hujjatlar PDF yoki HTML sifatida oʻrnatilmaydi.

Claude server vositalari yuklab olinadigan fayllarni yaratishi mumkin. Fayl kartasi uning himoyalangan tarkibi yuklab olingandan hamda uning MIME turi, aniq hajmi va SHA-256 tekshirilgandan soʻng paydo boʻladi. U yigʻilgan vosita chiqishidan tashqarida qoladi hamda nomi, hajmi, turi va taqdim etilgan tahrir yoki almashtirish metamaʼlumotlarini koʻrsatadi. Tizim dialogida manzilni tanlash uchun Saqlash dan foydalaning. Yangiroq oʻzgarmas versiya oldingi versiyani mavjud holda saqlaydi. Fayllar alohida 1 GiB shaxsiy artefakt keshida har biri 128 MiB ga ruxsat beradi; toʻlgan keshni qoʻlda tozalashdan oldin kerakli fayllarni saqlab qoling. Keshdagi tarix va saqlash xulosa chiqarishni yoki boshqa yuklab olishni soʻramaydi. Barcha artefakt kartalari faqat Saqlash uchun moʻljallangan, jumladan PDF ham; HTML, SVG va nomaʼlum formatlar umumiy yuklab olishlar boʻlib qoladi va hech qachon bajarilmaydi. Model tomonidan taqdim etilgan URL manzillar va Markdown rasmlari avtomatik ravishda yuklab olinmaydi. Server vositalari tomonidan yaratilgan fayllar mahalliy Claude foto, video, audio yoki nutq yaratishni anglatmaydi.

Tegishli ko‘rsatmalar: [API ulanishlari](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md) · [Claude Connector v1](../../CLAUDE_CONNECTOR_V1.md).

<a id="settings"></a>

## Sozlamalar, tillar va xavfsiz tiklash

Umumiy sozlamalar ishchi maydon, interfeys tili va standart qiymatlarni tanlaydi. Ulanishlar API yakuniy nuqtalarini boshqaradi. Oldindan oʻrnatishlar va Taqriz guruhlari rol konfiguratsiyalarini saqlab qoladi. Masofaviy boshqaruv mahalliy hisob maʼlumotlarini, server qamrovini va egasining ruxsatlarini boshqaradi; Yangilanishlar reliz manbasini/kanalini boshqaradi. Dastur haqida boʻlimi ishlayotgan yigʻmaning aniq identifikatsiyasini koʻrsatadi.

Interfeys tili prompt tili va hujjatlarni ko‘rib chiqish holatidan alohidadir. Mahsulot nomlari, buyruq identifikatorlari, fayl kengaytmalari, provayder model identifikatorlari va foydalanuvchi tomonidan yaratilgan nomlar identifikator bo‘lib qoladi. Yordam bo‘limi joriy tarjima mavjud bo‘lganda tanlangan interfeys tiliga amal qiladi; mashina tarjimalari belgilanadi va ingliz tili qonuniy (kanonik) ma’lumotnoma bo‘lib qoladi.

Saqlash ko‘rsatilgan konfiguratsiyani qo‘llaydi. Ma’lumotlar bazasini qayta sozlash yoki zavod sozlamalariga qaytarish ilova metama’lumotlarini olib tashlashi mumkin; qayta sozlashni qasddan ishlatishdan oldin fayllarni va sinovdan o‘tgan zaxira nusxasini saqlab qo‘ying. Bu amallar mahalliy egalik qiluvchining harakatlaridir. Muvaffaqiyatsiz ish jarayonini yoki buzilgan yozuvni tekshirish uchun ulardan qisqa yo‘l sifatida foydalanmang.

Tegishli ko‘rsatmalar: [Mahalliylashtirish bo‘yicha ko‘rsatmalar](../../LOCALIZATION.md) · [Ma’lumotlarni qayta tiklash](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Yordamchi assistentdan so‘rang

Yordam bo‘limini oching, uning yordamchi panelida saqlangan ulangan oldindan sozlamani (preset) tanlang va ZIAForge haqida so‘rang. Javoblar joriy qonuniy (kanonik) inglizcha qo‘llanma va siz tanlagan interfeys tilidan foydalanadi. Bo‘limga havola tugmalari tegishli qo‘llanma mavzularini ochadi, shuning uchun tushuntirishni birlamchi manba bilan solishtirishingiz mumkin.

Ushbu yordamchi 100 tagacha saqlangan yozuv va 3 MiB hajmgacha bo‘lgan alohida shaxsiy suhbatni saqlaydi. 12,000 tagacha belgidan iborat savol kiriting; Yuborish (Send) uni so‘raydi, To‘xtatish (Stop) savolingizni saqlagan holda faol javobni bekor qiladi, Tozalash (Clear) esa ushbu Yordam suhbatini o‘chiradi. Yuborilmagan qoralamangiz va oldindan sozlama tanlovingiz ilovaning ayni seansida Yordam bo‘limini yopish yoki qayta ochishda saqlanib qoladi, ammo qoralama diskka saqlanmaydi. Yordamchi ilova buyruqlarini yubormaydi, ish jarayonini o‘zgartirmaydi yoki darvozani qabul qilmaydi. Maslahat vazifa, hisob yoki tashqi ulanishning jonli tekshiruvi emas.

Claude Code va API Yordam seanslari qo‘llab-quvvatlanadigan vositasiz siyosatni (no-tools) majburiy qo‘llaydi. Mahalliy Codex va Antigravity Yordam seanslari egalik qiluvchining mavjud mahalliy kompyuter ruxsatini talab qiladi. Agar u o‘chirilgan bo‘lsa, ilova boshqa provayderni tanlash o‘rniga dastlabki talabni tushuntiradi. Uni faqat egalik qiluvchi mahalliy boshqaruv sozlamalarida yoqishi mumkin; yordamchining o‘zi uni yoqa olmaydi.

Codex Yordam faqat o‘qish uchun mo‘ljallangan qumdon (sandbox) dan foydalanadi va vositani ma’qullash so‘rovlarini rad etadi. Antigravity reja rejimi va uning mahalliy qumdon bayrog‘idan foydalanadi. Bu mahalliy rejimlar operatsion tizim doirasida cheklashning mutlaq kafolati emas. Manba qo‘llanmasining xeshi javob uchun foydalanilgan ma’lumotnomani aniqlaydi; yaratilgan tushuntirish baribir xato bo‘lishi mumkin, shuning uchun amal qilishdan oldin unga bog‘langan bo‘limlarni ko‘zdan kechiring. Manba qo‘llanmasi versiyasi joriy qo‘llanmadan farq qilganda eski javoblar belgilanadi.

Tegishli ko‘rsatmalar: [Qonuniy qo‘llanma va tarjimani saqlash](../../HELP_MAINTENANCE.md) · [Ilova yordamchisi va ruxsatlar](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Yordamchi va Telegram

Yordamchi tanlangan oldindan sozlama (preset) va bir xil ilova boshqaruvi API sidan foydalanadi. Holatni tekshirish ruxsati bilan amallarni bajarish ruxsati alohida hisoblanadi. Buyruqlar va natijalarni tekshiring: yordamchining matnli javobi amal bajarilganini isbotlamaydi.

Telegram faqat mahalliy egalik qiluvchi tomonidan, mavjud bot tokeni va raqamli egalik qiluvchi ID si orqali yoqiladi. Boshqaruv o‘sha egalik qiluvchining shaxsiy chati uchun mo‘ljallangan. Sozlanmagan yoki nofaol bot ilova xabarlarini olmasligi kerak.

Bot tokenini oddiy chatga qo‘ymang. Integratsiyani sozlash Telegram ulanishi mavjudligini isbotlamaydi va avtomatik ravishda bot yaratmaydi. Skrinshotlar va javoblar ish maydonidagi maxfiy ma’lumotlarni o‘z ichiga olishi mumkin.

Yordamchi oldindan sozlamasini tanlang va ilova amallarini bajarish ruxsatini tekshirish ruxsatidan alohida bering. Codex va Antigravity yordamchisi ijrosi egalik qiluvchining mahalliy (native) ruxsatini talab qiladi; ular vositalarsiz API yoki Claude seansiga bildirmasdan almashtirilmaydi. Skrinshotlar yordamchi suhbatida ko‘rsatilishi mumkin, ammo joriy model kiritmasi tasvir tahlilini o‘z ichiga olmaydi. Yordamchi tasvirni shunchaki ko‘rsatgani uchun uni vizual tekshirdi deb hisoblamang.

Yordamchi aniq tiplashtirilgan vositalar orqali xulosalar, vazifalar, chatlar, ish jarayoni holati, jarayon konteksti va ilova oynalarini tekshirishi mumkin. U ruxsat berilgan oddiy sozlamalarni o‘zgartirishi va vakolatli ilova amallarini ishga tushirishi mumkin. U mahalliy huquqlarni bera olmaydi, saqlangan hisob ma’lumotlarini oshkor qila olmaydi, ildiz ish maydoni ruxsatini masofadan o‘zgartira olmaydi yoki shunchaki qulay bo‘lgani uchun Forge darvozasini ma’qullay olmaydi.

Tegishli ko‘rsatmalar: [Ilova boshqaruvi shartnomasi](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Shaxsiy Telegram botingizni boshqaring

O‘zingizning botingizni yarating yoki oling, uning shaxsiy chatini boshlang hamda mahalliy boshqaruv sozlamalariga uning tokeni va raqamli Telegram foydalanuvchi ID sini kiriting. Integratsiyani faqat ilova ulanishini rejalashtirganingizda yoqing. Egalik qiluvchi ID si foydalanuvchi identifikatori bo‘lib, foydalanuvchi nomi (username) yoki bot ID si emas. Faqat o‘sha shaxsiy chatdagi o‘sha foydalanuvchining xabarlari qabul qilinadi.

Ishlayotgan versiya, loyiha/vazifalar soni va vazifalar holatlari haqida umumiy ma’lumot olish uchun /start, /menu yoki /status dan foydalaning. Tugmalar Loyihalar, Vazifalar, Skrinshot, Yordam va Til bo‘limlarini ochadi. Ro‘yxatlarda har bir sahifada sakkizta element ko‘rsatiladi, Orqaga, Yangilash, Bosh sahifa va Oldingi/Keyingi navigatsiyasi mavjud. Loyiha tugmalari vazifalar ro‘yxatini filtrlaydi. Vazifa kartasi uning saqlangan ish jarayoni borishini, modeli/oldindan sozlamasini va mavjud bo‘lsa kutilayotgan savollarni ko‘rsatadi.

Ochiq/yaqindagi suhbatlar va ish jarayoni bosqichi chatlarini oldindan ko‘rish uchun vazifaning Chatlar bo‘limini oching. Har bir oldindan ko‘rish eng so‘nggi oltitagacha foydalanuvchi/yordamchi xabarlarini ko‘rsatadi, ularning har biri ko‘rinadigan darajada 200 ta belgiga qisqartiriladi. Shaxsiy fikrlash (reasoning) ko‘rsatilmaydi. Tarixni o‘qish provayderni ishga tushirmaydi. Oldindan ko‘rish faqat o‘qish uchundir: oddiy matn va /ask TEXT baribir ilova yordamchisiga murojaat qiladi, siz ko‘rayotgan vazifa chatiga hech qachon bilvosita yo‘naltirilmaydi.

Ishga tushirish / Davom ettirish joriy Code yoki Work ish jarayonini qayta o‘qiydi va mos keladigan saqlangan ish jarayonini boshlaydi. To‘xtatib turish uning to‘xtatilishini so‘raydi. Ularning hech biri talablarni, spetsifikatsiyani, rejani, ko‘rib chiqish xulosalarini yoki savollarni qabul qilmaydi; kutilayotgan qaror Ishga tushirishga to‘sqinlik qiladi. Qarorlarni ilovada qabul qiling yoki uning aniq joriy darvozasi va reviziyasiga ega aniq vakolatli tiplashtirilgan buyruqdan foydalaning.

56 ta interfeys tilidan istalganini o‘z ona tilidagi nomi bo‘yicha tanlash uchun Til yoki /language dan foydalaning. Bu parametr faqat ushbu bot va egalik qiluvchi uchun saqlanadi. Ilova tilidan foydalanish ushbu parametrni tozalaydi. Bu ilova tilini ham, kirish ruxsatlarini ham o‘zgartirmaydi; mavjud xabarlar avtomatik ravishda qayta yuborilmaydi.

Navigatsiya odatda xuddi shu e’lon qilingan menyu xabarini yangilaydi. Tugmalar 15 daqiqadan so‘ng muddati tugaydigan va bir marta ishlatilishi mumkin bo‘lgan shaffof bo‘lmagan identifikatorlarga ega; kartani o‘zgartirish uning eski tugmalarini yaroqsiz qiladi. Muddati o‘tgan, ishlatilgan, xabarga mos kelmaydigan va oldingi jarayonga tegishli tugmalar amalni bajara olmaydi. Mutlaqo tahrirlab bo‘lmaydigan xabarni yangi karta bilan almashtirish mumkin; noma’lum tarmoq xatosi yangi xabar sifatida qayta urinilmaydi.

Faollashtirilganda, poller avvalgi to‘plangan navbatni bekor qiladi va uzatishdan oldin yangilanish qabul qilinganini qayd etadi, shuning uchun uzilib qolgan buyruqlar qayta ishga tushirilganda avtomatik ravishda qayta ijro etilmaydi. Bu qayta ijro etishning oldini oladi; u bajarilishni kafolatlamaydi. Xatodan keyin yangi ishni qasddan yuborishdan oldin holat/kontekstni tekshiring. Vazifa holati haqida avtomatik bildirishnomalar mavjud emas.

Aniq buyruqlar mavjud bo‘lib qoladi: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot va /ask TEXT. /new {JSON} tiplashtirilgan createTask orqali vazifa yaratadi; /command {JSON} aniq katalog buyrug‘ini yuboradi. Argument shakllari uchun jonli katalogni o‘qing. Ilovadagi kabi bir xil bekend ruxsati va jild huquqlari qo‘llaniladi.

Ilova hech qachon saqlangan bot-token qiymatlarini yordamchiga yubormaydi. Shunga qaramay, skrinshotlar, xulosalar va suhbat matni loyihaning maxfiy ma’lumotlarini o‘z ichiga olishi mumkin. Agar bot yoki egalik qiluvchi hisobiga boshqa ishonch bo‘lmasa, integratsiyani mahalliy darajada to‘xtating. Sizib chiqqan tokenni bot provayderida almashtiring (rotatsiya), so‘ngra uning mahalliy shifrlangan konfiguratsiyasini yangilang.

Tegishli ko‘rsatmalar: [Shaxsiy bot va buyruqlar](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Faqat egalik qiluvchi uchun mahalliy kompyuter ruxsati

Mahalliy kompyuterga kirish dastlab o‘chirilgan bo‘ladi. Uni faqat egalik qiluvchi mahalliy Sozlamalar → Masofadan boshqarish bo‘limida yoqishi mumkin. Yordamchi va HTTP/MCP/Telegram buyruqlari ushbu bayroqni o‘zlari uchun yoqa olmaydi. Agar amal rad etilsa, yordamchi sozlamani ta’riflashi va qarorni egalik qiluvchiga qoldirishi kerak.

Aniq yoqilganda, computer.run ijro etiluvchi fayl, argumentlar massivi va ixtiyoriy mutlaq ishchi katalogni qabul qiladi. U qobiq (shell) interpolyatsiyasidan foydalanmaydi, 30 soniyalik cheklovga ega va chiqishni 1 MiB gacha chegaralaydi. Taqdim etilgan mavjud bo‘lmagan yoki yaroqsiz katalog rad etiladi; cwd ko‘rsatilmasa, HOME emas, ilovaga tegishli sozlamalar katalogi ishlatiladi. Chiqish (Quit) o‘ziga tegishli faol buyruqlarni bekor qiladi va ularning jarayoni tozalanishini kutadi.

Ilovani o‘qish/bajarish qamrovi va mahalliy kirish alohida qarorlardir. Ishchi daraxt (worktree) cheklovlarsiz provayderning fayl tizimiga kirishini chegaralamaydi. Vazifadan so‘ng mahalliy kirish talab qilinmasa, uni bekor qiling va yordamchining matnli javobini isbot sifatida qabul qilish o‘rniga buyruq kvitansiyalarini tekshiring.

Tegishli ko‘rsatmalar: [Faqat egalik qiluvchi uchun boshqaruv shartnomasi](../../../shared/control.ts).

<a id="remote"></a>

## Brauzer va masofaviy instansiyalar

Mahalliy egalik qiluvchi serverni yoqadi va uning manzili, porti hamda qamrovini tanlaydi: tekshirish uchun o‘qish yoki amallar uchun bajarish. Standart 127.0.0.1 manzili faqat ushbu kompyuterda mavjud. 0.0.0.0 tarmoq interfeyslarida tinglaydi; uni yoqishdan oldin tarmoqqa kirish imkoniyatini ko‘rib chiqing.

Brauzer token orqali kirgandan keyin xuddi shu interfeysni ochadi. Tokenlarni ommaviy havolalar yoki skrinshotlarga qo‘shmang. HTTP ning o‘zi trafikni shifrlamaydi; ishonchsiz tarmoq orqali himoyalangan kanaldan foydalaning.

Egalik qiluvchi boshqa instansiyalarni URL va token bo‘yicha sozlaydi. Bekend so‘rovlarni proksilaydi; bu ularning loyihalarini mahalliy mashinaga nusxalamaydi. Har bir harakatdan oldin tanlangan instansiyani tekshiring.

Tiplashtirilgan buyruqlar va hodisalar ilova boshqaruvini tashiydi. O‘qish qamrovi vazifa o‘zgarishlariga vakolat bermaydi. Kompyuterni mahalliy boshqarish — bu mahalliy egalik qiluvchining alohida tanlovi bo‘lib, dastlab o‘chirilgan bo‘ladi.

Ilova brauzer, Telegram va tashqi agent boshqaruvi uchun ishlab turishi kerak. Har bir instansiya o‘zining shaxsiy profiliga, vazifa holatiga, tokeniga va server portiga ega. Bitta profildan mustaqil instansiyalar o‘rtasida bir vaqtning o‘zida qayta foydalanmang. Brauzer hodisalari va buyruq javoblari tanlangan instansiya doirasida bo‘ladi; UI ni almashtirish fayllarni ko‘chirmaydi yoki mahalliy kirish ma’lumotlarini nusxalamaydi.

Tegishli ko‘rsatmalar: [HTTP va instansiya nazorati](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes va boshqa tashqi agentlar

Autentifikatsiyadan o‘tgan ilova boshqaruvi API sidan yoki jamlangan MCP stdio ko‘prigidan foydalaning. Serverni mahalliy darajada yoqing, o‘qish yoki amal bajarish rejimini tanlang va har bir mijozni o‘sha instansiya URL manzili hamda tokeni bilan sozlang. Mustaqil MCP ko‘prigini ishga tushirish uchun Node.js 22 yoki undan yangiroq versiyasi zarur; Electron ilovasi agent mijozingizni o‘rnatmaydi. Brauzer URL manzili uzluksiz uzatiluvchi (streamable) HTTP MCP oxirgi nuqtasi emas: uni stdio ko‘prigiga ZIAFORGE_URL sifatida taqdim eting.

Ko‘prik ziaforge_status, ziaforge_commands, ziaforge_command va ziaforge_screenshot vositalarini taqdim etadi. Holat va jonli buyruqlar katalogidan boshlang, so‘ng tanlangan vazifa uchun system.context ni o‘qing. Tiplashtirilgan buyruqlar mahalliy UI kabi bir xil versiya (revision), darvoza, vazifa jildi va tozalash tekshiruvlariga amal qiladi.

Jonli buyruqlar katalogi documentation.guide — manba yo‘li va sourceSha256 ga ega qonuniy (kanonik) inglizcha yordam qo‘llanmasini o‘z ichiga oladi. Ichki ilova me’mori o‘z vositalari orqali xuddi shu ma’lumotnomani oladi. Bu agentlarga eski qaydlarga tayanmasdan butun mahsulot kontekstini beradi; hujjatlar hech qachon ruxsat bermaydi yoki joriy insoniy qaror o‘rnini bosmaydi.

Agentlar qisqa insoniy g‘oyadan boshlab talablar, texnik qarorlar va rejalashtirishni muhokama qilishlari kerak. Ular insonning aniq darvozalarini, tanlangan modellarni, qo‘lda/Auto siyosatini va talab qilinadigan ko‘rib chiqishni saqlab qolishlari shart. Ular o‘zlaridan ma’qullash to‘qib chiqarmasliklari, noaniq buyruqlarni yangi ID ostida qayta bajarmasliklari yoki egalik qiluvchining niyatidan tashqari Git o‘zgarishlarini nashr qilmasliklari shart.

Bir nechta o‘rnatishlar uchun bir nechta nomlangan MCP serverlarini sozlang. Instansiyani almashtirish — bu marshrutlash qarori bo‘lib, sinxronizatsiya emas. OpenClaw va Hermes sozlash misollari AGENT_CONTROL.md da keltirilgan; mijozga xos sozlash va moslik o‘rnatilgan mijoz versiyasi uchun tekshirilishi kerak.

Tashqi requestId keshi faqat ilova ishlayotgan vaqtda so‘rovlarning cheklangan to‘plamini dublikatlardan tozalaydi. Doimiy amallar o‘z identifikatorlaridan foydalanadi: vazifa yaratish uchun createRequestId, ish jarayoni qarorlari uchun commandId, xabarlar uchun clientMessageId va operationId Git o‘zgarishlari uchun. Noma’lum tasdiqdan keyin asl identifikator va ma’lumotlar yuklamasini (payload) saqlab qoling; yangi ishni qasddan boshlashdan oldin saqlangan holatni o‘qing.

Tegishli ko‘rsatmalar: [MCP mijozi bo‘yicha ko‘rsatmalar](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## Mahalliy CLI va avtomatlashtirish cheklovlari

ziaf dispetcheri ishlayotgan o‘sha ilovani va saqlangan ish jarayonini boshqaradi. Manbadan foydalanganda npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID yoki npm run ziaf -- pause --task TASK_ID dan foydalaning. Muvaffaqiyatli Boshlash (Start) tasdig‘i vazifa yakunlanganini anglatmaydi.

--until-success saqlangan ish jarayoni uchun Auto rejimini qasddan yoqadi, ammo savollar, ko‘rib chiqish, qabul qilish darvozalari, cheklovlar va nazorat nuqtalari baribir amal qiladi. Ctrl+C kuzatayotgan dispetcherdan chiqadi; u ilova ish jarayonini bildirmasdan to‘xtatmaydi. Chiqish kodlari, mahalliy oxirgi nuqta va profil bilan ishlash bo‘yicha CLI.md ga qarang.

Hozirgi vaqtda Avtomatlashtirish interfeysi ko‘rsatish ta’riflarini va mahalliy ishga tushirish hisoblagichlarini saqlaydi. U sertifikatlangan takroriy rejalashtiruvchi emas va fondagi model navbati ishlaganini isbotlamaydi. Haqiqiy ijro uchun saqlangan ish jarayoni boshqaruvlaridan, ziaf yoki autentifikatsiyadan o‘tgan API dan foydalaning va ularning kvitansiyalarini tekshiring. Namoyish panelini qarovsiz rejalashtirish deb yanglish hisoblamang.

Tegishli ko‘rsatmalar: [Dispetcher buyruqlari](../../CLI.md).

<a id="updates"></a>

## Version and updates

> To‘liq qo‘llanma hali interfeys tilingizga tarjima qilinmagan. Ingliz tilidagi asl nusxa ko‘rsatilmoqda.

Open Settings → Updates and choose Check for updates. The official GitHub repository ZIAForge/ZIAForge and the Stable channel are configured by default. The panel shows the running version and any newer compatible release. Preview includes prereleases; Stable excludes them. Checking never installs an update.

When an update is available, Update downloads the package for this operating system and architecture, verifies its published size and SHA-256, prepares the installer and requests a normal application restart. Save file edits first. Installation is armed only after application services stop, and the installer waits for the current process to exit. Your profile, settings, task history and project files are kept.

Supported installation paths are a writable macOS application bundle, the Windows installer, Linux AppImage and the distribution package manager for DEB/RPM. System installation or authentication prompts may still appear. A development checkout, a read-only or translocated macOS app, or an unsupported portable layout may require manual installation; the panel explains that case and links to the release. Move a macOS application out of the mounted disk image before using in-place updates.

Automatic checking and downloading is optional. When enabled, it checks immediately and every six hours. Installing and restarting remains a separate owner action. A failed download or checksum check retains the existing installation and never runs the downloaded file.

Downloaded package hashes establish that the files match the selected GitHub release. They do not replace code signing or notarization. The updater does not disable operating-system security checks. Repository and channel changes, downloads and installation are local owner actions; remote agents can read update status only.

Tegishli ko‘rsatmalar: [Application update behavior and installation limits](../../UPDATES.md) · [Release readiness](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Qayta ishga tushirish va tiklash

macOS tizimida to‘liq to‘xtatish uchun Chiqish / ⌘Q dan foydalaning. Oynani yopish ilovani ishlayotgan holda qoldirishi mumkin. Ilovani almashtirishdan oldin eski versiyadan to‘liq chiqing.

Ishga tushirgandan so‘ng o‘sha vazifani tanlang. Tarix va qoralamalar qaytadi. Davom ettirish mahalliy/lokal kontekstni tiklaydi, ammo qoralamani yubormaydi, navbatni to‘xtatib turishdan chiqarmaydi yoki noma’lum amalni takrorlashga vakolat bermaydi.

Agar Qayta tiklash paydo bo‘lsa, JSON ni qo‘lda tahrirlamang. Ta’sirlangan hujjat turini tekshiring, asl fayllarni saqlang va tasdiqlangan zaxira nusxani tanlang. Eski navbatni tiklash uning elementlarini noaniq deb belgilaydi.

Yetkazib berish noma’lum bo‘lganda, boshqariladigan ish jarayoni yangi kontekst uchun aniq ruxsat talab qilishi mumkin. Oldingi ishlar va muvaffaqiyatsiz urinishlar saqlanib qoladi; ko‘rinib turgan rad etish soxtalashtirilgan muvaffaqiyatdan ko‘ra xavfsizroqdir.

Barcha ilova instansiyalari yopiq holda vazifa fayllari va ilova profilining zaxira nusxasini yarating. Nusxalangan jild tekshirilgan tiklash degani emas. Agar qayta tiklash sizdan tasdiqlangan zaxira nusxasini tanlashni so‘rasa, shikastlangan aniq fayllarni ham saqlab qoling. Eski ish jarayoni yoki navbatni tiklash noaniq xulosa chiqarish yoki Git amallarini qayta bajarishga vakolat bermaydi.

Tegishli ko‘rsatmalar: [Qayta tiklash shartnomasi](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Nosozliklarni aniqlash va bartaraf etish

CLI topilmadi: oddiy terminalda uning o‘rnatilishi va versiyasini tekshiring, so‘ng ZIAForge ni qayta ishga tushiring. Ijro etiluvchi faylning mavjudligi siz tizimga kirganingizni anglatmaydi. Provayderning o‘z tizimiga kirish mexanizmidan foydalaning.

Model mavjud emas yoki autentifikatsiyadan o‘tmadi: aniqlashni yangilang, mavjud ID ni tanlang va hisobingiz hamda cheklovlaringizni tekshiring. Noaniq so‘rov tarixini tekshirishdan oldin uni qayta takrorlamang.

Ish jarayoni to‘xtatildi: joriy bosqichni, savolni, tekshirish kvitansiyasini yoki CLI jurnallarini oching. Aniq sababni bartaraf eting: javobsiz savol, buyruq, jild ruxsati yoki urinishlar cheklovi. Davom ettirish muvaffaqiyatsiz tekshiruvni muvaffaqiyatga aylantira olmaydi.

Jild yetishmayapti yoki almashtirilgan: asl jildga kirishni tiklang yoki yangi vazifa yarating. Ilova HOME dan davom etmasligi kerak. Agar boshqa cwd ni kuzatsangiz, navbatni to‘xtating va diagnostikani saqlab qoling.

Hisobot uchun Dastur haqida (About) bo‘limidagi versiyani, marshrutni, CLI/modelni, kutilgan va haqiqiy xatti-harakatni, skrinshotni va xavfsiz jurnal parchasini kiriting. Maxfiy ma’lumotlarni, shaxsiy kontentni va nashr qilib bo‘lmaydigan yo‘llarni olib tashlang.

Masofaviy sahifa mavjud emas: egalik qiluvchi serverni yoqqanini tekshiring, tinglanayotgan manzil va portni tekshiring, so‘ng to‘g‘ri instansiya tokeni bilan autentifikatsiyadan o‘ting. 401 autentifikatsiyani bildiradi; rad etilgan o‘zgartirish o‘qish qamrovi yoki faqat egalik qiluvchi uchun boshqaruv bo‘lishi mumkin. Tokenni o‘zgartirish mavjud brauzer mijozlarini yopadi. Alohida DevTools tekshirish portini ilovani masofadan boshqarish sifatida ochib qo‘ymang.

Muharrirda saqlash rad etildi: qoralamani saqlab qoling, diskdagi joriy faylni tekshiring va tashqi o‘zgarishlar to‘qnashuvini hal qiling. Ilova metama’lumotlarini qayta yozish orqali taqqoslashni chetlab o‘tmang. Katta hajmli faylni to‘liq yuklash imkoni bo‘lmasa, qo‘llab-quvvatlanadigan oyna tahrirlash/qidiruvdan yoki tashqi muharrirdan foydalaning.

Telegram mavjud emas: bot tokenini, raqamli egalik qiluvchini, shaxsiy chatni va holatni mahalliy darajada tasdiqlang. Raqobatdosh vebxuk yoki poller so‘rovlarni to‘sib qo‘yishi mumkin; ZIAForge avtomatik ravishda vebxukni o‘chirmaydi yoki boshqa pollerni egallamaydi. Noma’lum chegarada rad etilgan yoki to‘xtatilgan buyruqlar avtomatik ravishda qayta ijro etilmaydi.

Tegishli ko‘rsatmalar: [Sinov va diagnostika](../../TESTING.md).

<a id="diagnostics"></a>

## Muammolar haqida xabar berish va dalillarni tekshirish

Dastur haqida (About) bo‘limidan ishlayotgan aniq yig‘ilmani, OS/arxitekturani, vazifa rejimini, tanlangan provayder/modelni va muammoni takrorlovchi qadamlarni yozib oling. Kutilgan natija va kuzatilgan natijani bayon qiling. Butun maxfiy profilni yuborish o‘rniga, xavfsiz skrinshot hamda tegishli saqlab qolingan buyruq yoki tekshiruv kvitansiyasini ilova qiling.

CLI jurnallari, hodisalar jurnallari, model transkriptlari, brauzer izlari va skrinshotlar manba kodini, shaxsiy yo‘llarni yoki tokenlarni oshkor qilishi mumkin. Ulashishdan oldin tekshiring va tahrirlang (redaksiyalash). Jurnallarni imkon qadar tozalovchi mexanizm skrinshot yoki arxivni nashr qilishga tayyor deb kafolatlamaydi.

Hissa qo‘shuvchilar uchun: qa:doctor muhit/yig‘ilma identifikatsiyasini o‘qiydi; qa:inspect provayder stablari bilan alohidalangan profilni ochadi. Fikstura modelga murojaat qilmasdan sinovdan o‘tgan ilova yo‘lini isbotlaydi. Jonli xulosa chiqarish (inference), Telegram ulanishi, mahalliy Linux ish stoli, imzolash va paketlangan artifakt tekshiruvlari alohida dalillardir. Qayta takrorlanuvchi buyruqlar va tozalash bo‘yicha TESTING.md ga qarang.

Tegishli ko‘rsatmalar: [Dalillar buyruqlari](../../TESTING.md).

<a id="privacy"></a>

## Mahalliy ma’lumotlar va chegaralar

Loyihalar, tarix, rejalar, hujjatlar va diagnostika maxfiy matnni o‘z ichiga olishi mumkin. Profillar, xom ushlash ma’lumotlari, kalitlar yoki to‘liq jurnallarni manba kodi bilan birga nashr qilmang.

Linux tizimida API, boshqaruv, Telegram va instansiya hisob ma’lumotlarini saqlash qulfdan chiqarilgan GNOME Secret Service yoki KWallet ni talab qiladi; qo‘llab-quvvatlanadigan maxfiy ombor bo‘lmasa, ZIAForge Electron ning basic_text zaxira variantidan foydalanish o‘rniga bu sirlarni saqlashni rad etadi.

Mahalliy xotirada saqlash so‘rovlar kompyuteringizda qolishini anglatmaydi: tanlangan CLI/API ularni o‘z provayderiga yuboradi. Ishchi jild va jarayon nazorati OS izolyatsiyasi hisoblanmaydi. Tanlangan ruxsatlarni tekshiring.

Dalil turlarini farqlang: fiksturalar ilovani modelsiz sinovdan o‘tkazadi; mahalliy jonli sinov real CLI/hisobni ishlatadi; paketlangan tekshiruvlar aniq bir artifaktni sertifikatlaydi. Biri muvaffaqiyatli o‘tishi boshqalarini kafolatlamaydi.

Ilova qamrovi, ishchi daraxt va faqat o‘qish uchun mo‘ljallangan prompt operatsion tizim darajasidagi majburiy cheklovdan farq qiladi. Antigravity taqrizchi/yordamchi siyosatlari fayl tizimiga faqat o‘qish uchun kirishni majburlash o‘rniga, to‘plangan ish maydoni dalillaridagi o‘zgarishlarni aniqlaydi. Kompyuterni mahalliy boshqarish oddiy ilova-vosita chegarasidan tashqarida egalik qiluvchi tomonidan ruxsat berilgan dasturlarni bajaradi; u endi kerak bo‘lmaganda o‘chirib qo‘ying.

Tegishli ko‘rsatmalar: [Kelib chiqish va nashr qilish](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Ushbu ochiq kodli loyihani tushunish va o‘zgartirish

Avval AGENTS.md va CONTRIBUTING.md ni, so‘ngra joriy manba chegaralari uchun PROJECT_MAP.md ni o‘qing. Amalga oshirilgan tiplashtirilgan shartnomalar va joriy ish jarayoni/provayder hujjatlari xatti-harakatni belgilaydi. CONCEPT.md hamda ARCHITECTURE.md ning dastlab terminalga qaratilgan qismlari tarixiy niyatni saqlaydi va ularni joriy reliz da’volari deb yanglish hisoblamaslik kerak.

Inglizcha yordam manbasi — docs/help/en.json. Avtomatik yaratilgan USER_GUIDE.md yoki website/guide.html fayllarini qo‘lda tahrirlamang. Qonuniy bo‘limni o‘zgartiring, tegishli shartnomani yangilang va node scripts/help/generate.cjs ni ishga tushiring. Ilova ichidagi Yordam ham xuddi shu manbani o‘qiydi. Qo‘shimchalarni haqiqiy tatbiq bilan, jumladan cheklovlar, ruxsatlar va qo‘llab-quvvatlanmaydigan yo‘llar bilan birga ko‘rib chiqing.

56 ta interfeys lokalining har biri docs/help/locales.json da alohida yordam holatiga ega. Yetishmayotgan yoki to‘liq bo‘lmagan yordam ingliz tiliga qaytadi. To‘liq mashina tarjimasi qilingan matnlar belgilanadi va insoniy ko‘rib chiqish da’vosiz inglizcha manba xeshiga bog‘lanadi. Inson tomonidan ko‘rib chiqilgan tarjimada qo‘shimcha ravishda uning taqrizchisi yoziladi. Har bir tarjima bo‘lim ID larini, harakatlarni, fayl/buyruq identifikatorlarini va texnik cheklovlarni saqlashi, to‘g‘ri yo‘nalishdan foydalanishi hamda inglizcha manbasi o‘zgarganda yangilanishi kerak.

Chiqarishdan oldin, eskirgan yaratilgan natijalarni, yaroqsiz lokal andozalarini yoki buzilgan mahalliy shartnoma havolalarini aniqlash uchun node scripts/help/generate.cjs --check ni ishga tushiring. UI tarjima tekshiruvlari va ilova xatti-harakati tekshiruvlari alohida qoladi. HELP_MAINTENANCE.md da hissa qo‘shuvchi va AI ni yangilash tartibi keltirilgan; hujjatlar o‘tkazilmagan sinovni o‘tdi deb da’vo qilmasligi kerak.

Tegishli ko‘rsatmalar: [Joriy loyiha xaritasi](../../PROJECT_MAP.md) · [Hujjatlarni saqlash](../../HELP_MAINTENANCE.md) · [Hissa qo‘shuvchilar uchun ko‘rsatmalar](../../../CONTRIBUTING.md) · [Agent ko‘rsatmalari](../../../AGENTS.md).
