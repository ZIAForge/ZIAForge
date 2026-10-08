<!-- Generated from docs/help/en.json; source SHA-256 910098d2b61e07851b0a1433429a6bf1ee342749ea1fdc4885d1e63afda3cd7f. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: tr; served locale: tr; status: machine-translated. -->
# ZIAForge kullanım kılavuzu

Niyetten doğrulanmış bir sonuca. Code, Work ve uygulama denetimine dair pratik bir rehber.

İngilizce metin esastır. Makine çevirisiyle hazırlanan yardım içerikleri, insanlar tarafından gözden geçirilmiş çevirilerden ayrı olarak etiketlenir. Otomatik kontroller, ana dil doğruluğunu onaylamaz.

> Bu kılavuz, güncel İngilizce kaynaktan makine çevirisiyle çevrilmiştir. İnsan incelemesi memnuniyetle karşılanır.

## Kılavuz bölümleri

- [İlk adımlar](#start)
- [Doğru masaüstü paketini kurun](#install-platforms)
- [Code: beş rota](#code)
- [Forge tartışması](#forge)
- [Belgeler ve kararlar](#decisions)
- [Yürütme ve gözden geçirme](#execution)
- [Paralel gözden geçirme ekipleri ve rapor mimarı](#review-teams)
- [Ajan uzmanlaşmaları ve istem ilkesi](#specializations)
- [Work: sorudan belgeye](#work)
- [Ön ayarlar, modeller ve erişim](#models)
- [Sohbetler, Durdur ve kuyruk](#chat)
- [Dosyalar, Git ve tamamlama](#files)
- [API connections](#api)
- [Ayarlar, diller ve güvenli sıfırlama](#settings)
- [Yardım asistanına sorun](#help-assistant)
- [Asistan ve Telegram](#assistant-control)
- [Özel Telegram botunuzu çalıştırın](#telegram)
- [Yalnızca sahibe özel yerel bilgisayar izni](#native-permissions)
- [Tarayıcı ve uzak örnekler](#remote)
- [OpenClaw, Hermes ve diğer harici ajanlar](#external-agents)
- [Yerel CLI ve otomasyon sınırları](#local-cli)
- [Sürüm ve güncellemeler](#updates)
- [Yeniden başlatma ve kurtarma](#restart)
- [Sorun Giderme](#troubleshooting)
- [Sorunları bildirme ve kanıtları inceleme](#diagnostics)
- [Yerel veriler ve sınırlar](#privacy)
- [Bu açık kaynaklı projeyi anlama ve değiştirme](#project-contributors)

<a id="start"></a>

## İlk adımlar

ZIAForge tartışma, planlama, yürütme ve doğrulamayı tek bir görevde tutar. Bir Git projesi için Code modunu veya sıradan bir klasördeki belgeler, araştırmalar ve diğer sonuçlar için Work modunu seçin.

Ayrı bir projede küçük bir görevle başlayın. Yerel bir CLI seçerseniz, önce onu yükleyin ve bir terminalde kendi hesabıyla oturum açın. Alternatif olarak bir API bağlantısı yapılandırın. Bir CLI aboneliği ile ücretli bir API ayrı bağlantı yöntemleridir; ZIAForge oturumunuzu açmaz veya aralarında kredi aktarımı yapmaz.

1. Ayarlar'ı açın ve çalışma alanı klasörünü ve dili kontrol edin. Hakkında, çalışan derlemenin tam kimliğini gösterir.
2. Code için kenar çubuğuna bir Git deposu ekleyin. Work için görevi oluştururken ayrı bir klasör seçin.
3. Bir CLI, model, akıl yürütme çabası ve erişim düzeyi içeren bir ön ayar kaydedin. Kayıtlı bir ön ayar olmadan doğrudan Özel seçeneğini de belirleyebilirsiniz.
4. Bir görev oluşturun, rotasını, rollerini ve manuel veya otomatik ilerlemesini seçin. Başlat'tan önce tercihleri gözden geçirin.

> Sürüm yöneticisi tarafından sağlanan yapay ürünü ve sağlama toplamını (checksum) kullanın. Bir önizleme imzasız olabilir veya yayınlanmış bir güncelleme akışından yoksun olabilir. Masaüstü ve yerel sağlayıcı desteği tam OS, mimari ve yapay ürün için doğrulanmalıdır; tek başına kaynak desteği bir sürüm sertifikasyonu değildir.

İlgili yönergeler: [Projeye genel bakış](../../../README.md) · [Sağlayıcı uyumluluğu](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Doğru masaüstü paketini kurun

İşletim sisteminiz ve CPU mimariniz için bir paket seçin: x64 veya arm64. Derleme işlem hattı macOS DMG/ZIP, Windows NSIS yükleyicisi/ZIP ve Linux DEB/RPM/AppImage/tar.gz/ZIP formatları üretebilir. Üretilen bir dosya veya çapraz derleme, yükleyicisinin ve yerel UI bileşeninin makinenizde başarılı olduğunu kanıtlamaz; söz konusu sürümün doğrulama kaydına başvurun.

Electron 44 kullanan macOS derlemeleri macOS 13 veya sonraki bir sürümü gerektirir. Apple Silicon üzerinde arm64 paketini, Intel için ise x64 paketini kullanın. Değiştirmeden önce eski bir uygulamayı tamamen kapatın. Önizleme paketleri imzasız olabilir ve noter onayı bulunmayabilir; bir geliştirme yapay ürününü imzalı bir genel sürümle karıştırmayın.

Windows, birlikte gelen Electron sürümü tarafından desteklenen bir işletim sistemine ve PATH içinde Git bulunmasına ihtiyaç duyar. Eşleşen mimariyi seçin. İmzasız bir önizleme Authenticode sertifikasına sahip değildir. Taşınabilir bir ZIP yalnızca yürütülebilir dosyasını değil, eksiksiz uygulama dizinini ve çalışma zamanı dosyalarını içermelidir.

Linux uyumlu bir grafik masaüstüne, Electron tarafından gerekli kılınan sistem kitaplıklarına ve Git aracına ihtiyaç duyar. Şifrelenmiş denetim kimlik bilgileri için gnome-libsecret veya KWallet gibi çalışan bir Gizli Servis sağlayın; güvenli olmayan basic_text arka ucu kabul edilmez. Başsız/kapsayıcı duman testi kanıtları her masaüstünü veya dağıtımı onaylamaz.

Bir DEB paketini apt install ./file.deb ile kurun veya dağıtımınızın paket yöneticisi aracılığıyla bir RPM kurun. Bir AppImage yürütme iznine ve uygun FUSE desteğine ihtiyaç duyar; desteklenen yerlerde --appimage-extract-and-run bir alternatiftir. tar.gz ve ZIP paketlerini tüm çalışma zamanı dosyalarıyla birlikte çıkarın. Bir paketi değiştirirken kullanıcı verilerini ve uygulama dosyalarını birbirinden ayrı tutun.

Kaynaktan derlemek için normal Electron yükleyicisi dahil olmak üzere Node 24, Git ve npm ci kullanın. Yerel yeniden derlemeler platform araçları gerektirir: macOS üzerinde Xcode komut satırı araçları; Windows üzerinde MSVC C++, Windows SDK ve Python; Linux üzerinde derleyici, make, Python, pkg-config ve gerekli paketleme araçları. Kesin komutlar ve mevcut platform sınırları için PLATFORM_BUILDS.md dosyasını takip edin.

Sürüm numaraları merkezi olarak ayrılır ve çıktılar sabittir (değiştirilemez). Bir CI doğrulama derlemesi, yayınlanmış bir yükleyici değildir. Kaynak arşivleri kaynak kodunu, kilit dosyasını, belgeleri ve betikleri içerir; bağımlılıklar, kimlik bilgileri, kullanıcı profilleri ve özel araştırmalar hariç tutulur. Başarılı bir x64 derlemesinden asla yerel ARM veya Windows doğrulaması çıkarımı yapmayın.

İlgili yönergeler: [Platform paketleri, önkoşullar ve doğrulama sınırları](../../PLATFORM_BUILDS.md) · [Derleme kimliği ve sürüm denetimleri](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: beş rota

Auto kapsamı değerlendirir: basit bir soru bir yanıtla tamamlanabilirken, daha büyük bir görev hazırlık gerektirir. Hata düzelt bir nedeni araştırır ve bir düzeltme hazırlar. Önce belirtim teknik çözümle başlar; Önce gereksinimler ise gereksinimler ve kabul kriterleriyle başlar.

Çoklu model keşif, tasarım, uygulama ve gözden geçirme için ayrı bağlamlar kullanır. Rota adı farklı sağlayıcılar gerektirmez: her rol, seçtiğiniz ön ayarı veya Özel yapılandırmayı kullanır.

Bir Worktree, görevin Git değişikliklerini yalıtır. Dal, seçilen çalışma kopyasında çalışır. Başlamadan önce projeyi, dalı ve modeli kontrol edin; görev açıklaması ayrıca sıradan bir sohbete gönderilmez.

Çözülmemiş ürün veya teknik kararları olan bir fikir için Önce gereksinimler rotasını kullanın ve temeli tartışma içinde oluşturun. Auto isteği sınıflandırır; her kısa ifadeyi hemen uygulama komutu değildir. Taslağı kaydet, bir modelle bağlantı kurmadan isteği saklar; Başlat, yönetilen akışı bir kez kaydeder ve başlatır. Bir ila dört görev kopyası bağımsız oluşturma kimliklerine ve rol ayarlarına sahiptir.

İlgili yönergeler: [Code iş akışı sözleşmesi](../../WORKFLOWS.md) · [Code istem profilleri](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Forge tartışması

Başlat, merkezi tartışmayı açar. Doğal bir şekilde yanıt verin, karşı sorular sorun, kısıtlamalar ekleyin ve teknik tercihleri tartışın. Konuşma ve sorular görevle birlikte kalır.

Metin göndermek bir belgeyi kabul etmez veya yeni bir uygulama planını yetkilendirmez. Yürütme sırasında yapılan bir açıklama önce yönetilen sırayı duraklatır ve etkilenen kapsamı yeniden gözden geçirir. Zaten kabul edilmiş bir adım içindeki bir soruya verilen yanıt, o adımı devam ettirebilir.

Temeli kasıtlı olarak yeniden ele almak için Gereksinimler, Belirtim veya Planlama öğesini seçin. Yeni bir sürüm, bağımlı kararların yeniden kabul edilmesini gerektirir. Tamamlanan adımlar ve kanıtları kalır; yerini yenisine bırakan tamamlanmamış aşamalar geçmişte saklanır.

Yönetilen aşama oturumları serbest sohbetten farklıdır. İş akışına ait bir oturuma doğrudan manuel istemler göndermek yerine Forge tartışmasını kullanın.

İlgili yönergeler: [Forge tartışma sözleşmesi](../../WORKFLOWS.md).

<a id="decisions"></a>

## Belgeler ve kararlar

Bir belgeyi açın, sürümünü inceleyin ve gerektiğinde düzenlemeler yapın. Düzenlemelerin tartışma üzerinden gönderilmesi yeni bir sürüm üretir; raporlar ve doğrulanmış sonuçlar geriye dönük olarak yeniden yazılmaz.

Önerilen bir planı kabul etmeden önce sırayı, talimatları, kabul kriterlerini ve doğrulama komutlarını düzenleyin. Anladığınız somut komutları yetkilendirin: bunlar görev klasöründe çalışır. Çoklu model, belgelerinde ve talimatlarında ayrıntıları bulunan tüm göreve ait tek bir uygulama adımı önerir.

Onayla, ayrı ve kasıtlı bir karardır. Auto, soruları veya gereksinimlerin, belirtimlerin ve planların kabulünü atlamaz. Harici olarak değiştirilmiş bir belge, eski bir onayı yeniden kullanamaz.

Hazırlık dosyaları yapay ürünler (artifacts) olarak görünür. Sürümleri, üreten aşama ve karmaları onları bir sonuca bağlar. Code belgeleri worktree dışında tutulur ve bir işlemeye (commit) otomatik olarak dahil edilmez.

Kabul etmeden önce hem belgeyi hem de görüntülenen kararı kontrol edin. Kabul işlemi mevcut geçit ID bilgisini, plan revizyonunu ve korunan belge karmalarını bağlar. Kapsam veya kanıt hatalı olduğunda Değişiklik isteyin. Bir karar geçerliliğini yitirdiyse, yeni bir seçim yapmadan önce kayıtlı durumu yeniden yükleyin; değiştirilmiş bir dosya daha önceki bir sürüm altında kabul edilemez.

İlgili yönergeler: [İş akışı geçitleri ve belge sürümleri](../../WORKFLOWS.md).

<a id="execution"></a>

## Yürütme ve gözden geçirme

Yapılacaklar gerçek adımları, geçerli denemeyi, doğrulama ve gözden geçirme sonuçlarını gösterir. Bir aracının “bitti” demesi adımı tamamlamaz: planın gerektirdiği kanıtın mevcut olması gerekir.

Manuel mod uygun adımlar arasında duraklar. Auto doğrulanmış adımları ilerletir ve sınırlı yeniden denemelere izin verir. Şundan sonra durdur her zaman bir denetim noktası oluşturur. Duraklat, iş akışının etkin çalışmasını durdurur; bir paneli kapatmak onu durdurmaz.

Bağımsız bir gözden geçiren, dosyalar ve doğrulama sonuçlarıyla birlikte ayrı bir bağlam kullanır. Gerekli her engelleyici bulgu çözülmelidir; birden fazla gözden geçiren olması oylamayla engelleyici bir hatayı ortadan kaldıramaz.

Çoklu modelde, bulguları düzeltmek açık bir karar gerektirir. Bir düzeltme sessizce başka bir gözden geçirmeyi başlatmaz: Tekrar gözden geçir yeni bir döngü açar. Gözden geçirme yorumları, uygulamayı tekrarlamadan koordinatörün yeniden değerlendirmesini talep edebilir.

Tamamlanan adımlar sessizce düzenlenemez. TDD ile Red adımı beklenen nedenden ötürü gerçekten başarısız olmalı, ardından Green adımı başarılı olmalıdır. Sınırlı denemeler sonsuz yeniden denemeleri engeller.

Ayarlar → Gözden geçirme ekipleri bölümünden bağımsız CLI/API gözden geçirenleri kaydedin, ardından ekibi Code veya Work içinde seçin. Gözden geçirenler paralel olarak çalışır ve ardından ekibin rapor mimarı gelir. Bağımsız gözden geçirenleri kayıtlı bir ekip olmadan da yapılandırabilirsiniz. Rapor mimarı proje dosyaları veya araçlar olmadan yalnızca anonim yapılandırılmış raporlar alır; bu yalıtım şu anda Claude Code veya API gerektirir.

Her uygulama adımı yürütülebilir bir denetime, zorunlu bağımsız gözden geçirmeye veya her ikisine birden ihtiyaç duyar. Hazırlık aşamaları ise bunun yerine doğrulanmış sonuçları ve yapay ürün alındılarını saklar; bunlar uygulama testlerinin çalıştığı yanılsamasını yaratmaz. Bir komut yalnızca gerçek çıkış durumu ve sahip olunan süreç temizliği doğrulandığında başarılı sayılır. TDD için bir Red denetimi, uygulama ve Green doğrulamasından önce normal şekilde başarısız olmalıdır; eksik bir yürütülebilir dosya veya zaman aşımı geçerli bir Red sonucu değildir.

Varsayılan devre kesiciler, bir adımda üç başarısız denemeden veya toplamda elli denemeden sonra durur. Kesinti bir deneme hakkını tüketir ancak tek başına başarısız deneme sayılmaz. Limitler ve tamamlanmış kanıtlar yeniden başlatmada korunur; Yeniden dene bunları sıfırlamaz. Başka bir denemeyi yetkilendirmeden önce saklanan başarısızlığı okuyun.

İlgili yönergeler: [Doğrulama ve gözden geçirme](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Paralel gözden geçirme ekipleri ve rapor mimarı

Ayarlar → Gözden geçirme ekipleri bölümünü açın ve bir ekip kaydedin. Kendi CLI veya API, model, akıl yürütme çabası ve uzmanlığına sahip bağımsız gözden geçirenler ekleyin, ardından bir rapor mimarı seçin. Görevin gözden geçirme yapılandırmasında ekibi seçin. Bir yürütücü ön ayarı bir gözden geçiren tarafından da kullanılabilir ve Özel seçeneği kullanılabilir olmaya devam eder; bağımsız roller yine de ayrı bağlamlara sahiptir.

Gözden geçirenler aynı görev kanıtı üzerinde paralel olarak çalışır. Gerekli her rapor, hata ve karar saklanır. Mimar; gözden geçiren adları, model veya sağlayıcı kimlikleri, orijinal görev içerikleri, depo erişimi veya araçlar olmadan anonim numaralandırılmış raporları alır. Raporları karşılaştırır ve tek bir yapılandırılmış karar döndürür; yeni bir kaynak gözden geçirmesi yürütmez.

Engelleyici bir bulgu veya zorunlu bir gözden geçirenin reddi, çoğunluk oyuyla ya da mimarın tercihiyle geçersiz kılınamaz. Eksik veya hatalı biçimlendirilmiş raporlar onayı engeller. Düzeltmeleri kabul etmeden veya yetkilendirmeden önce bireysel bulguları ve toplam kararı inceleyin. Kayıtlı bir ekip çalışma için çözümlenir ve dondurulur; ön ayarını düzenlemek tamamlanmış kanıtları yeniden yazmaz.

Yalnızca rapor mimarı şu anda desteklenen Claude veya API araçsız yapılandırmalarını kullanır. Codex ve Antigravity gözden geçiren olarak kullanılabilir kalır ancak doğrulanmış bir araçsız sözleşme bulunana kadar bu yalıtılmış mimar rolü için reddedilir. Yalnızca “araç yok” diyen bir istem tek başına yeterli değildir.

> Code Çoklu modelin tasarım/gözden geçirme işlem hattı ile kayıtlı bir paralel gözden geçirme ekibi ayrı kontrollerdir. Seçilen özel gözden geçirme ilkesini koruyun; tek bir rotanın her gözden geçirme özelliğini etkinleştirdiğini varsaymayın.

İlgili yönergeler: [Tiplendirilmiş ekip yapılandırması](../../../shared/review-team.ts) · [Gözden geçirme birleştirmesi](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Ajan uzmanlaşmaları ve istem ilkesi

Model yürütme motorudur; uzmanlaşma ise bir talimat profilidir. Ek uzmanlaşma olmaması için Hiçbiri, varsayılan kılavuz için Standart, ilgili yerleşik bir kılavuz için Auto veya seçilen kılavuzlar ve kendi sınırlandırılmış talimatlarınız için Manuel seçeneğini belirleyin. Ön ayarlar seçimi saklayabilir.

Orijinal katalog genel kodlama, mimari, güvenlik, güvenilirlik, performans, test ve arayüz kullanılabilirliğini kapsar. Auto bir kılavuz seçmek için mevcut görev/adım metnini kullanır; gizlice başka bir modeli aramaz veya uzmanlığı onaylamaz. Planlama önerileri, uygulama planı kabul edilmeden önce incelenebilir ve değiştirilebilir.

Gözden geçirme uzmanlıkları dikkatin yönlendirilmesine yardımcı olur ancak hiçbir zaman bağımsız kanıtların, erişim sınırlarının veya yapılandırılmış kararın yerini almaz. Özel talimatları görev kapsamının bir parçası olarak değerlendirin: bunları belge kabulünü, araç ilkesini, kimlik doğrulamasını veya gözden geçiren başarısızlıklarını atlamak için kullanmayın.

İlgili yönergeler: [Orijinal istem kataloğu](../../../shared/specializations.ts).

<a id="work"></a>

## Work: sorudan belgeye

Work, Git gerektirmez. Varsayılan ayrı bir görev klasörü oluşturur; Özel, yerel seçici aracılığıyla mevcut bir klasörü seçer. Taslağı kaydet, çıkarım yapmadan ayarları saklar; Başlat, ilk aşamayı çalıştırır.

Auto doğrudan yanıt verir veya gerçek Yapılacaklar içeren uygun bir plan önerir. Beyin fırtınası, siz daha fazla fikir veya değerlendirme seçmeden önce ideas.md dosyasını oluşturur. Araştırma; findings.md dosyasını, kaynakları ve sınırlamaları saklar. Yazma; niyetten ve yararlı olduğunda outline.md dosyasından açıklayıcı bir belgeye veya draft.md dosyasına ilerler; revizyonlar önceki sürümleri korur.

Dosya girdilerini yerel seçici üzerinden seçin ve bunlara @ ile başvurun. Uygulama bunları sabit görev girdileri olarak kopyalar ve bir çalıştırmadan önce kimliklerini doğrular. Varsayılan, uygulamaya ait bir görev klasörü oluşturur; Özel klasör erişimi ise kayıtlı bir sahip yetkisidir. Kaydedilmiş, başlatılmamış bir taslak klasörünü değiştirebilir.

Bağımsız yürütücü ayarlarına sahip 1–4 kopya oluşturun. Çakışan klasörleri kullanan görevler aynı anda yazamaz. Bu koordinasyon rastgele harici programlar için değil, ZIAForge işlemleri için geçerlidir.

Derin Beyin Fırtınası varsayılan olarak üç bağımsız çalışana ayarlıdır ve sekize kadar destekler. Ayrı bağlamlarda bir ön ayarın yeniden kullanımı dahil olmak üzere sıralarını ve yapılandırmalarını seçin. Çalışan soruları kaynaklarını korur; hatalı biçimlendirilmiş raporlar bir biçim onarma denemesi alır. Kısmi başarısızlık oybirliğiyle başarı olarak sunulmak yerine görünür kalır.

Derin, tutulan çalışan raporlarını brainstorm_report.md dosyasında birleştirir ve her zaman bir kullanıcı kararı ister. Küçük bir takip, koordinatör aracılığıyla raporu revize eder; büyük bir değişiklik, dondurulmuş çalışanların yeni bir turunu başlatır. Yapay ürünler sürümlerini korur.

Çözümlenen roller görev oluşturulurken veya açık taslak kaydında dondurulur. İlk çağrıdan sonra yalnızca otomatik/manuel ilerleme değiştirilebilir; farklı rol veya model ayarları için yeni bir görev kullanın. Genel bir ön ayarı düzenlemek sonraki aşamaları sessizce değiştirmez.

Manuel mod, kapsamlı bir Yazma taslağı da dahil olmak üzere uygun aşamalar arasında duraklar. Auto bu taslak boyunca devam edebilir. Sorular, önerilen yürütülebilir planlar, Beyin fırtınası yönü ve Derin rapor gözden geçirmesi Auto modunda bile açık kararlar olarak kalır. Tek başına bir alıntı web'de gezinildiğini kanıtlamaz ve tek başına saklanan bir ikili dosya işlendiğini kanıtlamaz.

İlgili yönergeler: [Work modları ve kararları](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Ön ayarlar, modeller ve erişim

Bir ön ayar bir CLI/API, model, akıl yürütme çabası ve izinleri kaydeder. Sohbet altbilgisinde ön ayar, CLI, model ve seçenekler bölümleri bulunur. Özel, bir ön ayar olmadan çalışır; Ön ayar oluştur geçerli seçimi kaydeder.

Katalog, desteklenen yerlerde seçilen yüklü CLI veya API üzerinden gelir. Yenile, seçimi değiştirmeden listeyi günceller. Keşif kullanılamıyorsa açık bir model ID girin; sağlayıcının bunu yine de desteklemesi gerekir. Akıl yürütme düzeyleri modele ve CLI aracına bağlıdır. Sağlayıcı varsayılanı, açık none belirtecinden farklıdır.

Değişiklikleri yalnızca arka uç onayından sonra uygulayın. Etkin bir sıra veya boş olmayan bir kuyruk sırasında geçiş kısıtlanır. Taslaklar ve görünür geçmiş kalır ancak sağlayıcıları değiştirmek bunların özel dahili durumunu aktarmaz.

Forge içinde rol etiketi önemlidir: hazırlık aşaması ayrı bir Planlayıcı kullanabilir. Altbilgi görüntülenen rolü değiştirir; gözden geçirenler ve yardımcılar iş akışı ayarlarında seçilir. Daha önce doğrulanmış uygulama için ilke kilitlenmiş olabilir.

İzinler sağlayıcılar arasında farklılık gösterir. Bağdaştırıcının desteklediği yerlerde Salt okunur ve Çalışma alanı yazma kullanılabilir. Antigravity yerel CLI ayarlarını veya açıkça seçilmiş tam erişimi kullanır. Tam erişim bir sanal alan (sandbox) değildir.

Uzmanlaşma başka bir model veya izin değil, istem rehberliği ekler. Ön ayarlar ve roller Hiçbiri, Standart, Auto ve Manuel seçeneklerini destekler. Auto ek bir model çağrısı olmadan adım metninden profilleri seçer; Manuel en fazla dört uzmanlığı ve özel talimatları kabul eder. Planlayıcı tarafından önerilen atamalar, plan kabul edilmeden önce düzenlenebilir.

Manuel olarak girilen bir model ID veya çaba seçimi sizin tercihiniz olarak kalır ancak sağlayıcı bunu reddedebilir. Genel bir ön ayarı düzenlemek çalışan bir sohbeti veya kabul edilmiş bir planı geriye dönük olarak değiştirmez. Boştaki bir konuşmayı kasıtlı olarak değiştirmek için kendi yapılandırma kontrollerini kullanın ve onayı bekleyin. Devre dışı bırakılmış bir seçenek, kayıtlı JSON düzenlenerek atlanması gereken bir engel olarak değil, bir yetenek veya yaşam döngüsü sınırı olarak okunmalıdır.

İlgili yönergeler: [Sağlayıcı yetenekleri](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Sohbetler, Durdur ve kuyruk

Açık sekmeler, Son kullanılanlar ve taslaklar tek bir göreve aittir. Bir sekmeyi kapatmak onu Açık olanlar arasından kaldırır ancak Son kullanılanlar içinde tutar; sağlayıcı sürecini veya yönetilen iş akışını durdurmaz. Geçmiş menüsünden geçmişi arayın, bir sohbeti yeniden açın veya tüm ek sekmeleri kapatın.

Durdur, geçerli sırayı kesintiye uğratır. Bir sonraki Gönder işleminden önce durdurmanın tamamlanmasını bekleyin: bir kesme bildirimi, sürecin tamamlandığı anlamına gelmez. Bu sırada bir sonraki taslağı yazabilirsiniz.

Sıradan sohbette Kuyruk, daha sonraki bir isteği geçerli taslaktan ayrı olarak kaydeder. Kuyruğu duraklat, sonraki teslimatları bekletir. Durdur ve Çıkış kuyruğu duraklatır. Yeniden başlatmanın ardından önce Sürdürün, ardından açıkça Kuyruğa devam et seçeneğini kullanın.

Belirsiz, teslimat durumunun bilinmediği anlamına gelir. Böyle bir mesaj otomatik olarak yeniden gönderilmez: geçmişi inceleyin, uygunsa metni kopyalayın ve kuyruğa alınmış öğeyi kapatın. Mesajı tekrar göndermek, yeni ve kasıtlı bir istektir.

Yönetilen aşama sohbetleri sıradan kuyruğu değil, kendi iş akışlarını kullanır. Aşamayı takip et geçerli aşamayı gösterir; manuel olarak başka bir sekme seçmek takibi durdurur. CLI günlükleri, tanılamaları yanıttan ayrı olarak gösterir.

Markdown yanıtları başlıkları, listeleri, tabloları, bağlantıları ve çitle çevrilmiş kod bloklarını işler. Araç kartları ve CLI tanılamaları yanıttan ayrı kalır. Model tarafından bildirilen düşünme süreci ve belirteç metrikleri yalnızca sağlayıcı bunları gerçekten sunduğunda görünür; animasyonlara bakarak gizli akıl yürütme veya kullanım çıkarımında bulunmayın.

Belirsiz bir gönderim veya kuyruk onayından sonra geçmişi inceleyin ve yalnızca sunulduğu durumlarda korunan aynı isteği yeniden deneyin. Bir kuyruk makbuzu, depolamanın öğeyi kabul ettiği anlamına gelir; çıkarımın bittiği anlamına gelmez. Belirsiz kuyruğa alınmış bir öğeyi yalnızca açıkça yok sayma amacıyla kaldırın; bu işlem daha önce teslim edilmiş bir istemi geri alamaz.

İlgili yönergeler: [Kalıcı mesaj kuyruğu](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Dosyalar, Git ve tamamlama

Dosyalar görev klasörünü gösterir. Sonuçları gereksinimlerle karşılaştırın, belgeleri açın ve farkları inceleyin. İkili bir dosyanın tutulması, hedef uygulamasında doğru şekilde işlendiğini kanıtlamaz.

Git durum, değişiklikler ve kayıtlı sonuçlarla birlikte işlemleri sunar. İşleme (commit), birleştirme (merge) ve gönderme (push) varsayılan olarak manueldir; otomatik işlemler tamamen doğrulanmış bir plan için ayrı seçimlerdir.

Doğrulama ve yayınlama arasında çalışma dosyalarını değiştirmeyin: onay tam baytlara bağlıdır. Çakışmalar, başarısız göndermeler ve bilinmeyen işlem sonuçları açık bir karara kadar ilerlemeyi engeller. Auto yayınlamayı sessizce yetkilendirmez.

Work hiçbir Git dalı oluşturmaz ve hiçbir Git sonlandırma adımına sahip değildir. Sürümler ve kaynaklar dahil olmak üzere gerekli belgeleri seçilen klasörden saklayın.

Dosya düzenleyici uzantıya göre sözdizimi, arama ve değiştirme, geri alma geçmişi, satır kaydırma ve sekme başına taslaklar sağlar. Kaydetme işlemleri desteklenen UTF-8/UTF-16 kodlamalarını korur ve harici değişiklik çakışmalarını reddeder. Diğer kodlamalar ve ikili içerik harici bir düzenleyici gerektirir. Kaydedilmemiş taslaklar, sahip bunları kaydedene veya atana kadar uygulamanın Çıkış yapmasını engeller.

Tam sözdizimi 8 MiB boyutuna kadar etkindir. Daha büyük metin dosyaları 256 KiB pencereler halinde açılır; 8–64 MiB sözdizimi olmadan açıkça tam olarak yüklenebilir. 64 MiB üzerinde pencere düzenlemesi ve sınırlı sonraki eşleşme araması kullanın. Bu, isteğe bağlı büyüklükteki belgeler için Sublime Text eşdeğerliği değil, sınırlı bir büyük dosya modudur.

Klasör aç, yalnızca orijinal depoyu sessizce açmak yerine geçerli görev veya dal/worktree bağlamını kullanır. Bir dosya satırı o dosyanın üst dizinini gösterebilir. Yollar, kayıtlı görev izinlerine göre arka uç tarafından doğrulanır. İkili dosyalar düz metin olarak düzenlenemez; bunların hedef görüntüleyicisini kullanın ve orijinal baytları koruyun.

Worktree kaldırma işlemi ayrı ve korumalı bir eylemdir. Kaldırmadan önce, boşta olan oturumlar da dahil olmak üzere bağlı yapılandırılmış oturumları ve terminalleri sonlandırın. Kayıtlı Git sonucunu ve kurtarma durumunu inceleyin; bir görev kaydını silmek, işlenmemiş çalışmaları güvenle korumanın yerini tutmaz.

İlgili yönergeler: [Tip korumalı düzenleyici sözleşmesi](../../../shared/editor.ts) · [Git ilkeleri](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> Kılavuzun tamamı henüz arayüz dilinize çevrilmedi. İngilizce referans gösteriliyor.

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

İlgili yönergeler: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## Ayarlar, diller ve güvenli sıfırlama

Genel ayarlar çalışma alanını, arayüz dilini ve varsayılanları seçer. Bağlantılar API uç noktalarını yönetir. Ön ayarlar ve Gözden geçirme ekipleri rol yapılandırmalarını tutar. Uzaktan denetim yerel kimlik bilgilerini, sunucu kapsamını ve sahip izinlerini yönetir; Güncellemeler ise sürüm kaynağını/kanalını yönetir. Hakkında, çalışan derlemenin tam kimliğini gösterir.

Arayüz dili; istem dilinden ve belgelendirme inceleme durumundan ayrıdır. Ürün adları, komut kimlikleri, dosya uzantıları, sağlayıcı model kimlikleri ve kullanıcı tarafından oluşturulan adlar tanımlayıcı olarak kalır. Güncel bir çeviri mevcut olduğunda Yardım seçilen arayüz dilini izler; makine çevirileri etiketlenir ve İngilizce kurallı referans olmaya devam eder.

Kaydet, görüntülenen yapılandırmayı uygular. Veritabanını sıfırlama veya fabrika ayarlarına sıfırlama uygulama meta verilerini kaldırabilir; bilerek sıfırlama yapmadan önce dosyaları ve test edilmiş bir yedeği koruyun. Bu işlemler yerel sahibin yapacağı eylemlerdir. Bunları, başarısız bir iş akışını veya bozuk bir kaydı incelemek için kestirme bir yol olarak kullanmayın.

İlgili yönergeler: [Yerelleştirme talimatları](../../LOCALIZATION.md) · [Veri kurtarma](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Yardım asistanına sorun

Yardım'ı açın, asistan panelinde kayıtlı ve bağlı bir önayar seçin ve ZIAForge hakkında sorular sorun. Yanıtlar, geçerli kurallı İngilizce kılavuzu ve seçtiğiniz arayüz dilini kullanır. Bölüm referans düğmeleri ilgili kılavuz konularını açar, böylece açıklamayı referansla karşılaştırabilirsiniz.

Bu asistan, en fazla 100 kayıtlı girdi ve 3 MiB boyutunda ayrı bir özel konuşma tutar. En fazla 12,000 karakterlik bir soru girin; Gönder soruyu sorar, Durdur sorunuzu kullanılabilir tutarken etkin yanıtı iptal eder ve Temizle bu Yardım konuşmasını kaldırır. Gönderilmemiş taslağınız ve önayar seçiminiz aynı uygulama oturumunda Yardım'ı kapatıp yeniden açtığınızda korunur, ancak taslak diske kaydedilmez. Asistan uygulama komutları gönderemez, bir iş akışını değiştiremez veya bir geçidi kabul edemez. Tavsiyeler bir görevin, hesabın veya harici bağlantının canlı doğrulaması değildir.

Claude Code ve API Yardım oturumları, desteklenen araçsız (no-tools) politikasını zorunlu kılar. Yerel Codex ve Antigravity Yardım oturumları, mevcut yerel sahip yerel bilgisayar iznini gerektirir. Devre dışı bırakılmışsa, uygulama farklı bir sağlayıcı seçmek yerine bu önkoşulu açıklar. Bunu yalnızca sahip yerel denetim ayarlarında etkinleştirebilir; asistan bunu kendisi etkinleştiremez.

Codex Yardım'ı salt okunur bir korumalı alan kullanır ve araç onaylama isteklerini reddeder. Antigravity plan modunu ve yerel korumalı alan bayrağını kullanır. Bu yerel modlar, işletim sistemi yalıtımına dair evrensel bir garanti değildir. Kaynak kılavuz karması (hash), yanıt için kullanılan referansı tanımlar; üretilen bir açıklama yine de hatalı olabilir, bu nedenle harekete geçmeden önce bağlantılı bölümlerini inceleyin. Kaynak kılavuz sürümü geçerli kılavuzdan farklı olduğunda eski yanıtlar işaretlenir.

İlgili yönergeler: [Kurallı kılavuz ve çeviri bakımı](../../HELP_MAINTENANCE.md) · [Uygulama asistanı ve izinler](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Asistan ve Telegram

Asistan, seçilen önayarı ve aynı uygulama kontrolü API'sini kullanır. Durumu inceleme izni ile işlemleri gerçekleştirme izni birbirinden ayrıdır. Komutları ve sonuçları inceleyin: asistanın düz metni bir eylemin tamamlandığının kanıtı değildir.

Telegram, yalnızca yerel sahip tarafından, mevcut bir bot belirteci ve sayısal sahip ID'si ile etkinleştirilir. Denetim yalnızca bu sahibin özel sohbeti içindir. Yapılandırılmamış veya etkin olmayan bir bot, uygulama mesajlarını almamalıdır.

Bot belirtecini normal bir sohbete yapıştırmayın. Entegrasyonu yapılandırmak Telegram bağlantısını kanıtlamaz ve otomatik olarak bir bot oluşturmaz. Ekran görüntüleri ve yanıtlar özel çalışma alanı verileri içerebilir.

Bir asistan önayarı seçin ve uygulama çalıştırma iznini inceleme izninden ayrı olarak verin. Codex ve Antigravity asistan yürütmesi sahibin yerel iznini gerektirir; bunların yerine sessizce araçsız bir API veya Claude oturumu geçirilemez. Ekran görüntüleri asistan sohbetinde görüntülenebilir ancak mevcut model girdisi görsel analizi içermez. Yalnızca görüntülendi diye asistanın bir resmi görsel olarak incelediğini varsaymayın.

Asistan; tipli araçlar aracılığıyla özetleri, görevleri, sohbetleri, iş akışı durumunu, süreç bağlamını ve uygulama pencerelerini inceleyebilir. İzin verilen olağan ayarları değiştirebilir ve yetkilendirilmiş uygulama işlemlerini başlatabilir. Yerel haklar veremez, kayıtlı kimlik bilgilerini açığa çıkaramaz, kök çalışma alanı yetkisini uzaktan değiştiremez veya yalnızca pratik olduğu için bir Forge geçidini onaylayamaz.

İlgili yönergeler: [Uygulama denetim sözleşmesi](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Özel Telegram botunuzu çalıştırın

Kendi botunuzu oluşturun veya edinin, özel sohbetini başlatın ve belirteci ile sayısal Telegram kullanıcı ID'nizi yerel denetim ayarlarına girin. Entegrasyonu yalnızca uygulamanın bağlanmasını istediğinizde etkinleştirin. Sahip ID'si bir kullanıcı tanımlayıcısıdır, kullanıcı adı veya bot ID'si değildir. Yalnızca bu kullanıcıdan gelen ve aynı özel sohbetteki iletiler kabul edilir.

Çalışan sürüm, proje/görev sayıları ve görev durumları hakkında genel bir bakış için /start, /menu veya /status komutlarını kullanın. Düğmeler Projeler, Görevler, Ekran Görüntüsü, Yardım ve Dil bölümlerini açar. Listeler, Geri, Yenile, Ana Sayfa ve Önceki/Sonraki gezinme özellikleriyle sayfa başına sekiz öge gösterir. Proje düğmeleri görev listesini filtreler. Bir görev kartı, kaydedilen iş akışı ilerlemesini, modelini/önayarını ve varsa bekleyen soruları gösterir.

Açık/son konuşmaları ve iş akışı aşaması sohbetlerini önizlemek için bir görevin Sohbetler bölümünü açın. Her önizleme, her biri görünür şekilde 200 karaktere kısaltılmış en fazla altı güncel kullanıcı/asistan iletisini gösterir. Özel akıl yürütme gösterilmez. Geçmişi okumak bir sağlayıcı başlatmaz. Önizlemeler salt okunurdur: normal metin ve /ask TEXT yine uygulama asistanına yöneliktir, hiçbir zaman örtük olarak görüntülediğiniz görev sohbetine hitap etmez.

Çalıştır / Devam Et, geçerli Code veya Work iş akışını yeniden okur ve uygun olan kayıtlı bir iş akışını başlatır. Duraklat, duraklatılmasını talep eder. İkisi de gereksinimleri, bir şartnameyi, bir planı, inceleme bulgularını veya soruları kabul etmez; bekleyen bir karar Çalıştır'ı engeller. Kararları uygulamada verin veya tam geçerli geçidi ve revizyonu ile açıkça yetkilendirilmiş tipli bir komut kullanın.

56 arayüz dilinden herhangi birini kendi yerel adıyla seçmek için Dil veya /language komutunu kullanın. Bu, tercihi yalnızca bu bot ve sahip için saklar. Uygulama dilini kullan bu tercihi temizler. Ne uygulamanın dilini ne de erişim izinlerini değiştirir; mevcut iletiler otomatik olarak yeniden gönderilmez.

Gezinme normalde yayımlanan aynı menü iletisini günceller. Düğmeler 15 dakika sonra süresi dolan ve bir kez kullanılabilen opak kimliklere sahiptir; bir kartı değiştirmek eski düğmelerini geçersiz kılar. Süresi dolmuş, kullanılmış, uyuşmayan iletilere ait ve önceki işleme ait düğmeler bir eylem gerçekleştiremez. Kesinlikle düzenlenemeyen bir ileti yeni bir kartla değiştirilebilir; bilinmeyen bir ağ hatası yeni bir ileti olarak yeniden denenmez.

Etkinleştirme sırasında yoklayıcı (poller) önceki birikmiş işleri atar ve kesintiye uğrayan komutların yeniden başlatmada otomatik olarak tekrarlanmaması için dağıtımdan önce güncelleme kabulünü kaydeder. Bu durum yeniden yürütmeyi önler; tamamlanmayı garanti etmez. Bir hatadan sonra kasıtlı olarak yeni bir iş vermeden önce durumu/bağlamı kontrol edin. Otomatik görev durumu bildirimleri yoktur.

Açık komutlar kullanılabilir kalır: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot ve /ask TEXT. /new {JSON} tipli createTask aracılığıyla bir görev oluşturur; /command {JSON} açık bir katalog komutu gönderir. Argüman yapıları için canlı kataloğu okuyun. Uygulamadaki ile aynı arka uç yetkilendirmesi ve klasör izinleri geçerlidir.

Uygulama, saklanan bot belirteci değerlerini asistana asla göndermez. Yine de ekran görüntüleri, özetler ve konuşma metinleri özel proje bilgileri içerebilir. Bot veya sahip hesabına artık güvenilmiyorsa entegrasyonu yerel olarak durdurun. Sızdırılmış bir belirteci bot sağlayıcısında yenileyin (rotate), ardından yerel şifrelenmiş yapılandırmasını güncelleyin.

İlgili yönergeler: [Özel bot ve komutlar](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Yalnızca sahibe özel yerel bilgisayar izni

Yerel bilgisayar erişimi varsayılan olarak devre dışıdır. Bunu yalnızca sahip yerel Ayarlar → Uzaktan denetim bölümünden etkinleştirebilir. Asistan ve HTTP/MCP/Telegram komutları bu bayrağı kendileri için etkinleştiremez. Bir işlem reddedilirse asistan ayarı açıklamalı ve kararı sahibe bırakmalıdır.

Açıkça etkinleştirildiğinde, computer.run bir yürütülebilir dosya, argüman dizisi ve isteğe bağlı mutlak çalışma dizini kabul eder. Kabuk enterpolasyonu kullanmaz, 30 saniyelik bir sınıra sahiptir ve çıktıyı 1 MiB ile sınırlar. Sağlanan eksik veya geçersiz bir dizin reddedilir; cwd belirtilmezse HOME yerine uygulamanın sahip olduğu ayarlar dizini kullanılır. Çıkış, sahip olunan etkin komutları iptal eder ve süreçlerinin temizlenmesini bekler.

Uygulama okuma/çalıştırma kapsamı ile yerel erişim ayrı kararlardır. Bir çalışma ağacı (worktree), kısıtlanmamış bir sağlayıcının dosya sistemi erişimini sınırlandırmaz. Görevden sonra artık gerekli değilse yerel erişimi iptal edin ve asistanın düz metnini kanıt olarak kabul etmek yerine komut makbuzlarını inceleyin.

İlgili yönergeler: [Yalnızca sahip denetim sözleşmesi](../../../shared/control.ts).

<a id="remote"></a>

## Tarayıcı ve uzak örnekler

Yerel sahip sunucuyu etkinleştirir ve adresini, bağlantı noktasını ve kapsamını seçer: inceleme için read (okuma) veya eylemler için operate (çalıştırma). Varsayılan 127.0.0.1 adresi yalnızca bu bilgisayarda kullanılabilir. 0.0.0.0 ağ arayüzlerini dinler; etkinleştirmeden önce ağ erişimini gözden geçirin.

Bir tarayıcı, belirteçle giriş yaptıktan sonra aynı arayüzü açar. Belirteçleri genel bağlantılara veya ekran görüntülerine dahil etmeyin. Tek başına HTTP trafiği şifrelemez; güvenilmeyen bir ağ üzerinden korumalı bir kanal kullanın.

Sahip, diğer örnekleri URL ve belirteç ile yapılandırır. Arka uç istekleri vekil sunucu olarak iletir; bu, projelerini yerel makineye kopyalamaz. Her eylemden önce seçilen örneği kontrol edin.

Tipli komutlar ve olaylar uygulama denetimini taşır. Okuma kapsamı görev değişikliklerine yetki vermez. Yerel bilgisayar denetimi ayrı bir yerel sahip seçimidir ve devre dışı olarak başlar.

Tarayıcı, Telegram ve harici ajan denetimi için uygulamanın çalışır durumda kalması gerekir. Her örneğin kendi özel profili, görev durumu, belirteci ve sunucu bağlantı noktası vardır. Tek bir profili bağımsız örnekler arasında aynı anda yeniden kullanmayın. Tarayıcı olayları ve komut yanıtları seçilen örnekle sınırlıdır; UI'ı değiştirmek dosyaların yerini değiştirmez veya yerel girişi kopyalamaz.

İlgili yönergeler: [HTTP ve örnek denetimi](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes ve diğer harici ajanlar

Kimliği doğrulanmış uygulama denetimi API'sini veya birlikte gelen MCP stdio köprüsünü kullanın. Sunucuyu yerel olarak etkinleştirin, read (okuma) veya operate (çalıştırma) kapsamını seçin ve her istemciyi ilgili örnek URL'si ve belirteciyle yapılandırın. Bağımsız MCP köprüsünü çalıştırmak için Node.js 22 veya daha yenisi gerekir; Electron uygulaması ajan istemcinizi yüklemez. Tarayıcı URL'si akış yapılabilir bir HTTP MCP uç noktası değildir: bunu stdio köprüsüne ZIAFORGE_URL olarak sağlayın.

Köprü ziaforge_status, ziaforge_commands, ziaforge_command ve ziaforge_screenshot işlevlerini sunar. Durum ve canlı komut kataloğuyla başlayın, ardından seçilen görev için system.context'i okuyun. Tipli komutlar, yerel UI ile aynı revizyon, geçit, görev klasörü ve temizlik kontrollerini izler.

Canlı komut kataloğu, kaynak yolu ve sourceSha256 değeriyle birlikte kurallı İngilizce yardım olan documentation.guide'ı içerir. Dahili uygulama mimarı aynı referansı araçları aracılığıyla alır. Bu, ajanlara eski notlara güvenmeksizin ürün bağlamının tamamını sağlar; belgelendirme asla erişim hakkı tanımaz veya güncel bir insan kararının yerini almaz.

Ajanlar, kısa bir insan fikrinden yola çıkarak gereksinimleri, teknik kararları ve planlamayı tartışmalıdır. Açık insan geçitlerini, seçilen modelleri, manuel/Auto politikasını ve gerekli incelemeyi korumalıdırlar. Kafalarından onay uydurmamalı, belirsiz komutları yeni bir ID altında yeniden oynatmamalı veya sahibinin niyeti olmadan Git değişikliklerini yayımlamamalıdırlar.

Birden fazla kurulum için adlandırılmış birkaç MCP sunucusu yapılandırın. Örnek değiştirme bir yönlendirme kararıdır, senkronizasyon değildir. OpenClaw ve Hermes yapılandırma örnekleri AGENT_CONTROL.md dosyasındadır; istemciye özel kurulum ve uyumluluk, kurulu istemci sürümü için kontrol edilmelidir.

Dış requestId önbelleği, yalnızca uygulama çalışırken sınırlı sayıdaki istek kümesini tekilleştirir. Kalıcı işlemler kendi kimliklerini kullanır: görev oluşturma için createRequestId, iş akışı kararları için commandId, iletiler için clientMessageId ve operationId (Git mutasyonları için). Bilinmeyen bir bildirimin ardından orijinal kimliği ve yükü koruyun; kasıtlı olarak yeni bir iş vermeden önce kayıtlı durumu okuyun.

İlgili yönergeler: [MCP istemci talimatları](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## Yerel CLI ve otomasyon sınırları

ziaf dağıtıcısı, çalışan aynı uygulamayı ve kayıtlı iş akışını denetler. Kaynaktan npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID veya npm run ziaf -- pause --task TASK_ID komutlarını kullanın. Başarılı bir Başlatma onayı, görevin tamamlandığı anlamına gelmez.

--until-success, kayıtlı iş akışı için kasıtlı olarak Auto modunu etkinleştirir; ancak sorular, inceleme, kabul geçitleri, sınırlar ve kontrol noktaları geçerliliğini korur. Ctrl+C gözlemleyen dağıtıcıdan çıkar; uygulama iş akışını örtük olarak durdurmaz. Çıkış kodları, yerel uç nokta ve profil yönetimi için CLI.md dosyasına bakın.

Otomasyonlar arayüzü şu anda görüntüleme tanımlarını ve yerel çalıştırma sayaçlarını saklar. Onaylanmış bir yinelenen zamanlayıcı değildir ve arka plandaki model sırasının çalıştığını kanıtlamaz. Gerçek yürütme için kayıtlı iş akışı denetimlerini, ziaf'ı veya kimliği doğrulanmış API'yi kullanın ve makbuzlarını inceleyin. Gösterim panelini gözetimsiz zamanlama ile karıştırmayın.

İlgili yönergeler: [Dağıtıcı komutları](../../CLI.md).

<a id="updates"></a>

## Sürüm ve güncellemeler

Hakkında bölümü çalışan tam sürümü gösterir. Genel güncellemeler güvenilir bir GitHub sürüm deposu ile kararlı veya önizleme kanalı gerektirir. Kontrol etme, indirme ve yükleme ayrı durumlara sahiptir; bir hata, bir güncellemenin yüklendiği anlamına gelmez.

Otomatik yükleme, imzalanmış macOS sürümleri içindir. İmzalanmamış geliştirme derlemeleri bu mekanizma aracılığıyla otomatik olarak yüklenmez. Manuel değiştirme için mevcut uygulamadan tamamen çıkın ve doğrulanmış bir yapıt kullanın.

Otomatik kontrol etkinleştirildiğinde hemen, ardından her altı saatte bir çalışır.

Kararlı kanal önizleme sürümlerini hariç tutar; önizleme kanalı geliştirme sürümlerine de izin verir. Başarılı bir kontrol yalnızca mevcut sürüm meta verilerini doğrular. İndirme ve yükleme, platform paketine ve yapılandırılmış sürüm akışına ihtiyaç duyar. Linux DEB teslimatı ayrı bir yükleyici yoludur; bir DEB paketinin macOS güncelleme mekanizması tarafından otomatik olarak yükseltildiğini varsaymayın.

İlgili yönergeler: [Sürüm hazır olma durumu](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Yeniden başlatma ve kurtarma

macOS üzerinde tam kapatma için Çıkış / ⌘Q kullanın. Pencereyi kapatmak uygulamayı çalışır durumda bırakabilir. Uygulamayı değiştirmeden önce eski sürümden tamamen çıkın.

Başlattıktan sonra aynı görevi seçin. Geçmiş ve taslaklar geri döner. Devam Et yerel/dahili bir bağlamı geri yükler ancak bir taslağı göndermez, kuyruğu duraklatmadan çıkarmaz veya bilinmeyen bir işlemin tekrarlanmasına yetki vermez.

Kurtarma görünürse JSON'ı elle düzenlemeyin. Etkilenen belge türünü inceleyin, orijinal dosyaları koruyun ve doğrulanmış bir yedek seçin. Daha eski bir kuyruğun geri yüklenmesi ögelerini belirsiz olarak işaretler.

Teslimat bilinmediğinde, yönetilen bir iş akışının yeni bir bağlam için açık izne ihtiyacı olabilir. Önceki çalışma ve başarısız denemeler kalır; görünür bir ret, uydurma bir başarıdan daha güvenlidir.

Tüm uygulama örnekleri kapalıyken görev dosyalarını ve uygulama profilini yedekleyin. Kopyalanmış bir klasör test edilmiş bir geri yükleme değildir. Kurtarma doğrulanmış bir yedek seçmenizi isterse, hasarlı dosyaların tam halini de saklayın. Daha eski bir iş akışını veya kuyruğu geri yüklemek, belirsiz çıkarımları veya Git işlemlerini yeniden oynatmaya yetki vermez.

İlgili yönergeler: [Kurtarma sözleşmesi](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Sorun Giderme

CLI bulunamadı: normal bir terminalde kurulumunu ve sürümünü kontrol edin, ardından ZIAForge uygulamasını yeniden başlatın. Bir yürütülebilir dosyanın mevcut olması oturum açtığınız anlamına gelmez. Sağlayıcının kendi oturum açma mekanizmasını kullanın.

Model kullanılamıyor veya yetkilendirme başarısız oldu: keşfi yenileyin, kullanılabilir bir ID seçin ve hesabınızı ile limitlerinizi kontrol edin. Geçmişini incelemeden önce belirsiz bir isteği tekrarlamayın.

İş akışı durduruldu: geçerli aşamayı, soruyu, doğrulama makbuzunu veya CLI günlüklerini açın. Belirli nedeni giderin: yanıtlanmamış bir soru, komut, klasör izni veya deneme sınırı. Devam Et, başarısız bir kontrolü başarıya dönüştüremez.

Klasör eksik veya yeri değiştirilmiş: orijinal klasöre erişimi geri yükleyin veya yeni bir görev oluşturun. Uygulama HOME üzerinden devam etmemelidir. Başka bir cwd gözlemlerseniz sırayı durdurun ve tanılama verilerini koruyun.

Bir rapor için Hakkında sürümünü, rotayı, CLI/modeli, beklenen ve fiili davranışı, bir ekran görüntüsünü ve güvenli bir günlük alıntısını ekleyin. Gizli dizileri, kişisel içerikleri ve yayımlanamayacak yolları kaldırın.

Uzak sayfa kullanılamıyor: sahibin sunucuyu etkinleştirdiğini doğrulayın, dinleme adresini ve bağlantı noktasını kontrol edin, ardından doğru örnek belirteciyle kimlik doğrulaması yapın. Bir 401 kimlik doğrulamasını gösterir; reddedilen bir mutasyon, okuma kapsamı veya yalnızca sahibe özel bir denetim olabilir. Belirteci değiştirmek mevcut tarayıcı istemcilerini kapatır. Ayrı DevTools inceleme bağlantı noktasını uzaktan uygulama denetimi olarak açığa çıkarmayın.

Düzenleyici kaydetmeyi reddetti: taslağı koruyun, diskteki geçerli dosyayı inceleyin ve harici değişiklik çakışmasını çözün. Uygulama meta verilerini yeniden yazarak karşılaştırmayı atlatmayın. Büyük dosyaların tam yüklenmesi kullanılamıyorsa, desteklenen pencere düzenlemeyi/aramayı veya harici bir düzenleyiciyi kullanın.

Telegram kullanılamıyor: bot belirtecini, sayısal sahibi, özel sohbeti ve durumu yerel olarak onaylayın. Çakışan bir webhook veya yoklayıcı (poller) yoklamayı engelleyebilir; ZIAForge otomatik olarak bir webhook'u silmez veya başka bir yoklayıcıyı devralmaz. Bilinmeyen bir sınırda reddedilen veya kesintiye uğrayan komutlar otomatik olarak yeniden yürütülmez.

İlgili yönergeler: [Test ve tanılama](../../TESTING.md).

<a id="diagnostics"></a>

## Sorunları bildirme ve kanıtları inceleme

Hakkında bölümünden çalışan tam sürümü, OS/mimariyi, görev modunu, seçilen sağlayıcı/modeli ve sorunu yeniden üreten adımları kaydedin. Beklenen sonucu ve gözlemlenen sonucu açıklayın. Özel bir profilin tamamı yerine güvenli bir ekran görüntüsü ile ilgili saklanan komutu veya doğrulama makbuzunu ekleyin.

CLI günlükleri, olay kayıtları, model dökümleri, tarayıcı izleri ve ekran görüntüleri kaynak kodunu, kişisel yolları veya belirteçleri açığa çıkarabilir. Paylaşmadan önce inceleyin ve gizleyin. En iyi gayretle çalışan bir günlük gizleyici, bir ekran görüntüsünün veya arşivin yayımlanabilir olduğunu onaylamaz.

Katkıda bulunanlar için qa:doctor ortam/derleme kimliğini okur; qa:inspect sağlayıcı taslaklarıyla yalıtılmış bir profil açar. Bir sabit veri (fixture), bir modelle iletişim kurmadan test edilen uygulama yolunu kanıtlar. Canlı çıkarım, Telegram bağlantısı, yerel Linux masaüstü, imzalama ve paketlenmiş yapıt kontrolleri ayrı kanıtlardır. Tekrarlanabilir komutlar ve temizlik için TESTING.md dosyasına bakın.

İlgili yönergeler: [Kanıt komutları](../../TESTING.md).

<a id="privacy"></a>

## Yerel veriler ve sınırlar

Projeler, geçmiş, planlar, belgeler ve tanılama verileri özel metinler içerebilir. Profilleri, ham yakalamaları, anahtarları veya tam günlükleri kaynak kodla birlikte yayımlamayın.

Linux ortamında API, denetim, Telegram ve örnek kimlik bilgilerini kaydetmek, kilidi açılmış bir GNOME Secret Service veya KWallet gerektirir; desteklenen bir gizli dizi deposu olmadan ZIAForge, Electron'un basic_text yedeğini kullanmak yerine bu gizli dizileri kaydetmeyi reddeder.

Yerel depolama, isteklerin bilgisayarınızda kaldığı anlamına gelmez: seçilen CLI/API bunları sağlayıcısına gönderir. Bir çalışma klasörü ve süreç denetimi OS yalıtımı değildir. Seçilen izinleri inceleyin.

Kanıt türlerini ayırt edin: sabit veriler (fixtures) uygulamayı bir model olmadan test eder; yerel canlı, gerçek bir CLI/hesap çalıştırır; paketlenmiş kontroller belirli bir yapıtı onaylar. Birini geçmek diğerlerini garanti etmez.

Uygulama kapsamı, bir çalışma ağacı ve salt okunur bir istem, işletim sistemi yaptırımından farklıdır. Antigravity inceleme/yardımcı politikaları, dosya sistemi salt okunur erişimini zorunlu kılmak yerine toplanan çalışma alanı kanıtlarındaki değişiklikleri tespit eder. Yerel bilgisayar denetimi, sahibin yetkilendirdiği programları sıradan uygulama aracı sınırının dışında yürütür; artık gerekmediğinde bunu kapatın.

İlgili yönergeler: [Kaynak ve yayımlama](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Bu açık kaynaklı projeyi anlama ve değiştirme

Önce AGENTS.md ve CONTRIBUTING.md, ardından mevcut kaynak sınırları için PROJECT_MAP.md dosyasını okuyun. Uygulanan tipli sözleşmeler ve geçerli iş akışı/sağlayıcı belgeleri davranışı yönetir. CONCEPT.md ve ARCHITECTURE.md dosyasının öncelikle terminale odaklanan bölümleri geçmişteki amacı korur ve geçerli sürüm iddialarıyla karıştırılmamalıdır.

İngilizce yardım kaynağı docs/help/en.json dosyasıdır. Üretilen USER_GUIDE.md veya website/guide.html dosyasını elle düzenlemeyin. Kurallı bölümü değiştirin, etkilenen sözleşmeyi güncelleyin ve node scripts/help/generate.cjs komutunu çalıştırın. Uygulama içi Yardım aynı kaynağı okur. Eklemeleri sınırlar, izinler ve desteklenmeyen yollar dahil olmak üzere gerçek uygulama ile birlikte inceleyin.

56 arayüz yerel ayarının her biri, docs/help/locales.json dosyasında ayrı yardım durumuna sahiptir. Eksik veya tamamlanmamış yardım İngilizceye geri döner. Tam makine çevirisi yapılmış gövdeler etiketlenir ve bir insan incelemesi iddiası olmaksızın İngilizce kaynak karmasına bağlanır. İnsan tarafından incelenen bir çeviri ek olarak inceleyen kişiyi kaydeder. Her çeviri bölüm kimliklerini, eylemleri, dosya/komut tanımlayıcılarını ve teknik sınırları korumalı, doğru yönü kullanmalı ve İngilizce kaynağı değiştiğinde yenilenmelidir.

Yayımlamadan önce güncelliğini yitirmiş üretilen çıktıyı, geçersiz yerel ayar yapılarını veya bozuk yerel sözleşme bağlantılarını tespit etmek için node scripts/help/generate.cjs --check komutunu çalıştırın. UI çeviri kontrolleri ile uygulama davranışı kontrolleri ayrı kalır. HELP_MAINTENANCE.md katkıda bulunan ve AI güncelleme prosedürünü açıklar; belgelendirme, çalıştırılmamış başarılı bir test iddiasında bulunmamalıdır.

İlgili yönergeler: [Geçerli proje haritası](../../PROJECT_MAP.md) · [Belge bakımı](../../HELP_MAINTENANCE.md) · [Katkıda bulunan talimatları](../../../CONTRIBUTING.md) · [Ajan talimatları](../../../AGENTS.md).
