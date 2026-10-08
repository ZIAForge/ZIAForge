<!-- Generated from docs/help/en.json; source SHA-256 1d8a8515cf743144e27893fc6fb1e85fc06b290f1744ab0ebc57665893e6d684. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: km; served locale: km; status: machine-translated. -->
# សៀវភៅណែនាំអ្នកប្រើប្រាស់ ZIAForge

ពីបំណងឆ្ពោះទៅកាន់លទ្ធផលដែលបានផ្ទៀងផ្ទាត់។ សៀវភៅណែនាំជាក់ស្តែងសម្រាប់ Code, Work និងការគ្រប់គ្រងកម្មវិធី។

ភាសាអង់គ្លេសគឺជាប្រភពគោលផ្លូវការ។ ជំនួយដែលបកប្រែដោយម៉ាស៊ីនត្រូវបានដាក់ស្លាកដាច់ដោយឡែកពីការបកប្រែដែលបានត្រួតពិនិត្យដោយមនុស្ស។ ការត្រួតពិនិត្យដោយស្វ័យប្រវត្តិនឹងមិនបញ្ជាក់ពីភាពត្រឹមត្រូវនៃភាសាកំណើតឡើយ។

> ការណែនាំនេះត្រូវបានបកប្រែដោយម៉ាស៊ីនពីប្រភពភាសាអង់គ្លេសបច្ចុប្បន្ន។ ការពិនិត្យឡើងវិញដោយមនុស្សនៅតែត្រូវបានស្វាគមន៍ជានិច្ច។

## ផ្នែកនៃមគ្គុទ្ទេសក៍

- [ជំហានដំបូង](#start)
- [ដំឡើងកញ្ចប់ផ្ទៃតុ (desktop package) ឱ្យបានត្រឹមត្រូវ](#install-platforms)
- [Code៖ ទិសដៅទាំងប្រាំ](#code)
- [ការពិភាក្សា Forge](#forge)
- [ឯកសារ និងការសម្រេចចិត្ត](#decisions)
- [ការអនុវត្ត និងការពិនិត្យឡើងវិញ](#execution)
- [ក្រុមពិនិត្យឡើងវិញស្របគ្នា និងស្ថាបត្យកររបាយការណ៍](#review-teams)
- [ឯកទេសភ្នាក់ងារ និងគោលការណ៍ prompt](#specializations)
- [Work៖ ពីសំណួរទៅជាឯកសារ](#work)
- [ការកំណត់ជាមុន ម៉ូឌែល និងការចូលប្រើប្រាស់](#models)
- [ការជជែក, Stop និងជួរ (queue)](#chat)
- [ឯកសារ, Git និងការបញ្ចប់](#files)
- [API connections](#api)
- [ការកំណត់ ភាសា និងការកំណត់ឡើងវិញដោយសុវត្ថិភាព](#settings)
- [សួរសំណួរទៅកាន់ជំនួយការ Help](#help-assistant)
- [ជំនួយការ និង Telegram](#assistant-control)
- [ដំណើរការប៊ូត Telegram ឯកជនរបស់អ្នក](#telegram)
- [ការអនុញ្ញាតកុំព្យូទ័រដើមសម្រាប់តែម្ចាស់](#native-permissions)
- [កម្មវិធីរុករក និងធាតុពីចម្ងាយ](#remote)
- [OpenClaw, Hermes និងភ្នាក់ងារខាងក្រៅផ្សេងទៀត](#external-agents)
- [CLI មូលដ្ឋាន និងដែនកំណត់ស្វ័យប្រវត្តិកម្ម](#local-cli)
- [កំណែ និងការធ្វើបច្ចុប្បន្នភាព](#updates)
- [ការចាប់ផ្តើមឡើងវិញ និងការសង្គ្រោះ](#restart)
- [ការដោះស្រាយបញ្ហា](#troubleshooting)
- [រាយការណ៍បញ្ហា និងពិនិត្យមើលភស្តុតាង](#diagnostics)
- [ទិន្នន័យមូលដ្ឋាន និងព្រំដែន](#privacy)
- [ស្វែងយល់ និងផ្លាស់ប្តូរគម្រោងប្រភពបើកចំហនេះ](#project-contributors)

<a id="start"></a>

## ជំហានដំបូង

ZIAForge រក្សាការពិភាក្សា ការរៀបចំផែនការ ការអនុវត្ត និងការផ្ទៀងផ្ទាត់ក្នុងកិច្ចការតែមួយ។ ជ្រើសរើស Code សម្រាប់គម្រោង Git ឬ Work សម្រាប់ឯកសារ ការស្រាវជ្រាវ និងលទ្ធផលផ្សេងទៀតនៅក្នុងថតធម្មតា។

ចាប់ផ្តើមជាមួយកិច្ចការតូចមួយក្នុងគម្រោងដាច់ដោយឡែក។ ប្រសិនបើអ្នកជ្រើសរើស CLI ដើម សូមដំឡើងវា និងចូលប្រើដោយគណនីផ្ទាល់ខ្លួនរបស់វានៅក្នុង terminal ជាមុនសិន។ ម្យ៉ាងវិញទៀត សូមកំណត់រចនាសម្ព័ន្ធការតភ្ជាប់ API។ ការជាវ CLI និង API ដែលបង់ថ្លៃ គឺជាវិធីសាស្ត្រតភ្ជាប់ដាច់ដោយឡែកពីគ្នា។ ZIAForge មិនចូលប្រើជំនួសអ្នក ឬផ្ទេរក្រេឌីតរវាងពួកវាឡើយ។

1. បើកការកំណត់ ហើយពិនិត្យមើលថតកន្លែងធ្វើការ និងភាសា។ អំពី បង្ហាញអត្តសញ្ញាណជាក់លាក់នៃ build ដែលកំពុងដំណើរការ។
2. សម្រាប់ Code សូមបន្ថែមឃ្លាំង Git នៅក្នុងរបារចំហៀង។ សម្រាប់ Work សូមជ្រើសរើសថតដាច់ដោយឡែកមួយនៅពេលបង្កើតកិច្ចការ។
3. រក្សាទុកការកំណត់ជាមុន (preset) ជាមួយ CLI ម៉ូឌែល កម្រិតនៃការគិតពិចារណា (reasoning effort) និងកម្រិតចូលប្រើប្រាស់។ អ្នកក៏អាចជ្រើសរើស Custom ដោយផ្ទាល់ដោយមិនចាំបាច់មានការកំណត់ជាមុនដែលបានរក្សាទុកបានដែរ។
4. បង្កើតកិច្ចការ ជ្រើសរើសទិសដៅ តួនាទី និងដំណើរការបន្តដោយដៃ ឬដោយស្វ័យប្រវត្តិនៃកិច្ចការនោះ។ ពិនិត្យមើលជម្រើសទាំងនោះមុនពេលចុច Start។

> ប្រើប្រាស់ artifact និង checksum ដែលផ្តល់ដោយអ្នកថែទាំគម្រោង។ កំណែ preview អាចមិនទាន់ចុះហត្ថលេខា ឬខ្វះ feed ធ្វើបច្ចុប្បន្នភាពដែលបានបោះពុម្ពផ្សាយ។ ការគាំទ្រផ្ទៃតុ (desktop) និង native-provider ត្រូវតែត្រូវបានផ្ទៀងផ្ទាត់សម្រាប់ OS ស្ថាបត្យកម្ម និង artifact ជាក់លាក់។ ការគាំទ្រកូដប្រភពតែមួយមុខមិនមែនជាការបញ្ជាក់ការចេញផ្សាយនោះទេ។

ការណែនាំពាក់ព័ន្ធ: [ទិដ្ឋភាពទូទៅនៃគម្រោង](../../../README.md) · [ភាពឆបគ្នានៃអ្នកផ្តល់សេវា](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## ដំឡើងកញ្ចប់ផ្ទៃតុ (desktop package) ឱ្យបានត្រឹមត្រូវ

ជ្រើសរើសកញ្ចប់សម្រាប់ប្រព័ន្ធប្រតិបត្តិការ និងស្ថាបត្យកម្ម CPU របស់អ្នក៖ x64 ឬ arm64។ ខ្សែសង្វាក់ផលិតកម្ម build អាចបង្កើតទម្រង់ macOS DMG/ZIP, Windows កម្មវិធីដំឡើង NSIS/ZIP និង Linux DEB/RPM/AppImage/tar.gz/ZIP។ ឯកសារដែលបានបង្កើត ឬ cross-build មិនមែនជាភស្តុតាងដែលបញ្ជាក់ថាកម្មវិធីដំឡើង និង UI ដើមរបស់វាដំណើរការជោគជ័យនៅលើម៉ាស៊ីនរបស់អ្នកនោះទេ សូមពិគ្រោះជាមួយកំណត់ត្រាផ្ទៀងផ្ទាត់នៃការចេញផ្សាយនោះ។

Build macOS ដែលប្រើប្រាស់ Electron 44 ទាមទារ macOS 13 ឬថ្មីជាងនេះ។ ប្រើប្រាស់កញ្ចប់ arm64 នៅលើ Apple Silicon និងកញ្ចប់ x64 សម្រាប់ Intel។ សូមបិទកម្មវិធីចាស់ទាំងស្រុងមុនពេលជំនួស។ កញ្ចប់ Preview អាចមិនទាន់ចុះហត្ថលេខា និងមិនទាន់បាន notarize ឡើយ កុំយល់ច្រឡំ artifact អភិវឌ្ឍន៍ជាមួយនឹងការចេញផ្សាយជាសាធារណៈដែលបានចុះហត្ថលេខា។

Windows ត្រូវការប្រព័ន្ធប្រតិបត្តិការដែលគាំទ្រដោយកំណែ Electron ដែលបានភ្ជាប់មកជាមួយ និង Git ដែលមាននៅក្នុង PATH។ ជ្រើសរើសស្ថាបត្យកម្មដែលត្រូវគ្នា។ Preview ដែលមិនបានចុះហត្ថលេខាគឺគ្មានវិញ្ញាបនបត្រ Authenticode ទេ។ កំណែចល័ត ZIP ត្រូវតែរក្សាទុកថតកម្មវិធីពេញលេញ និងឯកសារ runtime មិនមែនតែឯកសារប្រតិបត្តិ (executable) របស់វានោះឡើយ។

Linux ត្រូវការផ្ទៃតុក្រាហ្វិក (graphical desktop) ដែលឆបគ្នា បណ្ណាល័យប្រព័ន្ធដែលទាមទារដោយ Electron និង Git។ សម្រាប់ព័ត៌មានសម្ងាត់បញ្ជាដែលបានអ៊ិនគ្រីប សូមផ្តល់ Secret Service ដែលដំណើរការ ដូចជា gnome-libsecret ឬ KWallet។ ផ្នែកខាងក្រោយដែលគ្មានសុវត្ថិភាព basic_text គឺមិនត្រូវបានទទួលយកឡើយ។ ភស្តុតាង smoke test លើ headless/container មិនបញ្ជាក់ពីដំណើរការលើគ្រប់ផ្ទៃតុ ឬការចែកចាយ (distribution) ទាំងអស់នោះទេ។

ដំឡើង DEB ដោយប្រើ apt install ./file.deb ឬដំឡើង RPM តាមរយៈកម្មវិធីគ្រប់គ្រងកញ្ចប់នៃ distribution របស់អ្នក។ AppImage ត្រូវការសិទ្ធិប្រតិបត្តិ និងការគាំទ្រ FUSE សមស្រប។ --appimage-extract-and-run គឺជាជម្រើសជំនួសនៅកន្លែងណាដែលគាំទ្រ។ ពន្លា (extract) កញ្ចប់ tar.gz និង ZIP ជាមួយឯកសារ runtime ទាំងអស់របស់វា។ រក្សាទិន្នន័យអ្នកប្រើប្រាស់ និងឯកសារកម្មវិធីឱ្យដាច់ដោយឡែកពីគ្នានៅពេលជំនួសកញ្ចប់។

ដើម្បី build ពីប្រភព សូមប្រើ Node 24, Git និង npm ci រួមទាំងកម្មវិធីដំឡើង Electron ធម្មតា។ ការ rebuild បែប native ទាមទារឧបករណ៍ប្រព័ន្ធ៖ ឧបករណ៍ពាក្យបញ្ជា Xcode នៅលើ macOS, MSVC C++, Windows SDK និង Python នៅលើ Windows, កម្មវិធីចងក្រង (compiler), make, Python, pkg-config និងឧបករណ៍វេចខ្ចប់ដែលចាំបាច់នៅលើ Linux។ អនុវត្តតាម PLATFORM_BUILDS.md សម្រាប់ពាក្យបញ្ជាជាក់លាក់ និងដែនកំណត់វេទិកាបច្ចុប្បន្ន។

កំណែចេញផ្សាយត្រូវបានបម្រុងទុកជាមជ្ឈិម ហើយលទ្ធផលគឺមិនអាចកែប្រែបានទេ។ Build ផ្ទៀងផ្ទាត់ CI មិនមែនជាកម្មវិធីដំឡើងដែលបានបោះពុម្ពផ្សាយនោះទេ។ បណ្ណសារប្រភព (source archives) មានកូដប្រភព ឯកសារ lockfile ឯកសារជំនួយ និងស្គ្រីប។ កញ្ចប់ពឹងផ្អែក (dependencies) ព័ត៌មានសម្ងាត់ ប្រវត្តិរូបអ្នកប្រើប្រាស់ និងការស្រាវជ្រាវឯកជនត្រូវបានដកចេញ។ កុំសន្និដ្ឋានថាមានការផ្ទៀងផ្ទាត់ ARM ឬ Windows ដើម ពី build x64 ដែលជោគជ័យឱ្យសោះ។

ការណែនាំពាក់ព័ន្ធ: [កញ្ចប់វេទិកា លក្ខខណ្ឌតម្រូវជាមុន និងដែនកំណត់ផ្ទៀងផ្ទាត់](../../PLATFORM_BUILDS.md) · [អត្តសញ្ញាណ Build និងការត្រួតពិនិត្យការចេញផ្សាយ](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code៖ ទិសដៅទាំងប្រាំ

Auto វាយតម្លៃវិសាលភាព៖ សំណួរសាមញ្ញអាចបញ្ចប់ដោយចម្លើយមួយ ខណៈពេលដែលកិច្ចការធំជាងត្រូវការការរៀបចំ។ Fix a bug ស៊ើបអង្កេតមូលហេតុ និងរៀបចំការកែតម្រូវ។ Spec first ចាប់ផ្តើមជាមួយដំណោះស្រាយបច្ចេកទេស។ Requirements first ចាប់ផ្តើមជាមួយតម្រូវការ និងលក្ខណៈវិនិច្ឆ័យទទួលយក។

Multi-model ប្រើប្រាស់បរិបទដាច់ដោយឡែកសម្រាប់ការរុករក ការរចនា ការអនុវត្ត និងការពិនិត្យឡើងវិញ។ ឈ្មោះទិសដៅនេះមិនទាមទារអ្នកផ្តល់សេវាផ្សេងគ្នានោះទេ៖ តួនាទីនីមួយៗប្រើប្រាស់ការកំណត់ជាមុន ឬការកំណត់រចនាសម្ព័ន្ធ Custom ដែលអ្នកជ្រើសរើស។

Worktree ញែកការផ្លាស់ប្តូរ Git នៃកិច្ចការមួយឱ្យនៅដាច់តែឯង។ Branch ដំណើរការនៅក្នុង checkout ដែលបានជ្រើសរើស។ ពិនិត្យមើលគម្រោង សាខា និងម៉ូឌែលមុនពេលចាប់ផ្តើម។ ការពិពណ៌នាកិច្ចការនឹងមិនត្រូវបានផ្ញើទៅការសន្ទនាធម្មតាឡើយ។

សម្រាប់គំនិតដែលមានជម្រើសផលិតផល ឬបច្ចេកទេសមិនទាន់ដោះស្រាយ សូមប្រើ Requirements first ហើយបង្កើតមូលដ្ឋានគ្រឹះក្នុងការពិភាក្សា។ Auto ចាត់ថ្នាក់សំណើ វាមិនមែនជាពាក្យបញ្ជាដើម្បីអនុវត្តរាល់ឃ្លាខ្លីៗភ្លាមៗនោះទេ។ Save draft រក្សាទុកសំណើដោយមិនទាក់ទងម៉ូឌែលឡើយ។ Start រក្សាទុក និងបើកដំណើរការលំហូរការងារដែលគ្រប់គ្រងតែម្តង។ ច្បាប់ចម្លងកិច្ចការពីមួយទៅបួនមានលេខសម្គាល់បង្កើត និងការកំណត់តួនាទីឯករាជ្យរៀងៗខ្លួន។

ការណែនាំពាក់ព័ន្ធ: [កិច្ចសន្យាលំហូរការងារ Code](../../WORKFLOWS.md) · [ទម្រង់ប្រវត្តិ prompt របស់ Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## ការពិភាក្សា Forge

Start បើកការពិភាក្សាកណ្តាល។ ឆ្លើយតបដោយធម្មជាតិ ចោទសួរសំណួរត្រឡប់ បន្ថែមលក្ខខណ្ឌកម្រិត និងពិភាក្សាអំពីជម្រើសបច្ចេកទេស។ ការសន្ទនា និងសំណួរនៅជាប់ជាមួយកិច្ចការជានិច្ច។

ការផ្ញើអត្ថបទមិនមែនជាការទទួលយកឯកសារ ឬអនុញ្ញាតផែនការអនុវត្តថ្មីនោះទេ។ ការបំភ្លឺកំឡុងពេលអនុវត្តនឹងផ្អាកវេនគ្រប់គ្រងជាបណ្តោះអាសន្នសិន ហើយពិនិត្យមើលវិសាលភាពដែលរងផលប៉ះពាល់ឡើងវិញ។ ចម្លើយចំពោះសំណួរនៅក្នុងជំហានដែលបានទទួលយករួចហើយ អាចបន្តដំណើរការជំហាននោះបាន។

ដើម្បីពិនិត្យមើលឡើងវិញនូវមូលដ្ឋានគ្រឹះដោយចេតនា សូមជ្រើសរើស Requirements, Specification ឬ Planning។ កំណែថ្មីទាមទារឱ្យមានការទទួលយកជាថ្មីលើការសម្រេចចិត្តដែលពឹងផ្អែកលើវា។ ជំហានដែលបានបញ្ចប់ និងភស្តុតាងរបស់វានៅតែរក្សាទុកដដែល។ ដំណាក់កាលមិនទាន់បញ្ចប់ដែលត្រូវបានជំនួស នឹងស្ថិតនៅក្នុងប្រវត្តិ។

វគ្គដំណាក់កាលដែលគ្រប់គ្រង (managed phase sessions) មានភាពខុសប្លែកពីការជជែកដោយសេរី។ ប្រើប្រាស់ការពិភាក្សា Forge ជាជាងការផ្ញើ prompt ដោយដៃដោយផ្ទាល់ទៅកាន់វគ្គដែលជាកម្មសិទ្ធិរបស់លំហូរការងារ។

ការណែនាំពាក់ព័ន្ធ: [កិច្ចសន្យាពិភាក្សា Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## ឯកសារ និងការសម្រេចចិត្ត

បើកឯកសារ ពិនិត្យមើលកំណែរបស់វា និងធ្វើការកែសម្រួលនៅពេលចាំបាច់។ ការបញ្ជូនការកែសម្រួលតាមរយៈការពិភាក្សានឹងបង្កើតកំណែថ្មីមួយ។ របាយការណ៍ និងលទ្ធផលដែលបានផ្ទៀងផ្ទាត់ មិនត្រូវបានសរសេរឡើងវិញជាអតីតកាលនោះទេ។

មុនពេលទទួលយកផែនការដែលបានស្នើ សូមកែសម្រួលលំដាប់ ការណែនាំ លក្ខណៈវិនិច្ឆ័យទទួលយក និងពាក្យបញ្ជាផ្ទៀងផ្ទាត់។ អនុញ្ញាតពាក្យបញ្ជាជាក់ស្តែងដែលអ្នកយល់ច្បាស់៖ ពួកវាដំណើរការនៅក្នុងថតកិច្ចការ។ Multi-model ស្នើជំហានអនុវត្តកិច្ចការទាំងមូលមួយ ដោយមានព័ត៌មានលម្អិតនៅក្នុងឯកសារ និងការណែនាំរបស់វា។

Approve គឺជាការសម្រេចចិត្តដោយចេតនាដាច់ដោយឡែកមួយ។ Auto មិនរំលងសំណួរ ឬការទទួលយកតម្រូវការ លក្ខណៈបច្ចេកទេស និងផែនការឡើយ។ ឯកសារដែលត្រូវបានផ្លាស់ប្តូរពីខាងក្រៅ មិនអាចប្រើប្រាស់ការអនុម័តចាស់ឡើងវិញបានទេ។

ឯកសាររៀបចំបង្ហាញជា artifact។ កំណែ ដំណាក់កាលបង្កើត និង hash របស់ពួកវាភ្ជាប់ពួកវាទៅនឹងលទ្ធផលមួយ។ ឯកសារ Code ត្រូវបានរក្សាទុកនៅក្រៅ worktree ហើយមិនចូលទៅក្នុង commit ដោយស្វ័យប្រវត្តិនោះទេ។

ពិនិត្យមើលទាំងឯកសារ និងការសម្រេចចិត្តដែលបានបង្ហាញមុនពេលទទួលយក។ ការទទួលយកភ្ជាប់ ID នៃ gate បច្ចុប្បន្ន ការកែសម្រួលផែនការ និង hash នៃឯកសារដែលបានរក្សាទុក។ ស្នើសុំការផ្លាស់ប្តូរ (Request changes) នៅពេលវិសាលភាព ឬភស្តុតាងមិនត្រឹមត្រូវ។ ប្រសិនបើការសម្រេចចិត្តហួសសម័យ សូមផ្ទុកឡើងវិញនូវស្ថានភាពដែលបានរក្សាទុកមុនពេលធ្វើការជ្រើសរើសថ្មី ឯកសារដែលបានផ្លាស់ប្តូរមិនអាចត្រូវបានទទួលយកក្រោមជំនាន់មុនឡើយ។

ការណែនាំពាក់ព័ន្ធ: [Gate លំហូរការងារ និងកំណែឯកសារ](../../WORKFLOWS.md).

<a id="execution"></a>

## ការអនុវត្ត និងការពិនិត្យឡើងវិញ

To-do បង្ហាញជំហានពិតប្រាកដ ការប៉ុនប៉ងបច្ចុប្បន្ន ការផ្ទៀងផ្ទាត់ និងលទ្ធផលនៃការពិនិត្យឡើងវិញ។ ភ្នាក់ងារដែលនិយាយថា “រួចរាល់” មិនមែនមានន័យថាបញ្ចប់ជំហាននោះទេ៖ ភស្តុតាងដែលត្រូវការនៃផែនការត្រូវតែមានជាដាច់ខាត។

របៀប Manual ផ្អាកនៅចន្លោះជំហានដែលមានសិទ្ធិដំណើរការ។ Auto ជំរុញជំហានដែលបានផ្ទៀងផ្ទាត់ទៅមុខ និងអនុញ្ញាតការសាកល្បងឡើងវិញក្នុងកម្រិតកំណត់។ Stop after តែងតែបង្កើត checkpoint ជានិច្ច។ Pause បញ្ឈប់ការងារសកម្មរបស់លំហូរការងារ។ ការបិទផ្ទាំង (panel) មិនបញ្ឈប់វាឡើយ។

អ្នកពិនិត្យឯករាជ្យប្រើប្រាស់បរិបទដាច់ដោយឡែកមួយដែលមានឯកសារ និងលទ្ធផលផ្ទៀងផ្ទាត់។ រាល់ការរកឃើញរារាំង (blocking finding) ដែលទាមទារត្រូវតែត្រូវបានដោះស្រាយ អ្នកពិនិត្យច្រើននាក់មិនអាចបោះឆ្នោតលុបចោលកំហុសរារាំងបានឡើយ។

នៅក្នុង Multi-model ការកែតម្រូវការរកឃើញទាមទារការសម្រេចចិត្តច្បាស់លាស់។ ការកែតម្រូវមិនចាប់ផ្តើមការពិនិត្យមួយផ្សេងទៀតដោយស្ងាត់ៗនោះទេ៖ Review again បើកវដ្តថ្មីមួយ។ មតិយោបល់ពិនិត្យអាចស្នើសុំឱ្យអ្នកសម្របសម្រួលពិចារណាឡើងវិញដោយមិនចាំបាច់អនុវត្តឡើងវិញឡើយ។

ជំហានដែលបានបញ្ចប់មិនអាចកែសម្រួលដោយស្ងាត់ៗបានឡើយ។ ជាមួយ TDD ដំណាក់កាល Red ត្រូវតែបរាជ័យពិតប្រាកដដោយសារហេតុផលដែលរំពឹងទុក បន្ទាប់មក Green ត្រូវតែឆ្លងកាត់ជោគជ័យ។ ការកំណត់ចំនួនលើកប៉ុនប៉ងជួយការពារកុំឱ្យមានការសាកល្បងឡើងវិញឥតឈប់ឈរ។

រក្សាទុកអ្នកពិនិត្យ CLI/API ឯករាជ្យនៅក្នុង ការកំណត់ → ក្រុមពិនិត្យឡើងវិញ (Review teams) បន្ទាប់មកជ្រើសរើសក្រុមនៅក្នុង Code ឬ Work។ អ្នកពិនិត្យដំណើរការស្របគ្នា បន្ទាប់មកគឺស្ថាបត្យកររបាយការណ៍ (report architect) របស់ក្រុម។ អ្នកក៏អាចកំណត់រចនាសម្ព័ន្ធអ្នកពិនិត្យឯករាជ្យដោយមិនចាំបាច់មានក្រុមដែលបានរក្សាទុកបានដែរ។ ស្ថាបត្យកររបាយការណ៍ទទួលបានតែរបាយការណ៍រចនាសម្ព័ន្ធអនាមិកប៉ុណ្ណោះ ដោយគ្មានឯកសារគម្រោង ឬឧបករណ៍ឡើយ។ ការញែកដាច់ពីគ្នានេះបច្ចុប្បន្នទាមទារ Claude Code ឬ API។

ជំហានអនុវត្តនីមួយៗត្រូវការការត្រួតពិនិត្យដែលអាចប្រតិបត្តិបាន ការពិនិត្យឡើងវិញដោយឯករាជ្យដែលទាមទារ ឬទាំងពីរ។ ផ្ទុយទៅវិញ ដំណាក់កាលរៀបចំរក្សាទុកលទ្ធផលដែលមានសុពលភាព និងបង្កាន់ដៃ artifact។ ទាំងនេះមិនមែនជាការក្លែងបន្លំថាការធ្វើតេស្តអនុវត្តបានដំណើរការនោះទេ។ ពាក្យបញ្ជាមួយជោគជ័យ លុះត្រាតែស្ថានភាពចាកចេញ (exit status) ពិតប្រាកដរបស់វា និងការសម្អាតដំណើរការដែលជាកម្មសិទ្ធិត្រូវបានបញ្ជាក់។ ការត្រួតពិនិត្យ Red សម្រាប់ TDD ត្រូវតែបរាជ័យជាធម្មតាមុនពេលការអនុវត្ត និងការផ្ទៀងផ្ទាត់ Green។ ឯកសារប្រតិបត្តិដែលបាត់ ឬការផុតកំណត់ពេលវេលា (timeout) មិនមែនជាលទ្ធផល Red ត្រឹមត្រូវឡើយ។

circuit breaker លំនាំដើមនឹងបញ្ឈប់បន្ទាប់ពីការប៉ុនប៉ងបរាជ័យបីដងលើជំហានមួយ ឬសរុបហាសិបដង។ ការរំខានប្រើប្រាស់ការប៉ុនប៉ងមួយលើក ប៉ុន្តែមិនត្រូវបានរាប់ថាជាការប៉ុនប៉ងបរាជ័យនោះទេ។ ដែនកំណត់ និងភស្តុតាងដែលបានបញ្ចប់នៅតែរក្សាទុកទោះបីជាចាប់ផ្តើមឡើងវិញក៏ដោយ។ Retry មិនកំណត់ពួកវាឡើងវិញឡើយ។ សូមអានការបរាជ័យដែលបានរក្សាទុកមុនពេលអនុញ្ញាតឱ្យមានការប៉ុនប៉ងម្តងទៀត។

ការណែនាំពាក់ព័ន្ធ: [ការផ្ទៀងផ្ទាត់ និងការពិនិត្យឡើងវិញ](../../WORKFLOWS.md).

<a id="review-teams"></a>

## ក្រុមពិនិត្យឡើងវិញស្របគ្នា និងស្ថាបត្យកររបាយការណ៍

បើក ការកំណត់ → ក្រុមពិនិត្យឡើងវិញ ហើយរក្សាទុកក្រុមមួយ។ បន្ថែមអ្នកពិនិត្យឯករាជ្យដែលមាន CLI ឬ API ម៉ូឌែល កម្រិតនៃការគិតពិចារណា និងឯកទេសផ្ទាល់ខ្លួនរបស់ពួកគេ រួចជ្រើសរើសស្ថាបត្យកររបាយការណ៍។ ជ្រើសរើសក្រុមនៅក្នុងការកំណត់រចនាសម្ព័ន្ធពិនិត្យរបស់កិច្ចការ។ ការកំណត់ជាមុននៃ executor ក៏អាចត្រូវបានប្រើដោយអ្នកពិនិត្យផងដែរ ហើយ Custom នៅតែអាចប្រើបាន។ តួនាទីឯករាជ្យនៅតែមានបរិបទដាច់ដោយឡែកពីគ្នា។

អ្នកពិនិត្យដំណើរការស្របគ្នាលើភស្តុតាងកិច្ចការដូចគ្នា។ រាល់របាយការណ៍ កំហុស និងសេចក្តីសម្រេចដែលទាមទារត្រូវបានរក្សាទុក។ ស្ថាបត្យករទទួលបានរបាយការណ៍អនាមិកដែលមានលេខរៀង ដោយគ្មានឈ្មោះអ្នកពិនិត្យ អត្តសញ្ញាណម៉ូឌែល ឬអ្នកផ្តល់សេវា មាតិកាកិច្ចការដើម ការចូលប្រើឃ្លាំង ឬឧបករណ៍ឡើយ។ វាប្រៀបធៀបរបាយការណ៍ និងផ្តល់ត្រឡប់មកវិញនូវសេចក្តីសម្រេចដែលមានរចនាសម្ព័ន្ធមួយ។ វាមិនធ្វើការពិនិត្យកូដប្រភពថ្មីឡើយ។

ការរកឃើញរារាំង ឬការបដិសេធរបស់អ្នកពិនិត្យដែលទាមទារ មិនអាចលើកលែងដោយការបោះឆ្នោតភាគច្រើន ឬចំណង់ចំណូលចិត្តរបស់ស្ថាបត្យករឡើយ។ របាយការណ៍ដែលបាត់ ឬខូចទម្រង់ នឹងរារាំងការអនុម័ត។ ពិនិត្យមើលការរកឃើញនីមួយៗ និងការសម្រេចចិត្តសរុបមុនពេលទទួលយក ឬអនុញ្ញាតឱ្យមានការកែតម្រូវ។ ក្រុមដែលបានរក្សាទុកត្រូវបានកំណត់ និងបង្កកសម្រាប់ដំណើរការ។ ការកែសម្រួលការកំណត់ជាមុនរបស់វាមិនសរសេរភស្តុតាងដែលបានបញ្ចប់ឡើងវិញទេ។

ស្ថាបត្យករដែលទទួលតែរបាយការណ៍បច្ចុប្បន្នប្រើការកំណត់រចនាសម្ព័ន្ធគ្មានឧបករណ៍ដែលគាំទ្រដោយ Claude ឬ API។ Codex និង Antigravity នៅតែអាចប្រើជាអ្នកពិនិត្យបាន ប៉ុន្តែត្រូវបានបដិសេធសម្រាប់តួនាទីស្ថាបត្យករដែលនៅដាច់ដោយឡែកនេះ រហូតទាល់តែមានកិច្ចសន្យាគ្មានឧបករណ៍ដែលបានផ្ទៀងផ្ទាត់។ prompt ដែលគ្រាន់តែចែងថា “គ្មានឧបករណ៍” តែមួយមុខគឺមិនគ្រប់គ្រាន់ទេ។

> ខ្សែសង្វាក់រចនា/ពិនិត្យឡើងវិញរបស់ Multi-model នៃ Code និងក្រុមពិនិត្យឡើងវិញស្របគ្នាដែលបានរក្សាទុក គឺជាការគ្រប់គ្រងដាច់ដោយឡែកពីគ្នា។ រក្សាគោលការណ៍ពិនិត្យផ្ទាល់ខ្លួនដែលបានជ្រើសរើស។ កុំសន្មតថាទិសដៅតែមួយអាចបើកដំណើរការគ្រប់មុខងារពិនិត្យឡើងវិញទាំងអស់នោះឡើយ។

ការណែនាំពាក់ព័ន្ធ: [ការកំណត់រចនាសម្ព័ន្ធក្រុមតាមប្រភេទ](../../../shared/review-team.ts) · [ការបូកសរុបការពិនិត្យឡើងវិញ](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## ឯកទេសភ្នាក់ងារ និងគោលការណ៍ prompt

ម៉ូឌែលគឺជាម៉ាស៊ីនអនុវត្ត រីឯឯកទេសគឺជាប្រវត្តិការណែនាំ។ ជ្រើសរើស None ប្រសិនបើមិនបន្ថែមឯកទេស, Standard សម្រាប់ការណែនាំលំនាំដើម, Auto សម្រាប់ការណែនាំដែលភ្ជាប់មកជាមួយដែលពាក់ព័ន្ធ ឬ Manual សម្រាប់ការណែនាំដែលបានជ្រើសរើស និងការណែនាំដែលមានដែនកំណត់ផ្ទាល់ខ្លួនរបស់អ្នក។ ការកំណត់ជាមុនអាចរក្សាទុកជម្រើសនេះបាន។

កាតាឡុកដើមគ្របដណ្តប់លើការសរសេរកូដទូទៅ ស្ថាបត្យកម្ម សុវត្ថិភាព ភាពជឿជាក់ ប្រសិទ្ធភាព ការធ្វើតេស្ត និងលទ្ធភាពប្រើប្រាស់នៃចំណុចប្រទាក់។ Auto ប្រើប្រាស់អត្ថបទកិច្ចការ/ជំហានដែលមាន ដើម្បីជ្រើសរើសការណែនាំ។ វាមិនលួចហៅម៉ូឌែលផ្សេងទៀត ឬបញ្ជាក់ពីជំនាញនោះឡើយ។ ការផ្ដល់យោបល់រៀបចំផែនការអាចត្រូវបានពិនិត្យ និងផ្លាស់ប្តូរមុនពេលទទួលយកផែនការអនុវត្ត។

ឯកទេសពិនិត្យឡើងវិញជួយតម្រង់ទិសការយកចិត្តទុកដាក់ ប៉ុន្តែមិនដែលជំនួសភស្តុតាងឯករាជ្យ ដែនកំណត់ចូលប្រើ ឬសេចក្តីសម្រេចដែលមានរចនាសម្ព័ន្ធឡើយ។ ចាត់ទុកការណែនាំផ្ទាល់ខ្លួនជាផ្នែកនៃវិសាលភាពកិច្ចការ៖ កុំប្រើពួកវាដើម្បីរំលងការទទួលយកឯកសារ គោលការណ៍ឧបករណ៍ ការផ្ទៀងផ្ទាត់ភាពត្រឹមត្រូវ ឬការបរាជ័យរបស់អ្នកពិនិត្យ។

ការណែនាំពាក់ព័ន្ធ: [កាតាឡុក prompt ដើម](../../../shared/specializations.ts).

<a id="work"></a>

## Work៖ ពីសំណួរទៅជាឯកសារ

Work មិនទាមទារ Git ទេ។ Default បង្កើតថតកិច្ចការដាច់ដោយឡែកមួយ។ Custom ជ្រើសរើសថតដែលមានស្រាប់តាមរយៈផ្ទាំងជ្រើសរើសដើម (native picker)។ Save draft រក្សាទុកការកំណត់ដោយមិនដំណើរការ inference ឡើយ។ Start ដំណើរការដំណាក់កាលដំបូង។

Auto ឆ្លើយតបដោយផ្ទាល់ ឬស្នើផែនការសមស្របដែលមាន To-do ពិតប្រាកដ។ Brainstorm បង្កើត ideas.md មុនពេលអ្នកជ្រើសរើសគំនិតបន្ថែម ឬការវាយតម្លៃ។ Research រក្សាទុក findings.md ប្រភព និងដែនកំណត់។ Write បម្លែងពីបំណង និង outline.md (នៅពេលមានប្រយោជន៍) ទៅជាឯកសារពិពណ៌នា ឬ draft.md។ ការកែសម្រួលរក្សាទុកកំណែពីមុនជានិច្ច។

ជ្រើសរើសឯកសារបញ្ចូលតាមរយៈផ្ទាំងជ្រើសរើសដើម ហើយយោងពួកវាជាមួយ @។ កម្មវិធីចម្លងពួកវាជាធាតុបញ្ចូលកិច្ចការដែលមិនអាចកែប្រែបាន និងផ្ទៀងផ្ទាត់អត្តសញ្ញាណរបស់ពួកវាមុនពេលដំណើរការ។ Default បង្កើតថតកិច្ចការដែលជាកម្មសិទ្ធិរបស់កម្មវិធី។ ការចូលប្រើថត Custom គឺជាការអនុញ្ញាតដែលបានរក្សាទុករបស់ម្ចាស់។ សេចក្តីព្រាងដែលបានរក្សាទុក និងមិនទាន់ចាប់ផ្តើម អាចផ្លាស់ប្តូរថតរបស់វាបាន។

បង្កើតច្បាប់ចម្លងចំនួន 1–4 ជាមួយនឹងការកំណត់ executor ឯករាជ្យ។ កិច្ចការដែលប្រើប្រាស់ថតជាន់គ្នា មិនអាចសរសេរក្នុងពេលដំណាលគ្នាបានទេ។ ការសម្របសម្រួលនេះអនុវត្តចំពោះប្រតិបត្តិការ ZIAForge មិនមែនកម្មវិធីខាងក្រៅតាមអំពើចិត្តឡើយ។

Deep Brainstorm កំណត់លំនាំដើមជាកម្មករឯករាជ្យបីនាក់ និងគាំទ្ររហូតដល់ប្រាំបីនាក់។ ជ្រើសរើសលំដាប់ និងការកំណត់រចនាសម្ព័ន្ធរបស់ពួកគេ រួមទាំងការប្រើប្រាស់ការកំណត់ជាមុនឡើងវិញក្នុងបរិបទដាច់ដោយឡែក។ សំណួររបស់កម្មកររក្សាប្រភពដើមរបស់ពួកគេ។ របាយការណ៍ដែលខូចទម្រង់ទទួលបានឱកាសជួសជុលទម្រង់មួយលើក។ ការបរាជ័យដោយផ្នែកនៅតែបង្ហាញឱ្យឃើញជាជាងការបង្ហាញថាជាភាពជោគជ័យជាឯកច្ឆន្ទ។

Deep រួមបញ្ចូលគ្នានូវរបាយការណ៍កម្មករដែលបានរក្សាទុកទៅក្នុង brainstorm_report.md ហើយតែងតែសួររកការសម្រេចចិត្តរបស់អ្នកប្រើប្រាស់ជានិច្ច។ ការតាមដានបន្តបន្ទាប់បន្តិចបន្តួចនឹងកែសម្រួលរបាយការណ៍តាមរយៈអ្នកសម្របសម្រួល។ ការផ្លាស់ប្តូរធំនឹងចាប់ផ្តើមជុំមួយទៀតនៃកម្មករដែលបានបង្កក។ Artifact រក្សាកំណែរបស់វាដដែល។

តួនាទីដែលបានដោះស្រាយត្រូវបានបង្កកនៅពេលបង្កើតកិច្ចការ ឬរក្សាទុកសេចក្តីព្រាងច្បាស់លាស់។ បន្ទាប់ពីការហៅដំណើរការលើកដំបូង មានតែដំណើរការបន្តដោយស្វ័យប្រវត្តិ/ដោយដៃប៉ុណ្ណោះដែលអាចផ្លាស់ប្តូរបាន។ សូមប្រើកិច្ចការថ្មីសម្រាប់ការកំណត់តួនាទី ឬម៉ូឌែលផ្សេងទៀត។ ការកែសម្រួលការកំណត់ជាមុនសកល (global preset) មិនផ្លាស់ប្តូរដំណាក់កាលក្រោយៗដោយស្ងាត់ៗនោះទេ។

របៀប Manual ផ្អាកនៅចន្លោះដំណាក់កាលដែលមានសិទ្ធិ រួមទាំងគ្រោង Write ដ៏សំខាន់ផងដែរ។ Auto អាចបន្តដំណើរការកាត់តាមគ្រោងនោះ។ សំណួរ ផែនការដែលអាចប្រតិបត្តិបានដែលបានស្នើ ទិសដៅ Brainstorm និងការពិនិត្យរបាយការណ៍ Deep នៅតែជាការសម្រេចចិត្តច្បាស់លាស់សូម្បីតែនៅក្នុង Auto ក៏ដោយ។ ការដកស្រង់តែមួយមុខមិនបញ្ជាក់ថាការរុករកគេហទំព័របានកើតឡើងនោះទេ ហើយឯកសារ binary ដែលបានរក្សាទុកតែមួយមុខ មិនបញ្ជាក់ពីការបង្ហាញ (rendering) របស់វាឡើយ។

ការណែនាំពាក់ព័ន្ធ: [របៀប និងការសម្រេចចិត្តនៃ Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## ការកំណត់ជាមុន ម៉ូឌែល និងការចូលប្រើប្រាស់

ការកំណត់ជាមុនរក្សាទុក CLI/API ម៉ូឌែល កម្រិតនៃការគិតពិចារណា និងការអនុញ្ញាត។ ផ្នែកខាងក្រោមនៃការជជែកមានផ្នែកការកំណត់ជាមុន CLI ម៉ូឌែល និងជម្រើសនានា។ Custom ដំណើរការដោយមិនចាំបាច់មានការកំណត់ជាមុន។ Create preset រក្សាទុកការជ្រើសរើសបច្ចុប្បន្ន។

កាតាឡុកបានមកពី CLI ដែលបានដំឡើង ឬ API ដែលបានជ្រើសរើស នៅកន្លែងណាដែលគាំទ្រ។ Refresh ធ្វើបច្ចុប្បន្នភាពបញ្ជីដោយមិនផ្លាស់ប្តូរការជ្រើសរើសឡើយ។ ប្រសិនបើមិនអាចរកឃើញដោយស្វ័យប្រវត្តិទេ សូមបញ្ចូល ID ម៉ូឌែលច្បាស់លាស់ ប៉ុន្តែអ្នកផ្តល់សេវានៅតែត្រូវតែគាំទ្រវា។ កម្រិតនៃការគិតពិចារណាអាស្រ័យលើម៉ូឌែល និង CLI។ លំនាំដើមរបស់អ្នកផ្តល់សេវាគឺខុសគ្នាពី token none ច្បាស់លាស់។

អនុវត្តការផ្លាស់ប្តូរបានលុះត្រាតែមានការបញ្ជាក់ទទួលពី backend។ ការផ្លាស់ប្តូរត្រូវបានកម្រិតក្នុងអំឡុងពេលវេនសកម្ម ឬជួរ (queue) មិនទាន់ទទេរ។ សេចក្តីព្រាង និងប្រវត្តិដែលអាចមើលឃើញនៅតែរក្សាទុកដដែល ប៉ុន្តែការផ្លាស់ប្តូរអ្នកផ្តល់សេវាមិនផ្ទេរស្ថានភាពផ្ទៃក្នុងឯកជនរបស់ពួកគេឡើយ។

នៅក្នុង Forge ស្លាកតួនាទីមានសារៈសំខាន់៖ ការរៀបចំអាចប្រើ Planner ដាច់ដោយឡែកមួយ។ ផ្នែកខាងក្រោមផ្លាស់ប្តូរតួនាទីដែលបានបង្ហាញ។ អ្នកពិនិត្យ និងជំនួយការត្រូវបានជ្រើសរើសនៅក្នុងការកំណត់លំហូរការងារ។ គោលការណ៍សម្រាប់ការអនុវត្តដែលបានផ្ទៀងផ្ទាត់រួចហើយអាចនឹងត្រូវបានចាក់សោ។

ការអនុញ្ញាតមានភាពខុសគ្នារវាងអ្នកផ្តល់សេវានីមួយៗ។ Read only និង Workspace write អាចប្រើបាននៅកន្លែងណាដែល adapter គាំទ្រពួកវា។ Antigravity ប្រើការកំណត់ CLI ដើម ឬការចូលប្រើពេញលេញដែលបានជ្រើសរើសយ៉ាងច្បាស់លាស់។ ការចូលប្រើពេញលេញមិនមែនជា sandbox ទេ។

ឯកទេសបន្ថែមការណែនាំ prompt មិនមែនជាម៉ូឌែល ឬការអនុញ្ញាតផ្សេងទៀតទេ។ ការកំណត់ជាមុន និងតួនាទីគាំទ្រ None, Standard, Auto និង Manual។ Auto ជ្រើសរើសទម្រង់ពីអត្ថបទជំហានដោយមិនចាំបាច់ហៅម៉ូឌែលបន្ថែម។ Manual ទទួលយកឯកទេសរហូតដល់បួន និងការណែនាំផ្ទាល់ខ្លួន។ កិច្ចការដែលបានស្នើដោយ Planner អាចត្រូវបានកែសម្រួលមុនពេលទទួលយកផែនការ។

ID ម៉ូឌែល ឬការគិតពិចារណាដែលបានបញ្ចូលដោយដៃនៅតែជាជម្រើសរបស់អ្នក ប៉ុន្តែអ្នកផ្តល់សេវាអាចនឹងបដិសេធវា។ ការកែសម្រួលការកំណត់ជាមុនសកលមិនផ្លាស់ប្តូរការជជែកដែលកំពុងដំណើរការ ឬផែនការដែលបានទទួលយកជាអតីតកាលឡើយ។ ដើម្បីផ្លាស់ប្តូរការសន្ទនាទំនេរដោយចេតនា សូមប្រើការគ្រប់គ្រងការកំណត់រចនាសម្ព័ន្ធផ្ទាល់របស់វា ហើយរង់ចាំការបញ្ជាក់ទទួល។ ជម្រើសដែលត្រូវបានបិទគួរតែត្រូវបានចាត់ទុកថាជាដែនកំណត់សមត្ថភាព ឬវដ្តជីវិត មិនត្រូវរំលងដោយការកែសម្រួល JSON ដែលបានរក្សាទុកឡើយ។

ការណែនាំពាក់ព័ន្ធ: [សមត្ថភាពរបស់អ្នកផ្តល់សេវា](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## ការជជែក, Stop និងជួរ (queue)

ផ្ទាំងបើក (Open tabs), ថ្មីៗ (Recent) និងសេចក្តីព្រាង គឺជាកម្មសិទ្ធិនៃកិច្ចការតែមួយ។ ការបិទផ្ទាំងមួយនឹងដកវាចេញពី Open ប៉ុន្តែរក្សាទុកវានៅក្នុង Recent ហើយមិនបញ្ឈប់ដំណើរការរបស់អ្នកផ្តល់សេវារបស់វា ឬលំហូរការងារដែលបានគ្រប់គ្រងឡើយ។ ស្វែងរកប្រវត្តិ បើកការជជែកឡើងវិញ ឬបិទផ្ទាំងបន្ថែមទាំងអស់ពីម៉ឺនុយប្រវត្តិ។

Stop ធ្វើអន្តរាគមន៍កាត់ផ្តាច់វេនបច្ចុប្បន្ន។ រង់ចាំឱ្យការបញ្ឈប់បញ្ចប់សិន មុនពេលចុច Send បន្ទាប់៖ ការបញ្ជាក់ការកាត់ផ្តាច់មិនមែនជាការបញ្ចប់ដំណើរការនោះទេ។ អ្នកអាចវាយសេចក្តីព្រាងបន្ទាប់ក្នុងពេលដំណាលគ្នានេះបាន។

នៅក្នុងការជជែកធម្មតា Queue រក្សាទុកសំណើពេលក្រោយដាច់ដោយឡែកពីសេចក្តីព្រាងបច្ចុប្បន្ន។ Pause queue ទប់ទល់ការបញ្ជូនបន្ត។ Stop និង Quit ផ្អាកជួរ។ បន្ទាប់ពីចាប់ផ្តើមឡើងវិញ សូមចុច Resume ជាមុនសិន បន្ទាប់មកចុច Continue queue ឱ្យបានច្បាស់លាស់។

Uncertain មានន័យថាមិនដឹងពីស្ថានភាពបញ្ជូន។ សារបែបនេះមិនត្រូវបានផ្ញើម្តងទៀតដោយស្វ័យប្រវត្តិនោះទេ៖ ពិនិត្យមើលប្រវត្តិ ចម្លងអត្ថបទប្រសិនបើសមស្រប ហើយច្រានចោលធាតុនៅក្នុងជួរនោះ។ ការផ្ញើវាម្តងទៀត គឺជាសំណើថ្មីមួយដោយចេតនា។

ការជជែកដំណាក់កាលដែលគ្រប់គ្រងប្រើប្រាស់លំហូរការងាររបស់ពួកគេ មិនមែនជួរធម្មតាឡើយ។ Follow stage បង្ហាញដំណាក់កាលបច្ចុប្បន្ន។ ការជ្រើសរើសផ្ទាំងមួយទៀតដោយដៃនឹងបញ្ឈប់ការតាមដាន។ កំណត់ហេតុ CLI បង្ហាញការវិនិច្ឆ័យដាច់ដោយឡែកពីការឆ្លើយតប។

ការឆ្លើយតបបែប Markdown បង្ហាញចំណងជើង បញ្ជី តារាង តំណភ្ជាប់ និងប្លុកកូដ (fenced code)។ កាតឧបករណ៍ និងការវិនិច្ឆ័យ CLI នៅតែដាច់ដោយឡែកពីចម្លើយ។ ការគិត និងរង្វាស់ token ដែលរាយការណ៍ដោយម៉ូឌែលបង្ហាញតែនៅពេលដែលអ្នកផ្តល់សេវាបង្ហាញពួកវាពិតប្រាកដប៉ុណ្ណោះ។ កុំសន្និដ្ឋានពីការគិតពិចារណាឯកជន ឬការប្រើប្រាស់ពីចលនា (animation) ឱ្យសោះ។

បន្ទាប់ពីការផ្ញើមិនច្បាស់លាស់ ឬការបញ្ជាក់ទទួលពីជួរ សូមពិនិត្យមើលប្រវត្តិ ហើយព្យាយាមម្តងទៀតតែលើសំណើដែលបានរក្សាទុកដដែលនៅកន្លែងណាដែលមានជម្រើស។ បង្កាន់ដៃទទួលជួរមានន័យថាទំហំផ្ទុកបានទទួលយកធាតុនោះ មិនមែនមានន័យថា inference បានបញ្ចប់នោះទេ។ ការលុបធាតុជួរដែលមិនច្បាស់លាស់ ធ្វើឡើងបានតែជាការច្រានចោលច្បាស់លាស់ប៉ុណ្ណោះ វាមិនអាចដកហូត prompt ដែលបានបញ្ជូនរួចហើយនោះឡើយ។

ការណែនាំពាក់ព័ន្ធ: [ជួរសារដែលស្ថិតស្ថេរ (Durable message queue)](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## ឯកសារ, Git និងការបញ្ចប់

Files បង្ហាញថតកិច្ចការ។ ប្រៀបធៀបលទ្ធផលជាមួយតម្រូវការ បើកឯកសារ និងពិនិត្យមើល diff។ ការរក្សាទុកឯកសារ binary មិនបញ្ជាក់ពីការបង្ហាញត្រឹមត្រូវនៅក្នុងកម្មវិធីគោលដៅរបស់វាឡើយ។

Git ផ្តល់ស្ថានភាព ការផ្លាស់ប្តូរ និងប្រតិបត្តិការជាមួយលទ្ធផលដែលបានកត់ត្រាទុក។ Commit, merge និង push គឺជាប្រតិបត្តិការដោយដៃតាមលំនាំដើម។ ប្រតិបត្តិការដោយស្វ័យប្រវត្តិគឺជាជម្រើសដាច់ដោយឡែកសម្រាប់ផែនការដែលបានផ្ទៀងផ្ទាត់ពេញលេញ។

កុំផ្លាស់ប្តូរឯកសារកំពុងដំណើរការនៅចន្លោះពេលផ្ទៀងផ្ទាត់ និងការបោះពុម្ពផ្សាយ៖ ការអនុម័តត្រូវបានចងភ្ជាប់ទៅនឹងបៃ (bytes) ជាក់លាក់។ ទំនាស់ ការ push បរាជ័យ និងលទ្ធផលប្រតិបត្តិការដែលមិនស្គាល់ នឹងរារាំងដំណើរការទៅមុខ រហូតទាល់តែមានការសម្រេចចិត្តច្បាស់លាស់។ Auto មិនអនុញ្ញាតការបោះពុម្ពផ្សាយដោយស្ងាត់ៗឡើយ។

Work មិនបង្កើតសាខា Git ទេ ហើយក៏គ្មានការបញ្ចប់ Git ដែរ។ រក្សាទុកឯកសារដែលត្រូវការពីថតដែលបានជ្រើសរើស រួមទាំងកំណែ និងប្រភពផងដែរ។

កម្មវិធីកែសម្រួលឯកសារផ្តល់នូវការបន្លិចវាក្យសម្ព័ន្ធតាមកន្ទុយឯកសារ (extension), ការស្វែងរក និងជំនួស, ប្រវត្តិ undo, ការរុំបន្ទាត់ (line wrapping) និងសេចក្តីព្រាងតាមផ្ទាំងនីមួយៗ។ ការរក្សាទុកការពារការអ៊ិនកូដ UTF-8/UTF-16 ដែលគាំទ្រ និងបដិសេធទំនាស់នៃការកែប្រែពីខាងក្រៅ។ ការអ៊ិនកូដផ្សេងទៀត និងមាតិកា binary ត្រូវការកម្មវិធីកែសម្រួលខាងក្រៅ។ សេចក្តីព្រាងដែលមិនទាន់រក្សាទុកនឹងរារាំងការចាកចេញ (Quit) ពីកម្មវិធី រហូតទាល់តែម្ចាស់រក្សាទុក ឬបោះបង់ពួកវាចោល។

វាក្យសម្ព័ន្ធពេញលេញត្រូវបានបើកដំណើរការរហូតដល់ 8 MiB។ ឯកសារអត្ថបទធំជាងនេះបើកនៅក្នុងផ្ទាំង 256 KiB។ ទំហំ 8–64 MiB អាចត្រូវបានផ្ទុកពេញលេញដោយផ្ទាល់ដោយគ្មានវាក្យសម្ព័ន្ធ។ លើសពី 64 MiB ត្រូវប្រើប្រាស់ការកែសម្រួលតាមផ្ទាំង និងការស្វែងរកការផ្គូផ្គងបន្ទាប់ដែលមានដែនកំណត់។ នេះគឺជារបៀបឯកសារធំដែលមានកម្រិត មិនមែនស្មើនឹង Sublime Text សម្រាប់ឯកសារធំតាមអំពើចិត្តនោះទេ។

Open folder ប្រើប្រាស់បរិបទកិច្ចការបច្ចុប្បន្ន ឬបរិបទសាខា/worktree ជាជាងការបើកតែឃ្លាំងដើមដោយស្ងាត់ៗ។ ជួរដេកឯកសារអាចបង្ហាញថតមេនៃឯកសារនោះ។ ផ្លូវ (paths) ត្រូវបានផ្ទៀងផ្ទាត់ដោយ backend ធៀបនឹងការអនុញ្ញាតកិច្ចការដែលបានចុះឈ្មោះ។ ឯកសារ binary មិនអាចកែសម្រួលជាអត្ថបទធម្មតាបានទេ សូមប្រើកម្មវិធីមើលគោលដៅរបស់វា ហើយរក្សាទុកបៃដើម។

ការលុប Worktree ចេញគឺជាសកម្មភាពការពារដាច់ដោយឡែកមួយ។ បញ្ចប់វគ្គរចនាសម្ព័ន្ធ និង terminal ដែលបានភ្ជាប់មុនពេលលុបវាចេញ រួមទាំងវគ្គដែលនៅទំនេរផងដែរ។ ពិនិត្យមើលលទ្ធផល Git ដែលបានរក្សាទុក និងស្ថានភាពសង្គ្រោះ។ ការលុបកំណត់ត្រាកិច្ចការមិនមែនជាការជំនួសឱ្យការរក្សាទុកការងារដែលមិនទាន់ commit ដោយសុវត្ថិភាពនោះទេ។

ការណែនាំពាក់ព័ន្ធ: [កិច្ចសន្យាកម្មវិធីកែសម្រួលតាមប្រភេទ](../../../shared/editor.ts) · [គោលការណ៍ Git](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> មគ្គុទ្ទេសក៍ពេញលេញមិនទាន់ត្រូវបានបកប្រែជាភាសាចំណុចប្រទាក់របស់អ្នកនៅឡើយទេ។ កំពុងបង្ហាញឯកសារយោងជាភាសាអង់គ្លេស។

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

ការណែនាំពាក់ព័ន្ធ: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## ការកំណត់ ភាសា និងការកំណត់ឡើងវិញដោយសុវត្ថិភាព

ការកំណត់ទូទៅជ្រើសរើសកន្លែងធ្វើការ ភាសាចំណុចប្រទាក់ និងលំនាំដើម។ Connections គ្រប់គ្រង endpoint API។ Presets និង Review teams រក្សាការកំណត់រចនាសម្ព័ន្ធតួនាទី។ Remote control គ្រប់គ្រងព័ត៌មានសម្ងាត់មូលដ្ឋាន វិសាលភាពម៉ាស៊ីនមេ និងការអនុញ្ញាតរបស់ម្ចាស់។ Updates គ្រប់គ្រងប្រភព/ប៉ុស្តិ៍ចេញផ្សាយ។ About បង្ហាញអត្តសញ្ញាណជាក់លាក់នៃ build ដែលកំពុងដំណើរការ។

ភាសាចំណុចប្រទាក់គឺដាច់ដោយឡែកពីភាសាប្រអប់បញ្ចូល និងស្ថានភាពពិនិត្យឡើងវិញនៃឯកសារ។ ឈ្មោះផលិតផល, លេខសម្គាល់ពាក្យបញ្ជា, កន្ទុយឯកសារ, លេខសម្គាល់ម៉ូដែលរបស់អ្នកផ្តល់សេវា និងឈ្មោះដែលបង្កើតដោយអ្នកប្រើប្រាស់ នៅតែជាឧបករណ៍កំណត់អត្តសញ្ញាណ។ ជំនួយអនុវត្តតាមភាសាចំណុចប្រទាក់ដែលបានជ្រើសរើស នៅពេលដែលមានការបកប្រែបច្ចុប្បន្ន; ការបកប្រែដោយម៉ាស៊ីនត្រូវបានដាក់ស្លាក ហើយភាសាអង់គ្លេសនៅតែជាឯកសារយោងផ្លូវការ។

រក្សាទុកអនុវត្តការកំណត់រចនាសម្ព័ន្ធដែលបានបង្ហាញ។ ការកំណត់មូលដ្ឋានទិន្នន័យឡើងវិញ ឬការកំណត់ឡើងវិញពីរោងចក្រអាចលុបទិន្នន័យមេតារបស់កម្មវិធី; សូមរក្សាទុកឯកសារ និងការបម្រុងទុកដែលបានសាកល្បង មុនពេលប្រើការកំណត់ឡើងវិញដោយចេតនា។ ប្រតិបត្តិការទាំងនេះគឺជាសកម្មភាពរបស់ម្ចាស់មូលដ្ឋាន។ កុំប្រើពួកវាជាផ្លូវកាត់ដើម្បីស៊ើបអង្កេតលំហូរការងារដែលបរាជ័យ ឬកំណត់ត្រាដែលខូច។

ការណែនាំពាក់ព័ន្ធ: [សេចក្តីណែនាំអំពីការធ្វើមូលដ្ឋានីយកម្ម](../../LOCALIZATION.md) · [ការសង្គ្រោះទិន្នន័យ](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## សួរសំណួរទៅកាន់ជំនួយការ Help

បើកជំនួយ (Help) ជ្រើសរើសការកំណត់ជាមុនដែលបានរក្សាទុក និងភ្ជាប់នៅក្នុងផ្ទាំងជំនួយការរបស់វា ហើយសួរសំណួរអំពី ZIAForge។ ចម្លើយប្រើប្រាស់ការណែនាំជាភាសាអង់គ្លេសផ្លូវការបច្ចុប្បន្ន និងភាសាចំណុចប្រទាក់ដែលអ្នកបានជ្រើសរើស។ ប៊ូតុងយោងផ្នែកនឹងបើកប្រធានបទណែនាំដែលពាក់ព័ន្ធ ដូច្នេះអ្នកអាចប្រៀបធៀបការពន្យល់ជាមួយនឹងឯកសារយោងបាន។

ជំនួយការនេះរក្សាទុកការសន្ទនាឯកជនដាច់ដោយឡែកមួយរហូតដល់ 100 ធាតុដែលបានរក្សាទុក និង 3 MiB។ បញ្ចូលសំណួររហូតដល់ 12,000 តួអក្សរ; ប៊ូតុងផ្ញើ (Send) នឹងសួរសំណួរ, បញ្ឈប់ (Stop) នឹងបោះបង់ចម្លើយសកម្ម ខណៈពេលដែលរក្សាសំណួររបស់អ្នកឱ្យនៅដដែល ហើយសម្អាត (Clear) នឹងលុបការសន្ទនាជំនួយនេះចោល។ សេចក្តីព្រាងដែលមិនទាន់ផ្ញើ និងជម្រើសកំណត់ជាមុនរបស់អ្នកនៅតែរក្សាដដែលពេលបិទ ឬបើកជំនួយឡើងវិញនៅក្នុងសម័យប្រជុំកម្មវិធីដូចគ្នា ប៉ុន្តែសេចក្តីព្រាងមិនត្រូវបានរក្សាទុកក្នុងថាសរឹងទេ។ ជំនួយការមិនផ្ញើពាក្យបញ្ជាកម្មវិធី ផ្លាស់ប្តូរលំហូរការងារ ឬទទួលយកច្រកទ្វារឡើយ។ ដំបូន្មានមិនមែនជាការផ្ទៀងផ្ទាត់ជាក់ស្តែងនៃកិច្ចការ គណនី ឬការតភ្ជាប់ខាងក្រៅនោះទេ។

សម័យប្រជុំជំនួយ Claude Code និង API អនុវត្តគោលការណ៍គ្មានឧបករណ៍ដែលគាំទ្រ។ សម័យប្រជុំជំនួយ Codex និង Antigravity ដើម ទាមទារការអនុញ្ញាតកុំព្យូទ័រដើមរបស់ម្ចាស់មូលដ្ឋានដែលមានស្រាប់។ ប្រសិនបើវាត្រូវបានបិទ កម្មវិធីនឹងពន្យល់អំពីលក្ខខណ្ឌតម្រូវជាមុន ជាជាងការជ្រើសរើសអ្នកផ្តល់សេវាផ្សេង។ មានតែម្ចាស់ប៉ុណ្ណោះដែលអាចបើកវាបាននៅក្នុងការកំណត់ការគ្រប់គ្រងមូលដ្ឋាន; ជំនួយការមិនអាចបើកវាដោយខ្លួនឯងបានទេ។

ជំនួយ Codex ប្រើប្រាស់ sandbox អានតែប៉ុណ្ណោះ (read-only) និងបដិសេធសំណើសុំការអនុម័តឧបករណ៍។ Antigravity ប្រើប្រាស់របៀបរៀបចំផែនការ (plan mode) និងទង់ sandbox ដើមរបស់វា។ របៀបដើមទាំងនេះមិនមែនជាការធានាជាសកលអំពីការកម្រិតប្រព័ន្ធប្រតិបត្តិការនោះទេ។ ហាស (hash) នៃការណែនាំប្រភពកំណត់អត្តសញ្ញាណឯកសារយោងដែលត្រូវបានប្រើសម្រាប់ចម្លើយ; ការពន្យល់ដែលបានបង្កើតនៅតែអាចមានកំហុស ដូច្នេះសូមពិនិត្យមើលផ្នែកដែលបានភ្ជាប់មុនពេលចាត់វិធានការ។ ចម្លើយចាស់ៗត្រូវបានសម្គាល់នៅពេលដែលកំណែការណែនាំប្រភពរបស់វាខុសពីការណែនាំបច្ចុប្បន្ន។

ការណែនាំពាក់ព័ន្ធ: [ការថែទាំការណែនាំផ្លូវការ និងការបកប្រែ](../../HELP_MAINTENANCE.md) · [ជំនួយការកម្មវិធី និងការអនុញ្ញាត](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## ជំនួយការ និង Telegram

ជំនួយការប្រើប្រាស់ការកំណត់ជាមុនដែលបានជ្រើសរើស និង API គ្រប់គ្រងកម្មវិធីដូចគ្នា។ ការអនុញ្ញាតដើម្បីពិនិត្យមើលស្ថានភាព និងការអនុញ្ញាតដើម្បីអនុវត្តប្រតិបត្តិការ គឺដាច់ដោយឡែកពីគ្នា។ សូមពិនិត្យមើលពាក្យបញ្ជា និងលទ្ធផល៖ អត្ថបទរបស់ជំនួយការមិនមែនជាភស្តុតាងបញ្ជាក់ថា សកម្មភាពត្រូវបានបញ្ចប់នោះទេ។

Telegram អាចបើកដំណើរការបានដោយម្ចាស់មូលដ្ឋានតែប៉ុណ្ណោះ ជាមួយថូខឹនប៊ូតដែលមានស្រាប់ និង ID ម្ចាស់ជាលេខ។ ការគ្រប់គ្រងគឺសម្រាប់តែការជជែកឯកជនរបស់ម្ចាស់នោះប៉ុណ្ណោះ។ ប៊ូតដែលមិនទាន់កំណត់រចនាសម្ព័ន្ធ ឬអសកម្ម មិនត្រូវទទួលសាររបស់កម្មវិធីឡើយ។

កុំបិទភ្ជាប់ថូខឹនប៊ូតទៅក្នុងការជជែកធម្មតា។ ការកំណត់រចនាសម្ព័ន្ធសមាហរណកម្ម មិនមែនជាការបញ្ជាក់ពីការតភ្ជាប់ Telegram នោះទេ ហើយក៏មិនបង្កើតប៊ូតដោយស្វ័យប្រវត្តិដែរ។ រូបថតអេក្រង់ និងការឆ្លើយតបអាចមានផ្ទុកទិន្នន័យឯកជននៃកន្លែងធ្វើការ។

ជ្រើសរើសការកំណត់ជាមុនរបស់ជំនួយការ ហើយផ្តល់ការអនុញ្ញាតប្រតិបត្តិការកម្មវិធីដាច់ដោយឡែកពីការត្រួតពិនិត្យ។ ការប្រតិបត្តិការជំនួយការ Codex និង Antigravity ទាមទារការអនុញ្ញាតដើមរបស់ម្ចាស់។ ពួកវាមិនត្រូវបានជំនួសដោយស្ងាត់ៗសម្រាប់សម័យប្រជុំ API ឬ Claude ដែលគ្មានឧបករណ៍នោះទេ។ រូបថតអេក្រង់អាចត្រូវបានបង្ហាញនៅក្នុងការសន្ទនារបស់ជំនួយការ ប៉ុន្តែការបញ្ចូលរបស់ម៉ូដែលបច្ចុប្បន្នមិនរាប់បញ្ចូលការវិភាគរូបភាពទេ។ កុំសន្មតថាជំនួយការបានពិនិត្យមើលរូបភាពដោយផ្ទាល់ភ្នែក គ្រាន់តែដោយសារតែវាបានបង្ហាញរូបភាពនោះ។

ជំនួយការអាចពិនិត្យមើលសេចក្តីសង្ខេប កិច្ចការ ការជជែក ស្ថានភាពលំហូរការងារ បរិបទដំណើរការ និងបង្អួចកម្មវិធី តាមរយៈឧបករណ៍ដែលមានប្រភេទកំណត់ច្បាស់លាស់។ វាអាចផ្លាស់ប្តូរការកំណត់ធម្មតាដែលត្រូវបានអនុញ្ញាត និងចាប់ផ្តើមប្រតិបត្តិការកម្មវិធីដែលមានការអនុញ្ញាត។ វាមិនអាចផ្តល់សិទ្ធិដើម បង្ហាញព័ត៌មានសម្ងាត់ដែលបានរក្សាទុក ផ្លាស់ប្តូរការផ្តល់សិទ្ធិកន្លែងធ្វើការដើមពីចម្ងាយ ឬអនុម័តច្រកទ្វារ Forge ដោយគ្រាន់តែវាមានភាពងាយស្រួលនោះទេ។

ការណែនាំពាក់ព័ន្ធ: [កិច្ចសន្យាគ្រប់គ្រងកម្មវិធី](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## ដំណើរការប៊ូត Telegram ឯកជនរបស់អ្នក

បង្កើត ឬយកប៊ូតផ្ទាល់ខ្លួនរបស់អ្នក ចាប់ផ្តើមការជជែកឯកជនរបស់វា ហើយបញ្ចូលថូខឹនរបស់វា និង Telegram អ្នកប្រើប្រាស់ ID ជាលេខរបស់អ្នកនៅក្នុងការកំណត់ការគ្រប់គ្រងមូលដ្ឋាន។ បើកដំណើរការសមាហរណកម្មតែនៅពេលដែលអ្នកមានបំណងឱ្យកម្មវិធីតភ្ជាប់ប៉ុណ្ណោះ។ ID ម្ចាស់ គឺជាឧបករណ៍សម្គាល់អ្នកប្រើប្រាស់ មិនមែនជាឈ្មោះអ្នកប្រើ ឬ ID ប៊ូតនោះទេ។ មានតែសារពីអ្នកប្រើប្រាស់នោះនៅក្នុងការជជែកឯកជនដដែលនោះទេ ទើបត្រូវបានទទួលយក។

ប្រើ /start, /menu ឬ /status សម្រាប់ទិដ្ឋភាពទូទៅនៃកំណែដែលកំពុងដំណើរការ ចំនួនគម្រោង/កិច្ចការ និងស្ថានភាពកិច្ចការ។ ប៊ូតុងបើក Projects, Tasks, Screenshot, Help និង Language។ បញ្ជីបង្ហាញប្រាំបីធាតុក្នុងមួយទំព័រ ជាមួយការរុករក Back, Refresh, Home និង Previous/Next។ ប៊ូតុងគម្រោងត្រងបញ្ជីកិច្ចការ។ កាតកិច្ចការបង្ហាញពីវឌ្ឍនភាពលំហូរការងារដែលបានរក្សាទុក ម៉ូដែល/ការកំណត់ជាមុន និងសំណួរដែលមិនទាន់សម្រេចនៅពេលមាន។

បើក Chats នៃកិច្ចការមួយ ដើម្បីមើលការសន្ទនាដែលបើក/ថ្មីៗ និងការជជែកដំណាក់កាលលំហូរការងារជាមុន។ ការមើលជាមុននីមួយៗបង្ហាញសារអ្នកប្រើប្រាស់/ជំនួយការចុងក្រោយរហូតដល់ប្រាំមួយ ដោយកាត់ឱ្យខ្លីត្រឹម 200 តួអក្សរក្នុងមួយសារ។ ការពិចារណាឯកជនមិនត្រូវបានបង្ហាញទេ។ ការអានប្រវត្តិមិនចាប់ផ្តើមអ្នកផ្តល់សេវាទេ។ ការមើលជាមុនគឺសម្រាប់តែអានប៉ុណ្ណោះ៖ អត្ថបទធម្មតា និង /ask TEXT នៅតែផ្ញើទៅកាន់ជំនួយការកម្មវិធី មិនដែលផ្ញើដោយប្រយោលទៅកាន់ការជជែកនៃកិច្ចការដែលអ្នកកំពុងមើលនោះឡើយ។

Run / Continue អានឡើងវិញនូវលំហូរការងារ Code ឬ Work បច្ចុប្បន្ន ហើយចាប់ផ្តើមលំហូរការងារដែលបានរក្សាទុកដែលត្រូវតាមលក្ខខណ្ឌ។ Pause ស្នើសុំការផ្អាករបស់វា។ ទាំងពីរនេះមិនទទួលយកតម្រូវការ ការបញ្ជាក់ជាក់លាក់ ផែនការ ការរកឃើញនៃការពិនិត្យឡើងវិញ ឬសំណួរឡើយ; ការសម្រេចចិត្តដែលមិនទាន់សម្រេចរារាំងមិនឱ្យដំណើរការ Run។ ធ្វើការសម្រេចចិត្តនៅក្នុងកម្មវិធី ឬប្រើពាក្យបញ្ជាដែលបានកំណត់ប្រភេទច្បាស់លាស់ និងមានការអនុញ្ញាត រួមជាមួយច្រកទ្វារ និងការកែប្រែបច្ចុប្បន្នពិតប្រាកដរបស់វា។

ប្រើ Language ឬ /language ដើម្បីជ្រើសរើសភាសាចំណុចប្រទាក់ណាមួយក្នុងចំណោម 56 ដោយឈ្មោះដើមរបស់វា។ ចំណុចនេះរក្សាទុកចំណូលចិត្តសម្រាប់តែប៊ូត និងម្ចាស់នេះប៉ុណ្ណោះ។ ការប្រើប្រាស់ភាសាកម្មវិធីនឹងសម្អាតចំណូលចិត្តនោះ។ វាមិនផ្លាស់ប្តូរទាំងភាសារបស់កម្មវិធី ឬការអនុញ្ញាតចូលប្រើឡើយ; សារដែលមានស្រាប់មិនត្រូវបានផ្ញើឡើងវិញដោយស្វ័យប្រវត្តិទេ។

ការរុករកជាធម្មតាធ្វើបច្ចុប្បន្នភាពសារម៉ឺនុយដែលបានបោះផ្សាយដដែល។ ប៊ូតុងមានអត្តសញ្ញាណមិនច្បាស់លាស់ដែលផុតកំណត់បន្ទាប់ពី 15 នាទី ហើយអាចប្រើបានតែម្តងគត់; ការផ្លាស់ប្តូរកាតធ្វើឱ្យប៊ូតុងចាស់ៗរបស់វាលែងមានសុពលភាព។ ប៊ូតុងដែលផុតកំណត់ ត្រូវបានប្រើប្រាស់រួច សារមិនត្រូវគ្នា និងដំណើរការពីមុន មិនអាចអនុវត្តសកម្មភាពបានទេ។ សារដែលមិនអាចកែសម្រួលបានច្បាស់លាស់ អាចត្រូវបានជំនួសដោយកាតថ្មី; កំហុសបណ្តាញដែលមិនស្គាល់មិនត្រូវបានព្យាយាមម្តងទៀតជាសារថ្មីទេ។

នៅពេលបើកដំណើរការ អ្នកបោះឆ្នោត (poller) នឹងបោះបង់ការងារដែលនៅសេសសល់មុននេះ ហើយកត់ត្រាការទទួលយកបច្ចុប្បន្នភាពមុនពេលបញ្ជូន ដូច្នេះពាក្យបញ្ជាដែលត្រូវបានរំខាននឹងមិនត្រូវបានចាក់ឡើងវិញដោយស្វ័យប្រវត្តិនៅពេលចាប់ផ្តើមឡើងវិញនោះទេ។ ចំណុចនេះការពារការចាក់ឡើងវិញ; វាមិនធានាការបញ្ចប់នោះទេ។ ពិនិត្យស្ថានភាព/បរិបទមុនពេលចេញការងារថ្មីដោយចេតនាបន្ទាប់ពីមានកំហុស។ មិនមានការជូនដំណឹងអំពីស្ថានភាពកិច្ចការដោយស្វ័យប្រវត្តិនោះទេ។

ពាក្យបញ្ជាជាក់លាក់នៅតែមាន៖ /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot និង /ask TEXT។ /new {JSON} បង្កើតកិច្ចការមួយតាមរយៈ createTask ដែលបានកំណត់ប្រភេទ; /command {JSON} ផ្ញើពាក្យបញ្ជាកាតាឡុកជាក់លាក់។ អានកាតាឡុកផ្ទាល់សម្រាប់ទម្រង់អាគុយម៉ង់។ ការអនុញ្ញាតផ្នែកខាងក្រោយ និងការផ្តល់សិទ្ធិលើថតដូចគ្នាត្រូវបានអនុវត្តដូចនៅក្នុងកម្មវិធី។

កម្មវិធីមិនដែលផ្ញើតម្លៃថូខឹនប៊ូតដែលបានរក្សាទុកទៅកាន់ជំនួយការឡើយ។ ទោះជាយ៉ាងណាក៏ដោយ រូបថតអេក្រង់ សេចក្តីសង្ខេប និងអត្ថបទសន្ទនាអាចមានផ្ទុកព័ត៌មានគម្រោងឯកជន។ បញ្ឈប់សមាហរណកម្មក្នុងមូលដ្ឋានប្រសិនបើប៊ូត ឬគណនីម្ចាស់លែងទុកចិត្តបានទៀត។ ប្តូរថូខឹនដែលលេចធ្លាយជាមួយអ្នកផ្តល់សេវាប៊ូត បន្ទាប់មកធ្វើបច្ចុប្បន្នភាពការកំណត់រចនាសម្ព័ន្ធដែលបានអ៊ិនគ្រីបក្នុងមូលដ្ឋានរបស់វា។

ការណែនាំពាក់ព័ន្ធ: [ប៊ូតឯកជន និងពាក្យបញ្ជា](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## ការអនុញ្ញាតកុំព្យូទ័រដើមសម្រាប់តែម្ចាស់

ការចូលប្រើកុំព្យូទ័រដើមចាប់ផ្តើមដោយបិទដំណើរការ។ មានតែម្ចាស់ប៉ុណ្ណោះដែលអាចបើកវាបាននៅក្នុងការកំណត់មូលដ្ឋាន → ការគ្រប់គ្រងពីចម្ងាយ (Remote control)។ ជំនួយការ និងពាក្យបញ្ជា HTTP/MCP/Telegram មិនអាចបើកទង់នេះសម្រាប់ខ្លួនឯងបានទេ។ ប្រសិនបើប្រតិបត្តិការត្រូវបានបដិសេធ ជំនួយការគួរតែពិពណ៌នាអំពីការកំណត់ ហើយទុកឱ្យម្ចាស់ជាអ្នកសម្រេចចិត្ត។

នៅពេលបើកដំណើរការយ៉ាងច្បាស់លាស់ computer.run ទទួលយកឯកសារដែលអាចប្រតិបត្តិបាន អារេអាគុយម៉ង់ និងថតដំណើរការការងារដាច់ខាតស្រេចចិត្ត។ វាមិនប្រើការបន្ថែមតម្លៃសែល (shell interpolation) មានដែនកំណត់ 30 វិនាទី និងកម្រិតលទ្ធផលត្រឹម 1 MiB។ ថតដែលបានផ្តល់ដែលបាត់ ឬមិនត្រឹមត្រូវនឹងត្រូវបានបដិសេធ; ការលុបចោល cwd នឹងប្រើប្រាស់ថតការកំណត់ដែលគ្រប់គ្រងដោយកម្មវិធី មិនមែន HOME ទេ។ ការចាកចេញ (Quit) នឹងបោះបង់ពាក្យបញ្ជាដែលជាកម្មសិទ្ធិសកម្ម និងរង់ចាំការសម្អាតដំណើរការរបស់ពួកគេ។

វិសាលភាពនៃការអាន/ដំណើរការប្រតិបត្តិការរបស់កម្មវិធី និងការចូលប្រើដើម គឺជាការសម្រេចចិត្តដាច់ដោយឡែកពីគ្នា។ Worktree មិនកម្រិតការចូលប្រើប្រព័ន្ធឯកសាររបស់អ្នកផ្តល់សេវាដែលគ្មានការរឹតបន្តឹងនោះទេ។ ដកហូតការចូលប្រើដើមវិញបន្ទាប់ពីបញ្ចប់កិច្ចការ ប្រសិនបើវាមិនត្រូវបានទាមទារទៀតទេ ហើយពិនិត្យមើលបង្កាន់ដៃពាក្យបញ្ជា ជាជាងទទួលយកអត្ថបទរបស់ជំនួយការជាភស្តុតាង។

ការណែនាំពាក់ព័ន្ធ: [កិច្ចសន្យាគ្រប់គ្រងសម្រាប់តែម្ចាស់](../../../shared/control.ts).

<a id="remote"></a>

## កម្មវិធីរុករក និងធាតុពីចម្ងាយ

ម្ចាស់មូលដ្ឋានបើកដំណើរការម៉ាស៊ីនបម្រើ ហើយជ្រើសរើសអាសយដ្ឋាន ច្រក និងវិសាលភាពរបស់វា៖ អានសម្រាប់ការត្រួតពិនិត្យ ឬប្រតិបត្តិការសម្រាប់សកម្មភាព។ អាសយដ្ឋានលំនាំដើម 127.0.0.1 មានដំណើរការតែនៅលើកុំព្យូទ័រនេះប៉ុណ្ណោះ។ 0.0.0.0 ស្តាប់នៅលើចំណុចប្រទាក់បណ្តាញ; សូមពិនិត្យមើលការចូលប្រើបណ្តាញមុនពេលបើកដំណើរការវា។

កម្មវិធីរុករកបើកចំណុចប្រទាក់ដូចគ្នាបន្ទាប់ពីការចូលដោយប្រើថូខឹន។ កុំបញ្ចូលថូខឹននៅក្នុងតំណសាធារណៈ ឬរូបថតអេក្រង់។ HTTP តែមួយមុខមិនបានអ៊ិនគ្រីបចរាចរណ៍ទិន្នន័យទេ; សូមប្រើប្រាស់បណ្តាញដែលត្រូវបានការពារនៅលើបណ្តាញដែលមិនគួរឱ្យទុកចិត្ត។

ម្ចាស់កំណត់រចនាសម្ព័ន្ធធាតុផ្សេងទៀតតាមរយៈ URL និងថូខឹន។ ផ្នែកខាងក្រោយ (backend) ធ្វើជាប្រូកស៊ីសំណើ; ចំណុចនេះមិនចម្លងគម្រោងរបស់ពួកគេមកលើម៉ាស៊ីនមូលដ្ឋានទេ។ ពិនិត្យមើលធាតុដែលបានជ្រើសរើសមុនពេលធ្វើសកម្មភាពនីមួយៗ។

ពាក្យបញ្ជា និងព្រឹត្តិការណ៍ដែលបានកំណត់ប្រភេទច្បាស់លាស់ ផ្ទុកនូវការគ្រប់គ្រងកម្មវិធី។ វិសាលភាពអានមិនអនុញ្ញាតឱ្យមានការផ្លាស់ប្តូរកិច្ចការទេ។ ការគ្រប់គ្រងកុំព្យូទ័រដើម គឺជាជម្រើសដាច់ដោយឡែករបស់ម្ចាស់មូលដ្ឋាន ហើយចាប់ផ្តើមដោយបិទដំណើរការ។

កម្មវិធីត្រូវតែបន្តដំណើរការសម្រាប់ការគ្រប់គ្រងតាមរយៈកម្មវិធីរុករក, Telegram និងភ្នាក់ងារខាងក្រៅ។ ធាតុនីមួយៗមានប្រវត្តិរូបឯកជន ស្ថានភាពកិច្ចការ ថូខឹន និងច្រកម៉ាស៊ីនបម្រើផ្ទាល់ខ្លួន។ កុំប្រើប្រវត្តិរូបមួយឡើងវិញក្នុងពេលដំណាលគ្នារវាងធាតុឯករាជ្យ។ ព្រឹត្តិការណ៍កម្មវិធីរុករក និងការឆ្លើយតបពាក្យបញ្ជា ត្រូវបានកំណត់វិសាលភាពចំពោះធាតុដែលបានជ្រើសរើស; ការប្តូរ UI មិនផ្លាស់ប្តូរទីតាំងឯកសារ ឬចម្លងការចូលដើមនោះទេ។

ការណែនាំពាក់ព័ន្ធ: [HTTP និងការគ្រប់គ្រងធាតុ](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes និងភ្នាក់ងារខាងក្រៅផ្សេងទៀត

ប្រើប្រាស់ API គ្រប់គ្រងកម្មវិធីដែលបានផ្ទៀងផ្ទាត់ភាពត្រឹមត្រូវ ឬស្ពាន stdio MCP ដែលភ្ជាប់មកជាមួយ។ បើកដំណើរការម៉ាស៊ីនបម្រើក្នុងមូលដ្ឋាន ជ្រើសរើសអាន ឬដំណើរការប្រតិបត្តិការ ហើយកំណត់រចនាសម្ព័ន្ធម៉ាស៊ីនភ្ញៀវនីមួយៗជាមួយ URL និងថូខឹននៃធាតុនោះ។ Node.js 22 ឬថ្មីជាងនេះ គឺចាំបាច់ដើម្បីដំណើរការស្ពាន MCP ឯករាជ្យ; កម្មវិធី Electron មិនដំឡើងម៉ាស៊ីនភ្ញៀវភ្នាក់ងាររបស់អ្នកទេ។ URL កម្មវិធីរុករក មិនមែនជាចំណុចបញ្ចប់ HTTP MCP បែប Streamable ទេ៖ សូមផ្តល់វាជា ZIAFORGE_URL ទៅកាន់ស្ពាន stdio។

ស្ពាននេះបង្ហាញ ziaforge_status, ziaforge_commands, ziaforge_command និង ziaforge_screenshot។ ចាប់ផ្តើមជាមួយស្ថានភាព និងកាតាឡុកពាក្យបញ្ជាផ្ទាល់ បន្ទាប់មកអាន system.context សម្រាប់កិច្ចការដែលបានជ្រើសរើស។ ពាក្យបញ្ជាដែលមានប្រភេទកំណត់ច្បាស់លាស់ ធ្វើតាមការពិនិត្យការកែប្រែ ច្រកទ្វារ ថតកិច្ចការ និងការសម្អាតដូចគ្នានឹង UI មូលដ្ឋានដែរ។

កាតាឡុកពាក្យបញ្ជាផ្ទាល់រួមបញ្ចូល documentation.guide ដែលជាជំនួយជាភាសាអង់គ្លេសផ្លូវការ រួមជាមួយផ្លូវប្រភពរបស់វា និង sourceSha256។ ស្ថាបត្យករកម្មវិធីផ្ទៃក្នុងទទួលបានឯកសារយោងដូចគ្នាតាមរយៈឧបករណ៍របស់វា។ ចំណុចនេះផ្តល់ឱ្យភ្នាក់ងារនូវបរិបទផលិតផលទាំងមូលដោយមិនចាំបាច់ពឹងផ្អែកលើកំណត់ចំណាំចាស់ៗឡើយ។ ឯកសារមិនដែលផ្តល់ការអនុញ្ញាតចូលប្រើ ឬជំនួសការសម្រេចចិត្តបច្ចុប្បន្នរបស់មនុស្សឡើយ។

ភ្នាក់ងារគួរតែពិភាក្សាអំពីតម្រូវការ ការសម្រេចចិត្តបច្ចេកទេស និងការធ្វើផែនការចេញពីគំនិតខ្លីៗរបស់មនុស្ស។ ពួកគេត្រូវតែរក្សាច្រកទ្វារជាក់លាក់របស់មនុស្ស ម៉ូដែលដែលបានជ្រើសរើស គោលការណ៍ដោយដៃ/Auto និងការពិនិត្យឡើងវិញដែលទាមទារ។ ពួកគេមិនត្រូវប្រឌិតការអនុម័ត ចាក់បញ្ជាដែលមិនច្បាស់លាស់ឡើងវិញក្រោម ID ថ្មី ឬបោះផ្សាយការផ្លាស់ប្តូរ Git ដោយគ្មានចេតនារបស់ម្ចាស់នោះឡើយ។

កំណត់រចនាសម្ព័ន្ធម៉ាស៊ីនបម្រើ MCP ដែលមានឈ្មោះជាច្រើនសម្រាប់ការដំឡើងច្រើន។ ការប្តូរធាតុគឺជាការសម្រេចចិត្តលើការបញ្ជូនផ្លូវ មិនមែនជាការធ្វើសមកាលកម្មទេ។ ឧទាហរណ៍នៃការកំណត់រចនាសម្ព័ន្ធ OpenClaw និង Hermes មាននៅក្នុង AGENT_CONTROL.md; ការរៀបចំ និងភាពត្រូវគ្នាជាក់លាក់របស់ម៉ាស៊ីនភ្ញៀវត្រូវតែត្រួតពិនិត្យសម្រាប់កំណែម៉ាស៊ីនភ្ញៀវដែលបានដំឡើង។

ឃ្លាំងសម្ងាត់ requestId ខាងក្រៅគ្រាន់តែដកសំណើស្ទួនក្នុងចំនួនកំណត់ប៉ុណ្ណោះ ខណៈពេលដែលកម្មវិធីកំពុងដំណើរការ។ ប្រតិបត្តិការយូរអង្វែងប្រើប្រាស់អត្តសញ្ញាណផ្ទាល់ខ្លួនរបស់ពួកគេ៖ createRequestId សម្រាប់ការបង្កើតកិច្ចការ, commandId សម្រាប់ការសម្រេចចិត្តលើលំហូរការងារ, clientMessageId សម្រាប់សារ និង operationId សម្រាប់ការផ្លាស់ប្តូរ Git។ រក្សាអត្តសញ្ញាណដើម និងបន្ទុកទិន្នន័យបន្ទាប់ពីការទទួលស្គាល់ដែលមិនស្គាល់; អានស្ថានភាពដែលបានរក្សាទុកមុនពេលចេញការងារថ្មីដោយចេតនា។

ការណែនាំពាក់ព័ន្ធ: [សេចក្តីណែនាំអំពីម៉ាស៊ីនភ្ញៀវ MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI មូលដ្ឋាន និងដែនកំណត់ស្វ័យប្រវត្តិកម្ម

ឧបករណ៍បញ្ជូន ziaf គ្រប់គ្រងកម្មវិធីដែលកំពុងដំណើរការ និងលំហូរការងារដែលបានរក្សាទុកដូចគ្នា។ ចេញពីកូដប្រភព សូមប្រើ npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID, ឬ npm run ziaf -- pause --task TASK_ID។ ការទទួលស្គាល់ការចាប់ផ្តើម (Start) ជោគជ័យ មិនមានន័យថាកិច្ចការត្រូវបានបញ្ចប់នោះទេ។

--until-success បើកដំណើរការ Auto ដោយចេតនាសម្រាប់លំហូរការងារដែលបានរក្សាទុក ប៉ុន្តែសំណួរ ការពិនិត្យឡើងវិញ ច្រកទ្វារទទួលយក ដែនកំណត់ និងចំណុចត្រួតពិនិត្យនៅតែត្រូវបានអនុវត្ត។ Ctrl+C ចាកចេញពីឧបករណ៍បញ្ជូនដែលកំពុងសង្កេត; វាមិនបញ្ឈប់លំហូរការងាររបស់កម្មវិធីដោយស្វ័យប្រវត្តិនោះទេ។ សូមមើល CLI.md សម្រាប់លេខកូដចាកចេញ ចំណុចបញ្ចប់មូលដ្ឋាន និងការគ្រប់គ្រងប្រវត្តិរូប។

បច្ចុប្បន្ន ចំណុចប្រទាក់ស្វ័យប្រវត្តិកម្មរក្សាទុកនិយមន័យនៃការបង្ហាញ និងឧបករណ៍រាប់ការដំណើរការក្នុងមូលដ្ឋាន។ វាមិនមែនជាឧបករណ៍កំណត់កាលវិភាគកើតឡើងដដែលៗដែលមានការបញ្ជាក់ទេ ហើយក៏មិនបញ្ជាក់ថាវេនម៉ូដែលផ្ទៃខាងក្រោយបានដំណើរការនោះដែរ។ សម្រាប់ការប្រតិបត្តិពិតប្រាកដ សូមប្រើការគ្រប់គ្រងលំហូរការងារដែលបានរក្សាទុក ziaf ឬ API ដែលបានផ្ទៀងផ្ទាត់ភាពត្រឹមត្រូវ ហើយពិនិត្យមើលបង្កាន់ដៃរបស់ពួកគេ។ កុំច្រឡំផ្ទាំងបង្ហាញសាកល្បងជាមួយនឹងការកំណត់កាលវិភាគដោយស្វ័យប្រវត្តិដែលគ្មានអ្នកមើលការខុសត្រូវ។

ការណែនាំពាក់ព័ន្ធ: [ពាក្យបញ្ជា Dispatcher](../../CLI.md).

<a id="updates"></a>

## កំណែ និងការធ្វើបច្ចុប្បន្នភាព

About បង្ហាញកំណែពិតប្រាកដដែលកំពុងដំណើរការ។ ការធ្វើបច្ចុប្បន្នភាពជាសាធារណៈទាមទារឃ្លាំងចេញផ្សាយ GitHub ដែលគួរឱ្យទុកចិត្ត និងប៉ុស្តិ៍ដែលមានស្ថេរភាព (stable) ឬមើលជាមុន (preview)។ ការត្រួតពិនិត្យ ការទាញយក និងការដំឡើង មានស្ថានភាពដាច់ដោយឡែកពីគ្នា; កំហុសមិនមានន័យថាការធ្វើបច្ចុប្បន្នភាពត្រូវបានដំឡើងនោះទេ។

ការដំឡើងដោយស្វ័យប្រវត្តិគឺសម្រាប់ការចេញផ្សាយ macOS ដែលបានចុះហត្ថលេខា។ ការសាងសង់សម្រាប់ការអភិវឌ្ឍដែលមិនបានចុះហត្ថលេខា នឹងមិនត្រូវបានដំឡើងដោយស្វ័យប្រវត្តិតាមរយៈយន្តការនេះទេ។ សម្រាប់ការជំនួសដោយដៃ សូមចាកចេញពីកម្មវិធីបច្ចុប្បន្នទាំងស្រុង ហើយប្រើប្រាស់វត្ថុបុរាណដែលបានផ្ទៀងផ្ទាត់។

ការត្រួតពិនិត្យដោយស្វ័យប្រវត្តិនឹងដំណើរការភ្លាមៗនៅពេលបើកដំណើរការ បន្ទាប់មកដំណើរការរៀងរាល់ប្រាំមួយម៉ោងម្តង។

Stable មិនរាប់បញ្ចូលការចេញផ្សាយមើលជាមុនទេ; preview អនុញ្ញាតឱ្យមានការចេញផ្សាយសម្រាប់ការអភិវឌ្ឍផងដែរ។ ការត្រួតពិនិត្យជោគជ័យគ្រាន់តែបង្កើតទិន្នន័យមេតានៃការចេញផ្សាយដែលមានប៉ុណ្ណោះ។ ការទាញយក និងការដំឡើងត្រូវការកញ្ចប់វេទិកា និងប្រភពព័ត៌មានចេញផ្សាយដែលបានកំណត់រចនាសម្ព័ន្ធ។ ការចែកចាយ Linux DEB គឺជាផ្លូវកម្មវិធីដំឡើងដាច់ដោយឡែក; កុំសន្មតថា DEB ត្រូវបានធ្វើឱ្យប្រសើរឡើងដោយស្វ័យប្រវត្តិតាមរយៈយន្តការធ្វើបច្ចុប្បន្នភាព macOS ឡើយ។

ការណែនាំពាក់ព័ន្ធ: [ការត្រៀមខ្លួនរួចរាល់សម្រាប់ការចេញផ្សាយ](../../RELEASE_READINESS.md).

<a id="restart"></a>

## ការចាប់ផ្តើមឡើងវិញ និងការសង្គ្រោះ

នៅលើ macOS សូមប្រើ ចាកចេញ / ⌘Q សម្រាប់ការបិទទាំងស្រុង។ ការបិទបង្អួចអាចទុកឱ្យកម្មវិធីនៅតែដំណើរការ។ សូមចាកចេញពីកំណែចាស់ទាំងស្រុងមុនពេលជំនួសកម្មវិធី។

បន្ទាប់ពីបើកដំណើរការ សូមជ្រើសរើសកិច្ចការដដែល។ ប្រវត្តិ និងសេចក្តីព្រាងនឹងត្រឡប់មកវិញ។ ការបន្ត (Resume) ស្តារបរិបទដើម/មូលដ្ឋាន ប៉ុន្តែមិនផ្ញើសេចក្តីព្រាង មិនបន្តជួរដែលបានផ្អាក ឬផ្តល់សិទ្ធិឱ្យធ្វើប្រតិបត្តិការដែលមិនស្គាល់ម្តងទៀតទេ។

ប្រសិនបើផ្ទាំងសង្គ្រោះ (Recovery) បង្ហាញឡើង កុំកែសម្រួល JSON ដោយដៃ។ ពិនិត្យមើលប្រភេទឯកសារដែលរងផលប៉ះពាល់ រក្សាទុកឯកសារដើម និងជ្រើសរើសការបម្រុងទុកដែលមានសុពលភាព។ ការស្តារជួរចាស់ឡើងវិញ នឹងសម្គាល់ធាតុរបស់វាថាមិនប្រាកដប្រជា។

នៅពេលដែលការដឹកជញ្ជូនមិនត្រូវបានដឹង លំហូរការងារដែលបានគ្រប់គ្រងអាចត្រូវការការអនុញ្ញាតច្បាស់លាស់សម្រាប់បរិបទថ្មី។ ការងារមុនៗ និងការប៉ុនប៉ងដែលបានបរាជ័យនៅតែរក្សាដដែល; ការបដិសេធដែលអាចមើលឃើញ គឺមានសុវត្ថិភាពជាងភាពជោគជ័យដែលបានប្រឌិតឡើង។

បម្រុងទុកឯកសារកិច្ចការ និងប្រវត្តិរូបកម្មវិធីដោយបិទគ្រប់ធាតុទាំងអស់នៃកម្មវិធី។ ថតដែលបានចម្លងមិនមែនជាការស្តារឡើងវិញដែលបានសាកល្បងនោះទេ។ ប្រសិនបើការសង្គ្រោះតម្រូវឱ្យអ្នកជ្រើសរើសការបម្រុងទុកដែលមានសុពលភាព សូមរក្សាទុកឯកសារដែលខូចខាតពិតប្រាកដផងដែរ។ ការស្តារលំហូរការងារចាស់ ឬជួរឡើងវិញ មិនផ្តល់សិទ្ធិឱ្យចាក់ឡើងវិញនូវការសន្និដ្ឋានដែលមិនច្បាស់លាស់ ឬប្រតិបត្តិការ Git នោះទេ។

ការណែនាំពាក់ព័ន្ធ: [កិច្ចសន្យាសង្គ្រោះ](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## ការដោះស្រាយបញ្ហា

រកមិនឃើញ CLI៖ ពិនិត្យមើលការដំឡើង និងកំណែរបស់វានៅក្នុងស្ថានីយធម្មតា បន្ទាប់មកចាប់ផ្តើម ZIAForge ឡើងវិញ។ វត្តមាននៃឯកសារដែលអាចប្រតិបត្តិបានមិនមានន័យថាអ្នកបានចូលគណនីនោះទេ។ សូមប្រើប្រាស់យន្តការចូលគណនីផ្ទាល់របស់អ្នកផ្តល់សេវា។

ម៉ូដែលមិនមានដំណើរការ ឬការអនុញ្ញាតបានបរាជ័យ៖ ផ្ទុកការរកឃើញឡើងវិញ ជ្រើសរើស ID ដែលអាចប្រើបាន ហើយពិនិត្យមើលគណនី និងដែនកំណត់របស់អ្នក។ កុំធ្វើសំណើដែលមិនច្បាស់លាស់ឡើងវិញមុនពេលពិនិត្យមើលប្រវត្តិរបស់វា។

លំហូរការងារបានបញ្ឈប់៖ បើកដំណាក់កាលបច្ចុប្បន្ន សំណួរ បង្កាន់ដៃផ្ទៀងផ្ទាត់ ឬកំណត់ហេតុ CLI។ ដោះស្រាយមូលហេតុជាក់លាក់៖ សំណួរដែលមិនទាន់ឆ្លើយ ពាក្យបញ្ជា ការអនុញ្ញាតថត ឬដែនកំណត់នៃការប៉ុនប៉ង។ បន្ត (Continue) មិនអាចបង្វែរការត្រួតពិនិត្យដែលបរាជ័យឱ្យទៅជាជោគជ័យបានទេ។

ថតបាត់ ឬត្រូវបានជំនួស៖ ស្តារការចូលប្រើថតដើមឡើងវិញ ឬបង្កើតកិច្ចការថ្មី។ កម្មវិធីមិនត្រូវបន្តពី HOME ឡើយ។ ប្រសិនបើអ្នកសង្កេតឃើញ cwd ផ្សេងទៀត សូមបញ្ឈប់វេន និងរក្សាទុកការវិភាគរោគវិនិច្ឆ័យ។

សម្រាប់របាយការណ៍ សូមបញ្ចូលកំណែ About, ផ្លូវ, CLI/ម៉ូដែល, ឥរិយាបថដែលរំពឹងទុក និងជាក់ស្តែង, រូបថតអេក្រង់ និងស្រង់កំណត់ហេតុប្រកបដោយសុវត្ថិភាព។ លុបការសម្ងាត់ ខ្លឹមសារផ្ទាល់ខ្លួន និងផ្លូវដែលមិនអាចបោះផ្សាយបាន។

ទំព័រពីចម្ងាយមិនមានដំណើរការ៖ ផ្ទៀងផ្ទាត់ថាម្ចាស់បានបើកដំណើរការម៉ាស៊ីនបម្រើ ពិនិត្យមើលអាសយដ្ឋានស្តាប់ និងច្រក បន្ទាប់មកផ្ទៀងផ្ទាត់ភាពត្រឹមត្រូវជាមួយថូខឹននៃធាតុត្រឹមត្រូវ។ 401 បង្ហាញពីការផ្ទៀងផ្ទាត់ភាពត្រឹមត្រូវ; ការផ្លាស់ប្តូរដែលត្រូវបានបដិសេធអាចជាវិសាលភាពអាន ឬការគ្រប់គ្រងសម្រាប់តែម្ចាស់។ ការផ្លាស់ប្តូរថូខឹននឹងបិទម៉ាស៊ីនភ្ញៀវកម្មវិធីរុករកដែលមានស្រាប់។ កុំបង្ហាញច្រកត្រួតពិនិត្យ DevTools ដាច់ដោយឡែកជាការគ្រប់គ្រងកម្មវិធីពីចម្ងាយ។

ការរក្សាទុកកម្មវិធីកែសម្រួលត្រូវបានបដិសេធ៖ រក្សាសេចក្តីព្រាង ពិនិត្យមើលឯកសារបច្ចុប្បន្ននៅលើថាសរឹង និងដោះស្រាយទំនាស់នៃការផ្លាស់ប្តូរខាងក្រៅ។ កុំរំលងការប្រៀបធៀបដោយការសរសេរទិន្នន័យមេតារបស់កម្មវិធីឡើងវិញ។ ប្រសិនបើការផ្ទុកឯកសារធំពេញលេញមិនមានដំណើរការ សូមប្រើការកែសម្រួល/ស្វែងរកតាមបង្អួចដែលគាំទ្រ ឬកម្មវិធីកែសម្រួលខាងក្រៅ។

Telegram មិនមានដំណើរការ៖ បញ្ជាក់ថូខឹនប៊ូត ម្ចាស់ជាលេខ ការជជែកឯកជន និងស្ថានភាពនៅក្នុងមូលដ្ឋាន។ Webhook ឬ poller ដែលប្រកួតប្រជែងអាចរារាំងការបោះឆ្នោត; ZIAForge មិនលុប webhook ឬដណ្តើមយក poller ផ្សេងទៀតដោយស្វ័យប្រវត្តិនោះទេ។ ពាក្យបញ្ជាដែលត្រូវបានបដិសេធ ឬរំខាននៅព្រំដែនដែលមិនស្គាល់ នឹងមិនត្រូវបានចាក់ឡើងវិញដោយស្វ័យប្រវត្តិនោះទេ។

ការណែនាំពាក់ព័ន្ធ: [ការធ្វើតេស្ត និងការធ្វើរោគវិនិច្ឆ័យ](../../TESTING.md).

<a id="diagnostics"></a>

## រាយការណ៍បញ្ហា និងពិនិត្យមើលភស្តុតាង

កត់ត្រាកំណែសាងសង់ពិតប្រាកដដែលកំពុងដំណើរការពី About, OS/ស្ថាបត្យកម្ម, របៀបកិច្ចការ, ក្រុមហ៊ុនផ្តល់/ម៉ូដែលដែលបានជ្រើសរើស និងជំហានដែលបង្កើតបញ្ហាឡើងវិញ។ ពិពណ៌នាអំពីលទ្ធផលរំពឹងទុក និងលទ្ធផលជាក់ស្តែងដែលបានសង្កេតឃើញ។ រួមបញ្ចូលរូបថតអេក្រង់ដែលមានសុវត្ថិភាព និងបង្កាន់ដៃបញ្ជា ឬការផ្ទៀងផ្ទាត់ដែលពាក់ព័ន្ធ និងត្រូវបានរក្សាទុក ជាជាងប្រវត្តិរូបឯកជនទាំងមូល។

កំណត់ហេតុ CLI, កំណត់ត្រាព្រឹត្តិការណ៍, ប្រតិចារឹកម៉ូដែល, ស្រមោលដានកម្មវិធីរុករក និងរូបថតអេក្រង់ អាចបង្ហាញកូដប្រភព ផ្លូវផ្ទាល់ខ្លួន ឬថូខឹន។ ពិនិត្យ និងកែសម្រួលលុបព័ត៌មានរសើបមុនពេលចែករំលែក។ ឧបករណ៍កែសម្រួលកំណត់ហេតុដែលប្រឹងប្រែងអស់ពីសមត្ថភាព មិនបញ្ជាក់ថារូបថតអេក្រង់ ឬប័ណ្ណសារអាចបោះផ្សាយជាសាធារណៈបាននោះទេ។

សម្រាប់អ្នករួមចំណែក qa:doctor អានអត្តសញ្ញាណបរិស្ថាន/ការសាងសង់; qa:inspect បើកប្រវត្តិរូបដាច់ដោយឡែកជាមួយ stubs របស់អ្នកផ្តល់។ Fixture បង្ហាញផ្លូវកម្មវិធីដែលបានសាកល្បងដោយមិនចាំបាច់ទាក់ទងម៉ូដែល។ ការសន្និដ្ឋានផ្ទាល់, ការតភ្ជាប់ Telegram, ផ្ទៃតុ Linux ដើម, ការចុះហត្ថលេខា និងការត្រួតពិនិត្យវត្ថុបុរាណដែលបានខ្ចប់ គឺជាភស្តុតាងដាច់ដោយឡែក។ សូមមើល TESTING.md សម្រាប់ពាក្យបញ្ជាដែលអាចបង្កើតឡើងវិញបាន និងការសម្អាត។

ការណែនាំពាក់ព័ន្ធ: [ពាក្យបញ្ជាភស្តុតាង](../../TESTING.md).

<a id="privacy"></a>

## ទិន្នន័យមូលដ្ឋាន និងព្រំដែន

គម្រោង ប្រវត្តិ ផែនការ ឯកសារ និងការវិភាគរោគវិនិច្ឆ័យអាចមានផ្ទុកអត្ថបទឯកជន។ កុំបោះផ្សាយប្រវត្តិរូប ការចាប់យកទិន្នន័យដើម កូនសោ ឬកំណត់ហេតុពេញលេញជាមួយកូដប្រភព។

នៅលើ Linux ការរក្សាទុក API, ការគ្រប់គ្រង, Telegram និងព័ត៌មានសម្ងាត់នៃធាតុ ទាមទារ GNOME Secret Service ឬ KWallet ដែលបានដោះសោ; បើគ្មានកន្លែងផ្ទុកការសម្ងាត់ដែលគាំទ្រទេ ZIAForge បដិសេធមិនរក្សាទុកការសម្ងាត់ទាំងនេះទេ ជាជាងប្រើប្រាស់ basic_text fallback របស់ Electron។

ការផ្ទុកទិន្នន័យក្នុងមូលដ្ឋានមិនមានន័យថាសំណើនៅតែមាននៅលើកុំព្យូទ័ររបស់អ្នកនោះទេ៖ CLI/API ដែលបានជ្រើសរើសនឹងបញ្ជូនពួកវាទៅកាន់អ្នកផ្តល់សេវារបស់វា។ ថតការងារ និងការត្រួតពិនិត្យដំណើរការ មិនមែនជាការញែកដាច់នៃ OS ទេ។ សូមពិនិត្យមើលការអនុញ្ញាតដែលបានជ្រើសរើស។

បែងចែកប្រភេទភស្តុតាងឱ្យដាច់ពីគ្នា៖ fixtures សាកល្បងកម្មវិធីដោយគ្មានម៉ូដែល; native live សាកល្បង CLI/គណនីជាក់ស្តែង; ការត្រួតពិនិត្យកញ្ចប់បញ្ជាក់ពីវត្ថុបុរាណជាក់លាក់។ ការឆ្លងកាត់ការត្រួតពិនិត្យមួយ មិនធានាដល់ការត្រួតពិនិត្យផ្សេងទៀតទេ។

វិសាលភាពកម្មវិធី worktree និងប្រអប់បញ្ចូលសម្រាប់តែអាន (read-only prompt) គឺខុសពីការអនុវត្តដោយប្រព័ន្ធប្រតិបត្តិការ។ គោលការណ៍អ្នកត្រួតពិនិត្យ/អ្នកជំនួយ Antigravity រកឃើញការផ្លាស់ប្តូរនៅក្នុងភស្តុតាងកន្លែងធ្វើការដែលបានប្រមូល ជាជាងការអនុវត្តការចូលប្រើប្រព័ន្ធឯកសារបែបអានតែប៉ុណ្ណោះ។ ការគ្រប់គ្រងកុំព្យូទ័រដើមប្រតិបត្តិកម្មវិធីដែលបានអនុញ្ញាតដោយម្ចាស់នៅក្រៅព្រំដែនឧបករណ៍កម្មវិធីធម្មតា; សូមបិទវាវិញនៅពេលដែលលែងត្រូវការ។

ការណែនាំពាក់ព័ន្ធ: [ប្រភពដើម និងការបោះផ្សាយ](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## ស្វែងយល់ និងផ្លាស់ប្តូរគម្រោងប្រភពបើកចំហនេះ

សូមអាន AGENTS.md និង CONTRIBUTING.md ជាមុនសិន បន្ទាប់មក PROJECT_MAP.md សម្រាប់ព្រំដែនប្រភពបច្ចុប្បន្ន។ កិច្ចសន្យាប្រភេទដែលបានអនុវត្ត និងឯកសារលំហូរការងារ/អ្នកផ្តល់សេវាបច្ចុប្បន្ន គ្រប់គ្រងលើឥរិយាបថ។ CONCEPT.md និងផ្នែកដំបូងនៃស្ថានីយនៃ ARCHITECTURE.md រក្សាទុកចេតនាជាប្រវត្តិសាស្ត្រ ហើយមិនត្រូវច្រឡំជាមួយនឹងការទាមទារនៃការចេញផ្សាយបច្ចុប្បន្នឡើយ។

ប្រភពជំនួយជាភាសាអង់គ្លេសគឺ docs/help/en.json។ កុំកែសម្រួល USER_GUIDE.md ឬ website/guide.html ដែលត្រូវបានបង្កើតឡើងដោយដៃ។ ផ្លាស់ប្តូរផ្នែកផ្លូវការ ធ្វើបច្ចុប្បន្នភាពកិច្ចសន្យាដែលរងផលប៉ះពាល់ និងដំណើរការ node scripts/help/generate.cjs។ ជំនួយក្នុងកម្មវិធីអានប្រភពដូចគ្នា។ ពិនិត្យមើលការបន្ថែមឡើងវិញជាមួយនឹងការអនុវត្តជាក់ស្តែង រួមទាំងដែនកំណត់ ការអនុញ្ញាត និងផ្លូវដែលមិនគាំទ្រ។

ភាសាចំណុចប្រទាក់នីមួយៗក្នុងចំណោម 56 មានស្ថានភាពជំនួយដាច់ដោយឡែកនៅក្នុង docs/help/locales.json។ ជំនួយដែលបាត់ ឬមិនពេញលេញ នឹងត្រឡប់ទៅប្រើភាសាអង់គ្លេសវិញ។ អត្ថបទដែលបានបកប្រែដោយម៉ាស៊ីនពេញលេញ ត្រូវបានដាក់ស្លាក និងចងភ្ជាប់ទៅនឹងហាសនៃប្រភពភាសាអង់គ្លេស ដោយគ្មានការទាមទារថាមានការពិនិត្យឡើងវិញដោយមនុស្សនោះទេ។ ការបកប្រែដែលបានពិនិត្យឡើងវិញដោយមនុស្ស បន្ថែមពីនេះនឹងកត់ត្រាអ្នកពិនិត្យរបស់វា។ រាល់ការបកប្រែត្រូវតែរក្សាទុកលេខសម្គាល់ផ្នែក សកម្មភាព ឧបករណ៍កំណត់អត្តសញ្ញាណឯកសារ/ពាក្យបញ្ជា និងដែនកំណត់បច្ចេកទេស ប្រើទិសដៅត្រឹមត្រូវ និងធ្វើបច្ចុប្បន្នភាពឡើងវិញនៅពេលដែលប្រភពភាសាអង់គ្លេសរបស់វាផ្លាស់ប្តូរ។

មុនពេលបញ្ចេញ សូមដំណើរការ node scripts/help/generate.cjs --check ដើម្បីរកមើលលទ្ធផលដែលបានបង្កើតដែលលែងប្រើ រចនាសម្ព័ន្ធតំបន់មិនត្រឹមត្រូវ ឬតំណភ្ជាប់កិច្ចសន្យាមូលដ្ឋានដែលខូច។ ការត្រួតពិនិត្យការបកប្រែ UI និងការត្រួតពិនិត្យឥរិយាបថកម្មវិធីនៅតែដាច់ដោយឡែកពីគ្នា។ HELP_MAINTENANCE.md ផ្តល់នូវនីតិវិធីធ្វើបច្ចុប្បន្នភាពសម្រាប់អ្នករួមចំណែក និង AI; ឯកសារមិនត្រូវទាមទារការធ្វើតេស្តដែលបានឆ្លងកាត់ដែលមិនទាន់បានដំណើរការនោះទេ។

ការណែនាំពាក់ព័ន្ធ: [ផែនទីគម្រោងបច្ចុប្បន្ន](../../PROJECT_MAP.md) · [ការថែទាំឯកសារ](../../HELP_MAINTENANCE.md) · [សេចក្តីណែនាំសម្រាប់អ្នករួមចំណែក](../../../CONTRIBUTING.md) · [សេចក្តីណែនាំសម្រាប់ភ្នាក់ងារ](../../../AGENTS.md).
