<!-- Generated from docs/help/en.json; source SHA-256 c62aae118737b0c8aa69a75571d08fc21a8b86d7f369e8cf3d293550fff266f2. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: am; served locale: am; status: machine-translated. -->
# የZIAForge የተጠቃሚ መመሪያ

ከአላማ ወደ የተረጋገጠ ውጤት። ተግባራዊ መመሪያ ለCode፣ Work እና የመተግበሪያ ቁጥጥር።

እንግሊዝኛ ቀኖናዊ (ዋና) ነው። በማሽን የተተረጎመ እገዛ በሰው ከተገመገሙ ትርጉሞች ተለይቶ ተሰይሟል። አውቶማቲክ ፍተሻዎች የአፍ መፍቻ ቋንቋ ትክክለኛነትን አያረጋግጡም።

> ይህ መመሪያ ከአሁኑ የእንግሊዝኛ ምንጭ በማሽን የተተረጎመ ነው። የሰው ግምገማ አሁንም በደስታ ይቀበላል።

## የመመሪያ ክፍሎች

- [የመጀመሪያ እርምጃዎች](#start)
- [ትክክለኛውን የዴስክቶፕ ፓኬጅ ይጫኑ](#install-platforms)
- [Code: አምስት መንገዶች](#code)
- [የForge ውይይት](#forge)
- [ሰነዶች እና ውሳኔዎች](#decisions)
- [አፈጻጸም እና ግምገማ](#execution)
- [ትይዩ የግምገማ ቡድኖች እና የሪፖርት አርክቴክቱ](#review-teams)
- [የወኪል ልዩ ሙያዎች እና የጥያቄ ፖሊሲ](#specializations)
- [Work: ከጥያቄ ወደ ሰነድ](#work)
- [ቅድመ-ቅምጦች፣ ሞዴሎች እና መዳረሻ](#models)
- [ቻቶች፣ አቁም እና ወረፋው](#chat)
- [ፋይሎች፣ Git እና ማጠናቀቅ](#files)
- [API connections](#api)
- [ቅንብሮች፣ ቋንቋዎች እና ደህንነቱ የተጠበቀ ዳግም ማስጀመር](#settings)
- [የእገዛ ረዳቱን ይጠይቁ](#help-assistant)
- [ረዳት እና Telegram](#assistant-control)
- [የእርስዎን የግል Telegram ቦት ያንቀሳቅሱ](#telegram)
- [የባለቤት-ብቻ የአካባቢ ኮምፒውተር ፈቃድ](#native-permissions)
- [አሳሽ እና የርቀት ምሳሌዎች](#remote)
- [OpenClaw፣ Hermes እና ሌሎች ውጫዊ ወኪሎች](#external-agents)
- [የአካባቢ CLI እና የአውቶሜሽን ገደቦች](#local-cli)
- [Version and updates](#updates)
- [ዳግም ማስጀመር እና መልሶ ማግኛ](#restart)
- [ችግር መፍታት](#troubleshooting)
- [ችግሮችን ሪፖርት ያድርጉ እና ማስረጃዎችን ይመርምሩ](#diagnostics)
- [የአካባቢ ውሂብ እና ወሰኖች](#privacy)
- [ይህንን ክፍት ምንጭ ፕሮጀክት ይረዱ እና ይቀይሩ](#project-contributors)

<a id="start"></a>

## የመጀመሪያ እርምጃዎች

ZIAForge ውይይትን፣ እቅድን፣ አፈጻጸምን እና ማረጋገጫን በአንድ ተግባር ውስጥ ያቆያል። ለGit ፕሮጀክት Codeን፣ ወይም በተለመደው አቃፊ ውስጥ ላሉ ሰነዶች፣ ምርምር እና ሌሎች ውጤቶች Workን ይምረጡ።

በተለየ ፕሮጀክት ውስጥ በትንሽ ተግባር ይጀምሩ። አገር በቀል (native) CLIን ከመረጡ፣ መጀመሪያ ይጫኑት እና በተርሚናል ውስጥ በራሱ መለያ ይግቡ። በአማራጭ፣ የAPI ግንኙነትን ያዋቅሩ። የCLI ምዝገባ እና የሚከፈልበት API የተለያዩ የግንኙነት ዘዴዎች ናቸው፤ ZIAForge ወደ መለያዎ አያስገባዎትም ወይም በመካከላቸው ክሬዲቶችን አያስተላልፍም።

1. ቅንብሮችን ይክፈቱ እና የስራ ቦታ አቃፊውን እና ቋንቋውን ያረጋግጡ። ስለ የሚለው የሩጫውን ትክክለኛ ማንነት ያሳያል።
2. ለCode፣ በጎን አሞሌው ውስጥ የGit ማከማቻ (repository) ያክሉ። ለWork፣ ተግባሩን ሲፈጥሩ የተለየ አቃፊ ይምረጡ።
3. ከCLI፣ ሞዴል፣ የአመክንዮ ጥረት እና የመዳረሻ ደረጃ ጋር ቅድመ-ቅምጥ ያስቀምጡ። እንዲሁም የተቀመጠ ቅድመ-ቅምጥ ሳይኖር በቀጥታ ብጁን መምረጥ ይችላሉ።
4. ተግባር ይፍጠሩ፣ መንገዱን፣ ሚናዎቹን እና በእጅ ወይም በራስ-ሰር መሻሻልን ይምረጡ። ከመጀመርዎ በፊት ምርጫዎቹን ይገምግሙ።

> በአስተዳዳሪው የቀረበውን ቅርስ እና የቼክሰም ድምር ይጠቀሙ። ቅድመ እይታ ያልተፈረመ ሊሆን ወይም የታተመ የዝመና ምግብ ላያንሰው ይችላል። የዴስክቶፕ እና የአገር በቀል አቅራቢ ድጋፍ ለትክክለኛው OS፣ አርክቴክቸር እና ቅርስ መረጋገጥ አለበት፤ የምንጭ ድጋፍ ብቻውን የልቀት ማረጋገጫ አይደለም።

ተዛማጅ መመሪያዎች: [የፕሮጀክት አጠቃላይ እይታ](../../../README.md) · [የአቅራቢ ተኳኋኝነት](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## ትክክለኛውን የዴስክቶፕ ፓኬጅ ይጫኑ

ለእርስዎ ኦፕሬቲንግ ሲስተም እና ለCPU አርክቴክቸር ፓኬጅ ይምረጡ፡ x64 ወይም arm64። የግንባታ ቧንቧው (pipeline) macOS DMG/ZIP፣ Windows NSIS ጫኝ/ZIP፣ እና Linux DEB/RPM/AppImage/tar.gz/ZIP ቅርጸቶችን ማምረት ይችላል። የተፈጠረ ፋይል ወይም አቋራጭ ግንባታ ጫኚው እና አገር በቀል (native) UI በእርስዎ ማሽን ላይ ማለፋቸውን የሚያሳይ ማስረጃ አይደለም፤ የዚያን ልቀት የማረጋገጫ መዝገብ ይመልከቱ።

Electron 44ን የሚጠቀሙ የmacOS ግንባታዎች macOS 13 ወይም ከዚያ በኋላ ያስፈልጋቸዋል። በApple Silicon ላይ የarm64 ፓኬጅን እና ለIntel ደግሞ የx64 ፓኬጅን ይጠቀሙ። ከመተካትዎ በፊት አሮጌውን መተግበሪያ ሙሉ በሙሉ ያቁሙ። የቅድመ እይታ ፓኬጆች ያልተፈረሙ እና ኖተራይዝድ ያልተደረጉ ሊሆኑ ይችላሉ፤ የልማት ቅርስን (artifact) ለተፈረመ ይፋዊ ልቀት አያምታቱ።

Windows በጥቅሉ በተካተተው የElectron ስሪት የሚደገፍ ኦፕሬቲንግ ሲስተም እና በPATH ውስጥ የሚገኝ Git ያስፈልገዋል። ተዛማጁን አርክቴክቸር ይምረጡ። ያልተፈረመ ቅድመ እይታ የAuthenticode ማረጋገጫ የለውም። ተንቀሳቃሽ ZIP የሚተገበረውን ፋይል ብቻ ሳይሆን ሙሉውን የመተግበሪያ ማውጫ እና የማስኬጃ (runtime) ፋይሎችን ማቆየት አለበት።

Linux ተኳሃኝ የሆነ ስዕላዊ ዴስክቶፕ፣ በElectron የሚፈለጉ የስርዓት ቤተ-መጻሕፍት እና Git ያስፈልገዋል። ለተመሰጠሩ የቁጥጥር ምስክርነቶች፣ እንደ gnome-libsecret ወይም KWallet ያለ የሚሰራ Secret Service ያቅርቡ፤ ደህንነቱ ያልተጠበቀው የbasic_text backend ተቀባይነት የለውም። ያለ ጭንቅላት (Headless)/ኮንቴይነር የጭስ ማውጫ (smoke) ማስረጃ እያንዳንዱን ዴስክቶፕ ወይም ስርጭት አያረጋግጥም።

DEBን በapt install ./file.deb ይጫኑ፣ ወይም በእርስዎ ስርጭት የፓኬጅ አስተዳዳሪ በኩል RPM ይጫኑ። AppImage ሊተገበር የሚችል ፈቃድ እና ተስማሚ የFUSE ድጋፍ ይፈልጋል፤ --appimage-extract-and-run በሚደገፍበት ቦታ አማራጭ ነው። የtar.gz እና ZIP ፓኬጆችን ከሁሉም የማስኬጃ ፋይሎቻቸው ጋር ያውጡ። ፓኬጅ በሚተካበት ጊዜ የተጠቃሚ ውሂብ እና የመተግበሪያ ፋይሎችን ለይተው ያቆዩ።

ከምንጭ ለመገንባት መደበኛውን የElectron ጫኝ ጨምሮ Node 24፣ Git እና npm ci ይጠቀሙ። አገር በቀል ዳግም ግንባታዎች የመድረክ መሳሪያዎችን ይፈልጋሉ፡ የXcode የትዕዛዝ መስመር መሳሪያዎች በmacOS ላይ፤ MSVC C++፣ Windows SDK እና Python በWindows ላይ፤ አቀናባሪ፣ make፣ Python፣ pkg-config እና አስፈላጊ የማሸጊያ መሳሪያዎች በLinux ላይ። ለትክክለኛዎቹ ትዕዛዞች እና የአሁን የመድረክ ገደቦች PLATFORM_BUILDS.mdን ይከተሉ።

የልቀት ስሪቶች በማዕከላዊነት የተጠበቁ ናቸው እና ውጤቶቹ የማይለወጡ ናቸው። የCI ማረጋገጫ ግንባታ የታተመ ጫኝ አይደለም። የምንጭ ማህደሮች ምንጭን፣ የቁልፍ ፋይልን (lockfile)፣ ሰነዶችን እና ስክሪፕቶችን ይይዛሉ፤ ጥገኞች፣ ምስክርነቶች፣ የተጠቃሚ መገለጫዎች እና የግል ምርምሮች የተገለሉ ናቸው። ከተሳካ የx64 ግንባታ አገር በቀል የARM ወይም Windows ማረጋገጫን በጭራሽ አይገምቱ።

ተዛማጅ መመሪያዎች: [የመድረክ ፓኬጆች፣ ቅድመ ሁኔታዎች እና የማረጋገጫ ገደቦች](../../PLATFORM_BUILDS.md) · [የግንባታ ማንነት እና የልቀት ፍተሻዎች](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: አምስት መንገዶች

Auto ስፋትን ይገመግማል፡ ቀላል ጥያቄ በመልስ ሊያበቃ ይችላል፣ ትልቅ ተግባር ግን ዝግጅት ያስፈልገዋል። ሳንካን መጠገን መንስኤን ይመረምራል እና እርማት ያዘጋጃል። ዝርዝር መግለጫ መጀመሪያ በቴክኒካዊ መፍትሄ ይጀምራል፤ መስፈርቶች መጀመሪያ በመስፈርቶች እና ተቀባይነት መስፈርቶች ይጀምራል።

ባለብዙ ሞዴል ፍለጋ፣ ዲዛይን፣ አተገባበር እና ግምገማ የተለዩ አውዶችን ይጠቀማል። የመንገዱ ስም የተለያዩ አቅራቢዎችን አይጠይቅም፡ እያንዳንዱ ሚና እርስዎ የመረጡትን ቅድመ-ቅምጥ ወይም ብጁ ውቅር ይጠቀማል።

የስራ ዛፍ (Worktree) የተግባርን የGit ለውጦች ይለያል። ቅርንጫፍ በተመረጠው ፍተሻ ውስጥ ይሰራል/ የፕሮጀክቱን፣ ቅርንጫፉን እና ሞዴሉን ከመጀመርዎ በፊት ያረጋግጡ፤ የተግባር መግለጫው በተጨማሪ ወደ ተራ ውይይት አይላክም።

ያልተፈቱ የምርት ወይም ቴክኒካዊ ምርጫዎች ላለው ሀሳብ፣ መስፈርቶች መጀመሪያን ይጠቀሙ እና መሰረቱን በውይይት ውስጥ ይገንቡ። Auto ጥያቄውን ይመድባል፤ እያንዳንዱን አጭር ሀረግ ወዲያውኑ ተግባራዊ ለማድረግ ትዕዛዝ አይደለም። ረቂቅ አስቀምጥ ሞዴልን ሳያነጋግር ጥያቄውን ያቆያል፤ ጀምር የሚተዳደረውን ፍሰት አንድ ጊዜ ያስቀምጣል እና ያስጀምራል። ከአንድ እስከ አራት የተግባር ቅጂዎች ገለልተኛ የፈጠራ መታወቂያዎች እና የሚና ቅንብሮች አሏቸው።

ተዛማጅ መመሪያዎች: [የCode የስራ ፍሰት ውል](../../WORKFLOWS.md) · [የCode ጥያቄ መገለጫዎች](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## የForge ውይይት

ጀምር ማዕከላዊውን ውይይት ይከፍታል። በተፈጥሮ ይመልሱ፣ የተቃውሞ ጥያቄዎችን ይጠይቁ፣ ገደቦችን ያክሉ እና ቴክኒካዊ ምርጫዎችን ይወያዩ። ውይይቱ እና ጥያቄዎቹ ከተግባሩ ጋር ይቆያሉ።

ጽሁፍ መላክ ሰነድን አይቀበልም ወይም አዲስ የአተገባበር እቅድ አይፈቅድም። በአፈጻጸም ወቅት የሚደረግ ማብራሪያ መጀመሪያ የሚተዳደረውን ተራ ለአፍታ ያቆማል እና የተጎዳውን ስፋት እንደገና ይመረምራል። አስቀድሞ ተቀባይነት ባለው ደረጃ ውስጥ ላለ ጥያቄ መልስ ያንን ደረጃ ሊቀጥል ይችላል።

ሆን ብለው መሰረቱን እንደገና ለመጎብኘት፣ መስፈርቶች፣ ዝርዝር መግለጫ ወይም እቅድን ይምረጡ። አዲስ ስሪት ጥገኛ ውሳኔዎችን አዲስ መቀበልን ይፈልጋል። የተጠናቀቁ ደረጃዎች እና ማስረጃዎቻቸው ይቀራሉ፤ የተተኩ ያላለቁ ምዕራፎች በታሪክ ውስጥ ይቆያሉ።

የሚተዳደሩ የምዕራፍ ክፍለ-ጊዜዎች ከነጻ ቻት ይለያያሉ። በእጅ የሚደረጉ ጥያቄዎችን በቀጥታ በስራ ፍሰት ባለቤትነት ወደተያዘ ክፍለ-ጊዜ ከመላክ ይልቅ የForge ውይይት ይጠቀሙ።

ተዛማጅ መመሪያዎች: [የForge የውይይት ውል](../../WORKFLOWS.md).

<a id="decisions"></a>

## ሰነዶች እና ውሳኔዎች

ሰነድ ይክፈቱ፣ ስሪቱን ይመርምሩ እና በሚያስፈልግበት ጊዜ አርትዖቶችን ያድርጉ። በውይይት በኩል አርትዖቶችን ማስገባት አዲስ ስሪት ያመነጫል፤ ሪፖርቶች እና የተረጋገጡ ውጤቶች ወደ ኋላ ተመልሰው እንደገና አይጻፉም።

የቀረበውን እቅድ ከመቀበልዎ በፊት ቅደም ተከተሉን፣ መመሪያዎችን፣ ተቀባይነት መስፈርቶችን እና የማረጋገጫ ትዕዛዞችን ያርትዑ። የተረዱትን ተጨባጭ ትዕዛዞችን ፍቀድ፡ በተግባር አቃፊው ውስጥ ይሰራሉ። ባለብዙ ሞዴል አንድ ሙሉ ተግባር የማስፈጸሚያ ደረጃን ያቀርባል፣ ዝርዝሮቹም በሰነዶቹ እና በመመሪያዎቹ ውስጥ አሉ።

ማጽደቅ የተለየ ሆን ተብሎ የሚደረግ ውሳኔ ነው። Auto ጥያቄዎችን ወይም የመስፈርቶችን፣ ዝርዝር መግለጫዎችን እና እቅዶችን መቀበልን አያልፍም። በውጪ የተቀየረ ሰነድ አሮጌ ፈቃድን እንደገና መጠቀም አይችልም።

የዝግጅት ፋይሎች እንደ ቅርስ (artifacts) ይታያሉ። ስሪታቸው፣ ያመረተው ምዕራፍ እና ሃሽ ከውጤት ጋር ያቆራኛቸዋል። የCode ሰነዶች ከስራ ዛፍ ውጭ ይቀመጣሉ እና በራስ-ሰር ወደ commit አይገቡም።

ከመቀበልዎ በፊት ሰነዱን እና የታየውን ውሳኔ ያረጋግጡ። መቀበል የአሁኑን በር ID፣ የእቅድ ክለሳ እና የተያዙ የሰነድ ሃሾችን ያስራል። ስፋት ወይም ማስረጃ የተሳሳተ ሲሆን ለውጦችን ይጠይቁ። ውሳኔ ጊዜው ካለፈበት፣ አዲስ ምርጫ ከማድረግዎ በፊት የተቀመጠውን ሁኔታ እንደገና ይጫኑ፤ የተቀየረ ፋይል በቀድሞ ስሪት ስር ተቀባይነት ሊያገኝ አይችልም።

ተዛማጅ መመሪያዎች: [የስራ ፍሰት በሮች እና የሰነድ ስሪቶች](../../WORKFLOWS.md).

<a id="execution"></a>

## አፈጻጸም እና ግምገማ

የሚደረጉ ነገሮች (To-do) እውነተኛ ደረጃዎችን፣ የአሁኑን ሙከራ፣ የማረጋገጫ እና የግምገማ ውጤቶችን ያሳያል። ወኪል “ተከናውኗል” ማለቱ ደረጃን አያጠናቅቅም፡ የእቅዱ አስፈላጊ ማስረጃ መኖር አለበት።

በእጅ ሁነታ ብቁ በሆኑ ደረጃዎች መካከል ለአፍታ ይቆማል። Auto የተረጋገጡ እርምጃዎችን ያራምዳል እና የተገደቡ ድጋሚ ሙከራዎችን ይፈቅዳል። በኋላ አቁም ሁልጊዜ የፍተሻ ነጥብ (checkpoint) ይፈጥራል። ለአፍታ አቁም የስራ ፍሰቱን ንቁ ስራ ያቆማል፤ ፓነልን መዝጋት አያቆመውም።

ገለልተኛ ገምጋሚ ከፋይሎች እና ከማረጋገጫ ውጤቶች ጋር የተለየ አውድ ይጠቀማል። እያንዳንዱ የሚፈለግ አግድ ግኝት መፈታት አለበት፤ ብዙ ገምጋሚዎች የሚያግድ ስህተትን በድምጽ ብልጫ አያስወግዱትም።

በባለብዙ ሞዴል ውስጥ ግኝቶችን ማረም ግልጽ ውሳኔን ይፈልጋል። እርማት በጸጥታ ሌላ ግምገማ አይጀምርም፡ እንደገና ገምግም አዲስ ዑደት ይከፍታል። የግምገማ አስተያየቶች አተገባበርን ሳይደግሙ የአስተባባሪን ዳግም እይታ ሊጠይቁ ይችላሉ።

የተጠናቀቁ ደረጃዎች በጸጥታ ሊታረሙ አይችሉም። በTDD፣ ቀይ (Red) በትክክል በሚጠበቀው ምክንያት መውደቅ አለበት፣ ከዚያ አረንጓዴ (Green) ማለፍ አለበት። የተገደቡ ሙከራዎች ማለቂያ የሌላቸውን ድጋሚ ሙከራዎች ይከላከላሉ።

ገለልተኛ የCLI/API ገምጋሚዎችን በቅንብሮች → የግምገማ ቡድኖች ውስጥ ያስቀምጡ፣ ከዚያ ቡድኑን በCode ወይም Work ውስጥ ይምረጡ። ገምጋሚዎች በትይዩ ይሰራሉ፣ በመቀጠልም የቡድኑ ሪፖርት አርክቴክት ይከተላል። የተቀመጠ ቡድን ሳይኖርዎት ገለልተኛ ገምጋሚዎችን ማዋቀር ይችላሉ። የሪፖርት አርክቴክቱ ስም-አልባ የተዋቀሩ ሪፖርቶችን ብቻ ይቀበላል፣ ምንም የፕሮጀክት ፋይሎች ወይም መሳሪያዎች የሉትም፤ ይህ መገለል በአሁኑ ጊዜ Claude Code ወይም API ያስፈልገዋል።

እያንዳንዱ የአተገባበር ደረጃ ሊተገበር የሚችል ፍተሻ፣ አስፈላጊ ገለልተኛ ግምገማ ወይም ሁለቱንም ይፈልጋል። የዝግጅት ምዕራፎች በምትኩ የተረጋገጡ ውጤቶችን እና የቅርስ ደረሰኞችን ይይዛሉ፤ እነዚህ የአተገባበር ሙከራዎች እንደተካሄዱ አያስመስሉም። ትዕዛዝ የሚሳካው ትክክለኛው የመውጫ ሁኔታ እና በባለቤትነት የተያዘው ሂደት ጽዳት ሲረጋገጥ ብቻ ነው። ለTDD የቀይ ፍተሻ ከአተገባበሩ እና ከአረንጓዴ ማረጋገጫው በፊት በመደበኛነት መውደቅ አለበት፤ የጎደለ ተፈጻሚ ፋይል ወይም ጊዜ ማብቂያ (timeout) ትክክለኛ የቀይ ውጤት አይደለም።

ነባሪ የወረዳ መቆራረጦች (circuit breakers) በአንድ ደረጃ ላይ ከሶስት ያልተሳኩ ሙከራዎች በኋላ ወይም በአጠቃላይ ሃምሳ ሙከራዎች በኋላ ያቆማሉ። መቋረጥ ሙከራን ይወስዳል ነገር ግን በራሱ እንደ ያልተሳካ ሙከራ አይቆጠርም። ገደቦች እና የተጠናቀቁ ማስረጃዎች ዳግም ከተነሳ በኋላም ይቆያሉ፤ እንደገና መሞከር ዳግም አያስጀምራቸውም። ሌላ ሙከራ ከመፍቀድዎ በፊት የተያዘውን ውድቀት ያንብቡ።

ተዛማጅ መመሪያዎች: [ማረጋገጫ እና ግምገማ](../../WORKFLOWS.md).

<a id="review-teams"></a>

## ትይዩ የግምገማ ቡድኖች እና የሪፖርት አርክቴክቱ

ቅንብሮች → የግምገማ ቡድኖችን ይክፈቱ እና ቡድን ያስቀምጡ። ገለልተኛ ገምጋሚዎችን ከራሳቸው CLI ወይም API፣ ሞዴል፣ የአመክንዮ ጥረት እና ልዩ ሙያ ጋር ያክሉ፣ ከዚያ የሪፖርት አርክቴክት ይምረጡ። በተግባሩ የግምገማ ውቅር ውስጥ ቡድኑን ይምረጡ። የአስፈጻሚ ቅድመ-ቅምጥ በገምጋሚም ሊሠራበት ይችላል፣ እና ብጁ እንደተገኘ ይቆያል፤ ገለልተኛ ሚናዎች አሁንም የተለዩ አውዶች አሏቸው።

ገምጋሚዎች በተመሳሳይ የተግባር ማስረጃ ላይ በትይዩ ይሰራሉ። እያንዳንዱ አስፈላጊ ሪፖርት፣ ስህተት እና ውሳኔ ተጠብቆ ይቆያል። አርክቴክቱ ያለ ገምጋሚ ​​ስሞች፣ የሞዴል ወይም የአቅራቢ ማንነቶች፣ የመጀመሪያ የተግባር ይዘቶች፣ የማከማቻ መዳረሻ ወይም መሳሪያዎች ስም-አልባ ቁጥር ያላቸው ሪፖርቶችን ይቀበላል። ሪፖርቶችን ያወዳድራል እና አንድ የተዋቀረ ውሳኔ ይመልሳል፤ አዲስ የምንጭ ግምገማ አያካሂድም።

የሚያግድ ግኝት ወይም አስፈላጊ የገምጋሚ ውድቅ መደረግ በድምጽ ብልጫ ወይም በአርክቴክት ምርጫ ሊተው አይችልም። የጎደሉ ወይም የተበላሹ ሪፖርቶች ማጽደቅን ይከለክላሉ። እርማቶችን ከመቀበልዎ ወይም ከመፍቀድዎ በፊት የግለሰብ ግኝቶችን እና አጠቃላይ ውሳኔን ይመርምሩ። የተቀመጠ ቡድን ለሩጫው ይወሰናል እና ይቀዘቅዛል፤ ቅድመ-ቅምጡን ማረም የተጠናቀቀ ማስረጃን እንደገና አይጽፍም።

ሪፖርት-ብቻ አርክቴክቱ በአሁኑ ጊዜ የሚደገፉትን የClaude ወይም API ከመሳሪያ ነጻ አወቃቀሮችን ይጠቀማል። Codex እና Antigravity እንደ ገምጋሚዎች ሆነው ይቆያሉ ነገር ግን የተረጋገጠ ከመሳሪያ ነጻ ውል እስኪኖር ድረስ ለዚህ ገለልተኛ የአርክቴክት ሚና ውድቅ ይደረጋሉ። “ምንም መሳሪያዎች የሉም” የሚል ጥያቄ ብቻውን በቂ አይደለም።

> የCode ባለብዙ ሞዴል ዲዛይን/ግምገማ ቧንቧ እና የተቀመጠ ትይዩ የግምገማ ቡድን የተለያዩ መቆጣጠሪያዎች ናቸው። የተመረጠውን ብጁ የግምገማ ፖሊሲ ያቆዩ፤ አንድ መንገድ እያንዳንዱን የግምገማ ባህሪ እንደሚያነቃ አያስቡ።

ተዛማጅ መመሪያዎች: [የተተየበ የቡድን ውቅር](../../../shared/review-team.ts) · [የግምገማ ድምር](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## የወኪል ልዩ ሙያዎች እና የጥያቄ ፖሊሲ

ሞዴል የአፈጻጸም ሞተር ነው፤ ልዩ ሙያ የመመሪያ መገለጫ ነው። ምንም ተጨማሪ ልዩ ሙያ ላለመኖር ምንምን፣ ለነባሪ መመሪያ መደበኛን፣ ለአግባብ አብሮ የተሰራ መመሪያ Autoን፣ ወይም ለተመረጡ መመሪያዎች እና ለራስዎ የተገደቡ መመሪያዎች በእጅ የሚለውን ይምረጡ። ቅድመ-ቅምጦች ምርጫውን ማቆየት ይችላሉ።

ዋናው ካታሎግ አጠቃላይ ኮድ አጻጻፍን፣ አርክቴክቸርን፣ ደህንነትን፣ አስተማማኝነትን፣ አፈጻጸምን፣ ሙከራን እና የበይነገጽ አጠቃቀምን ይሸፍናል። Auto መመሪያ ለመምረጥ የሚገኘውን የተግባር/የደረጃ ጽሁፍ ይጠቀማል፤ በድብቅ ሌላ ሞዴል አይጠራም ወይም ባለሙያነትን አያረጋግጥም። የአተገባበር እቅዱን ከመቀበልዎ በፊት የእቅድ ጥቆማዎችን መመርመር እና መለወጥ ይቻላል።

የግምገማ ልዩ ሙያዎች ትኩረትን ለመምራት ይረዳሉ ነገር ግን ገለልተኛ ማስረጃዎችን፣ የመዳረሻ ገደቦችን ወይም የተዋቀረውን ውሳኔ በጭራሽ አይተኩም። ብጁ መመሪያዎችን እንደ የተግባር ወሰን አካል አድርገው ይያዙ፡ የሰነድ መቀበልን፣ የመሳሪያ ፖሊሲን፣ ማረጋገጫን ወይም የገምጋሚ ውድቀቶችን ለማለፍ አይጠቀሙባቸው።

ተዛማጅ መመሪያዎች: [ዋናው የጥያቄ ካታሎግ](../../../shared/specializations.ts).

<a id="work"></a>

## Work: ከጥያቄ ወደ ሰነድ

Work Gitን አይፈልግም። ነባሪ የተለየ የተግባር አቃፊ ይፈጥራል፤ ብጁ በአገር በቀል መራጭ በኩል ያለውን አቃፊ ይመርጣል። ረቂቅ አስቀምጥ ያለ ግምት (inference) ቅንብሮችን ያከማቻል፤ ጀምር የመጀመሪያውን ምዕራፍ ያካሂዳል።

Auto በቀጥታ ይመልሳል ወይም ከእውነተኛ የሚደረጉ ነገሮች (To-dos) ጋር ተስማሚ እቅድ ያቀርባል። Brainstorm ተጨማሪ ሀሳቦችን ወይም ግምገማን ከመምረጥዎ በፊት ideas.mdን ይፈጥራል። Research findings.mdን፣ ምንጮችን እና ገደቦችን ያቆያል። Write ከአላማ እና ጠቃሚ በሚሆንበት ጊዜ ከoutline.md ወደ ገላጭ ሰነድ ወይም draft.md ይሸጋገራል፤ ክለሳዎች የቀድሞ ስሪቶችን ያቆያሉ።

በአገር በቀል መራጭ በኩል የፋይል ግብአቶችን ይምረጡ እና በ@ ያመልክቷቸው። መተግበሪያው እንደ የማይለወጡ የተግባር ግብአቶች አድርጎ ይገለብጣቸዋል እና ከመሮጡ በፊት ማንነታቸውን ያረጋግጣል። ነባሪ በመተግበሪያ ባለቤትነት የተያዘ የተግባር አቃፊ ይፈጥራል፤ የብጁ አቃፊ መዳረሻ የተቀመጠ የባለቤት ስጦታ ነው። የተቀመጠ፣ ያልተጀመረ ረቂቅ አቃፊውን ሊለውጥ ይችላል።

ገለልተኛ የአስፈጻሚ ቅንብሮች ያላቸው የ1–4 ቅጂዎችን ይፍጠሩ። ተደራራቢ አቃፊዎችን የሚጠቀሙ ተግባራት በአንድ ጊዜ መጻፍ አይችሉም። ይህ ቅንጅት ለZIAForge ስራዎች ተፈጻሚ ይሆናል እንጂ ለዘፈቀደ የውጭ ፕሮግራሞች አይደለም።

Deep Brainstorm በነባሪ ሶስት ገለልተኛ ሰራተኞችን ይጠቀማል እና እስከ ስምንት ድረስ ይደግፋል። ቅደም ተከተላቸውን እና አወቃቀራቸውን ይምረጡ፣ ይህም ቅድመ-ቅምጥን በተለዩ አውዶች ውስጥ እንደገና መጠቀምን ይጨምራል። የሰራተኛ ጥያቄዎች መነሻቸውን ያቆያሉ፤ የተበላሹ ሪፖርቶች አንድ የቅርጸት-ጥገና ሙከራ ያገኛሉ። ከፊል ውድቀት እንደ ሙሉ ስኬት ከመቅረብ ይልቅ የሚታይ ሆኖ ይቆያል።

Deep የተያዙትን የሰራተኛ ሪፖርቶች ወደ brainstorm_report.md ያጣምራል እና ሁልጊዜ የተጠቃሚ ውሳኔን ይጠይቃል። ትንሽ ክትትል በአስተባባሪው በኩል ሪፖርቱን ያሻሽላል፤ ትልቅ ለውጥ የቀዘቀዙትን ሰራተኞች ሌላ ዙር ያስጀምራል። ቅርሶች ስሪቶቻቸውን ያቆያሉ።

የተፈቱ ሚናዎች በተግባር ፈጠራ ወይም በግልጽ ረቂቅ ማስቀመጥ ወቅት ይቀዘቅዛሉ። ከመጀመሪያው ጥሪ በኋላ፣ አውቶማቲክ/በእጅ እድገት ብቻ ሊለወጥ ይችላል፤ ለተለያዩ የሚና ወይም የሞዴል ቅንብሮች አዲስ ተግባር ይጠቀሙ። ዓለም አቀፍ ቅድመ-ቅምጥን ማረም የኋለኛውን ምዕራፎች በጸጥታ አይለውጥም።

በእጅ ሁነታ ከፍተኛ የሆነ የWrite ረቂቅን ጨምሮ ብቁ በሆኑ ምዕራፎች መካከል ለአፍታ ይቆማል። Auto በዚያ ረቂቅ በኩል ሊቀጥል ይችላል። ጥያቄዎች፣ የቀረቡ ተፈጻሚ እቅዶች፣ የBrainstorm አቅጣጫ እና የDeep ሪፖርት ግምገማ በAuto ውስጥም ቢሆን ግልጽ ውሳኔዎች ሆነው ይቆያሉ። ጥቅስ ብቻውን አሰሳ መከሰቱን አያረጋግጥም፣ እና የተያዘ የሁለትዮሽ ፋይል ብቻውን አቀራረቡን አያረጋግጥም።

ተዛማጅ መመሪያዎች: [የWork ሁነታዎች እና ውሳኔዎች](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## ቅድመ-ቅምጦች፣ ሞዴሎች እና መዳረሻ

ቅድመ-ቅምጥ CLI/APIን፣ ሞዴልን፣ የአመክንዮ ጥረትን እና ፈቃዶችን ያስቀምጣል። የቻት ግርጌ ቅድመ-ቅምጥ፣ CLI፣ ሞዴል እና የአማራጮች ክፍሎች አሉት። ብጁ ያለ ቅድመ-ቅምጥ ይሰራል፤ ቅድመ-ቅምጥ ፍጠር የአሁኑን ምርጫ ያስቀምጣል።

ካታሎጉ ከሚደገፈው ከተመረጠው የተጫነ CLI ወይም API የመጣ ነው። አድስ ምርጫውን ሳይቀይር ዝርዝሩን ያዘምናል። ግኝት የማይገኝ ከሆነ፣ ግልጽ የሆነ ሞዴል ID ያስገቡ፤ አቅራቢው አሁንም መደገፍ አለበት። የአመክንዮ ደረጃዎች በሞዴሉ እና በCLI ላይ የተመሰረቱ ናቸው። የአቅራቢው ነባሪ ከግልጹ none ቶከን የተለየ ነው።

ለውጦችን የሚተገብሩት ከጀርባ እውቅና ከተሰጠ በኋላ ብቻ ነው። በንቁ ተራ ወይም ባዶ ባልሆነ ወረፋ ወቅት መቀያየር የተገደበ ነው። ረቂቆች እና የሚታየው ታሪክ ይቀራሉ፣ ነገር ግን አቅራቢዎችን መቀየር የግል የውስጥ ሁኔታቸውን አያስተላልፍም።

በForge ውስጥ፣ የሚናው ስያሜ አስፈላጊ ነው፡ ዝግጅት የተለየ አቅራጅ (Planner) ሊጠቀም ይችላል። ግርጌው የሚታየውን ሚና ይለውጣል፤ ገምጋሚዎች እና ረዳቶች በስራ ፍሰት ቅንብሮች ውስጥ ይመረጣሉ። ቀድሞውኑ ለተረጋገጠ አተገባበር ፖሊሲ ሊቆለፍ ይችላል።

ፈቃዶች በአቅራቢዎች መካከል ይለያያሉ። አስማሚው በሚደግፍበት ቦታ ተነባቢ ብቻ እና የስራ ቦታ ጽሁፍ ይገኛሉ። Antigravity አገር በቀል የCLI ቅንብሮችን ወይም በግልጽ የተመረጠ ሙሉ መዳረሻን ይጠቀማል። ሙሉ መዳረሻ ማጠሪያ (sandbox) አይደለም።

ልዩ ሙያ የጥያቄ መመሪያን ይጨምራል እንጂ ሌላ ሞዴል ወይም ፈቃድ አይደለም። ቅድመ-ቅምጦች እና ሚናዎች ምንም፣ መደበኛ፣ Auto እና በእጅ ይደግፋሉ። Auto ያለ ተጨማሪ የሞዴል ጥሪ ከደረጃ ጽሁፍ መገለጫዎችን ይመርጣል፤ በእጅ እስከ አራት ልዩ ሙያዎችን እና ብጁ መመሪያዎችን ይቀበላል። በአቅራጅ የቀረቡ ምደባዎች እቅዱን ከመቀበልዎ በፊት ሊታረሙ ይችላሉ።

በእጅ የገባ ሞዴል ID ወይም ጥረት የእርስዎ ምርጫ ሆኖ ይቆያል፣ ነገር ግን አቅራቢው ውድቅ ሊያደርገው ይችላል። ዓለም አቀፍ ቅድመ-ቅምጥን ማረም የሚሰራን ቻት ወይም ተቀባይነት ያለው እቅድ ወደ ኋላ ተመልሶ አይለውጥም። ስራ ፈት የሆነን ውይይት ሆን ብለው ለመቀየር የራሱን የውቅር መቆጣጠሪያዎች ይጠቀሙ እና እውቅና እስኪያገኝ ይጠብቁ። የአካል ጉዳተኛ (የቦዘነ) አማራጭ እንደ ችሎታ ወይም የሕይወት ዑደት ገደብ መነበብ አለበት እንጂ የተቀመጠውን JSON በማረም መታለፍ የለበትም።

ተዛማጅ መመሪያዎች: [የአቅራቢ ችሎታዎች](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## ቻቶች፣ አቁም እና ወረፋው

ክፍት ትሮች፣ የቅርብ ጊዜ እና ረቂቆች የአንድ ተግባር ናቸው። ትርን መዝጋት ከክፍት ያስወግደዋል ነገር ግን በቅርብ ጊዜ ውስጥ ያቆየዋል፣ እና የአቅራቢውን ሂደት ወይም የሚተዳደር የስራ ፍሰትን አያቆምም። ታሪክን ይፈልጉ፣ ቻትን እንደገና ይክፈቱ ወይም ሁሉንም ተጨማሪ ትሮች ከታሪክ ምናሌው ይዝጉ።

አቁም የአሁኑን ተራ ያቋርጣል። ከሚቀጥለው ላክ በፊት ማቆም እስኪያበቃ ድረስ ይጠብቁ፡ የማቋረጥ ማረጋገጫ የሂደት መጠናቀቅ አይደለም። እስከዚያው ድረስ የሚቀጥለውን ረቂቅ መተየብ ይችላሉ።

በተለመደው ቻት ውስጥ፣ ወረፋ ከአሁኑ ረቂቅ ተለይቶ በኋላ የሚቀርብ ጥያቄን ያስቀምጣል። ወረፋን ለአፍታ አቁም ተጨማሪ ማድረስን ይይዛል። አቁም እና ውጣ ወረፋውን ለአፍታ ያቆማሉ። እንደገና ከጀመሩ በኋላ በመጀመሪያ ቀጥል ያድርጉ፣ ከዚያም ወረፋውን በግልጽ አስቀጥል።

እርግጠኛ ያልሆነ ማለት ማድረሱ አይታወቅም ማለት ነው። እንዲህ ዓይነቱ መልእክት በራስ-ሰር እንደገና አይላክም፡ ታሪኩን ይመርምሩ፣ ተገቢ ከሆነ ጽሁፍ ይቅዱ እና በወረፋ የተያዘውን ንጥል ያሰናብቱ። እንደገና መላክ አዲስ ሆን ተብሎ የሚደረግ ጥያቄ ነው።

የሚተዳደሩ የደረጃ ቻቶች የተለመደውን ወረፋ ሳይሆን የስራ ፍሰታቸውን ይጠቀማሉ። ደረጃን ተከተል የአሁኑን ምዕራፍ ያሳያል፤ ሌላ ትርን እራስዎ መምረጥ መከተልን ያቆማል። የCLI ምዝግብ ማስታወሻዎች ከምላሹ ተለይተው ምርመራዎችን ያሳያሉ።

የማርክዳውን ምላሾች አርዕስቶችን፣ ዝርዝሮችን፣ ሰንጠረዦችን፣ አገናኞችን እና የታጠረ ኮድ ያሳያሉ። የመሳሪያ ካርዶች እና የCLI ምርመራዎች ከመልሱ ተለይተው ይቆያሉ። በአምሳያው የተዘገቡ የአስተሳሰብ እና የቶከን መለኪያዎች የሚታዩት አቅራቢው በትክክል ሲያሳያቸው ብቻ ነው፤ ከአኒሜሽን የግል አመክንዮ ወይም አጠቃቀምን አይገምቱ።

እርግጠኛ ካልሆነ የመላክ ወይም የወረፋ ማረጋገጫ በኋላ፣ ታሪክን ይመርምሩ እና በሚቀርብበት ጊዜ ተመሳሳይ የተቀመጠ ጥያቄን ብቻ እንደገና ይሞክሩ። የወረፋ ደረሰኝ ማለት ማከማቻው ንጥሉን ተቀብሏል ማለት ነው እንጂ ማስተዋል (inference) አልቋል ማለት አይደለም። እርግጠኛ ያልሆነ በወረፋ የተያዘ ንጥልን እንደ ግልጽ ማሰናበት ብቻ ያስወግዱ፤ አስቀድሞ የተላለፈን ጥያቄ መመለስ አይችልም።

ተዛማጅ መመሪያዎች: [ዘላቂ የመልእክት ወረፋ](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## ፋይሎች፣ Git እና ማጠናቀቅ

ፋይሎች የተግባር አቃፊውን ያሳያል። ውጤቶችን ከመስፈርቶች ጋር ያወዳድሩ፣ ሰነዶችን ይክፈቱ እና ልዩነቶችን (diffs) ይመርምሩ። የሁለትዮሽ ፋይልን ማቆየት በዒላማው መተግበሪያ ውስጥ ትክክለኛ አቀራረብን አያረጋግጥም።

Git ሁኔታን፣ ለውጦችን እና ስራዎችን ከተመዘገቡ ውጤቶች ጋር ያቀርባል። Commit፣ merge እና push በነባሪ በእጅ ናቸው፤ አውቶማቲክ ስራዎች ሙሉ በሙሉ ለተረጋገጠ እቅድ የተለዩ ምርጫዎች ናቸው።

በማረጋገጫ እና በህትመት መካከል የሚሰሩ ፋይሎችን አይቀይሩ፡ ማጽደቅ ከትክክለኛ ባይቶች ጋር የተሳሰረ ነው። ግጭቶች፣ ያልተሳኩ pushዎች እና ያልታወቁ የስራ ውጤቶች ግልጽ ውሳኔ እስኪሰጥ ድረስ እድገትን ያግዳሉ። Auto ማተምን በጸጥታ አይፈቅድም።

Work ምንም የGit ቅርንጫፎችን አይፈጥርም እና ምንም የGit ማጠናቀቂያ የለውም። ስሪቶችን እና ምንጮችን ጨምሮ አስፈላጊ ሰነዶችን ከተመረጠው አቃፊ ያቆዩ።

የፋይል አርታዒው በቅጥያ አገባብ፣ ፍለጋ እና መተካት፣ የመቀልበስ ታሪክ፣ የመስመር መጠቅለያ እና በአንድ ትር ረቂቆችን ያቀርባል። ማስቀመጥ የሚደገፈውን የUTF-8/UTF-16 ኢንኮዲንግ ይጠብቃል እና የውጭ ማሻሻያ ግጭቶችን ውድቅ ያደርጋል። ሌሎች ኢንኮዲንጎች እና የሁለትዮሽ ይዘቶች የውጭ አርታዒ ያስፈልጋቸዋል። ያልተቀመጡ ረቂቆች ባለቤቱ እስኪያድናቸው ወይም እስኪያጠፋቸው ድረስ የመተግበሪያውን መውጣት (Quit) ይከላከላሉ።

ሙሉ አገባብ እስከ 8 MiB ድረስ ነቅቷል። ትላልቅ የጽሁፍ ፋይሎች በ256 KiB መስኮቶች ውስጥ ይከፈታሉ፤ 8–64 MiB ያለ አገባብ ሙሉ በሙሉ በግልጽ ሊጫኑ ይችላሉ። ከ64 MiB በላይ የመስኮት አርትዖት እና የተገደበ የቀጣይ-ግጥሚያ ፍለጋን ይጠቀሙ። ይህ የተገደበ ትልቅ-ፋይል ሁነታ ነው እንጂ በዘፈቀደ ትላልቅ ሰነዶች የSublime Text እኩልነት አይደለም።

አቃፊ ክፈት ዋናውን ማከማቻ (repository) ብቻ በጸጥታ ከመክፈት ይልቅ የአሁኑን ተግባር ወይም የቅርንጫፍ/የስራ ዛፍ አውድ ይጠቀማል። የፋይል ረድፍ የዚያን ፋይል የወላጅ ማውጫ ሊያሳይ ይችላል። መንገዶች በተመዘገቡ የተግባር ድጎማዎች ላይ በጀርባ (backend) ይረጋገጣሉ። የሁለትዮሽ ፋይሎች እንደ ተራ ጽሁፍ ሊታረሙ አይችሉም፤ የታለመውን መመልከቻ ይጠቀሙ እና የመጀመሪያዎቹን ባይቶች ያቆዩ።

የስራ ዛፍ ማስወገድ የተለየ ጥበቃ የሚደረግበት እርምጃ ነው። ስራ ፈት የሆኑ ክፍለ-ጊዜዎችን ጨምሮ ከማስወገድዎ በፊት የተያያዙ የተዋቀሩ ክፍለ-ጊዜዎችን እና ተርሚናሎችን ያጠናቅቁ። የተቀመጠውን የGit ውጤት እና የመልሶ ማግኛ ሁኔታ ይመርምሩ፤ የተግባር መዝገብን መሰረዝ ያልተፈጸመውን (uncommitted) ስራ በጥንቃቄ ለመጠበቅ ምትክ አይደለም።

ተዛማጅ መመሪያዎች: [የተተየበ የአርታዒ ውል](../../../shared/editor.ts) · [የGit ፖሊሲዎች](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> ሙሉው መመሪያ እስካሁን ወደ እርስዎ የበይነገጽ ቋንቋ አልተተረጎመም። የእንግሊዝኛ ማመሳከሪያው እየታየ ነው።

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

ተዛማጅ መመሪያዎች: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## ቅንብሮች፣ ቋንቋዎች እና ደህንነቱ የተጠበቀ ዳግም ማስጀመር

አጠቃላይ ቅንብሮች የስራ ቦታን፣ የበይነገጽ ቋንቋን እና ነባሪዎችን ይመርጣሉ። ግንኙነቶች የAPI የመጨረሻ ነጥቦችን ያስተዳድራል። ቅድመ-ቅምጦች እና የግምገማ ቡድኖች የሚና አወቃቀሮችን ያቆያሉ። የርቀት መቆጣጠሪያ የአካባቢ ምስክርነቶችን፣ የአገልጋይ ወሰን እና የባለቤት ፈቃዶችን ያስተዳድራል፤ ዝመናዎች የልቀት ምንጭን/ቻናልን ያስተዳድራል። ስለ የሚለው ትክክለኛውን የሚሰራ ግንባታ ያሳያል።

የበይነገጽ ቋንቋ ከመጠየቂያ ቋንቋ እና ከሰነድ ግምገማ ሁኔታ የተለየ ነው። የምርት ስሞች፣ የትዕዛዝ መለያዎች፣ የፋይል ቅጥያዎች፣ የአቅራቢ ሞዴል መለያዎች እና በተጠቃሚ የተፈጠሩ ስሞች መለያዎች ሆነው ይቀራሉ። ወቅታዊ ትርጉም ሲገኝ እገዛ የተመረጠውን የበይነገጽ ቋንቋ ይከተላል፤ የማሽን ትርጉሞች ምልክት ይደረግባቸዋል እንዲሁም እንግሊዝኛ ይፋዊ ማጣቀሻ ሆኖ ይቆያል።

አስቀምጥ የሚታየውን ውቅር ተግባራዊ ያደርጋል። የውሂብ ጎታ ዳግም ማስጀመር ወይም የፋብሪካ ዳግም ማስጀመር የመተግበሪያ ሜታዳታን ሊያስወግድ ይችላል፤ ዳግም ማስጀመርን ሆን ብለው ከመጠቀምዎ በፊት ፋይሎችን እና የተሞከረ ምትኬን ይጠብቁ። እነዚህ ክዋኔዎች የአካባቢው ባለቤት እርምጃዎች ናቸው። ያልተሳካ የስራ ፍሰትን ወይም የተበላሸ መዝገብን ለመመርመር እንደ አቋራጭ መንገድ አይጠቀሙባቸው።

ተዛማጅ መመሪያዎች: [የአካባቢያዊነት መመሪያዎች](../../LOCALIZATION.md) · [የውሂብ መልሶ ማግኛ](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## የእገዛ ረዳቱን ይጠይቁ

እገዛን ይክፈቱ፣ በረዳቱ ፓነል ውስጥ የተቀመጠ የተገናኘ ቅድመ-ቅምጥ ይምረጡ እና ስለ ZIAForge ይጠይቁ። ምላሾች የአሁኑን ይፋዊ የእንግሊዝኛ መመሪያ እና የመረጡትን የበይነገጽ ቋንቋ ይጠቀማሉ። የክፍል ማጣቀሻ አዝራሮች አግባብ የሆኑትን የመመሪያ ርዕሶች ይከፍታሉ፣ ስለዚህ ማብራሪያውን ከማጣቀሻው ጋር ማወዳደር ይችላሉ።

ይህ ረዳት እስከ 100 የተቀመጡ ግቤቶች እና 3 MiB ድረስ የተለየ የግል ውይይት ይይዛል። እስከ 12,000 ቁምፊዎች የሚደርስ ጥያቄ ያስገቡ፤ ላክ ይጠይቀዋል፣ አቁም ጥያቄዎ እንዳለ ሆኖ ንቁውን ምላሽ ይሰርዛል፣ እና አጽዳ ደግሞ ይህንን የእገዛ ውይይት ያስወግዳል። ያልተላከው ረቂቅዎ እና የቅድመ-ቅምጥ ምርጫዎ በእዚያው የመተግበሪያ ክፍለ-ጊዜ ውስጥ እገዛን መዝጋት ወይም እንደገና መክፈትን ይቋቋማሉ፣ ነገር ግን ረቂቁ በዲስክ ላይ አይቀመጥም። ረዳቱ የመተግበሪያ ትዕዛዞችን አይልክም፣ የስራ ፍሰትን አይለውጥም ወይም በርን አያጸድቅም። ምክር የተግባር፣ መለያ ወይም የውጭ ግንኙነት የቀጥታ ማረጋገጫ አይደለም።

የClaude Code እና API እገዛ ክፍለ-ጊዜዎች የሚደገፈውን ከመሳሪያ-ነጻ ፖሊሲ ያስፈጽማሉ። የአካባቢ Codex እና Antigravity እገዛ ክፍለ-ጊዜዎች ነባሩን የአካባቢው ባለቤት የኮምፒውተር ፈቃድ ይፈልጋሉ። ከተሰናከለ መተግበሪያው የተለየ አቅራቢ ከመምረጥ ይልቅ ቅድመ-ሁኔታውን ያብራራል። በአካባቢው የቁጥጥር ቅንብሮች ውስጥ ሊያነቃው የሚችለው ባለቤቱ ብቻ ነው፤ ረዳቱ በራሱ ሊያነቃው አይችልም።

የCodex እገዛ ተነባቢ-ብቻ ማጠሪያን ይጠቀማል እንዲሁም የመሳሪያ-ማጽደቂያ ጥያቄዎችን ውድቅ ያደርጋል። Antigravity የዕቅድ ሁነታን እና የአካባቢውን የማጠሪያ ባንዲራ ይጠቀማል። እነዚህ የአካባቢ ሁነታዎች ሁለንተናዊ የስርዓተ-ክወና መገደብ ዋስትና አይደሉም። የምንጭ-መመሪያው ሃሽ ለመልሱ ጥቅም ላይ የዋለውን ማጣቀሻ ይለያል፤ የተፈጠረ ማብራሪያ አሁንም ሊሳሳት ይችላል፣ ስለዚህ እርምጃ ከመውሰድዎ በፊት የተገናኙትን ክፍሎች ይመርምሩ። የቆዩ መልሶች የምንጭ-መመሪያ ስሪታቸው ከአሁኑ መመሪያ ሲለይ ምልክት ይደረግባቸዋል።

ተዛማጅ መመሪያዎች: [ይፋዊ መመሪያ እና የትርጉም ጥገና](../../HELP_MAINTENANCE.md) · [የመተግበሪያ ረዳት እና ፈቃዶች](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## ረዳት እና Telegram

ረዳቱ የተመረጠውን ቅድመ-ቅምጥ እና ያንኑ የመተግበሪያ ቁጥጥር API ይጠቀማል። ሁኔታን የመመርመር ፈቃድ እና ክዋኔዎችን የማከናወን ፈቃድ የተለያዩ ናቸው። ትዕዛዞችን እና ውጤቶችን ይመርምሩ፦ የረዳቱ ጽሑፍ አንድ ድርጊት መጠናቀቁን የሚያረጋግጥ ማስረጃ አይደለም።

Telegram የሚነቃው በአካባቢው ባለቤት ብቻ ሲሆን፣ ይህም ነባር የቦት ቶከን እና የባለቤቱን የቁጥር መለያ ID ይጠይቃል። ቁጥጥሩ ለዚያ ባለቤት የግል ውይይት ብቻ የታሰበ ነው። ያልተዋቀረ ወይም የማይሰራ ቦት የመተግበሪያ መልዕክቶችን መቀበል የለበትም።

የቦት ቶከንን ወደ ተራ ውይይት ውስጥ አይለጥፉ። ውህደቱን ማዋቀር የTelegram ግንኙነት መኖሩን አያረጋግጥም፣ እንዲሁም ቦትን በራሱ አይፈጥርም። ቅጽበታዊ ገጽ እይታዎች እና ምላሾች የግል የስራ ቦታ ውሂብ ሊይዙ ይችላሉ።

የረዳት ቅድመ-ቅምጥ ይምረጡ እና ከመመርመር ፈቃድ ውጭ የመተግበሪያ ክዋኔ ፈቃድን ለብቻው ይስጡ። የCodex እና Antigravity ረዳት አፈጻጸም የባለቤቱን የአካባቢ ኮምፒውተር ፈቃድ ይፈልጋሉ፤ ያለ መሳሪያ በሚሰሩ የAPI ወይም Claude ክፍለ-ጊዜዎች በድብቅ አይተኩም። ቅጽበታዊ ገጽ እይታዎች በረዳቱ ውይይት ውስጥ ሊታዩ ይችላሉ፣ ነገር ግን አሁን ያለው ሞዴል ግብዓት የምስል ትንተናን አያካትትም። ረዳቱ ምስሉን ስላሳየ ብቻ ምስሉን በዕይታ መርምሮታል ብለው አያስቡ።

ረዳቱ በተገለጹ መሳሪያዎች በኩል ማጠቃለያዎችን፣ ተግባራትን፣ ውይይቶችን፣ የስራ ፍሰት ሁኔታን፣ የሂደት አውድን እና የመተግበሪያ መስኮቶችን መመርመር ይችላል። የተፈቀዱ መደበኛ ቅንብሮችን መለወጥ እና የተፈቀዱ የመተግበሪያ ክዋኔዎችን ማስጀመር ይችላል። የአካባቢ ኮምፒውተር መብቶችን መስጠት፣ የተቀመጡ ምስጢራዊ መረጃዎችን ማጋለጥ፣ የስራ ቦታ ስር ፍቃድን በርቀት መቀየር ወይም አመቺ ስለሆነ ብቻ የForge በር ማጽደቅ አይችልም።

ተዛማጅ መመሪያዎች: [የመተግበሪያ ቁጥጥር ውል](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## የእርስዎን የግል Telegram ቦት ያንቀሳቅሱ

የራስዎን ቦት ይፍጠሩ ወይም ያግኙ፣ የግል ውይይቱን ያስጀምሩ፣ እና ቶከኑን እንዲሁም የቁጥር Telegram ተጠቃሚ IDን በአካባቢው የቁጥጥር ቅንብሮች ውስጥ ያስገቡ። መተግበሪያው እንዲገናኝ በሚፈልጉበት ጊዜ ብቻ ውህደቱን ያንቁ። የባለቤቱ ID የተጠቃሚ መለያ እንጂ የተጠቃሚ ስም ወይም የቦት ID አይደለም። በዚያው የግል ውይይት ውስጥ ከዚያ ተጠቃሚ የሚመጡ መልዕክቶች ብቻ ተቀባይነት ያገኛሉ።

ስለሚሰራው ስሪት፣ የፕሮጀክት/ተግባር ብዛት እና የተግባር ሁኔታዎች አጠቃላይ እይታ ለማግኘት /start፣ /menu ወይም /statusን ይጠቀሙ። አዝራሮች ፕሮጀክቶችን፣ ተግባራትን፣ ቅጽበታዊ ገጽ እይታን፣ እገዛን እና ቋንቋን ይከፍታሉ። ዝርዝሮች በገጽ ስምንት ንጥሎችን ከኋላ፣ አድስ፣ መነሻ እና ቀዳሚ/ቀጣይ አሰሳ ጋር ያሳያሉ። የፕሮጀክት አዝራሮች የተግባር ዝርዝሩን ያጣራሉ፤ የተግባር ካርድ የተቀመጠውን የስራ ፍሰት ሂደት፣ ሞዴል/ቅድመ-ቅምጥ እና ሲኖሩ የሚጠበቁ ጥያቄዎችን ያሳያል።

ክፍት/የቅርብ ጊዜ ውይይቶችን እና የስራ ፍሰት ምዕራፍ ውይይቶችን አስቀድመው ለማየት የተግባሩን ውይይቶች ይክፈቱ። እያንዳንዱ ቅድመ-ዕይታ እስከ ስድስት የቅርብ ጊዜ የተጠቃሚ/ረዳት መልዕክቶችን ያሳያል፣ እያንዳንዳቸው በሚታይ ሁኔታ ወደ 200 ቁምፊዎች አጥረዋል። የግል አስተሳሰብ አይታይም። ታሪክን ማንበብ አቅራቢን አያስጀምርም። ቅድመ-ዕይታዎች ተነባቢ-ብቻ ናቸው፦ መደበኛ ጽሑፍ እና /ask TEXT አሁንም የመተግበሪያውን ረዳት ያነጋግራሉ እንጂ እርስዎ እየተመለከቱት ያለውን የተግባር ውይይት በድብቅ አያነጋግሩም።

አስኪድ / ቀጥል የአሁኑን የCode ወይም Work የስራ ፍሰት እንደገና ያነባል እንዲሁም ብቁ የሆነ የተቀመጠ የስራ ፍሰት ያስጀምራል። ለአፍታ አቁም እንዲቆም ይጠይቃል። የትኛውም መስፈርቶችን፣ ዝርዝር መግለጫን፣ እቅድን፣ የግምገማ ግኝቶችን ወይም ጥያቄዎችን አይቀበልም፤ ውሳኔ የሚጠብቅ ጉዳይ ማስኬድን ይከለክላል። ውሳኔዎችን በመተግበሪያው ውስጥ ያድርጉ፣ ወይም በትክክለኛው የአሁኑ በር እና ክለሳ በግልጽ የተፈቀደ የተገለጸ ትዕዛዝ ይጠቀሙ።

ማንኛውንም የ56 የበይነገጽ ቋንቋዎች በዋና ስሙ ለመምረጥ ቋንቋ ወይም /languageን ይጠቀሙ። ይህ ለዚህ ቦት እና ባለቤት ብቻ ምርጫን ያቆያል። የመተግበሪያ ቋንቋ ተጠቀም ያንን ምርጫ ያጸዳል። የመተግበሪያውን ቋንቋም ሆነ የመዳረሻ ፈቃዶችን አይለውጥም፤ ነባር መልዕክቶች በራስ-ሰር ዳግም አይላኩም።

አሰሳ በመደበኛነት ያንኑ የታተመውን የምናሌ መልዕክት ያዘምናል፤ አዝራሮች ከ15 ደቂቃዎች በኋላ የሚያበቁ እና አንድ ጊዜ ብቻ ጥቅም ላይ ሊውሉ የሚችሉ ግልጽ ያልሆኑ መለያዎች አሏቸው፤ ካርድን መቀየር የድሮ አዝራሮቹን ውድቅ ያደርጋል። ጊዜያቸው ያለፈባቸው፣ ጥቅም ላይ የዋሉ፣ የማይዛመዱ እና የቀድሞ ሂደት አዝራሮች እርምጃ ማከናወን አይችሉም። በእርግጠኝነት ሊስተካከል የማይችል መልዕክት በአዲስ ካርድ ሊተካ ይችላል፤ ያልታወቀ የአውታረ መረብ ስህተት እንደ አዲስ መልዕክት በድጋሚ አይሞከርም።

በሚነሳበት ጊዜ ፖለሩ የቀደመውን ክምችት ያስወግዳል እንዲሁም ከመላኩ በፊት የዝመና ተቀባይነትን ይመዘግባል፣ ስለዚህ የተቋረጡ ትዕዛዞች እንደገና ሲጀመር በራስ-ሰር አይደገሙም። ይህ ድግግሞሽን ይከላከላል፤ መጠናቀቅን ዋስትና አይሰጥም። ከስህተት በኋላ ሆን ብለው አዲስ ስራ ከመስጠትዎ በፊት ሁኔታን/አውድን ያረጋግጡ። ምንም አውቶማቲክ የተግባር-ሁኔታ ማሳወቂያዎች የሉም።

ግልጽ ትዕዛዞች እንደተገኙ ይቆያሉ፦ /projects፣ /tasks፣ /task TASK_ID፣ /run TASK_ID፣ /pause TASK_ID፣ /screenshot እና /ask TEXT። /new {JSON} በተገለጸ createTask በኩል ተግባር ይፈጥራል፤ /command {JSON} ይፋዊ የካታሎግ ትዕዛዝ ይልካል። ለክርክር ቅርጾች የቀጥታ ካታሎጉን ያንብቡ። በመተግበሪያው ውስጥ እንዳለው ተመሳሳይ የጀርባ ፈቃድ እና የአቃፊ ፈቃዶች ተፈጻሚ ይሆናሉ።

መተግበሪያው የተቀመጡ የቦት-ቶከን እሴቶችን በጭራሽ ወደ ረዳቱ አይልክም። ሆኖም ቅጽበታዊ ገጽ እይታዎች፣ ማጠቃለያዎች እና የውይይት ጽሑፎች የግል የፕሮጀክት መረጃ ሊይዙ ይችላሉ። ቦቱ ወይም የባለቤቱ መለያ የማይታመን ከሆነ ውህደቱን በአካባቢው ያቁሙ። የፈሰሰውን ቶከን ከቦት አቅራቢው ጋር ይቀይሩ፣ ከዚያ በአካባቢው የተመሰጠረውን ውቅር ያዘምኑ።

ተዛማጅ መመሪያዎች: [የግል ቦት እና ትዕዛዞች](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## የባለቤት-ብቻ የአካባቢ ኮምፒውተር ፈቃድ

የአካባቢ ኮምፒውተር መዳረሻ ተሰናክሎ ይጀምራል። በአካባቢ ቅንብሮች → የርቀት መቆጣጠሪያ ውስጥ ሊያነቃው የሚችለው ባለቤቱ ብቻ ነው። ረዳቱ እና የHTTP/MCP/Telegram ትዕዛዞች ይህንን ባንዲራ ለራሳቸው ማንቃት አይችሉም። ክዋኔ ከተከለከለ፣ ረዳቱ ቅንብሩን መግለጽ እና ባለቤቱ እንዲወስን መተው አለበት።

በግልጽ ሲነቃ፣ computer.run ተፈጻሚ ፋይልን፣ የክርክር ድርድርን እና አማራጭ ፍጹም የስራ ማውጫን ይቀበላል። ምንም የሼል መግቢያ አይጠቀምም፣ የ30 ሰከንድ ገደብ አለው እንዲሁም ውጤቱን በ1 MiB ይገድባል። የቀረበ የጎደለ ወይም ልክ ያልሆነ ማውጫ ውድቅ ይደረጋል፤ cwdን መተው የመተግበሪያው የሆነውን የቅንብሮች ማውጫ ይጠቀማል እንጂ HOMEን አይደለም። መውጣት ንቁ የሆኑ የባለቤትነት ትዕዛዞችን ይሰርዛል እንዲሁም ሂደታቸው እስኪጸዳ ይጠብቃል።

የመተግበሪያ ማንበብ/መስራት ወሰን እና የአካባቢ መዳረሻ የተለያዩ ውሳኔዎች ናቸው። የስራ ዛፍ ያልተገደበ የአቅራቢ ፋይል ስርዓት መዳረሻን አይገድብም። ከአሁን በኋላ የማያስፈልግ ከሆነ ከተግባሩ በኋላ የአካባቢ መዳረሻን ይሰርዙ፣ እና የረዳቱን ጽሑፍ እንደ ማስረጃ ከመቀበል ይልቅ የትዕዛዝ ደረሰኞችን ይመርምሩ።

ተዛማጅ መመሪያዎች: [የባለቤት-ብቻ ቁጥጥር ውል](../../../shared/control.ts).

<a id="remote"></a>

## አሳሽ እና የርቀት ምሳሌዎች

የአካባቢው ባለቤት አገልጋዩን ያነቃል እንዲሁም አድራሻውን፣ ወደቡን እና ወሰኑን ይመርጣል፦ ለመመርመር ማንበብ ወይም ለድርጊቶች መስራት። ነባሪው 127.0.0.1 አድራሻ በዚህ ኮምፒውተር ላይ ብቻ ይገኛል። 0.0.0.0 በአውታረ መረብ በይነገጾች ላይ ያዳምጣል፤ ከማንቃትዎ በፊት የአውታረ መረብ መዳረሻን ይገምግሙ።

አሳሽ በቶከን ከገቡ በኋላ ያንኑ በይነገጽ ይከፍታል። ቶከኖችን በይፋዊ አገናኞች ወይም ቅጽበታዊ ገጽ እይታዎች ውስጥ አያካትቱ። HTTP ብቻውን ትራፊክን አያመሰጥርም፤ ባልተማመነ አውታረ መረብ ላይ የተጠበቀ መስመር ይጠቀሙ።

ባለቤቱ ሌሎች ምሳሌዎችን በURL እና በቶከን ያዋቅራል። የጀርባ አገልጋዩ ጥያቄዎችን ያስተላልፋል፤ ይህ ፕሮጀክቶቻቸውን ወደ አካባቢው ማሽን አይገለብጥም። ከእያንዳንዱ እርምጃ በፊት የተመረጠውን ምሳሌ ያረጋግጡ።

የተገለጹ ትዕዛዞች እና ክስተቶች የመተግበሪያ ቁጥጥርን ያካሂዳሉ። የማንበብ ወሰን የተግባር ለውጦችን አይፈቅድም። የአካባቢ ኮምፒውተር ቁጥጥር የተለየ የአካባቢው ባለቤት ምርጫ ነው እንዲሁም ተሰናክሎ ይጀምራል።

መተግበሪያው ለአሳሽ፣ ለTelegram እና ለውጫዊ ወኪል ቁጥጥር መስራቱን መቀጠል አለበት። እያንዳንዱ ምሳሌ የራሱ የሆነ የግል መገለጫ፣ የተግባር ሁኔታ፣ ቶከን እና የአገልጋይ ወደብ አለው። አንድን መገለጫ ራሳቸውን በቻሉ ምሳሌዎች መካከል በአንድ ጊዜ አይጠቀሙበት። የአሳሽ ክስተቶች እና የትዕዛዝ ምላሾች ለተመረጠው ምሳሌ የተገደቡ ናቸው፤ UIን መቀየር ፋይሎችን አያንቀሳቅስም ወይም የአካባቢ መግቢያን አይገለብጥም።

ተዛማጅ መመሪያዎች: [HTTP እና የምሳሌ ቁጥጥር](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw፣ Hermes እና ሌሎች ውጫዊ ወኪሎች

የተረጋገጠውን የመተግበሪያ ቁጥጥር API ወይም አብሮ የተሰራውን የMCP stdio ድልድይ ይጠቀሙ። አገልጋዩን በአካባቢው ያንቁ፣ ማንበብን ወይም መስራትን ይምረጡ፣ እና እያንዳንዱን ደንበኛ በዚያ ምሳሌ URL እና ቶከን ያዋቅሩ። ራሱን የቻለውን የMCP ድልድይ ለማስኬድ Node.js 22 ወይም አዲስ ያስፈልጋል፤ የElectron መተግበሪያ የእርስዎን የወኪል ደንበኛ አይጭንም። የአሳሹ URL የሚለቀቅ የHTTP MCP መጨረሻ ነጥብ አይደለም፦ ወደ stdio ድልድይ እንደ ZIAFORGE_URL አድርገው ያቅርቡት።

ድልድዩ ziaforge_status፣ ziaforge_commands፣ ziaforge_command እና ziaforge_screenshotን ያጋልጣል። በሁኔታ እና በቀጥታ የትዕዛዝ ዝርዝር ይጀምሩ፣ ከዚያም ለተመረጠው ተግባር system.contextን ያንብቡ። የተገለጹ ትዕዛዞች እንደ አካባቢያዊው UI ተመሳሳይ የክለሳ፣ የበሮች፣ የተግባር አቃፊ እና የጽዳት ፍተሻዎችን ይከተላሉ።

የቀጥታ ትዕዛዝ ዝርዝሩ documentation.guideን፣ ይፋዊውን የእንግሊዝኛ እገዛ፣ ከምንጭ ዱካው እና sourceSha256 ጋር ያካትታል። የውስጥ መተግበሪያ አርክቴክት በመሳሪያዎቹ በኩል ያንኑ ማጣቀሻ ይቀበላል። ይህ ወኪሎች የቆዩ ማስታወሻዎች ላይ ሳይመሰረቱ አጠቃላይ የምርት አውድ እንዲኖራቸው ያደርጋል፤ ሰነዶች ፈቃድ አይሰጡም ወይም የአሁኑን የሰው ውሳኔ አይተኩም።

ወኪሎች ከአጭር የሰው ሃሳብ ተነስተው ስለ መስፈርቶች፣ ቴክኒካዊ ውሳኔዎች እና እቅድ መወያየት አለባቸው። ግልጽ የሰው በሮችን፣ የተመረጡ ሞዴሎችን፣ በእጅ/Auto ፖሊሲን እና አስፈላጊ ግምገማዎችን መጠበቅ አለባቸው። ማጽደቅን መፍጠር፣ እርግጠኛ ያልሆኑ ትዕዛዞችን በአዲስ ID ስር በድጋሚ ማስኬድ ወይም ያለ ባለቤቱ ፍላጎት የGit ለውጦችን ማተም የለባቸውም።

ለተለያዩ ጭነቶች በርካታ ስም የተሰጣቸውን የMCP አገልጋዮች ያዋቅሩ። ምሳሌዎችን መቀየር የማስተላለፍ ውሳኔ እንጂ ማመሳሰል አይደለም። የOpenClaw እና Hermes የማዋቀሪያ ምሳሌዎች በAGENT_CONTROL.md ውስጥ ይገኛሉ፤ ለተጫነው የደንበኛ ስሪት የደንበኛ-ተኮር ቅንብር እና ተኳኋኝነት መረጋገጥ አለበት።

የውጪው የrequestId መሸጎጫ መተግበሪያው በሚሰራበት ጊዜ የተወሰነ የጥያቄዎች ስብስብን ብቻ ነው ድግግሞሽ የሚያስቀረው። ዘላቂ ክዋኔዎች የራሳቸውን መለያዎች ይጠቀማሉ፦ createRequestId ለተግባር ፈጠራ፣ commandId ለስራ ፍሰት ውሳኔዎች፣ clientMessageId ለመልዕክቶች እና operationId ለGit ለውጦች። ካልታወቀ ማረጋገጫ በኋላ የመጀመሪያውን መለያ እና ጭነት ይጠብቁ፤ አዲስ ስራ ሆን ብለው ከመስጠትዎ በፊት የተቀመጠውን ሁኔታ ያንብቡ።

ተዛማጅ መመሪያዎች: [የMCP ደንበኛ መመሪያዎች](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## የአካባቢ CLI እና የአውቶሜሽን ገደቦች

የ ziaf አስተላላፊ ያንኑ የሚሰራ መተግበሪያ እና የተቀመጠ የስራ ፍሰት ይቆጣጠራል። ከምንጩ npm run ziaf -- list፣ npm run ziaf -- status --task TASK_ID --json፣ npm run ziaf -- start --task TASK_ID፣ ወይም npm run ziaf -- pause --task TASK_IDን ይጠቀሙ። የተሳካ የጅማሮ ማረጋገጫ ተግባሩ ተጠናቋል ማለት አይደለም።

--until-success ሆን ብሎ ለተቀመጠው የስራ ፍሰት Autoን ያነቃል፣ ነገር ግን ጥያቄዎች፣ ግምገማ፣ የማጽደቂያ በሮች፣ ገደቦች እና የፍተሻ ነጥቦች አሁንም ተግባራዊ ይሆናሉ። Ctrl+C ታዛቢውን አስተላላፊ ይዘጋል፤ የመተግበሪያውን የስራ ፍሰት በድብቅ አያቆምም። ለመውጫ ኮዶች፣ ለአካባቢው መጨረሻ ነጥብ እና ለመገለጫ አያያዝ CLI.mdን ይመልከቱ።

የአውቶሜሽን በይነገጽ በአሁኑ ጊዜ የማሳያ ፍቺዎችን እና የአካባቢ የማስኬጃ ቆጣሪዎችን ያከማቻል። የተረጋገጠ ተደጋጋሚ መርሐግብር አዘጋጅ አይደለም እንዲሁም የበስተጀርባ ሞዴል ዙር መስራቱን አያረጋግጥም። ለእውነተኛ አፈጻጸም የተቀመጡትን የስራ ፍሰት መቆጣጠሪያዎች፣ ziaf ወይም የተረጋገጠውን API ይጠቀሙ እና ደረሰኞቻቸውን ይመርምሩ። የማሳያ ፓነሉን ካለክትትል ከሚሰራ መርሐግብር ጋር እንዳያምታቱ።

ተዛማጅ መመሪያዎች: [የአስተላላፊ ትዕዛዞች](../../CLI.md).

<a id="updates"></a>

## Version and updates

> ሙሉው መመሪያ እስካሁን ወደ እርስዎ የበይነገጽ ቋንቋ አልተተረጎመም። የእንግሊዝኛ ማመሳከሪያው እየታየ ነው።

Open Settings → Updates and choose Check for updates. The official GitHub repository ZIAForge/ZIAForge and the Stable channel are configured by default. The panel shows the running version and any newer compatible release. Preview includes prereleases; Stable excludes them. Checking never installs an update.

When an update is available, Update downloads the package for this operating system and architecture, verifies its published size and SHA-256, prepares the installer and requests a normal application restart. Save file edits first. Installation is armed only after application services stop, and the installer waits for the current process to exit. Your profile, settings, task history and project files are kept.

Supported installation paths are a writable macOS application bundle, the Windows installer, Linux AppImage and the distribution package manager for DEB/RPM. System installation or authentication prompts may still appear. A development checkout, a read-only or translocated macOS app, or an unsupported portable layout may require manual installation; the panel explains that case and links to the release. Move a macOS application out of the mounted disk image before using in-place updates.

Automatic checking and downloading is optional. When enabled, it checks immediately and every six hours. Installing and restarting remains a separate owner action. A failed download or checksum check retains the existing installation and never runs the downloaded file.

Downloaded package hashes establish that the files match the selected GitHub release. They do not replace code signing or notarization. The updater does not disable operating-system security checks. Repository and channel changes, downloads and installation are local owner actions; remote agents can read update status only.

ተዛማጅ መመሪያዎች: [Application update behavior and installation limits](../../UPDATES.md) · [Release readiness](../../RELEASE_READINESS.md).

<a id="restart"></a>

## ዳግም ማስጀመር እና መልሶ ማግኛ

በmacOS ላይ፣ ሙሉ በሙሉ ለመዝጋት ውጣ / ⌘Q ይጠቀሙ። መስኮቱን መዝጋት መተግበሪያውን እንደሰራ ሊተወው ይችላል። መተግበሪያውን ከመተካትዎ በፊት የድሮውን ስሪት ሙሉ በሙሉ ያቁሙ።

ከተከፈተ በኋላ ያንኑ ተግባር ይምረጡ። ታሪክ እና ረቂቆች ይመለሳሉ። መልሶ መቀጠል የአካባቢውን አውድ ወደነበረበት ይመልሳል ነገር ግን ረቂቅ አይልክም፣ ወረፋውን አያስጀምርም ወይም ያልታወቀ ክዋኔን መድገም አይፈቅድም።

መልሶ ማግኛ ከታየ፣ JSONን በእጅዎ አያርሙ። የተጎዳውን የሰነድ ዓይነት ይመርምሩ፣ ዋናዎቹን ፋይሎች ይጠብቁ እና የተረጋገጠ መጠባበቂያ ይምረጡ። የቆየ ወረፋን ወደነበረበት መመለስ ንጥሎቹን እርግጠኛ እንዳልሆኑ ምልክት ያደርግባቸዋል።

አቅርቦት በማይታወቅበት ጊዜ፣ የሚተዳደር የስራ ፍሰት ለአዲስ አውድ ግልጽ ፈቃድ ሊያስፈልገው ይችላል። የቀድሞ ስራ እና ያልተሳኩ ሙከራዎች ይቀራሉ፤ የሚታይ እምቢታ ከተፈበረከ ስኬት የበለጠ አስተማማኝ ነው።

ሁሉም የመተግበሪያ ምሳሌዎች ተዘግተው ሳሉ የተግባር ፋይሎችን እና የመተግበሪያ መገለጫን ምትኬ ያስቀምጡ። የተገለበጠ አቃፊ የተሞከረ መልሶ ማግኛ አይደለም። መልሶ ማግኛ የተረጋገጠ መጠባበቂያ እንዲመርጡ ከጠየቀዎት፣ ትክክለኛዎቹን የተበላሹ ፋይሎችም ያቆዩ። የቆየ የስራ ፍሰት ወይም ወረፋ ወደነበረበት መመለስ እርግጠኛ ያልሆነ ግምትን ወይም የGit ክዋኔዎችን በድጋሚ ለማስኬድ ፈቃድ አይሰጥም።

ተዛማጅ መመሪያዎች: [የመልሶ ማግኛ ውል](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## ችግር መፍታት

CLI አልተገኘም፦ በመደበኛ ተርሚናል ውስጥ ጭነቱን እና ስሪቱን ያረጋግጡ፣ ከዚያ ZIAForgeን እንደገና ያስጀምሩ። ተፈጻሚ ፋይል መኖሩ ገብተዋል ማለት አይደለም። የአቅራቢውን የራስዎን የመግቢያ ዘዴ ይጠቀሙ።

ሞዴል አይገኝም ወይም ማረጋገጫ አልተሳካም፦ ግኝትን ያድሱ፣ የሚገኝ ID ይምረጡ እና መለያዎን እና ገደቦችዎን ያረጋግጡ። ታሪኩን ከመመርመርዎ በፊት እርግጠኛ ያልሆኑትን ጥያቄ አይደግሙ።

የስራ ፍሰት ቆሟል፦ የአሁኑን ምዕራፍ፣ ጥያቄ፣ የማረጋገጫ ደረሰኝ ወይም የCLI ምዝግብ ማስታወሻዎችን ይክፈቱ። የተወሰነውን ምክንያት ይፍቱ፦ ያልተመለሰ ጥያቄ፣ ትዕዛዝ፣ የአቃፊ ፈቃድ ወይም የሙከራ ገደብ። መቀጠል ያልተሳካ ፍተሻን ወደ ስኬት ሊለውጠው አይችልም።

አቃፊ ጠፍቷል ወይም ተተክቷል፦ ወደ ዋናው አቃፊ መዳረሻን ይመልሱ ወይም አዲስ ተግባር ይፍጠሩ። መተግበሪያው ከHOME መቀጠል የለበትም። ሌላ cwd ከተመለከቱ፣ ዙሩን ያቁሙ እና ምርመራዎችን ይጠብቁ።

ለሪፖርት፣ የስለ ስሪቱን፣ መስመሩን፣ CLI/ሞዴልን፣ የሚጠበቀውን እና ትክክለኛውን ባህሪ፣ ቅጽበታዊ ገጽ እይታን እና አስተማማኝ የምዝግብ ማስታወሻ ቅንጭብን ያካትቱ። ሊታተሙ የማይችሉ ምስጢሮችን፣ የግል ይዘቶችን እና ዱካዎችን ያስወግዱ።

የርቀት ገጽ አይገኝም፦ ባለቤቱ አገልጋዩን ማብራቱን ያረጋግጡ፣ የሚያዳምጠውን አድራሻ እና ወደብ ይፈትሹ፣ ከዚያ በትክክለኛው የምሳሌ ቶከን ያረጋግጡ። 401 ማረጋገጫን ያሳያል፤ የተከለከለ ለውጥ የማንበብ ወሰን ወይም የባለቤት-ብቻ ቁጥጥር ሊሆን ይችላል። ቶከኑን መቀየር ነባር የአሳሽ ደንበኞችን ይዘጋል። የተለየውን የ DevTools መመርመሪያ ወደብ እንደ የርቀት መተግበሪያ ቁጥጥር አያጋልጡ።

የአርታዒ ማስቀመጥ ተከልክሏል፦ ረቂቁን ያቆዩ፣ በዲስክ ላይ ያለውን የአሁኑን ፋይል ይመርምሩ እና የውጭ-ለውጥ ግጭትን ይፍቱ። የመተግበሪያ ሜታዳታን እንደገና በመጻፍ ንጽጽሩን አያልፉ። የትላልቅ ፋይሎች ሙሉ ጭነት የማይገኝ ከሆነ፣ የሚደገፈውን የመስኮት አርትዖት/ፍለጋ ወይም ውጫዊ አርታዒ ይጠቀሙ።

Telegram አይገኝም፦ የቦት ቶከኑን፣ የቁጥር ባለቤቱን፣ የግል ውይይቱን እና ሁኔታውን በአካባቢው ያረጋግጡ። ተፎካካሪ ዌብሁክ ወይም ፖለር ምርጫን ሊያግድ ይችላል፤ ZIAForge በራስ-ሰር ዌብሁክን አይሰርዝም ወይም ሌላ ፖለርን አይቆጣጠርም። ባልታወቀ ወሰን ላይ ውድቅ የተደረጉ ወይም የተቋረጡ ትዕዛዞች በራስ-ሰር አይደገሙም።

ተዛማጅ መመሪያዎች: [ሙከራ እና ምርመራ](../../TESTING.md).

<a id="diagnostics"></a>

## ችግሮችን ሪፖርት ያድርጉ እና ማስረጃዎችን ይመርምሩ

ትክክለኛውን የሚሰራ ግንባታ ከስለ ዝርዝር፣ OS/አርክቴክቸር፣ የተግባር ሁነታ፣ የተመረጠ አቅራቢ/ሞዴል እና ችግሩን መልሰው የሚያስነሱትን እርምጃዎች ይመዝግቡ። የሚጠበቀውን ውጤት እና የታየውን ውጤት ይግለጹ። ሙሉ የግል መገለጫ ከማጋራት ይልቅ፣ ደህንነቱ የተጠበቀ ቅጽበታዊ ገጽ እይታ እና አግባብ ያለው የተቀመጠ ትዕዛዝ ወይም የማረጋገጫ ደረሰኝ ያካትቱ።

የCLI ምዝግብ ማስታወሻዎች፣ የክስተት መዝገቦች፣ የሞዴል ግልባጮች፣ የአሳሽ ዱካዎች እና ቅጽበታዊ ገጽ እይታዎች የምንጭ ኮድን፣ የግል ዱካዎችን ወይም ቶከኖችን ሊያጋልጡ ይችላሉ። ከማጋራትዎ በፊት ይመርምሩ እና አደገኛ ውሂብን ያጥፉ። የተቻለውን ያህል ጥረት የሚያደርግ የምዝግብ ማስታወሻ አጣሪ ቅጽበታዊ ገጽ እይታ ወይም ማህደር ለህዝብ የሚጋራ መሆኑን አያረጋግጥም።

ለአስተዋጽዖ አበርካቾች፣ qa:doctor የአካባቢ/ግንባታ መለያን ያነባል፤ qa:inspect ከአቅራቢ አምሳያዎች ጋር የተነጠለ መገለጫ ይከፍታል። ቋሚ የሙከራ ውሂብ ሞዴል ሳያነጋግር የተፈተሸውን የመተግበሪያ መንገድ ያረጋግጣል። የቀጥታ ግምት፣ የTelegram ግንኙነት፣ የአካባቢ Linux ዴስክቶፕ፣ የፊርማ እና የታሸጉ ቅርሶች ፍተሻዎች የተለያዩ ማስረጃዎች ናቸው። ሊደገሙ ለሚችሉ ትዕዛዞች እና ጽዳት TESTING.mdን ይመልከቱ።

ተዛማጅ መመሪያዎች: [የማስረጃ ትዕዛዞች](../../TESTING.md).

<a id="privacy"></a>

## የአካባቢ ውሂብ እና ወሰኖች

ፕሮጀክቶች፣ ታሪክ፣ እቅዶች፣ ሰነዶች እና ምርመራዎች የግል ጽሑፍ ሊይዙ ይችላሉ። መገለጫዎችን፣ ያልተጣሩ ቀረጻዎችን፣ ቁልፎችን ወይም ሙሉ ምዝግብ ማስታወሻዎችን ከምንጭ ኮድ ጋር አያትሙ።

በLinux ላይ፣ የAPIን፣ ቁጥጥርን፣ Telegramን እና የምሳሌ ምስክርነቶችን ማስቀመጥ የተከፈተ የGNOME ሚስጥር አገልግሎት ወይም KWalletን ይፈልጋል፤ የሚደገፍ የምስጢር ማከማቻ ከሌለ፣ ZIAForge የElectronን የbasic_text አማራጭ ከመጠቀም ይልቅ እነዚህን ምስጢሮች ለማስቀመጥ ፈቃደኛ አይሆንም።

የአካባቢ ማከማቻ ጥያቄዎች በኮምፒውተርዎ ላይ ይቆያሉ ማለት አይደለም፦ የተመረጠው CLI/API ወደ አቅራቢው ይልካቸዋል። የስራ አቃፊ እና የሂደት ቁጥጥር የOS ማግለል አይደሉም። የተመረጡትን ፈቃዶች ይመርምሩ።

የማስረጃ ዓይነቶችን ይለዩ፦ ቋሚ ሙከራዎች መተግበሪያውን ያለ ሞዴል ይፈትሻሉ፤ የቀጥታ አካባቢያዊ እውነተኛ CLI/መለያን ይለማመዳል፤ የታሸጉ ፍተሻዎች የተወሰነ ቅርጽን ያረጋግጣሉ። አንዱን ማለፍ ሌሎቹን ዋስትና አይሰጥም።

የመተግበሪያ ወሰን፣ የስራ ዛፍ እና ተነባቢ-ብቻ መጠየቂያ ከስርዓተ-ክወና ማስገደድ የተለዩ ናቸው። የAntigravity ገምጋሚ/ረዳት ፖሊሲዎች የፋይል ስርዓት ተነባቢ-ብቻ መዳረሻን ከማስገደድ ይልቅ በተሰበሰበ የስራ ቦታ ማስረጃ ውስጥ ለውጦችን ያገኛሉ። የአካባቢ ኮምፒውተር ቁጥጥር በባለቤቱ የተፈቀዱ ፕሮግራሞችን ከመደበኛ የመተግበሪያ-መሳሪያ ወሰን ውጭ ያስፈጽማል፤ ከአሁን በኋላ የማያስፈልግ ሲሆን ያጥፉት።

ተዛማጅ መመሪያዎች: [መነሻ እና ህትመት](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## ይህንን ክፍት ምንጭ ፕሮጀክት ይረዱ እና ይቀይሩ

በመጀመሪያ AGENTS.md እና CONTRIBUTING.mdን ያንብቡ፣ ከዚያ ለአሁኑ የምንጭ ወሰኖች PROJECT_MAP.mdን ያንብቡ። የተተገበሩ የተገለጹ ውሎች እና የአሁኑ የስራ ፍሰት/አቅራቢ ሰነዶች ባህሪን ይገዛሉ። CONCEPT.md እና በተርሚናል-የሚጀምሩ የARCHITECTURE.md ክፍሎች ታሪካዊ ዓላማን ይጠብቃሉ እንዲሁም አሁን ላለው ልቀት የይገባኛል ጥያቄዎች ተደርገው መወሰድ የለባቸውም።

የእንግሊዝኛ እገዛ ምንጭ docs/help/en.json ነው። የተፈጠረውን USER_GUIDE.md ወይም website/guide.html በእጅዎ አያርሙ። ይፋዊውን ክፍል ይለውጡ፣ የተጎዳውን ውል ያዘምኑ እና node scripts/help/generate.cjsን ያስኪዱ። የውስጠ-መተግበሪያ እገዛ ያንኑ ምንጭ ያነባል። ጭማሪዎችን ከትክክለኛው አተገባበር ጋር ይገምግሙ፣ ይህም ገደቦችን፣ ፈቃዶችን እና የማይደገፉ መንገዶችን ይጨምራል።

እያንዳንዳቸው 56 የበይነገጽ ቋንቋዎች በdocs/help/locales.json ውስጥ የተለየ የእገዛ ሁኔታ አላቸው። የጎደለ ወይም ያልተሟላ እገዛ ወደ እንግሊዝኛ ይመለሳል። የተሟሉ በማሽን የተተረጎሙ አካላት ምልክት ይደረግባቸዋል እና ከእንግሊዝኛው የምንጭ ሃሽ ጋር ይያያዛሉ፣ ይህም የሰው ግምገማ ሳይጠየቅ ነው። በሰው የተገመገመ ትርጉም በተጨማሪም ገምጋሚውን ይመዘግባል። እያንዳንዱ ትርጉም የክፍል መለያዎችን፣ ድርጊቶችን፣ የፋይል/ትዕዛዝ መለያዎችን እና ቴክኒካዊ ገደቦችን መጠበቅ አለበት፣ ትክክለኛውን አቅጣጫ መጠቀም አለበት፣ እና የእንግሊዝኛ ምንጩ ሲቀየር መታደስ አለበት።

ከማቅረብዎ በፊት፣ ያረጀ የተፈጠረ ውጤትን፣ ልክ ያልሆኑ የቋንቋ ቅርጾችን ወይም የተበላሹ የአካባቢ የውል አገናኞችን ለመለየት node scripts/help/generate.cjs --checkን ያስኪዱ። የUI የትርጉም ፍተሻዎች እና የመተግበሪያ ባህሪ ፍተሻዎች የተለያዩ እንደሆኑ ይቆያሉ። HELP_MAINTENANCE.md የአስተዋጽዖ አበርካቹን እና የAI የማዘመን ሂደትን ይሰጣል፤ ሰነዶች ያልተካሄደን ፈተና አለፈ ብለው መናገር የለባቸውም።

ተዛማጅ መመሪያዎች: [የአሁኑ የፕሮጀክት ካርታ](../../PROJECT_MAP.md) · [የሰነድ ጥገና](../../HELP_MAINTENANCE.md) · [የአስተዋጽዖ አበርካች መመሪያዎች](../../../CONTRIBUTING.md) · [የወኪል መመሪያዎች](../../../AGENTS.md).
