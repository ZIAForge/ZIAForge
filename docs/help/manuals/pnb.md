<!-- Generated from docs/help/en.json; source SHA-256 1d8a8515cf743144e27893fc6fb1e85fc06b290f1744ab0ebc57665893e6d684. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: pnb; served locale: pnb; status: machine-translated. -->
# ZIAForge ورتن والے دی رہنمائی

ارادے توں لے کے تصدیق شدہ نتیجے تیکر۔ Code، Work تے ایپلیکیشن کنٹرول دی اک عملی رہنما کتاب۔

انگریزی مستند تے بنیادی اے۔ مشین نال ترجمہ کیتی گئی مدد نوں انسان دی جانچ والے ترجمیاں توں وکھرا لیبل کیتا جاندا اے۔ خودکار جانچ مادری بولی دی درستگی دی تصدیق نہیں کردی۔

> ایہ گائیڈ موجودہ انگریزی ماخذ توں مشین-ترجمہ شدہ ہے۔ انسانی نظر ثانی دا فیر وی خیر مقدم ہے۔

## رہنمائی دے سیکشن

- [پہلے قدم](#start)
- [صحیح ڈیسک ٹاپ پیکج انسٹال کرو](#install-platforms)
- [Code: پنج رستے](#code)
- [Forge بحث](#forge)
- [دستاویزات تے فیصلے](#decisions)
- [نفاذ تے جائزہ](#execution)
- [متوازی جائزہ ٹیماں تے رپورٹ آرکیٹیکٹ](#review-teams)
- [ایجنٹ تخصصات تے پرامپٹ پالیسی](#specializations)
- [Work: سوال توں دستاویز تیکر](#work)
- [پری سیٹس، ماڈلز تے رسائی](#models)
- [چیٹس، روکو تے قطار](#chat)
- [فائلاں، Git تے تکمیل](#files)
- [API connections](#api)
- [ترتیبات، بولیاں تے محفوظ ری سیٹ](#settings)
- [مدد معاون کولوں پچھو](#help-assistant)
- [معاون تے Telegram](#assistant-control)
- [اپنا نجی Telegram بوٹ چلاؤ](#telegram)
- [صرف مالک دی مقامی کمپیوٹر اجازت](#native-permissions)
- [براؤزر تے ریموٹ انسٹانسز](#remote)
- [OpenClaw، Hermes تے دوجے بیرونی ایجنٹس](#external-agents)
- [مقامی CLI تے آٹومیشن دیاں حداں](#local-cli)
- [ورژن تے اپ ڈیٹس](#updates)
- [دوبارہ شروع کرنا تے بحالی](#restart)
- [مسائل دا حل](#troubleshooting)
- [مسئلیاں دی اطلاع دیو تے ثبوتاں دی جانچ کرو](#diagnostics)
- [مقامی ڈیٹا تے حداں](#privacy)
- [اس اوپن سورس پروجیکٹ نوں سمجھو تے بدلو](#project-contributors)

<a id="start"></a>

## پہلے قدم

ZIAForge بحث، منصوبہ بندی، عمل درآمد تے تصدیق نوں اکو ٹاسک وچ رکھدا اے۔ Git پروجیکٹ لئی Code چُنو، یا عام فولڈر وچ دستاویزات، تحقیق تے ہور نتائج لئی Work چُنو۔

اک وکھرے پروجیکٹ وچ اک چھوٹے جہے کم نال شروع کرو۔ جے تسیں مقامی CLI چُندے ہو، تاں پہلاں اوہنوں انسٹال کرو تے ٹرمینل وچ اوہدے اپنے اکاؤنٹ نال سائن ان کرو۔ متبادل طور تے، اک API کنیکشن کنفیگر کرو۔ اک CLI سبسکرپشن تے اک بامعاوضہ API وکھرے کنکشن طریقے نیں؛ ZIAForge تہانوں سائن ان نہیں کرواندا تے نہ ای اوہناں دے وچکار کریڈٹ منتقل کردا اے۔

1. ترتیبات کھولو تے ورک سپیس فولڈر تے بولی دی جانچ کرو۔ بارے وچ چلدی بلڈ دی عین شناخت وکھاندا اے۔
2. Code لئی، سائیڈ بار وچ اک Git ریپوزٹری شامل کرو۔ Work لئی، ٹاسک بناؤندے ویلے اک وکھرا فولڈر چُنو۔
3. اک CLI، ماڈل، سوچ وچار دی کوشش تے رسائی دی سطح دے نال اک پری سیٹ محفوظ کرو۔ تسیں محفوظ پری سیٹ توں بغیر وی سدھا کسٹم چُن سکدے ہو۔
4. اک ٹاسک بناؤ، اوہدا راستہ، کردار تے دستی یا خودکار پیش رفت چُنو۔ شروع کرن توں پہلاں انتخا بات دی جانچ کرو۔

> مینٹینر دا فراہم کردہ آرٹیفیکٹ تے چیک سم ورتو۔ اک پیش نظارہ غیر دستخط شدہ ہو سکدا اے یا ایہدے کول شائع شدہ اپ ڈیٹ فیڈ دی کمی ہو سکدی اے۔ ڈیسک ٹاپ تے مقامی فراہم کنندہ دی سپورٹ دی تصدیق عین مطابق OS، فن تعمیر تے آرٹیفیکٹ لئی ہونی چاہیدی اے؛ صرف سورس سپورٹ ریلیز دی سرٹیفیکیشن نہیں اے۔

متعلقہ ہدایتاں: [پروجیکٹ دا جائزہ](../../../README.md) · [فراہم کنندہ دی مطابقت](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## صحیح ڈیسک ٹاپ پیکج انسٹال کرو

اپنے آپریٹنگ سسٹم تے CPU فن تعمیر لئی اک پیکج چُنو: x64 یا arm64۔ بلڈ پائپ لائن macOS DMG/ZIP، Windows NSIS انسٹالر/ZIP، تے Linux DEB/RPM/AppImage/tar.gz/ZIP فارمیٹس بنا سکدی اے۔ کوئی تیار کردہ فائل یا کراس بلڈ اس گل دا ثبوت نہیں اے کہ اوہدا انسٹالر تے مقامی UI تواڈی مشین تے پاس ہو گیا اے؛ اس ریلیز دے تصدیقی ریکارڈ نال رجوع کرو۔

macOS بلڈز جہڑے Electron 44 ورتدے نیں، اوہناں لئی macOS 13 یا بعد دا ورژن درکار اے۔ ایپل سلیکان تے arm64 پیکج تے انٹیل لئی x64 پیکج ورتو۔ بدلن توں پہلاں پرانی ایپ نوں مکمل طور تے بند کرو۔ پریویو پیکجز غیر دستخط شدہ تے غیر تصدیق شدہ ہو سکدے نیں؛ ڈویلپمنٹ آرٹیفیکٹ نوں دستخط شدہ عوامی ریلیز سمجھن دی غلطی نہ کرو۔

Windows نوں اک اجیہے آپریٹنگ سسٹم دی لوڑ ہوندی اے جس دی بنڈل شدہ Electron ورژن ولوں حمایت کیتی گئی ہووے تے Git PATH وچ دستیاب ہووے۔ ملدا جلدا آرکیٹیکچر چُنو۔ اک غیر دستخط شدہ پیش نظارہ کول Authenticode سرٹیفیکیشن نہیں ہوندی۔ پورٹیبل ZIP وچ صرف اوہدی ایگزیکیوٹیبل ای نہیں بلکہ پوری ایپلیکیشن ڈائریکٹری تے رن ٹائم فائلاں برقرار رہنیاں چاہیدیاں نیں۔

Linux نوں اک موافق گرافیکل ڈیسک ٹاپ، Electron لئی درکار سسٹم لائبریریاں، تے Git دی لوڑ ہوندی اے۔ انکرپٹڈ کنٹرول اسناد لئی، اک کم کردا سیکرٹ سروس مہیا کرو جویں کہ gnome-libsecret یا KWallet؛ غیر محفوظ basic_text بیک اینڈ قبول نہیں کیتا جاندا۔ ہیڈ لیس/کنٹینر دھوئیں دے ثبوت ہر ڈیسک ٹاپ یا ڈسٹری بیوشن دی تصدیق نہیں کردے۔

DEB نوں apt install ./file.deb نال انسٹال کرو، یا اپنی ڈسٹری بیوشن دے پیکج منیجر راہیں RPM انسٹال کرو۔ اک AppImage لئی قابل عمل اجازت تے مناسب FUSE سپورٹ دی لوڑ ہوندی اے؛ --appimage-extract-and-run اوتھے اک متبادل اے جتھے تعاون حاصل ہووے۔ tar.gz تے ZIP پیکجز نوں اوہناں دیاں ساریاں رن ٹائم فائلاں نال ان زپ کرو۔ پیکج بدلن ویلے ورتن والے دا ڈیٹا تے ایپلیکیشن فائلاں وکھ رکھو۔

سورس توں بلڈ کرن لئی، Node 24، Git تے npm ci ورتو، بشمول عام Electron انسٹالر۔ مقامی ری بلڈز لئی پلیٹ فارم ٹولز دی لوڑ ہوندی اے: macOS تے Xcode کمانڈ لائن ٹولز؛ Windows تے MSVC C++، Windows SDK تے Python؛ کمپائلر، make، Python، pkg-config تے Linux تے مطلوبہ پیکیجنگ ٹولز۔ اصل کمانڈز تے موجودہ پلیٹ فارم دی حدود لئی PLATFORM_BUILDS.md تے عمل کرو۔

ریلیز ورژن مرکزی طور تے محفوظ ہوندے نیں تے نتائج ناقابل تغیر ہوندے نیں۔ CI تصدیقی بلڈ شائع شدہ انسٹالر نہیں ہوندا۔ سورس آرکائیوز وچ سورس، لاک فائل، دستاویزات تے سکرپٹس ہوندے نیں؛ انحصارات، اسناد، صارف پروفائلز تے نجی تحقیق خارج نیں۔ کسے کامیاب x64 بلڈ توں مقامی ARM یا Windows دی تصدیق دا اندازہ کدی نہ لاؤ۔

متعلقہ ہدایتاں: [پلیٹ فارم پیکجز، ضروری شرطاں تے تصدیقی حدود](../../PLATFORM_BUILDS.md) · [بلڈ دی شناخت تے ریلیز چیکس](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: پنج رستے

Auto گنجائش دا اندازہ لاندا اے: اک سادہ سوال دا جواب مل سکدا اے، جد کہ وڈے ٹاسک لئی تیاری دی لوڑ ہوندی اے۔ کیڑا ٹھیک کرو وجہ دی تفتیش کردا اے تے درستی تیار کردا اے۔ سپیک پہلاں تکنیکی حل نال شروع ہوندا اے؛ ضروریات پہلاں ضروریات تے قبولیت دے معیار نال شروع ہوندا اے۔

ملٹی ماڈل کھوج، ڈیزائن، نفاذ تے جائزے لئی وکھو وکھرے سیاق و سباق ورتدا اے۔ روٹ دے ناں لئی وکھرے فراہم کنندگان دی لوڑ نہیں ہوندی: ہر کردار اوہی پری سیٹ یا کسٹم کنفیگریشن ورتدا اے جہڑی تسیں چُندے ہو۔

ورک ٹری ٹاسک دیاں Git تبدیلیاں نوں وکھ کر دیندا اے۔ برانچ چُنے ہوئے چیک آؤٹ وچ کم کردی اے۔ شروع کرن توں پہلاں پروجیکٹ، برانچ تے ماڈل دی جانچ کرو؛ ٹاسک دا ویروا عام چیٹ وچ وی نہیں بھیجیا جاندا۔

کسے اجیہے خیال لئی جس دے پروڈکٹ یا تکنیکی فیصلے حل طلب ہون، ضروریات پہلاں ورتو تے گل بات وچ بنیاد بناؤ۔ Auto درخواست دی درجہ بندی کردا اے؛ ایہ ہر چھوٹے جملے نوں فوراً نافذ کرن دا حکم نہیں اے۔ ڈرافٹ محفوظ کرو ماڈل نال رابطہ کیتے بغیر درخواست نوں برقرار رکھدا اے؛ شروع کرو منظم بہاؤ نوں اک وار محفوظ کر کے شروع کردا اے۔ اک توں چار ٹاسک کاپیاں دے آزادانہ تخلیقی IDs تے کردار دیاں سیٹنگز ہوندیاں نیں۔

متعلقہ ہدایتاں: [Code ورک فلو معاہدہ](../../WORKFLOWS.md) · [Code پرامپٹ پروفائلز](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Forge بحث

شروع کرو مرکزی بحث کھولدا اے۔ قدرتی طور تے جواب دیو، جوابی سوال پچھو، رکاوٹاں شامل کرو تے تکنیکی انتخاب تے بحث کرو۔ گل بات تے سوال ٹاسک دے نال ای رہندے نیں۔

متن بھیجن نال کسے دستاویز نوں قبول نہیں کیتا جاندا تے نہ ای نفاذ دے نویں منصوبے دی اجازت ملدی اے۔ نفاذ دے دوران وضاحت پہلاں منظم واری نوں روکدی اے تے متاثرہ گنجائش دا دوبارہ جائزہ لیندی اے۔ پہلے توں قبول شدہ مرحلے دے اندر کسے سوال دا جواب اس مرحلے نوں جاری رکھ سکدا اے۔

جان بجھ کے بنیاد دا دوبارہ جائزہ لین لئی، ضروریات، تصریحات یا منصوبہ بندی چُنو۔ اک نویں ورژن لئی منحصر فیصلیاں دی نویں سرے توں قبولیت درکار ہوندی اے۔ مکمل شدہ مرحلے تے اوہناں دے ثبوت باقی رہندے نیں؛ منسوخ شدہ نامکمل مرحلے تاریخ وچ رہندے نیں۔

منظم مرحلے دے سیشن آزادانہ چیٹ توں وکھرے ہوندے نیں۔ ورک فلو دی ملکیت والے سیشن وچ سدھے دستی پرامپٹس بھیجن دے بجائے Forge بحث ورتو۔

متعلقہ ہدایتاں: [Forge بحث دا معاہدہ](../../WORKFLOWS.md).

<a id="decisions"></a>

## دستاویزات تے فیصلے

دستاویز کھولو، اوہدا ورژن ویکھو تے لوڑ پین تے تبدیلیاں کرو۔ گل بات راہیں تبدیلیاں جمع کراؤن نال نواں ورژن بندا اے؛ رپورٹاں تے تصدیق شدہ نتیجے پچھلی تاریخ نال دوبارہ نہیں لکھے جاندے۔

تجویز کردہ منصوبے نوں قبول کرن توں پہلاں، ترتیب، ہدایات، قبولیت دے معیار تے تصدیقی کمانڈز وچ ترمیم کرو۔ ٹھوس کمانڈز دی اجازت دیو جنہاں نوں تسیں سمجھدے ہو: اوہ ٹاسک فولڈر وچ چلدیاں نیں۔ ملٹی ماڈل پورے ٹاسک دے نفاذ دا اک مرحلہ تجویز کردا اے، جس دی تفصیلات اوہدیاں دستاویزات تے ہدایات وچ ہوندیاں نیں۔

منظور کرو اک وکھرا سوچیا سمجھیا فیصلہ اے۔ Auto سوالاں یا ضروریات، وضاحتاں تے منصوبیاں دی قبولیت نوں نظرانداز نہیں کردا۔ باہروں بدلی گئی دستاویز پرانی منظوری نوں دوبارہ استعمال نہیں کر سکدی۔

تیاری دیاں فائلاں نمونیاں (artifacts) دے طور تے ظاہر ہوندیاں نیں۔ اوہناں دا ورژن، تیار کرن والا مرحلہ تے ہیش اوہناں نوں نتیجے نال بنھدے نیں۔ Code دیاں دستاویزات ورک ٹری توں باہر رکھیاں جاندیاں نیں تے خودکار طور تے کمٹ وچ شامل نہیں ہوندیاں۔

قبول کرن توں پہلاں دستاویز تے وکھائے گئے فیصلے دوواں دی جانچ کرو۔ قبولیت موجودہ گیٹ ID، منصوبے دے جائزے تے محفوظ شدہ دستاویز دے ہیش نوں پابند کردی اے۔ جدوں گنجائش یا ثبوت غلط ہون تاں تبدیلیاں دی درخواست کرو۔ جے کوئی فیصلہ پرانا ہو گیا اے، تاں نیا انتخاب کرن توں پہلاں محفوظ حالت نوں دوبارہ لوڈ کرو؛ بدلی ہوئی فائل نوں پچھلے ورژن دے تحت قبول نہیں کیتا جا سکدا۔

متعلقہ ہدایتاں: [ورک فلو گیٹس تے دستاویز دے ورژن](../../WORKFLOWS.md).

<a id="execution"></a>

## نفاذ تے جائزہ

کرن والے کم اصل مرحلے، موجودہ کوشش، تصدیق تے جائزے دے نتائج وکھاندا اے۔ کسے ایجنٹ دا "مکمل" کہنا مرحلے نوں پورا نہیں کردا: منصوبے دے مطلوبہ ثبوت دا ہونا ضروری اے۔

دستی موڈ اہل مرحلیاں دے وچکار رکدا اے۔ Auto تصدیق شدہ مرحلیاں نوں اگے ودھاندا اے تے محدود دوبارہ کوششاں دی اجازت دیندا اے۔ اس توں بعد روکو ہمیشہ اک چیک پوائنٹ بناندا اے۔ عارضی روکو ورک فلو دے فعال کم نوں روک دیندا اے؛ پینل بند کرنا ایہنوں نہیں روکدا۔

اک آزاد مبصر فائلاں تے تصدیقی نتائج دے نال اک وکھرا سیاق و سباق ورتدا اے۔ ہر ضروری رکاوٹ والی تلاش نوں حل کرنا لازمی اے؛ اک توں ودھ مبصرین ووٹ پا کے کسے رکاوٹ والی غلطی نوں ختم نہیں کر سکدے۔

ملٹی ماڈل وچ، خامیاں نوں ٹھیک کرن لئی اک واضح فیصلے دی لوڑ ہوندی اے۔ کوئی درستی خاموشی نال اک ہور جائزہ شروع نہیں کردی: دوبارہ جائزہ لو اک نواں چکر شروع کردا اے۔ جائزے دے تبصرے نفاذ نوں دہرائے بغیر کوآرڈینیٹر توں دوبارہ غور دی درخواست کر سکدے نیں۔

مکمل ہو چکے مرحلیاں نوں خاموشی نال تبدیل نہیں کیتا جا سکدا۔ TDD دے نال، متوقع وجہ نال ریڈ دا اصل وچ فیل ہونا ضروری اے، فیر گرین پاس ہونا چاہیدا اے۔ محدود کوششاں لامتناہی دوبارہ کوششاں نوں روکدیاں نیں۔

ترتیبات ← جائزہ ٹیماں وچ آزاد CLI/API مبصرین محفوظ کرو، فیر Code یا Work وچ ٹیم چُنو۔ مبصرین متوازی چلدے نیں، اوہناں دے بعد ٹیم دا رپورٹ آرکیٹیکٹ آؤندا اے۔ تسیں محفوظ ٹیم توں بغیر وی آزاد مبصرین ترتیب دے سکدے ہو۔ رپورٹ آرکیٹیکٹ نوں صرف گمنام منظم رپورٹاں ملدیاں نیں، جنہاں وچ پروجیکٹ دیاں فائلاں یا ٹولز نہیں ہوندے؛ اس تنہائی لئی فی الحال Claude Code یا API درکار اے۔

ہر نفاذ دے مرحلے لئی اک قابل عمل جانچ، مطلوبہ آزاد جائزہ، یا دوواں دی لوڑ ہوندی اے۔ تیاری دے مرحلے اس دے بجائے تصدیق شدہ نتائج تے نمونیاں دیاں رسیداں برقرار رکھدے نیں؛ ایہ ایہ دعویٰ نہیں کردے کہ نفاذ دے ٹیسٹ چلے سن۔ کوئی کمانڈ صرف ادوں کامیاب ہوندی اے جدوں اوہدی اصل ایگزٹ سٹیٹس تے متعلقہ پروسیس دی صفائی دی تصدیق ہو جائے۔ TDD لئی اک ریڈ چیک نوں نفاذ تے گرین تصدیق توں پہلاں عام طور تے فیل ہونا چاہیدا اے؛ کسے قابل عمل فائل دا گم ہونا یا ٹائم آؤٹ درست ریڈ نتیجہ نہیں اے۔

پہلے توں طے شدہ سرکٹ بریکر اک مرحلے تے تن ناکام کوششاں یا کل پنجاہ کوششاں توں بعد رک جاندے نیں۔ رکاوٹ اک کوشش کھا جاندی اے پر اپنے آپ وچ ناکام کوشش شمار نہیں ہوندی۔ حدود تے مکمل ثبوت دوبارہ شروع کرن توں بعد وی باقی رہندے نیں؛ دوبارہ کوشش اوہناں نوں دوبارہ سیٹ نہیں کردی۔ دوسری کوشش دی اجازت دین توں پہلاں محفوظ شدہ ناکامی نوں پڑھو۔

متعلقہ ہدایتاں: [تصدیق تے جائزہ](../../WORKFLOWS.md).

<a id="review-teams"></a>

## متوازی جائزہ ٹیماں تے رپورٹ آرکیٹیکٹ

ترتیبات ← جائزہ ٹیماں کھولو تے اک ٹیم محفوظ کرو۔ اپنے CLI یا API، ماڈل، استدلال دی کوشش تے تخصص دے نال آزاد مبصرین شامل کرو، فیر رپورٹ آرکیٹیکٹ چُنو۔ ٹاسک دی جائزہ ترتیب وچ ٹیم چُنو۔ ایگزیکیوٹر پری سیٹ وی اک مبصر ورت سکدا اے، تے کسٹم دستیاب رہندا اے؛ آزاد کرداراں دے فیر وی وکھرے سیاق و سباق ہوندے نیں۔

مبصرین اکو ٹاسک ثبوت تے متوازی طور تے چلدے نیں۔ ہر مطلوبہ رپورٹ، غلطی تے فیصلہ برقرار رکھیا جاندا اے۔ آرکیٹیکٹ نوں مبصر دے ناواں، ماڈل یا فراہم کنندہ دی شناخت، اصل ٹاسک دا مواد، ریپوزٹری رسائی یا ٹولز توں بغیر گمنام نمبر والی رپورٹاں ملدیاں نیں۔ ایہ رپورٹاں دا موازنہ کردا اے تے اک منظم فیصلہ واپس کردا اے؛ ایہ سورس دا نواں جائزہ نہیں لیندا۔

اک رکاوٹ والی کھوج یا مطلوبہ مبصر دی مستردگی نوں اکثریتی ووٹ یا آرکیٹیکٹ دی ترجیح نال معاف نہیں کیتا جا سکدا۔ گمشدہ یا خراب رپورٹاں منظوری نوں روکدیاں نیں۔ قبول کرن یا درستی دی اجازت دین توں پہلاں انفرادی نتائج تے مجموعی فیصلے دی جانچ کرو۔ اک محفوظ ٹیم نوں رن لئی حل تے منجمد کیتا جاندا اے؛ اوہدے پری سیٹ وچ ترمیم کرن نال مکمل ثبوت دوبارہ نہیں لکھے جاندے۔

صرف-رپورٹ والا آرکیٹیکٹ فی الحال معاونت یافتہ Claude یا API ٹول توں پاک کنفیگریشنز ورتدا اے۔ Codex تے Antigravity مبصرین دے طور تے دستیاب رہندے نیں پر اس وکھرے آرکیٹیکٹ کردار لئی ادوں تیکر انکار کیتا جاندا اے جد تیکر کوئی تصدیق شدہ ٹول توں پاک معاہدہ موجود نہ ہووے۔ صرف اک پرامپٹ جس وچ "کوئی ٹول نہیں" کہیا گیا ہووے، کافی نہیں اے۔

> Code ملٹی ماڈل دی ڈیزائن/جائزہ پائپ لائن تے محفوظ کیتی متوازی جائزہ ٹیم وکھرے کنٹرولز نیں۔ چُنی گئی کسٹم جائزہ پالیسی نوں برقرار رکھو؛ ایہ فرض نہ کرو کہ اک راستہ ہر جائزے دے فیچر نوں فعال کردا اے۔

متعلقہ ہدایتاں: [ٹائپ شدہ ٹیم کنفیگریشن](../../../shared/review-team.ts) · [جائزے دا مجموعہ](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## ایجنٹ تخصصات تے پرامپٹ پالیسی

ماڈل نفاذ دا انجن اے؛ اک تخصص اک ہدایتی پروفائل اے۔ بغیر کسے اضافی تخصص لئی کوئی نہیں، پہلے توں طے شدہ گائیڈ لئی معیاری، متعلقہ بلٹ ان گائیڈ لئی Auto، یا چُنی گئیاں گائیڈز تے تواڈیاں اپنیاں محدود ہدایات لئی دستی چُنو۔ پری سیٹس اس انتخاب نوں برقرار رکھ سکدے نیں۔

اصل کیٹلاگ عام کوڈنگ، فن تعمیر، سکیورٹی، وشوسنییتا، کارکردگی، ٹیسٹنگ تے انٹرفیس دے استعمال نوں شامل کردا اے۔ Auto گائیڈ چُنن لئی دستیاب ٹاسک/قدم دا متن ورتدا اے؛ ایہ خاموشی نال کسے دوجے ماڈل نوں کال نہیں کردا تے نہ ای مہارت دی تصدیق کردا اے۔ منصوبہ بندی دیاں تجاویز نوں نفاذ دے منصوبے نوں قبول کرن توں پہلاں ویکھیا تے بدلیا جا سکدا اے۔

جائزہ تخصصات دھیان مرکوز کرن وچ مدد کردے نیں پر کدی وی آزاد ثبوت، رسائی دیاں حدود یا منظم فیصلے دی تھاں نہیں لیندے۔ کسٹم ہدایات نوں ٹاسک دے دائرہ کار دا حصہ سمجھو: اوہناں نوں دستاویز دی قبولیت، ٹول پالیسی، تصدیق یا مبصر دی ناکامی نوں نظرانداز کرن لئی نہ ورتو۔

متعلقہ ہدایتاں: [اصل پرامپٹ کیٹلاگ](../../../shared/specializations.ts).

<a id="work"></a>

## Work: سوال توں دستاویز تیکر

Work نوں Git دی لوڑ نہیں ہوندی۔ پہلے توں طے شدہ اک وکھرا ٹاسک فولڈر بناندا اے؛ کسٹم مقامی چُݨن والے راہیں موجودہ فولڈر چُن لیندا اے۔ ڈرافٹ محفوظ کرو انفارنس دے بغیر ترتیبات محفوظ کردا اے؛ شروع کرو پہلا مرحلہ چلاندا اے۔

Auto سدھا جواب دیندا اے یا اصل ٹو-ڈوز نال اک مناسب منصوبہ پیش کردا اے۔ برین سٹارم ideas.md بناندا اے اس توں پہلاں کہ تسیں ہور خیالات یا تشخیص چُنو۔ تحقیق findings.md، ذرائع تے حدود نوں محفوظ رکھدی اے۔ لکھو مقصد توں تے، جدوں مفید ہووے، outline.md توں تفصیلی دستاویز یا draft.md ول ودھدا اے؛ جائزے پچھلے ورژناں نوں محفوظ رکھدے نیں۔

مقامی چُݨن والے راہیں فائل ان پٹس چُنو تے اوہناں دا @ نال حوالہ دیو۔ ایپ اوہناں نوں ناقابل تغیر ٹاسک ان پٹس دے طور تے کاپی کردی اے تے رن توں پہلاں اوہناں دی شناخت دی تصدیق کردی اے۔ پہلے توں طے شدہ ایپلیکیشن دی ملکیت والا ٹاسک فولڈر بناندا اے؛ کسٹم فولڈر رسائی اک محفوظ مالک گرانٹ اے۔ اک محفوظ، غیر شروع شدہ ڈرافٹ اپنا فولڈر بدل سکدا اے۔

آزاد ایگزیکیوٹر سیٹنگز نال 1–4 کاپیاں بناؤ۔ آپس وچ جڑے ہوئے فولڈرز ورتن والے ٹاسک اکٹھے نہیں لکھ سکدے۔ ایہ رابطہ کاری ZIAForge دے کماں تے لاگو ہوندی اے، من مانی بیرونی پروگراماں تے نہیں۔

ڈیپ برین سٹارم پہلے توں طے شدہ طور تے تن آزاد کارکناں نوں ورتدا اے تے اٹھ تیکر سپورٹ کردا اے۔ اوہناں دی ترتیب تے کنفیگریشنز چُنو، بشمول وکھرے سیاق و سباق وچ پری سیٹ دا دوبارہ استعمال۔ کارکناں دے سوال اپنے ماخذ برقرار رکھدے نیں؛ غلط فارمیٹ والیاں رپورٹاں نوں فارمیٹ ٹھیک کرن دی اک کوشش ملدی اے۔ جزوی ناکامی نوں متفقہ کامیابی بنا کے پیش کرن دے بجائے وکھایا جاندا اے۔

ڈیپ محفوظ کیتیاں کارکناں دیاں رپورٹاں نوں brainstorm_report.md وچ یکجا کردا اے تے ہمیشہ ورتن والے توں فیصلہ منگدا اے۔ اک چھوٹی جہی پیروی کوآرڈینیٹر راہیں رپورٹ وچ ترمیم کردی اے؛ اک وڈی تبدیلی منجمد کارکناں دا اک ہور دور شروع کردی اے۔ آرٹیفیکٹس اپنے ورژنز برقرار رکھدے نیں۔

طے شدہ کردار ٹاسک دی تخلیق یا ڈرافٹ دے واضح سیو تے منجمد ہو جاندے نیں۔ پہلی واری توں بعد، صرف خودکار/دستی پیش رفت بدل سکدی اے؛ وکھرے کردار یا ماڈل سیٹنگز لئی نواں ٹاسک ورتو۔ گلوبل پری سیٹ وچ ترمیم کرن نال بعد دے مرحلے خاموشی نال نہیں بدلدے۔

دستی موڈ اہل مرحلیاں دے وچکار رکدا اے، بشمول اک خاصا وڈا رائٹ آؤٹ لائن۔ Auto اس آؤٹ لائن راہیں جاری رہ سکدا اے۔ سوال، تجویز کردہ قابل عمل منصوبے، برین سٹارم دی سمت تے ڈیپ رپورٹ دا جائزہ Auto وچ وی واضح فیصلے رہندے نیں۔ صرف حوالہ ایہ ثابت نہیں کردا کہ براؤزنگ ہوئی سی، تے صرف اک محفوظ بائنری فائل اوہدی رینڈرنگ نوں ثابت نہیں کردی۔

متعلقہ ہدایتاں: [Work موڈز تے فیصلے](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## پری سیٹس، ماڈلز تے رسائی

اک پری سیٹ CLI/API، ماڈل، سوچ وچار دی کوشش تے اجازت نامیاں نوں محفوظ کردا اے۔ چیٹ دے تھلڑے حصے وچ پری سیٹ، CLI، ماڈل تے آپشنز دے حصے ہوندے نیں۔ کسٹم بغیر پری سیٹ دے کم کردا اے؛ پری سیٹ بناؤ موجودہ انتخاب نوں محفوظ کردا اے۔

کیٹلاگ چُنے ہوئے انسٹال شدہ CLI یا API توں آؤندا اے جتھے تعاون حاصل ہووے۔ تازہ کرو انتخاب نوں بدلے بغیر فہرست نوں اپ ڈیٹ کردا اے۔ جے دریافت دستیاب نہیں اے، تاں اک واضح ماڈل ID درج کرو؛ فراہم کنندہ لئی ہلے وی ایہدی حمایت لازمی اے۔ استدلال دے درجے ماڈل تے CLI تے منحصر ہوندے نیں۔ فراہم کنندہ دا پہلے توں طے شدہ واضح none ٹوکن توں وکھرا اے۔

تبدیلیاں صرف بیک اینڈ دی تصدیق توں بعد لاگو کرو۔ فعال واری یا غیر خالی قطار دے دوران تبدیلی تے پابندی اے۔ ڈرافٹس تے نظر آؤن والی تاریخ برقرار رہندی اے، پر فراہم کنندگان نوں بدلنا اوہناں دی نجی اندرونی حالت نوں منتقل نہیں کردا۔

Forge وچ، کردار دا لیبل اہمیت رکھدا اے: تیاری اک وکھرا منصوبہ ساز ورت سکدی اے۔ فوٹر وکھائے گئے کردار نوں بدلدا اے؛ جائزہ لین والے تے مددگار ورک فلو سیٹنگز وچ چُنے جاندے نیں۔ پہلے توں تصدیق شدہ نفاذ لئی پالیسی لاک کیتی جا سکدی اے۔

اجازت نامے فراہم کنندگان دے وچکار مختلف ہوندے نیں۔ صرف پڑھنا تے ورک سپیس لکھنا اوتھے دستیاب نیں جتھے اڈاپٹر اوہناں دی حمایت کردا اے۔ Antigravity مقامی CLI ترتیبات یا واضح طور تے منتخب کردہ مکمل رسائی ورتدا اے۔ مکمل رسائی کوئی سینڈ باکس نہیں اے۔

تخصص پرامپٹ رہنمائی شامل کردا اے، کوئی ہور ماڈل یا اجازت نامہ نہیں۔ پری سیٹس تے کردار کوئی نہیں، معیاری، Auto تے دستی دی حمایت کردے نیں۔ Auto اضافی ماڈل کال توں بغیر مرحلے دے متن توں پروفائلز چُن لیندا اے؛ دستی چار تخصصات تے کسٹم ہدایات تیکر قبول کردا اے۔ منصوبہ ساز دیاں تجویز کردہ تفویضات نوں منصوبے نوں قبول کرن توں پہلاں تبدیل کیتا جا سکدا اے۔

دستی طور تے درج کیتا گیا ماڈل ID یا کوشش تواڈی پسند رہندی اے، پر فراہم کنندہ اوہنوں مسترد کر سکدا اے۔ کسے گلوبل پری سیٹ نوں تبدیل کرنا کسے چلدی ہوئی چیٹ یا قبول شدہ منصوبے نوں پچھلی تاریخ نال تبدیل نہیں کردا۔ کسے بیکار گل بات نوں جان بجھ کے بدلن لئی، اوہدے اپنے کنفیگریشن کنٹرولز ورتو تے تصدیق دی اڈیک کرو۔ کسے غیر فعال آپشن نوں صلاحیت یا لائف سائیکل دی حد سمجھیا جانا چاہیدا اے، نہ کہ محفوظ کردہ JSON نوں تبدیل کر کے نظرانداز کیتا جائے۔

متعلقہ ہدایتاں: [فراہم کنندہ دیاں صلاحیتاں](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## چیٹس، روکو تے قطار

کھلیاں ٹیباں، حالیہ تے ڈرافٹ اکو ٹاسک نال تعلق رکھدے نیں۔ کسے ٹیب نوں بند کرن نال اوہ کھلی فہرست وچوں نکل جاندی اے پر حالیہ وچ برقرار رہندی اے تے ایہدے نال اوہدا فراہم کنندہ پروسیس یا منظم ورک فلو بند نہیں ہوندا۔ تاریخ وچ کھوج کرو، کوئی چیٹ دوبارہ کھولو یا ہسٹری مینو توں ساریاں ودھیک ٹیباں بند کرو۔

روکو موجودہ واری نوں روک دیندا اے۔ اگلی وار بھیجن توں پہلاں رکن دے عمل دے ختم ہون دی اڈیک کرو: رکاوٹ دی تصدیق پروسیس دا مکمل ہونا نہیں اے۔ تسیں اس دوران اگلا ڈرافٹ لکھ سکدے ہو۔

عام چیٹ وچ، قطار بعد دی درخواست نوں موجودہ ڈرافٹ توں الگ محفوظ کردی اے۔ قطار روکو اگلی ترسیل نوں روک دیندی اے۔ روکو تے بند کرو قطار نوں عارضی طور تے روک دیندے نیں۔ دوبارہ شروع کرن توں بعد، پہلاں بحال کرو، فیر واضح طور تے قطار جاری رکھو۔

غیر یقینی دا مطلب اے کہ ترسیل نامعلوم اے۔ اجیہا سنیہا خودکار طریقے نال دوبارہ نہیں بھیجیا جاندا: تاریخ دی جانچ کرو، جے مناسب ہووے تاں متن کاپی کرو تے قطار وچ لگی شے نوں خارج کرو۔ ایہنوں دوبارہ بھیجنا اک نویں سوچ سمجھی درخواست اے۔

منظم مرحلے دیاں چیٹاں اپنے ورک فلو نوں ورتدیاں نیں، عام قطار نوں نہیں۔ مرحلے دے نال چلو موجودہ مرحلہ وکھاندا اے؛ دستی طور تے کوئی دوجی ٹیب چُنن نال نال چلنا رک جاندا اے۔ CLI لاگز جواب توں الگ تشخیصی معلومات وکھاندے نیں۔

مارک ڈاؤن جواب سرخیاں، فہرستان، جدول، لنک تے باڑ والا کوڈ رینڈر کردے نیں۔ ٹول کارڈز تے CLI تشخیصی معلومات جواب توں الگ رہندیاں نیں۔ ماڈل دی دسی گئی سوچ تے ٹوکن میٹرکس صرف ادوں ظاہر ہوندے نیں جدوں فراہم کنندہ اصل وچ اوہناں نوں ظاہر کردا اے؛ اینیمیشن توں نجی استدلال یا ورتوں دا اندازہ نہ لاؤ۔

غیر یقینی بھیجن یا قطار دی تصدیق توں بعد، تاریخ دی جانچ کرو تے صرف اوتھے ای اوہی محفوظ درخواست دوبارہ آزماؤ جتھے پیشکش کیتی گئی ہووے۔ قطار دی رسید دا مطلب اے کہ سٹوریج نے شے قبول کر لئی اے، ایہ نہیں کہ انفارنس مکمل ہو گیا۔ غیر یقینی قطار والی شے نوں صرف اک واضح اخراج دے طور تے ہٹاؤ؛ ایہ پہلے توں پہنچائے گئے پرامپٹ نوں واپس نہیں لے سکدا۔

متعلقہ ہدایتاں: [پائیدار میسج قطار](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## فائلاں، Git تے تکمیل

فائلاں ٹاسک فولڈر وکھاندا اے۔ نتائج دا ضروریات نال موازنہ کرو، دستاویزات کھولو تے فرق دی جانچ کرو۔ بائنری فائل نوں برقرار رکھنا اوہدی متعلقہ ایپلیکیشن وچ درست رینڈرنگ نوں ثابت نہیں کردا۔

Git ریکارڈ شدہ نتائج دے نال حالت، تبدیلیاں تے آپریشن فراہم کردا اے۔ کمٹ، ضم تے پش پہلے توں طے شدہ طور تے دستی نیں؛ خودکار آپریشن مکمل طور تے تصدیق شدہ منصوبے لئی وکھرے انتخاب نیں۔

تصدیق تے اشاعت دے وچکار کم کرن والیاں فائلاں نوں نہ بدلو: منظوری عین بائٹس نال جڑی ہوندی اے۔ تضادات، ناکام پش تے نامعلوم آپریشن دے نتائج اک واضح فیصلے تیکر پیش رفت نوں روکدے نیں۔ Auto خاموشی نال اشاعت دی اجازت نہیں دیندا۔

Work کوئی Git شاخاں نہیں بناندا تے ایہدی کوئی Git تکمیل نہیں ہوندی۔ ورژن تے ذرائع سمیت چُنے ہوئے فولڈر توں مطلوبہ دستاویزات محفوظ رکھو۔

فائل ایڈیٹر ایکسٹینشن دے لحاظ نال نحو، تلاش تے تبدیلی، کالعدم کرن دی تاریخ، لائن ریپنگ تے فی ٹیب ڈرافٹ فراہم کردا اے۔ سیو تعاون یافتہ UTF-8/UTF-16 انکوڈنگ نوں برقرار رکھدا اے تے بیرونی تبدیلی دے تضادات نوں مسترد کردا اے۔ دوجیاں انکوڈنگز تے بائنری مواد لئی بیرونی ایڈیٹر دی لوڑ ہوندی اے۔ غیر محفوظ شدہ ڈرافٹ ایپلیکیشن نوں بند ہون توں روکدے نیں جد تیکر مالک اوہناں نوں محفوظ یا ضائع نہ کر دیوے۔

پورا نحو 8 MiB تیکر فعال اے۔ وڈیاں ٹیکسٹ فائلاں 256 KiB دیاں ونڈوز وچ کھلدیان نیں؛ 8–64 MiB نوں بغیر نحو دے واضح طور تے مکمل لوڈ کیتا جا سکدا اے۔ 64 MiB توں اتے ونڈو ایڈیٹنگ تے محدود اگلیاں ملدیاں جُلدیاں تلاشاں ورتو۔ ایہ اک محدود وڈی فائل موڈ اے، من مانی وڈیاں دستاویزات لئی سب لائم ٹیکسٹ دے برابر نہیں۔

فولڈر کھولو خاموشی نال صرف اصل ریپوزٹری نوں کھولن دے بجائے موجودہ ٹاسک یا برانچ/ورک ٹری دا سیاق و سباق ورتدا اے۔ فائل دی قطار اس فائل دی پیرنٹ ڈائریکٹری نوں ظاہر کر سکدی اے۔ پاتھز دی تصدیق بیک اینڈ راہیں رجسٹرڈ ٹاسک گرانٹس دے خلاف کیتی جاندی اے۔ بائنری فائلاں سادہ متن دے طور تے قابل تدوین نہیں نیں؛ اوہناں دے اصل ناظر ورتو تے اصل بائٹس برقرار رکھو۔

ورک ٹری نوں ہٹانا اک وکھرا محفوظ عمل اے۔ ایہنوں ہٹاؤن توں پہلاں منسلک منظم سیشنز تے ٹرمینلز نوں ختم کرو، بشمول اوہ سیشن جہڑے بیکار پئے نیں۔ محفوظ کیتے گئے Git نتیجے تے بحالی دی حالت دی جانچ کرو؛ ٹاسک ریکارڈ نوں مٹانا غیر کمٹ شدہ کم نوں محفوظ طریقے نال برقرار رکھن دا متبادل نہیں اے۔

متعلقہ ہدایتاں: [ٹائپ شدہ ایڈیٹر دا معاہدہ](../../../shared/editor.ts) · [Git پالیسیاں](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> مکمل رہنمائی اجے تہاڈی انٹرفیس بولی وچ ترجمہ نہیں کیتی گئی۔ انگریزی حوالہ وکھایا جا رہیا اے۔

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

متعلقہ ہدایتاں: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## ترتیبات، بولیاں تے محفوظ ری سیٹ

عام ترتیبات ورک سپیس، انٹرفیس دی بولی تے پہلے توں طے شدہ چیزاں نوں چُندیاں نیں۔ کنیکشنز API اینڈپوائنٹس دا انتظام کردا اے۔ پری سیٹس تے جائزہ ٹیماں کرداراں دیاں کنفیگریشنز نوں محفوظ رکھدیاں نیں۔ ریموٹ کنٹرول مقامی اسناد، سرور دے دائرہ کار تے مالک دے اجازت نامیاں دا انتظام کردا اے؛ اپ ڈیٹس ریلیز سورس/چینل دا انتظام کردا اے۔ بارے وچ چلدی بلڈ دی درست شناخت وکھاندا اے۔

انٹرفیس دی بولی پرامپٹ دی بولی تے دستاویزات دے جائزے دی حیثیت توں وکھ ہے۔ پروڈکٹ دے ناں، کمانڈ IDs، فائل ایکسٹینشنز، فراہم کنندہ ماڈل IDs تے صارف دے بنائے ہوئے ناں شناختی علامت دے طور تے رہندے ہن۔ جدوں موجودہ ترجمہ دستیاب ہووے تاں مدد منتخب کردہ انٹرفیس بولی دی پیروی کردی ہے؛ مشینی ترجماں تے لیبل لایا جاندا ہے تے انگریزی اصل حوالہ رہندی ہے۔

Save وکھائی گئی تشکیل نوں لاگو کردا ہے۔ ڈیٹا بیس ری سیٹ یا فیکٹری ری سیٹ ایپلی کیشن دا میٹا ڈیٹا ہٹا سکدا ہے؛ ری سیٹ نوں جان بجھ کے ورتن توں پہلاں فائلاں تے اک ازمایا ہویا بیک اپ محفوظ کرو۔ ایہ کارروائیاں مقامی مالک دے اعمال ہن۔ ناکام ورک فلو یا خراب ریکارڈ دی تفتیش لئی ایہناں نوں شارٹ کٹ دے طور تے مت ورتو۔

متعلقہ ہدایتاں: [لوکلائزیشن دیاں ہدایتاں](../../LOCALIZATION.md) · [ڈیٹا دی بحالی](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## مدد معاون کولوں پچھو

مدد کھولو، اس دے معاون پینل وچ اک محفوظ شدہ منسلک پیش سیٹ چنو تے ZIAForge بارے پچھو۔ جواب موجودہ معیاری انگریزی گائیڈ تے تہاڈی منتخب کردہ انٹرفیس بولی ورتدے ہن۔ سیکشن-ریفرنس بٹن متعلقہ گائیڈ دے موضوعات کھولدے ہن، تاں جے تسیں وضاحت دا موازنہ اصل حوالے نال کر سکو۔

ایہ معاون 100 محفوظ اندراجات تے 3 MiB تک دی اک وکھری نجی گفتگو رکھدا ہے۔ 12,000 حروف تک دا سوال درج کرو؛ Send اس نوں پچھدا ہے، Stop تہاڈے سوال نوں دستیاب رکھدے ہوئے فعال جواب نوں منسوخ کردا ہے، تے Clear اس مدد گفتگو نوں ہٹا دیندا ہے۔ تہاڈا ان بھیجیا مسودہ تے پیش سیٹ دا انتخاب اسے ایپ سیشن وچ مدد بند کرن یا دوبارہ کھولن دے بعد وی قائم رہندے ہن، لیکن مسودہ ڈسک تے محفوظ نہیں ہوندا۔ معاون ایپلی کیشن کمانڈاں نہیں بھیجدا، ورک فلو نوں تبدیل نہیں کردا یا کسے گیٹ نوں منظور نہیں کردا۔ مشورہ کسے ٹاسک، اکاؤنٹ یا بیرونی کنکشن دی لائیو تصدیق نہیں ہے۔

Claude Code تے API مدد سیشنز تعاون یافتہ نو-ٹولز پالیسی لاگو کردے ہن۔ مقامی Codex تے Antigravity مدد سیشنز لئی مقامی مالک دی موجودہ مقامی کمپیوٹر اجازت درکار ہوندی ہے۔ جے ایہ غیر فعال ہووے، تاں ایپ کوئی وکھرا فراہم کنندہ چنن دی بجائے اس شرط دی وضاحت کردی ہے۔ صرف مالک ہی مقامی کنٹرول سیٹنگز وچ اس نوں فعال کر سکدا ہے؛ معاون خود اس نوں فعال نہیں کر سکدا۔

Codex مدد صرف-پڑھن لئی سینڈ باکس ورتدا ہے تے ٹول-منظوری دیاں درخواستاں رد کر دیندا ہے۔ Antigravity پلان موڈ تے اپنا مقامی سینڈ باکس فلیگ ورتدا ہے۔ ایہ مقامی موڈز آپریٹنگ سسٹم دی قید دی کوئی مکمل ضمانت نہیں ہن۔ سورس-گائیڈ ہیش اس حوالے دی پچھان کردا ہے جو جواب واسطے ورتیا گیا سی؛ پیدا کیتی گئی وضاحت فیر وی غلط ہو سکدی ہے، اس لئی عمل کرن توں پہلاں اس دے منسلک حصے ضرور ویکھو۔ پرانے جواباں تے نشان لایا جاندا ہے جدوں اوہناں دا سورس-گائیڈ ورژن موجودہ گائیڈ توں وکھرا ہووے۔

متعلقہ ہدایتاں: [معیاری رہنمائی تے ترجمے دی دیکھ بھال](../../HELP_MAINTENANCE.md) · [ایپلی کیشن معاون تے اجازت نامے](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## معاون تے Telegram

معاون منتخب شدہ پیش سیٹ تے اوہی ایپلی کیشن کنٹرول API ورتدا اے۔ حالت جانچن دی اجازت تے کارروائیاں کرن دی اجازت وکھو وکھ ہن۔ کماں تے نتائج دی جانچ کرو: معاون دا بیان اس گل دا ثبوت نہیں ہے کہ کوئی کارروائی مکمل ہو گئی ہے۔

Telegram نوں صرف مقامی مالک ہی چالو کر سکدا ہے، اک موجودہ بوٹ ٹوکن تے اک عددی مالک ID دے نال۔ کنٹرول اس مالک دی نجی گل بات واسطے ہے۔ غیر تشکیل شدہ یا غیر فعال بوٹ نوں ایپلی کیشن دے سنہاں موصول نہیں ہونے چاہیدے۔

عام گل بات وچ بوٹ ٹوکن پیسٹ مت کرو۔ انٹیگریشن دی تشکیل کرنا Telegram کنیکٹیوٹی نوں ثابت نہیں کردا تے نہ ہی خودکار طور تے کوئی بوٹ بناندا ہے۔ سکرین شاٹس تے جوابی پیغامات وچ نجی ورک سپیس ڈیٹا شامل ہو سکدا ہے۔

معاون دا اک پیش سیٹ چنو تے جانچ توں وکھرے طور تے ایپلی کیشن آپریشن دی اجازت دیو۔ Codex تے Antigravity معاون نوں چلان لئی مالک دی مقامی اجازت دی لوڑ ہوندی ہے؛ اوہ چپ چاپ ٹول-مکت API یا Claude سیشن نال تبدیل نہیں ہوندے۔ معاون دی گل بات وچ سکرین شاٹس دکھائے جا سکدے ہن، لیکن موجودہ ماڈل ان پٹ وچ تصویر دا تجزیہ شامل نہیں ہے۔ ایہ مت سمجھو کہ معاون نے محض تصویر دکھان دی وجہ توں اس دی بصری جانچ کر لئی ہے۔

معاون ٹائپ شدہ ٹولز راہیں خلاصیاں، ٹاسکاں، چیٹس، ورک فلو دی حالت، پروسیس سیاق و سباق تے ایپلی کیشن دیاں ونڈوز دی جانچ کر سکدا ہے۔ ایہ اجازت شدہ عام سیٹنگاں بدل سکدا ہے تے مجاز ایپلی کیشن کارروائیاں شروع کر سکدا ہے۔ ایہ محض آسانی دی خاطر مقامی حقوق نہیں دے سکدا، محفوظ کردہ اسناد ظاہر نہیں کر سکدا، روٹ ورک سپیس دی اجازت نوں دور دراز توں بدل نہیں سکدا، یا Forge گیٹ نوں منظور نہیں کر سکدا۔

متعلقہ ہدایتاں: [ایپلی کیشن کنٹرول معاہدہ](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## اپنا نجی Telegram بوٹ چلاؤ

اپنا خود دا بوٹ بناؤ یا حاصل کرو، اس دی نجی چیٹ شروع کرو، تے لوکل کنٹرول سیٹنگز وچ اس دا ٹوکن تے اپنی عددی Telegram صارف ID درج کرو۔ انٹیگریشن صرف ادوں فعال کرو جدوں تسیں ایپ نوں منسلک کرنا چاہندے ہووو۔ مالک دی ID صارف دی شناخت ہے، کوئی یوزر نیم یا بوٹ ID نہیں۔ صرف اسی نجی چیٹ وچ اس صارف ولوں بھیجے گئے سنہے قبول کیتے جاندے ہن۔

چلن والے ورژن، پروجیکٹ/ٹاسک گنتیاں تے ٹاسک سٹیٹس دے خلاصے لئی /start، /menu یا /status ورتو۔ بٹن پروجیکٹس، ٹاسکس، سکرین شاٹ، ہیلپ تے لینگویج کھولدے ہن۔ فہرستاں فی صفحہ اٹھ آئٹمز وکھاندیاں ہن، پچھانہ، ریفریش، ہوم تے پچھلا/اگلا نیویگیشن دے نال۔ پروجیکٹ بٹن ٹاسک لسٹ نوں فلٹر کردے ہن۔ اک ٹاسک کارڈ اپنی محفوظ کردہ ورک فلو پیشرفت، ماڈل/پیش سیٹ تے موجود ہون تے زیر التوا سوالات وکھاندا ہے۔

کھلیاں/حالیہ بات چیت تے ورک فلو فیز چیٹس دا پیش منظر ویکھن لئی ٹاسک دے Chats کھولو۔ ہر پیش منظر چھ تازہ ترین صارف/معاون سنہے وکھاندا ہے، جو واضح طور تے ہر اک 200 حروف تک گھٹائے ہوندے ہن۔ نجی استدلال نہیں وکھایا جاندا۔ تاریخ پڑھن نال کوئی فراہم کنندہ شروع نہیں ہوندا۔ پیش منظر صرف پڑھن لئی ہن: عام لکھت تے /ask TEXT فیر وی ایپلی کیشن معاون نوں مخاطب کردے ہن، کدی وی غیر واضح طور تے اس ٹاسک چیٹ نوں نہیں جو تسیں ویکھ رہے ہو۔

Run / Continue موجودہ Code یا Work ورک فلو نوں دوبارہ پڑھدا ہے تے اہل محفوظ ورک فلو نوں شروع کردا ہے۔ Pause اس نوں روکن دی درخواست کردا ہے۔ دوواں وچوں کوئی وی ضرورتاں، اک تصریح، اک منصوبہ، جائزہ نتائج یا سوالات قبول نہیں کردا؛ اک زیر التوا فیصلہ Run نوں روکدا ہے۔ ایپلی کیشن وچ فیصلے کرو، یا اس دے اصل موجودہ گیٹ تے نظر ثانی دے نال واضح طور تے مجاز ٹائپ شدہ کمانڈ ورتو۔

کسے وی 56 انٹرفیس بولی نوں اس دے مقامی ناں نال چنن لئی Language یا /language ورتو۔ ایہ ترجیح صرف اس بوٹ تے مالک واسطے محفوظ رہندی ہے۔ Use app language اس ترجیح نوں مٹا دیندا ہے۔ ایہ نہ تاں ایپلی کیشن دی بولی بدلدا ہے تے نہ ہی رسائی دیاں اجازتاں؛ موجودہ سنہے خودکار طریقے نال دوبارہ نہیں بھیجے جاندے۔

نیویگیشن عام طور تے ایسے شائع شدہ مینو سنہے نوں اپ ڈیٹ کردی ہے۔ بٹناں دیاں غیر شفاف شناختیں ہوندیاں ہن جو 15 منٹاں بعد ختم ہو جاندیاں ہن تے اک وار ورتیاں جا سکدیاں ہن؛ کارڈ بدلن نال اس دے پرانے بٹن باطل ہو جاندے ہن۔ ختم شدہ، ورتے ہوئے، بے میل-سنہے تے پچھلے پروسیس دے بٹن کوئی کارروائی نہیں کر سکدے۔ قطعی طور تے ناقابل ترمیم سنہے نوں نویں کارڈ نال بدلیا جا سکدا ہے؛ اک نامعلوم نیٹ ورک غلطی نوں نویں سنہے دے طور تے دوبارہ کوشش نہیں کیتا جاندا۔

ایکٹیویشن تے پولر پچھلا بیک لاگ خارج کر دیندا ہے تے بھیجن توں پہلاں اپ ڈیٹ دی منظوری ریکارڈ کر لیندا ہے تاں جو رکے ہوئے کمانڈز دوبارہ شروع ہون تے خود بخود دوبارہ نہ چلن۔ ایہ دوبارہ چلان توں روکدا ہے؛ ایہ مکمل ہون دی ضمانت نہیں دیندا۔ غلطی دے بعد جان بجھ کے نواں کم جاری کرن توں پہلاں حالت/سیاق و سباق دی جانچ کرو۔ کوئی خودکار ٹاسک-سٹیٹس اطلاعات نہیں ہن۔

واضح کمانڈاں دستیاب رہندیاں ہن: /projects، /tasks، /task TASK_ID، /run TASK_ID، /pause TASK_ID، /screenshot تے /ask TEXT۔ /new {JSON} ٹائپ شدہ createTask دے راہیں اک ٹاسک بناندا ہے؛ /command {JSON} اک واضح کیٹلاگ کمانڈ بھیجدا ہے۔ آرگومنٹ دیاں شکلاں لئی لائیو کیٹلاگ پڑھو۔ اوہی بیک اینڈ اجازت تے فولڈر گرانٹس لاگو ہوندے ہن جو ایپلی کیشن وچ ہن۔

ایپ کدی وی محفوظ شدہ بوٹ-ٹوکن قدر معاون نوں نہیں بھیجدی۔ سکرین شاٹس، خلاصیاں تے گفتگو دی لکھت وچ فیر وی نجی پروجیکٹ معلومات شامل ہو سکدی ہے۔ جے بوٹ یا مالک دے اکاؤنٹ تے ہور بھروسہ نہ رہے تاں لوکل طور تے انٹیگریشن روک دیو۔ بوٹ فراہم کنندہ دے نال لیک شدہ ٹوکن نوں روٹیٹ کرو، فیر اس دی مقامی خفیہ کردہ ترتیب نوں اپ ڈیٹ کرو۔

متعلقہ ہدایتاں: [نجی بوٹ تے کمانڈاں](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## صرف مالک دی مقامی کمپیوٹر اجازت

مقامی کمپیوٹر رسائی ابتدا وچ غیر فعال ہوندی ہے۔ صرف مالک ہی مقامی Settings → Remote control وچ اس نوں فعال کر سکدا ہے۔ معاون تے HTTP/MCP/Telegram کمانڈاں اپنے لئی اس فلیگ نوں فعال نہیں کر سکدیاں۔ جے کوئی کارروائی رد ہو جاوے، تاں معاون نوں سیٹنگ بیان کرنی چاہیدی ہے تے فیصلہ مالک تے چھڈنا چاہیدا ہے۔

جدوں واضح طور تے فعال کیتا جاوے، computer.run اک ایگزیکیوٹیبل، آرگومنٹ لسٹ تے اختیاری قطعی ورکنگ ڈائرکٹری قبول کردا ہے۔ ایہ کوئی شیل انٹرپولیشن نہیں ورتدا، اس دی حد 30 سیکنڈ ہے تے آؤٹ پٹ 1 MiB تک محدود ہے۔ فراہم کیتی گئی گمشدہ یا غلط ڈائرکٹری رد کر دتی جاندی ہے؛ cwd نوں چھڈن تے ایپ دی ملکیتی سیٹنگز ڈائرکٹری ورتی جاندی ہے، نہ کہ HOME۔ Quit فعال ملکیتی کمانڈاں منسوخ کردا ہے تے اوہناں دے پروسیس دی صفائی دا انتظار کردا ہے۔

ایپلی کیشن پڑھن/آپریٹ کرن دی وسعت تے مقامی رسائی وکھو وکھ فیصلے ہن۔ ورک ٹری کسے غیر پابند فراہم کنندہ دی فائل سسٹم رسائی نوں محدود نہیں کردا۔ ٹاسک دے بعد مقامی رسائی منسوخ کر دیو جے اس دی ہور لوڑ نہ ہووے، تے معاون دے بیان نوں ثبوت منن دی بجائے کمانڈ دیاں رسیداں دی جانچ کرو۔

متعلقہ ہدایتاں: [صرف-مالک کنٹرول معاہدہ](../../../shared/control.ts).

<a id="remote"></a>

## براؤزر تے ریموٹ انسٹانسز

مقامی مالک سرور نوں فعال کردا ہے تے اس دا پتہ، پورٹ تے دائرہ اختیار چندا ہے: جانچ واسطے read یا کارروائیاں واسطے operate۔ ڈیفالٹ 127.0.0.1 پتہ صرف اس کمپیوٹر تے دستیاب ہے۔ 0.0.0.0 نیٹ ورک انٹرفیسز تے سندا ہے؛ فعال کرن توں پہلاں نیٹ ورک رسائی دی جانچ کرو۔

ٹوکن لاگ ان دے بعد اک براؤزر اوہی انٹرفیس کھولدا ہے۔ عوامی لنکس یا سکرین شاٹس وچ ٹوکن شامل مت کرو۔ صرف HTTP ٹریفک نوں خفیہ (encrypt) نہیں کردا؛ غیر معتبر نیٹ ورک تے اک محفوظ چینل ورتو۔

مالک URL تے ٹوکن دے ذریعے دوجے انسٹانسز تشکیل دیندا ہے۔ بیک اینڈ درخواستاں نوں پراکسی کردا ہے؛ ایہ اوہناں دے پروجیکٹس نوں مقامی مشین تے کاپی نہیں کردا۔ ہر کارروائی توں پہلاں منتخب کردہ انسٹانس دی جانچ کرو۔

ٹائپ شدہ کمانڈاں تے ایونٹس ایپلی کیشن کنٹرول لے جاندے ہن۔ Read سکوپ ٹاسک دیاں تبدیلیاں دی اجازت نہیں دیندا۔ مقامی کمپیوٹر کنٹرول اک وکھری مقامی مالک دی پسند ہے تے غیر فعال شروع ہوندا ہے۔

براؤزر، Telegram تے بیرونی ایجنٹ کنٹرول واسطے ایپ دا چلدا رہنا ضروری ہے۔ ہر انسٹانس دی اپنی نجی پروفائل، ٹاسک سٹیٹ، ٹوکن تے سرور پورٹ ہوندی ہے۔ آزاد انسٹانسز دے وچکار اک ہی پروفائل نوں اکٹھے دوبارہ مت ورتو۔ براؤزر ایونٹس تے کمانڈ جوابات منتخب کردہ انسٹانس تک محدود ہوندے ہن؛ UI بدلن نال فائلاں منتقل نہیں ہوندیاں تے نہ ہی لوکل لاگ ان کاپی ہوندا ہے۔

متعلقہ ہدایتاں: [HTTP تے انسٹانس کنٹرول](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw، Hermes تے دوجے بیرونی ایجنٹس

تصدیق شدہ ایپلی کیشن کنٹرول API یا بنڈل شدہ MCP stdio برج ورتو۔ سرور نوں مقامی طور تے فعال کرو، read یا operate چنو تے ہر کلائنٹ نوں اس انسٹانس دے URL تے ٹوکن نال تشکیل دیو۔ اسٹینڈ اکیلے MCP برج نوں چلان لئی Node.js 22 یا نواں لوڑیندا ہے؛ Electron ایپ تہاڈا ایجنٹ کلائنٹ انسٹال نہیں کردی۔ براؤزر URL کوئی سٹریم ایبل HTTP MCP اینڈ پوائنٹ نہیں ہے: اس نوں stdio برج لئی بطور ZIAFORGE_URL فراہم کرو۔

برج ziaforge_status، ziaforge_commands، ziaforge_command تے ziaforge_screenshot مہیا کردا ہے۔ سٹیٹس تے لائیو کمانڈ کیٹلاگ توں شروعات کرو، فیر منتخب ٹاسک واسطے system.context پڑھو۔ ٹائپ شدہ کمانڈاں اوہی نظر ثانی، گیٹ، ٹاسک فولڈر تے صفائی دیاں جانچاں فالو کردیاں ہن جو مقامی UI وچ ہوندیاں ہن۔

لائیو کمانڈ کیٹلاگ وچ documentation.guide، یعنی معیاری انگریزی گائیڈ، اس دے سورس پاتھ تے sourceSha256 دے نال شامل ہے۔ اندرونی ایپلی کیشن معمار اپنے ٹولز راہیں ایہی حوالہ موصول کردا ہے۔ ایہ ایجنٹاں نوں پرانے نوٹاں تے تکیہ کیتے بغیر مکمل پروڈکٹ سیاق و سباق دیندا ہے؛ دستاویزات کدی وی رسائی نہیں بخشدی تے نہ ہی موجودہ انسانی فیصلے دا متبادل بن سکدی ہے۔

ایجنٹاں نوں کسے مختصر انسانی خیال توں ضرورتاں، تکنیکی فیصلیاں تے منصوبہ بندی بارے گل بات کرنی چاہیدی ہے۔ اوہناں لئی لازمی ہے کہ اوہ واضح انسانی گیٹس، منتخب ماڈلز، مینوئل/Auto پالیسی تے مطلوبہ نظر ثانی نوں برقرار رکھن۔ اوہناں نوں از خود منظوری نہیں گھڑنی چاہیدی، نویں ID دے تحت غیر یقینی کمانڈاں دوبارہ نہیں چلانیاں چاہیدیاں، یا مالک دی مرضی توں بغیر Git تبدیلیاں شائع نہیں کرنیاں چاہیدیاں۔

کئی انسٹالیشناں لئی کئی نامزد MCP سرورز تشکیل دیو۔ انسٹانس بدلنا روٹنگ دا فیصلہ ہے، ہم آہنگی (synchronization) نہیں۔ OpenClaw تے Hermes دی تشکیل دیاں مثالاں AGENT_CONTROL.md وچ ہن؛ کلائنٹ دے مخصوص سیٹ اپ تے مطابقت دی جانچ انسٹال شدہ کلائنٹ ورژن لئی لازمی کرنی چاہیدی ہے۔

بیرونی requestId کیشے صرف اس ویلے تک درخواستاں دی نقل ختم کردا ہے جدوں تک ایپ چل رہی ہوندی ہے۔ پائیدار کارروائیاں اپنیاں پچھاناں ورتدیاں ہن: ٹاسک بناؤن لئی createRequestId، ورک فلو فیصلیاں لئی commandId، سنہاں لئی clientMessageId تے operationId Git تبدیلیاں لئی۔ کسے نامعلوم اعتراف دے بعد اصل پچھان تے پیلوڈ نوں برقرار رکھو؛ جان بجھ کے نواں کم جاری کرن توں پہلاں محفوظ حالت پڑھو۔

متعلقہ ہدایتاں: [MCP کلائنٹ ہدایتاں](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## مقامی CLI تے آٹومیشن دیاں حداں

ziaf ڈسپیچر اوہی چلدی ایپ تے محفوظ ورک فلو نوں کنٹرول کردا ہے۔ سورس کوڈ توں، npm run ziaf -- list، npm run ziaf -- status --task TASK_ID --json، npm run ziaf -- start --task TASK_ID، یا npm run ziaf -- pause --task TASK_ID ورتو۔ Start دا اک کامیاب اقرار ایہ مطلب نہیں رکھدا کہ ٹاسک مکمل ہو گیا ہے۔

--until-success محفوظ ورک فلو لئی جان بجھ کے Auto چالو کردا ہے، لیکن سوالات، نظر ثانی، منظوری دے گیٹس، حداں تے چیک پوائنٹس فیر وی لاگو ہوندے ہن۔ Ctrl+C نگرانی کرن والے ڈسپیچر توں باہر نکلدا ہے؛ ایہ اندرونی طور تے ایپلی کیشن ورک فلو نوں بند نہیں کردا۔ باہر نکلن دے کوڈز، لوکل اینڈ پوائنٹ تے پروفائل سنبھالن واسطے CLI.md ویکھو۔

Automations انٹرفیس فی الحال ڈسپلے تعریفاں تے مقامی رن کاؤنٹرز ذخیرہ کردا ہے۔ ایہ کوئی تصدیق شدہ بار بار چلان والا شیڈولر نہیں ہے تے ایہ ثابت نہیں کردا کہ بیک گراؤنڈ ماڈل دی واری چلی سی۔ اصل عمل درآمد واسطے محفوظ ورک فلو کنٹرولز، ziaf یا تصدیق شدہ API ورتو تے اوہناں دیاں رسیداں دی جانچ کرو۔ مظاہرے والے پینل نوں خودکار شیڈولنگ سمجھن دی غلطی مت کرو۔

متعلقہ ہدایتاں: [ڈسپیچر کمانڈاں](../../CLI.md).

<a id="updates"></a>

## ورژن تے اپ ڈیٹس

About چلن والا اصل ورژن وکھاندا ہے۔ عوامی اپ ڈیٹس لئی اک قابل اعتماد GitHub ریلیز ریپوزٹری تے مستحکم یا پیش نظارہ چینل درکار ہے۔ جانچن، ڈاؤن لوڈ کرن تے انسٹال کرن دیاں وکھو وکھ حالتاں ہوندیاں ہن؛ اک خرابی دا ایہ مطلب نہیں کہ اپ ڈیٹ انسٹال ہو گئی ہے۔

خودکار تنصیب دستخط شدہ macOS ریلیز لئی ہے۔ غیر دستخط شدہ ڈیولپمنٹ بلڈز اس طریقہ کار راہیں خود بخود انسٹال نہیں ہوندے۔ دستی متبادل واسطے، موجودہ ایپ نوں مکمل طور تے بند کرو تے اک تصدیق شدہ آرٹفیکٹ ورتو۔

فعال ہون تے خودکار جانچ فورا چلدی ہے، فیر ہر چھ گھنٹے بعد۔

مستحکم پیش نظارہ ریلیز نوں خارج کردا ہے؛ پیش نظارہ ڈیولپمنٹ ریلیز دی وی اجازت دیندا ہے۔ اک کامیاب جانچ صرف دستیاب ریلیز میٹا ڈیٹا قائم کردی ہے۔ ڈاؤن لوڈ تے انسٹالیشن واسطے پلیٹ فارم پیکیج تے تشکیل شدہ ریلیز فیڈ دی لوڑ ہوندی ہے۔ Linux DEB ترسیل اک وکھرا انسٹالر رستہ ہے؛ ایہ مت سمجھو کہ اک DEB macOS اپ ڈیٹ دے طریقہ کار راہیں خود بخود اپ گریڈ ہو جاندا ہے۔

متعلقہ ہدایتاں: [ریلیز دی تیاری](../../RELEASE_READINESS.md).

<a id="restart"></a>

## دوبارہ شروع کرنا تے بحالی

macOS تے، مکمل بند کرن واسطے Quit / ⌘Q ورتو۔ ونڈو بند کرن نال ایپ چلدی رہ سکدی ہے۔ ایپلی کیشن نوں بدلن توں پہلاں پرانے ورژن نوں مکمل طور تے بند کرو۔

شروع کرن توں بعد، اوہی ٹاسک چنو۔ ہسٹری تے ڈرافٹس واپس آ جاندے ہن۔ Resume اک لوکل/مقامی سیاق و سباق نوں بحال کردا ہے پر مسودہ نہیں بھیجدا، قطار توں توقف نہیں ہٹاندا، یا کسے نامعلوم کارروائی نوں دہران دا اختیار نہیں دیندا۔

جے Recovery ظاہر ہووے، تاں ہتھ نال JSON ایڈٹ مت کرو۔ متاثرہ دستاویز دی قسم دی جانچ کرو، اصل فائلاں نوں محفوظ رکھو تے اک تصدیق شدہ بیک اپ چنو۔ پرانی قطار نوں بحال کرنا اس دیاں آئٹمز نوں غیر یقینی قرار دیندا ہے۔

جدوں ترسیل نامعلوم ہووے، تاں اک منظم ورک فلو نوں نویں سیاق و سباق واسطے واضح اجازت دی لوڑ ہو سکدی ہے۔ پہلا کم تے ناکام کوششاں باقی رہندیاں ہن؛ گھڑی ہوئی کامیابی نالوں اک واضح انکار زیادہ محفوظ ہے۔

تمام ایپ انسٹانسز بند کرکے ٹاسک فائلاں تے ایپ پروفائل دا بیک اپ لوو۔ کاپی کیتا گیا فولڈر کوئی ازمائی ہوئی بحالی نہیں ہوندا۔ جے بحالی تہاڈے کولوں تصدیق شدہ بیک اپ چنن دا کہندی ہے، تاں اصل خراب فائلاں نوں وی محفوظ رکھو۔ پرانے ورک فلو یا قطار نوں بحال کرنا غیر یقینی استدلال یا Git کارروائیاں نوں دہران دا اختیار نہیں دیندا۔

متعلقہ ہدایتاں: [بحالی دا معاہدہ](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## مسائل دا حل

CLI نہیں لبھیا: اک عام ٹرمینل وچ اس دی تنصیب تے ورژن دی جانچ کرو، فیر ZIAForge نوں دوبارہ شروع کرو۔ اک ایگزیکیوٹیبل دی موجودگی دا ایہ مطلب نہیں ہے کہ تسیں سائن ان ہو۔ فراہم کنندہ دا اپنا سائن ان طریقہ کار ورتو۔

ماڈل دستیاب نہیں یا اجازت ناکام ہو گئی: دریافت نوں تازہ کرو، دستیاب ID چنو تے اپنے اکاؤنٹ تے حداں دی جانچ کرو۔ غیر یقینی درخواست دی ہسٹری جانچے بغیر اس نوں مت دہراؤ۔

ورک فلو رک گیا: موجودہ مرحلہ، سوال، تصدیقی رسید یا CLI لاگز کھولو۔ مخصوص وجہ نوں حل کرو: اک غیر جوابی سوال، کمانڈ، فولڈر اجازت یا کوشش دی حد۔ Continue اک ناکام جانچ نوں کامیابی وچ نہیں بدل سکدا۔

فولڈر گم ہے یا تبدیل ہو گیا ہے: اصل فولڈر تک رسائی بحال کرو یا نواں ٹاسک بناؤ۔ ایپ نوں HOME توں جاری نہیں رہنا چاہیدا۔ جے تسیں کوئی ہور cwd ویکھدے ہو، تاں واری روکو تے تشخیصی ڈیٹا محفوظ کرو۔

رپورٹ واسطے، About ورژن، روٹ، CLI/ماڈل، متوقع تے اصل رویہ، اک سکرین شاٹ تے اک محفوظ لاگ اقتباس شامل کرو۔ اوہ راز، ذاتی مواد تے راستے ہٹا دیو جو شائع نہیں کیتے جا سکدے۔

ریموٹ صفحہ دستیاب نہیں: تصدیق کرو کہ مالک نے سرور نوں فعال کیتا ہے، سننے والے پتے تے پورٹ دی جانچ کرو، فیر درست انسٹانس ٹوکن نال تصدیق کرو۔ اک 401 تصدیق ول اشارہ کردا ہے؛ اک مسترد شدہ تبدیلی read سکوپ یا صرف-مالک کنٹرول دی وجہ توں ہو سکدی ہے۔ ٹوکن بدلن نال موجودہ براؤزر کلائنٹس بند ہو جاندے ہن۔ وکھرے DevTools معائنہ پورٹ نوں ریموٹ ایپلی کیشن کنٹرول دے طور تے ظاہر مت کرو۔

ایڈیٹر سیو مسترد ہو گیا: مسودہ اپنے کول رکھو، ڈسک تے موجودہ فائل دی جانچ کرو تے بیرونی تبدیلی دے تنازعے نوں حل کرو۔ ایپلی کیشن میٹا ڈیٹا نوں دوبارہ لکھ کے موازنہ نظر انداز مت کرو۔ جے وڈی فائل دی مکمل لوڈنگ دستیاب نہیں ہے، تاں تعاون یافتہ ونڈو ایڈیٹنگ/سرچ یا کوئی بیرونی ایڈیٹر ورتو۔

Telegram دستیاب نہیں: بوٹ ٹوکن، عددی مالک، نجی چیٹ تے سٹیٹس دی مقامی طور تے تصدیق کرو۔ اک مسابقتی ویب ہک یا پولر پولنگ نوں روک سکدا ہے؛ ZIAForge خود بخود ویب ہک نوں حذف نہیں کردا یا کسے دوجے پولر نوں سنبھالدا نہیں۔ نامعلوم حد تے مسترد یا روکے گئے کمانڈز خودکار طریقے نال دوبارہ نہیں چلائے جاندے۔

متعلقہ ہدایتاں: [ٹیسٹنگ تے تشخیص](../../TESTING.md).

<a id="diagnostics"></a>

## مسئلیاں دی اطلاع دیو تے ثبوتاں دی جانچ کرو

About توں چلن والا اصل بلڈ، OS/فن تعمیر، ٹاسک موڈ، منتخب شدہ فراہم کنندہ/ماڈل تے اوہ مراحل ریکارڈ کرو جنہاں نال مسئلہ دوبارہ پیش آندا ہے۔ متوقع نتیجہ تے مشاہدہ کیتا گیا نتیجہ بیان کرو۔ پوری نجی پروفائل بھیجن دی بجائے اک محفوظ سکرین شاٹ تے متعلقہ محفوظ شدہ کمانڈ یا تصدیقی رسید شامل کرو۔

CLI لاگز، ایونٹ جرنلز، ماڈل ٹرانسکرپٹس، براؤزر ٹریسز تے سکرین شاٹس وچ سورس کوڈ، ذاتی راستے یا ٹوکن ظاہر ہو سکدے ہن۔ سانجھا کرن توں پہلاں جانچ کرو تے حساس معلومات ہٹاؤ۔ اک بہترین کوشش والا لاگ ریڈیکٹر اس گل دی تصدیق نہیں کردا کہ سکرین شاٹ یا آرکائیو شائع کرن دے قابل ہے۔

حصہ داراں واسطے، qa:doctor ماحول/بلڈ شناخت نوں پڑھدا ہے؛ qa:inspect فراہم کنندہ دے سStub دے نال اک وکھری پروفائل کھولدا ہے۔ اک فکسچر ماڈل نال رابطہ کیتے بغیر ٹیسٹ شدہ ایپلی کیشن رستے نوں ثابت کردا ہے۔ لائیو نتیجہ کڈھنا، Telegram کنیکٹیوٹی، مقامی Linux ڈیسک ٹاپ، دستخط تے پیکجڈ آرٹفیکٹ دیاں جانچاں وکھرے ثبوت ہن۔ دوبارہ پیش کرن یوگ کمانڈاں تے صفائی واسطے TESTING.md ویکھو۔

متعلقہ ہدایتاں: [ثبوت کمانڈاں](../../TESTING.md).

<a id="privacy"></a>

## مقامی ڈیٹا تے حداں

پروجیکٹس، ہسٹری، منصوبے، دستاویزات تے تشخیصات وچ نجی لکھت ہو سکدی ہے۔ پروفائلز، خام کیپچرز، چابیاں یا سورس کوڈ دے نال مکمل لاگز شائع مت کرو۔

Linux تے، API، کنٹرول، Telegram تے انسٹانس اسناد نوں محفوظ کرن لئی اک انلاک شدہ GNOME Secret Service یا KWallet دی لوڑ ہوندی ہے؛ کسے تعاون یافتہ سیکریٹ سٹور توں بغیر، ZIAForge Electron دے basic_text متبادل نوں ورتن دی بجائے ایہناں بھیداں نوں محفوظ کرن توں انکار کر دیندا ہے۔

مقامی سٹوریج دا ایہ مطلب نہیں کہ درخواستاں تہاڈے کمپیوٹر تے ہی رہندیاں ہن: منتخب شدہ CLI/API اوہناں نوں اپنے فراہم کنندہ ول بھیجدا ہے۔ کم کرن والا فولڈر تے پروسیس دی نگرانی کوئی OS تنہائی نہیں ہن۔ منتخب کردہ اجازتاں دی جانچ کرو۔

ثبوتاں دیاں قسماں وچ فرق کرو: فکسچرز ماڈل توں بغیر ایپلی کیشن دی جانچ کردے ہن؛ لوکل لائیو اک اصلی CLI/اکاؤنٹ نوں آزماندا ہے؛ پیکجڈ جانچاں اک خاص آرٹفیکٹ دی تصدیق کردیاں ہن۔ اک وچ پاس ہونا دوجیاں دی ضمانت نہیں دیندا۔

ایپلی کیشن سکوپ، ورک ٹری تے صرف-پڑھن والا پرامپٹ آپریٹنگ سسٹم دے نفاذ توں وکھرے ہن۔ Antigravity جائزہ کار/معاون پالیسیاں فائل سسٹم دی صرف-پڑھن رسائی لاگو کرن دی بجائے اکٹھے کیتے ورک سپیس ثبوتاں وچ تبدیلیاں لبھدیاں ہن۔ مقامی کمپیوٹر کنٹرول عام ایپ-ٹول حد توں باہر مالک دے مجاز پروگراماں نوں چلاندا ہے؛ جدوں ہور لوڑ نہ ہووے تاں اس نوں بند کر دیو۔

متعلقہ ہدایتاں: [ماخذ تے اشاعت](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## اس اوپن سورس پروجیکٹ نوں سمجھو تے بدلو

پہلاں AGENTS.md تے CONTRIBUTING.md پڑھو، فیر موجودہ سورس دیاں حداں واسطے PROJECT_MAP.md پڑھو۔ لاگو کیتے گئے ٹائپ شدہ معاہدے تے موجودہ ورک فلو/فراہم کنندہ دیاں دستاویزات طرز عمل نوں کنٹرول کردیاں ہن۔ CONCEPT.md تے ARCHITECTURE.md دے ٹرمینل-پہلے حصے تاریخی مقصد نوں محفوظ رکھدے ہن تے اوہناں نوں موجودہ ریلیز دے دعوے سمجھن دی غلطی نہیں کرنی چاہیدی۔

انگریزی مدد دا ماخذ docs/help/en.json ہے۔ تیار کیتی گئی USER_GUIDE.md یا website/guide.html نوں ہتھ نال ایڈٹ مت کرو۔ معیاری سیکشن نوں بدلو، متاثرہ معاہدے نوں اپ ڈیٹ کرو تے node scripts/help/generate.cjs چلاؤ۔ ایپ دے اندر والی Help اوہی سورس پڑھدی ہے۔ اصل عمل درآمد دے نال اضافیاں دا جائزہ لوو، بشمول حداں، اجازتاں تے غیر تعاون یافتہ راستے۔

56 انٹرفیس زباناں وچوں ہر اک دی docs/help/locales.json وچ وکھری ہیلپ حیثیت ہے۔ گمشدہ یا نامکمل مدد انگریزی ول رجوع کردی ہے۔ مکمل مشین-ترجمہ شدہ متناں تے لیبل لایا جاندا ہے تے انسانی جائزے دے دعوے توں بغیر انگریزی سورس ہیش نال بنھیا جاندا ہے۔ اک انسانی نظر ثانی شدہ ترجمہ اضافی طور تے اپنے مبصر نوں ریکارڈ کردا ہے۔ ہر ترجمے واسطے سیکشن IDs، ایکشنز، فائل/کمانڈ شناخت کنندگان تے تکنیکی حداں نوں برقرار رکھنا، درست سمت ورتنا، تے انگریزی سورس بدلن تے اس نوں تازہ کرنا لازمی ہے۔

ریلیز کرن توں پہلاں، پرانی جنریٹڈ آؤٹ پٹ، غلط لوکیل سکیفولڈز یا ٹٹے ہوئے مقامی کنٹریکٹ لنکس نوں لبھن لئی node scripts/help/generate.cjs --check چلاؤ۔ UI ترجمہ جانچاں تے ایپلی کیشن رویے دیاں جانچاں وکھریاں رہندیاں ہن۔ HELP_MAINTENANCE.md حصہ دار تے AI نوں اپ ڈیٹ کرن دا طریقہ کار دیندا ہے؛ دستاویزات نوں کسے ایسے پاس ٹیسٹ دا دعویٰ نہیں کرنا چاہیدا جو چلیا ہی نہ ہووے۔

متعلقہ ہدایتاں: [موجودہ پروجیکٹ میپ](../../PROJECT_MAP.md) · [دستاویزات دی دیکھ بھال](../../HELP_MAINTENANCE.md) · [حصہ دار لئی ہدایتاں](../../../CONTRIBUTING.md) · [ایجنٹ لئی ہدایتاں](../../../AGENTS.md).
