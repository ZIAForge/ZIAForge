<!-- Generated from docs/help/en.json; source SHA-256 fed1d177bb98f1742eb79a0a8420de451327fc7bc9760b20bcaed4489b5fec8e. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: nl; served locale: nl; status: machine-translated. -->
# Gebruikershandleiding voor ZIAForge

Van intentie tot een geverifieerd resultaat. Een praktische handleiding voor Code, Work en applicatiebeheer.

Het Engels is toonaangevend. Automatisch vertaalde documentatie wordt afzonderlijk aangeduid van door mensen gecontroleerde vertalingen. Geautomatiseerde controles garanderen geen nauwkeurigheid in de doeltaal.

> Deze gids is machinaal vertaald vanuit de actuele Engelse bron. Menselijke controle is nog steeds welkom.

## Secties van de gids

- [Eerste stappen](#start)
- [Het juiste desktoppakket installeren](#install-platforms)
- [Code: vijf routes](#code)
- [Forge-discussie](#forge)
- [Documenten en beslissingen](#decisions)
- [Uitvoering en beoordeling](#execution)
- [Parallelle beoordelingsteams en de rapportarchitect](#review-teams)
- [Agentspecialisaties en promptbeleid](#specializations)
- [Work: van vraag tot document](#work)
- [Voorinstellingen, modellen en toegang](#models)
- [Chats, Stop en de wachtrij](#chat)
- [Bestanden, Git en voltooiing](#files)
- [API connections](#api)
- [Instellingen, talen en veilige reset](#settings)
- [Vraag het de Help-assistent](#help-assistant)
- [Assistent en Telegram](#assistant-control)
- [Bedien uw privé-Telegram-bot](#telegram)
- [Native computermachtiging alleen voor de eigenaar](#native-permissions)
- [Browser en externe instanties](#remote)
- [OpenClaw, Hermes en andere externe agents](#external-agents)
- [Lokale CLI en automatiseringslimieten](#local-cli)
- [Versie en updates](#updates)
- [Herstarten en herstel](#restart)
- [Probleemoplossing](#troubleshooting)
- [Problemen melden en bewijs inspecteren](#diagnostics)
- [Lokale gegevens en grenzen](#privacy)
- [Dit opensourceproject begrijpen en aanpassen](#project-contributors)

<a id="start"></a>

## Eerste stappen

ZIAForge brengt discussie, planning, uitvoering en verificatie samen in één taak. Kies Code voor een Git-project, of Work voor documenten, onderzoek en andere resultaten in een gewone map.

Begin met een kleine taak in een afzonderlijk project. Als u voor een native CLI kiest, installeer deze dan eerst en meld u in een terminal aan met het bijbehorende account. U kunt ook een API-verbinding configureren. Een CLI-abonnement en een betaalde API zijn afzonderlijke verbindingsmethoden; ZIAForge meldt u niet aan en draagt geen tegoeden tussen beide over.

1. Open Instellingen en controleer de werkruimtemap en taal. Over toont de exacte identiteit van de actieve build.
2. Voeg voor Code een Git-repository toe in de zijbalk. Kies voor Work een afzonderlijke map bij het aanmaken van de taak.
3. Sla een voorinstelling op met een CLI, model, redeneerinspanning en toegangsniveau. U kunt ook rechtstreeks Aangepast kiezen zonder opgeslagen voorinstelling.
4. Maak een taak aan, kies de route, rollen en handmatige of automatische voortgang. Controleer de keuzes vóór Start.

> Gebruik het artefact en de controlesom die door de beheerder zijn geleverd. Een preview kan niet-ondertekend zijn of geen gepubliceerd updatekanaal hebben. Ondersteuning voor desktop en native providers moet worden geverifieerd voor het exacte OS, de architectuur en het artefact; ondersteuning vanuit broncode alleen geldt niet als releasecertificering.

Gerelateerde instructies: [Projectoverzicht](../../../README.md) · [Compatibiliteit van providers](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Het juiste desktoppakket installeren

Kies een pakket voor uw besturingssysteem en CPU-architectuur: x64 of arm64. De build-pipeline kan macOS-DMG/ZIP, Windows-NSIS-installatieprogramma/ZIP en Linux-DEB/RPM/AppImage/tar.gz/ZIP-formaten produceren. Een gegenereerd bestand of cross-build is geen bewijs dat het bijbehorende installatieprogramma en de native UI op uw computer geslaagd zijn; raadpleeg het verificatierapport van die specifieke release.

macOS-builds die gebruikmaken van Electron 44 vereisen macOS 13 of hoger. Gebruik het arm64-pakket op Apple Silicon en het x64-pakket voor Intel. Sluit een oudere applicatie volledig af voordat u deze vervangt. Preview-pakketten kunnen niet-ondertekend en niet-genotariseerd zijn; verwar een ontwikkelingsartefact niet met een ondertekende openbare release.

Windows vereist een besturingssysteem dat wordt ondersteund door de gebundelde Electron-versie en Git beschikbaar in PATH. Kies de overeenkomende architectuur. Een niet-ondertekende preview beschikt niet over een Authenticode-certificering. Een draagbare ZIP moet de volledige applicatiemap en runtimebestanden behouden, en niet alleen het uitvoerbare bestand.

Linux vereist een compatibele grafische desktop, de door Electron vereiste systeembibliotheken en Git. Zorg voor versleutelde besturingsgegevens voor een werkende Secret Service zoals gnome-libsecret of KWallet; de onveilige basic_text-backend wordt niet geaccepteerd. Headless-/containersmoketests bieden geen garantie voor elke desktop of distributie.

Installeer een DEB met apt install ./file.deb of installeer een RPM via het pakketbeheer van uw distributie. Een AppImage vereist uitvoerrechten en geschikte FUSE-ondersteuning; --appimage-extract-and-run is een alternatief waar dit wordt ondersteund. Pak tar.gz- en ZIP-pakketten uit met al hun runtimebestanden. Houd gebruikersgegevens en applicatiebestanden gescheiden bij het vervangen van een pakket.

Gebruik om vanuit broncode te bouwen Node 24, Git en npm ci, inclusief het normale Electron-installatieprogramma. Native hercompilaties vereisen platformtools: Xcode-opdrachtregeltools op macOS; MSVC C++, Windows-SDK en Python op Windows; compiler, make, Python, pkg-config en de vereiste verpakkingstools op Linux. Volg PLATFORM_BUILDS.md voor de exacte opdrachten en actuele platformbeperkingen.

Releaseversies worden centraal gereserveerd en outputs zijn onveranderlijk. Een CI-verificatiebuild is geen gepubliceerd installatieprogramma. Broncodearchieven bevatten broncode, lockfile, documentatie en scripts; afhankelijkheden, inloggegevens, gebruikersprofielen en privé-onderzoek zijn uitgesloten. Leid nooit een native ARM- of Windows-validatie af uit een geslaagde x64-build.

Gerelateerde instructies: [Platformpakketten, vereisten en verificatiebeperkingen](../../PLATFORM_BUILDS.md) · [Build-identiteit en releasecontroles](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: vijf routes

Auto beoordeelt de omvang: een eenvoudige vraag kan worden afgerond met een antwoord, terwijl een grotere taak voorbereiding vereist. Los een bug op onderzoekt een oorzaak en bereidt een correctie voor. Specificatie eerst begint met de technische oplossing; Vereisten eerst begint met vereisten en acceptatiecriteria.

Multi-model gebruikt afzonderlijke contexten voor verkenning, ontwerp, implementatie en beoordeling. De routenaam vereist geen verschillende providers: elke rol gebruikt de voorinstelling of Aangepaste configuratie die u kiest.

Een Worktree isoleert de Git-wijzigingen van een taak. Branch werkt in de geselecteerde checkout. Controleer het project, de branch en het model vóór het starten; de taakbeschrijving wordt niet ook naar een gewone chat verzonden.

Gebruik voor een idee met openstaande product- of technische keuzes Vereisten eerst en leg de basis in discussie. Auto classificeert het verzoek; het is geen opdracht om elke korte formulering onmiddellijk te implementeren. Concept opslaan bewaart het verzoek zonder contact op te nemen met een model; Start slaat de beheerde flow op en start deze eenmalig. Eén tot vier taakkopieën hebben onafhankelijke aanmaak-ID's en rolinstellingen.

Gerelateerde instructies: [Code-workflowcontract](../../WORKFLOWS.md) · [Code-promptprofielen](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Forge-discussie

Start opent de centrale discussie. Reageer op natuurlijke wijze, stel tegenvragen, voeg beperkingen toe en bespreek technische keuzes. Het gesprek en de vragen blijven aan de taak gekoppeld.

Het verzenden van tekst geldt niet als acceptatie van een document of autorisatie van een nieuw implementatieplan. Een verduidelijking tijdens de uitvoering pauzeert eerst de beheerde beurt en heropent de betreffende scope. Een antwoord op een vraag binnen een reeds geaccepteerde stap kan die stap voortzetten.

Selecteer Vereisten, Specificatie of Planning om bewust terug te keren naar de basis. Een nieuwe versie vereist een nieuwe acceptatie van afhankelijke beslissingen. Voltooide stappen en hun bewijsmateriaal blijven bewaard; vervangen onvoltooide fasen blijven in de geschiedenis behouden.

Sessies in een beheerde fase verschillen van vrije chat. Gebruik de Forge-discussie in plaats van handmatige prompts rechtstreeks naar een aan de workflow toebehorende sessie te sturen.

Gerelateerde instructies: [Forge-discussiecontract](../../WORKFLOWS.md).

<a id="decisions"></a>

## Documenten en beslissingen

Open een document, controleer de versie en breng indien nodig bewerkingen aan. Het indienen van bewerkingen via discussie levert een nieuwe versie op; rapporten en geverifieerde resultaten worden niet met terugwerkende kracht herschreven.

Bewerk de volgorde, instructies, acceptatiecriteria en verificatieopdrachten voordat u een voorgesteld plan accepteert. Autoriseer concrete opdrachten die u begrijpt: ze worden uitgevoerd in de taakmap. Multi-model stelt één implementatiestap voor de gehele taak voor, met details in de bijbehorende documenten en instructies.

Goedkeuren is een afzonderlijke, weloverwogen beslissing. Auto omzeilt geen vragen of de acceptatie van vereisten, specificaties en plannen. Een extern gewijzigd document kan een oude goedkeuring niet hergebruiken.

Voorbereidingsbestanden verschijnen als artefacten. Hun versie, producerende fase en hash koppelen ze aan een resultaat. Code-documenten worden buiten de worktree bewaard en komen niet automatisch in een commit terecht.

Controleer zowel het document als de weergegeven beslissing voordat u accepteert. Acceptatie bindt het huidige gate-ID, de planrevisie en de bewaarde document-hashes. Vraag om wijzigingen wanneer de scope of het bewijsmateriaal onjuist is. Als een beslissing verouderd is geraakt, laad dan de opgeslagen status opnieuw voordat u een nieuwe keuze maakt; een gewijzigd bestand kan niet onder een eerdere versie worden geaccepteerd.

Gerelateerde instructies: [Workflow-gates en documentversies](../../WORKFLOWS.md).

<a id="execution"></a>

## Uitvoering en beoordeling

Taken toont daadwerkelijke stappen, de huidige poging, verificatie en beoordelingsresultaten. Een agent die “klaar” zegt, voltooit een stap niet: het vereiste bewijsmateriaal uit het plan moet aanwezig zijn.

De handmatige modus pauzeert tussen in aanmerking komende stappen. Auto laat geverifieerde stappen doorgaan en staat een begrensd aantal herhaalpogingen toe. Stoppen na maakt altijd een controlepunt aan. Pauzeren stopt het actieve werk van de workflow; het sluiten van een paneel stopt dit niet.

Een onafhankelijke beoordelaar gebruikt een afzonderlijke context met bestanden en verificatieresultaten. Elke vereiste blokkerende bevinding moet worden opgelost; meerdere beoordelaars kunnen een blokkerende fout niet wegstemmen.

In Multi-model vereist het corrigeren van bevindingen een expliciete beslissing. Een correctie start niet stilletjes een nieuwe beoordeling: Opnieuw beoordelen opent een nieuwe cyclus. Beoordelingsopmerkingen kunnen om heroverweging door de coördinator verzoeken zonder de implementatie te herhalen.

Voltooide stappen kunnen niet geruisloos worden bewerkt. Bij TDD moet Rood daadwerkelijk om de verwachte reden mislukken, waarna Groen moet slagen. Een begrensd aantal pogingen voorkomt eindeloze herhalingen.

Sla onafhankelijke CLI/API-beoordelaars op in Instellingen → Beoordelingsteams en selecteer het team vervolgens in Code of Work. Beoordelaars draaien parallel, gevolgd door de rapportarchitect van het team. U kunt ook onafhankelijke beoordelaars configureren zonder opgeslagen team. De rapportarchitect ontvangt uitsluitend anonieme gestructureerde rapporten, zonder projectbestanden of tools; deze isolatie vereist momenteel Claude Code of API.

Elke implementatiestap vereist een uitvoerbare controle, een vereiste onafhankelijke beoordeling, of beide. Voorbereidingsfasen behouden daarentegen gevalideerde resultaten en artefactontvangstbewijzen; deze doen niet alsof implementatietests zijn uitgevoerd. Een opdracht slaagt pas wanneer de daadwerkelijke exitstatus en het opruimen van eigen processen zijn bevestigd. Een Rood-controle voor TDD moet normaal falen vóór implementatie en Groen-verificatie; een ontbrekend uitvoerbaar bestand of een time-out is geen geldig Rood-resultaat.

Standaard stroomonderbrekers stoppen na drie mislukte pogingen bij één stap of vijftig pogingen in totaal. Een onderbreking verbruikt een poging, maar telt op zichzelf niet als een mislukte poging. Limieten en voltooid bewijsmateriaal blijven behouden na een herstart; Opnieuw proberen stelt ze niet opnieuw in. Lees de bewaarde foutmelding voordat u een nieuwe poging autoriseert.

Gerelateerde instructies: [Verificatie en beoordeling](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Parallelle beoordelingsteams en de rapportarchitect

Open Instellingen → Beoordelingsteams en sla een team op. Voeg onafhankelijke beoordelaars toe met hun eigen CLI of API, model, redeneerinspanning en specialisatie, en kies vervolgens een rapportarchitect. Selecteer het team in de beoordelingsconfiguratie van de taak. Een voorinstelling van een uitvoerder kan ook door een beoordelaar worden gebruikt, en Aangepast blijft beschikbaar; onafhankelijke rollen behouden afzonderlijke contexten.

Beoordelaars werken parallel aan hetzelfde taakbewijsmateriaal. Elk vereist rapport, elke fout en elk oordeel wordt bewaard. De architect ontvangt anonieme genummerde rapporten zonder namen van beoordelaars, model- of provideridentiteiten, oorspronkelijke taakinhoud, repositorytoegang of tools. Deze vergelijkt de rapporten en levert één gestructureerd oordeel op; deze voert geen nieuwe broncodebeoordeling uit.

Een blokkerende bevinding of een afwijzing door een vereiste beoordelaar kan niet terzijde worden geschoven door een meerderheidsstemming of voorkeur van de architect. Ontbrekende of foutief geformatteerde rapporten verhinderen goedkeuring. Controleer de individuele bevindingen en de geaggregeerde beslissing voordat u accepteert of correcties autoriseert. Een opgeslagen team wordt voor de run vastgesteld en bevroren; het bewerken van de voorinstelling herschrijft voltooid bewijsmateriaal niet.

De architect die uitsluitend rapporteert, gebruikt momenteel ondersteunde toolvrije configuraties van Claude of API. Codex en Antigravity blijven beschikbaar als beoordelaars, maar worden geweigerd voor deze geïsoleerde architectrol totdat er een geverifieerd toolvrij contract bestaat. Een prompt met alleen “geen tools” is niet voldoende.

> De ontwerp-/beoordelingspipeline van Code Multi-model en een opgeslagen parallel beoordelingsteam zijn afzonderlijke bedieningselementen. Behoud het geselecteerde aangepaste beoordelingsbeleid; ga er niet van uit dat één route elke beoordelingsfunctie inschakelt.

Gerelateerde instructies: [Getypeerde teamconfiguratie](../../../shared/review-team.ts) · [Beoordelingsaggregatie](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Agentspecialisaties en promptbeleid

Een model is de uitvoeringsengine; een specialisatie is een instructieprofiel. Kies Geen voor geen toegevoegde specialisatie, Standaard voor de standaardhandleiding, Auto voor een relevante ingebouwde handleiding, of Handmatig voor geselecteerde handleidingen en uw eigen begrensde instructies. Voorinstellingen kunnen de selectie behouden.

De oorspronkelijke catalogus omvat algemene programmering, architectuur, beveiliging, betrouwbaarheid, prestaties, testen en interface-bruikbaarheid. Auto gebruikt de beschikbare taak-/staptekst om een gids te selecteren; het roept niet stiekem een ander model aan en certificeert geen expertise. Planningsuggesties kunnen worden geïnspecteerd en gewijzigd voordat het implementatieplan wordt geaccepteerd.

Beoordelingsspecialisaties helpen de aandacht te richten, maar vervangen nooit onafhankelijk bewijsmateriaal, toegangsbeperkingen of het gestructureerde oordeel. Behandel aangepaste instructies als onderdeel van de taakscope: gebruik ze niet om documentacceptatie, toolbeleid, authenticatie of fouten van beoordelaars te omzeilen.

Gerelateerde instructies: [Oorspronkelijke promptcatalogus](../../../shared/specializations.ts).

<a id="work"></a>

## Work: van vraag tot document

Work vereist geen Git. Standaard maakt een afzonderlijke taakmap aan; Aangepast selecteert een bestaande map via de native kiezer. Concept opslaan bewaart instellingen zonder inferentie; Start voert de eerste fase uit.

Auto antwoordt direct of stelt een passend plan met echte Taken voor. Brainstorm maakt ideas.md aan voordat u meer ideeën of een evaluatie kiest. Research bewaart findings.md, bronnen en beperkingen. Schrijven gaat van intentie en, wanneer nuttig, outline.md naar een beschrijvend document of draft.md; revisies behouden eerdere versies.

Selecteer bestandsinvoer via de native kiezer en verwijs ernaar met @. De app kopieert ze als onveranderlijke taakinvoer en valideert hun identiteit vóór een run. Standaard maakt een taakmap in eigendom van de applicatie; toegang tot een Aangepaste map is een opgeslagen eigenaarsmachtiging. Een opgeslagen, nog niet gestart concept kan van map veranderen.

Maak 1–4 kopieën met onafhankelijke uitvoerderinstellingen. Taken die overlappende mappen gebruiken, kunnen niet gelijktijdig schrijven. Deze coördinatie geldt voor ZIAForge-bewerkingen, niet voor willekeurige externe programma's.

Deep Brainstorm heeft standaard drie onafhankelijke workers en ondersteunt er maximaal acht. Selecteer hun volgorde en configuraties, inclusief hergebruik van een voorinstelling in afzonderlijke contexten. Vragen van workers behouden hun herkomst; onjuist geformatteerde rapporten krijgen één poging tot formaatherstel. Gedeeltelijke fouten blijven zichtbaar in plaats van als unaniem succes te worden gepresenteerd.

Deep combineert bewaarde rapporten van workers in brainstorm_report.md en vraagt altijd om een gebruikersbeslissing. Een kleine vervolgactie herziet het rapport via de coördinator; een grote wijziging start een nieuwe ronde van de bevroren workers. Artefacten behouden hun versies.

Vastgestelde rollen worden bevroren bij het aanmaken van de taak of bij het expliciet opslaan van een concept. Na de eerste aanroep kan alleen de automatische/handmatige voortgang nog veranderen; gebruik een nieuwe taak voor afwijkende rol- of modelinstellingen. Het bewerken van een globale voorinstelling wijzigt latere fasen niet geruisloos.

De handmatige modus pauzeert tussen in aanmerking komende fasen, waaronder een substantiële Schrijven-outline. Auto kan doorgaan voorbij die outline. Vragen, voorgestelde uitvoerbare plannen, de richting van Brainstorm en de beoordeling van Deep-rapporten blijven expliciete beslissingen, zelfs in Auto. Een citaat alleen bewijst niet dat er gebrowst is, en een bewaard binair bestand alleen bewijst niet de correcte weergave ervan.

Gerelateerde instructies: [Work-modi en -beslissingen](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Voorinstellingen, modellen en toegang

Een voorinstelling slaat een CLI/API, model, redeneerinspanning en machtigingen op. De chat-voettekst bevat segmenten voor voorinstelling, CLI, model en opties. Aangepast werkt zonder voorinstelling; Voorinstelling maken slaat de huidige selectie op.

De catalogus is afkomstig van de geselecteerde geïnstalleerde CLI of API waar dit wordt ondersteund. Vernieuwen werkt de lijst bij zonder de selectie te wijzigen. Voer een expliciet model-ID in als detectie niet beschikbaar is; de provider moet dit nog steeds ondersteunen. Redeneerniveaus zijn afhankelijk van het model en de CLI. Provider-standaard verschilt van het expliciete token none.

Pas wijzigingen pas toe na bevestiging door de backend. Wisselen is beperkt tijdens een actieve beurt of een niet-lege wachtrij. Concepten en zichtbare geschiedenis blijven behouden, maar het wisselen van provider draagt hun besloten interne status niet over.

In Forge is het rollabel van belang: voorbereiding kan een afzonderlijke Planner gebruiken. De voettekst wijzigt de weergegeven rol; beoordelaars en helpers worden geselecteerd in de workflowinstellingen. Beleid voor reeds geverifieerde implementatie kan vergrendeld zijn.

Machtigingen verschillen per provider. Alleen-lezen en Schrijven naar werkruimte zijn beschikbaar waar de adapter deze ondersteunt. Antigravity gebruikt native CLI-instellingen of expliciet geselecteerde volledige toegang. Volledige toegang is geen sandbox.

Specialisatie voegt promptbegeleiding toe, geen ander model of andere machtiging. Voorinstellingen en rollen ondersteunen Geen, Standaard, Auto en Handmatig. Auto selecteert profielen op basis van staptekst zonder een extra modelaanroep; Handmatig accepteert maximaal vier specialismen en aangepaste instructies. Door de planner voorgestelde toewijzingen kunnen worden bewerkt voordat het plan wordt geaccepteerd.

Een handmatig ingevoerd model-ID of redeneerinspanning blijft uw keuze, maar de provider kan dit weigeren. Het bewerken van een globale voorinstelling wijzigt een actieve chat of een geaccepteerd plan niet met terugwerkende kracht. Gebruik de eigen configuratieknoppen van een inactief gesprek en wacht op bevestiging om dit bewust te wijzigen. Een uitgeschakelde optie moet worden opgevat als een capaciteits- of levenscyclusbeperking, en niet worden omzeild door opgeslagen JSON te bewerken.

Gerelateerde instructies: [Mogelijkheden van providers](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Chats, Stop en de wachtrij

Geopende tabbladen, Recent en concepten behoren tot één taak. Het sluiten van een tabblad verwijdert het uit Geopend maar behoudt het in Recent en stopt het bijbehorende providerproces of de beheerde workflow niet. Doorzoek de geschiedenis, heropen een chat of sluit alle extra tabbladen vanuit het geschiedenismenu.

Stop onderbreekt de huidige beurt. Wacht tot het stoppen is voltooid voordat u de volgende keer op Verzenden klikt: een bevestiging van de onderbreking is nog geen procesvoltooiing. Ondertussen kunt u het volgende concept typen.

In een gewone chat slaat Wachtrij een later verzoek afzonderlijk van het huidige concept op. Wachtrij pauzeren houdt verdere levering tegen. Stop en Afsluiten pauzeren de wachtrij. Kies na een herstart eerst Hervatten en vervolgens expliciet Wachtrij voortzetten.

Onzeker betekent dat de aflevering onbekend is. Een dergelijk bericht wordt niet automatisch opnieuw verzonden: inspecteer de geschiedenis, kopieer indien gewenst de tekst en verwijder het item uit de wachtrij. Het opnieuw verzenden is een nieuw, weloverwogen verzoek.

Chats in een beheerde fase gebruiken hun workflow, niet de gewone wachtrij. Fase volgen toont de huidige fase; het handmatig selecteren van een ander tabblad stopt het volgen. CLI-logboeken tonen diagnostische gegevens afzonderlijk van het antwoord.

Markdown-antwoorden geven koppen, lijsten, tabellen, links en omheinde codeblokken weer. Toolkaarten en CLI-diagnostiek blijven gescheiden van het antwoord. Door het model gerapporteerde denkprocessen en tokentelling verschijnen alleen wanneer de provider deze daadwerkelijk vrijgeeft; leid geen intern redeneren of verbruik af uit animaties.

Inspecteer na een onzekere verzending of wachtrijbevestiging de geschiedenis en probeer alleen hetzelfde bewaarde verzoek opnieuw waar dit wordt aangeboden. Een ontvangstbewijs van de wachtrij betekent dat de opslag het item heeft geaccepteerd, niet dat de inferentie is voltooid. Verwijder een onzeker wachtrij-item alleen als een expliciete afwijzing; het kan een reeds afgeleverde prompt niet intrekken.

Gerelateerde instructies: [Duurzame berichtenwachtrij](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Bestanden, Git en voltooiing

Bestanden toont de taakmap. Vergelijk resultaten met vereisten, open documenten en inspecteer diffs. Het bewaren van een binair bestand bewijst niet de correcte weergave in de doelapplicatie.

Git biedt status, wijzigingen en bewerkingen met vastgelegde resultaten. Commit, merge en push zijn standaard handmatig; automatische bewerkingen zijn afzonderlijke keuzes voor een volledig geverifieerd plan.

Wijzig werkbestanden niet tussen verificatie en publicatie: goedkeuring is gekoppeld aan de exacte bytes. Conflicten, mislukte pushes en onbekende bewerkingsresultaten blokkeren de voortgang tot een expliciete beslissing. Auto autoriseert publicatie niet geruisloos.

Work maakt geen Git-branches aan en heeft geen Git-afronding. Bewaar de vereiste documenten uit de geselecteerde map, inclusief versies en bronnen.

De bestandseditor biedt syntaxisaccentuering op basis van extensie, zoeken en vervangen, geschiedenis van ongedaan maken, regelterugloop en concepten per tabblad. Bij het opslaan blijft de ondersteunde UTF-8/UTF-16-codering behouden en worden conflicten door externe wijzigingen geweigerd. Andere coderingen en binaire inhoud vereisen een externe editor. Niet-opgeslagen concepten verhinderen het Afsluiten van de applicatie totdat de eigenaar ze opslaat of weggooit.

Volledige syntaxisaccentuering is ingeschakeld tot 8 MiB. Grotere tekstbestanden openen in vensters van 256 KiB; 8–64 MiB kan expliciet volledig worden geladen zonder syntaxisaccentuering. Boven 64 MiB gebruikt u vensterbewerking en begrensde volgende-overeenkomst-zoekacties. Dit is een beperkte modus voor grote bestanden, geen gelijkwaardigheid met Sublime Text voor willekeurig grote documenten.

Map openen gebruikt de context van de huidige taak of branch/worktree, in plaats van geruisloos alleen de oorspronkelijke repository te openen. Een bestandsrij kan de bovenliggende map van dat bestand onthullen. Paden worden door de backend gevalideerd aan de hand van geregistreerde taakmachtigingen. Binaire bestanden kunnen niet als platte tekst worden bewerkt; gebruik de beoogde viewer en behoud de originele bytes.

Het verwijderen van een worktree is een afzonderlijke, beveiligde actie. Beëindig gekoppelde gestructureerde sessies en terminals voordat u deze verwijdert, inclusief sessies die inactief zijn. Inspecteer het opgeslagen Git-resultaat en de herstelstatus; het verwijderen van een taakrecord is geen vervanging voor het veilig bewaren van niet-gecommitte werk.

Gerelateerde instructies: [Getypeerd editorcontract](../../../shared/editor.ts) · [Git-beleid](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> De volledige gids is nog niet vertaald naar je interfacetaal. De Engelse referentie wordt getoond.

Connections adds an explicitly selected OpenAI-compatible endpoint. Enter a name, base URL, model and a key if needed. Select Chat Completions for existing integrations or Responses for function rounds, provider tool progress and generated images. Existing connections retain Chat Completions until you change them explicitly.

HTTPS is required except for loopback HTTP. Use a plain endpoint without credentials, queries or fragments. Redirects are refused. Keys use supported OS encryption and are never returned to the UI. Changing the endpoint requires re-entering or clearing its key. Leaving the key field blank preserves a saved key.

Workspace file tools execute in the backend-resolved local task folder, with relative paths and checks against traversal and links. Every file write needs explicit approval and an unchanged expected revision. Read-only sessions expose only read tools. In Responses, Allow local commands separately enables approved executable/argument calls on macOS and Linux. Command supervision is unavailable on Windows; the adapter does not advertise that tool there. Commands always require owner approval and are not an operating-system sandbox.

The Codex connector profile identifies that gateway’s Responses tool-progress extension. Native provider tools execute on the server, separately from caller tools on your computer. Local read-only permissions do not constrain the server. A connector cannot be selected for a report-only architect that requires all tools disabled: unsupported isolation fails rather than silently allowing native tools. Select an endpoint that can enforce the required policy.

Generated PNG, JPEG and WebP results appear as separate image cards, with Save image, outside collapsed tool output. Images are validated and kept in private application storage; model-supplied URLs and Markdown images are not fetched automatically. Opening saved history, retrying an image read and saving a cached image do not request a new generation. Results are bounded to 32 MiB and 32 million pixels per image, with a 128 MiB private cache. Preserve needed images before manually clearing the private cache if it becomes full.

Responses conversations retain the acknowledged response identity and exact function call IDs. Interrupted inputs are not automatically resent. An uncertain local edit or command is not rerun after restart; preserve the history and explicitly create a new context after inspection. Changes to a saved transport or endpoint require explicit reconfiguration. Provider status, cancellation and expiry failures are reported without hiding them behind a CLI fallback.

API connections use their configured endpoint and authentication, separately from native CLI subscriptions. Some gateways use subscriptions internally; ZIAForge does not copy native authentication into an API. Models, tool policies, reasoning parameters and billing depend on the endpoint. Discovery alone does not prove inference. Keep keys in Connections, never in task prose or screenshots.

Gerelateerde instructies: [API connections](../../API_CONNECTIONS.md).

<a id="settings"></a>

## Instellingen, talen en veilige reset

Algemene instellingen selecteren de werkruimte, de interfacetaal en standaardwaarden. Verbindingen beheert API-eindpunten. Voorinstellingen en Beoordelingsteams behouden rolconfiguraties. Afstandsbediening beheert lokale inloggegevens, serverbereik en eigenaarsmachtigingen; Updates beheert de releasebron en het releasekanaal. Over toont de exacte actieve build.

De interfacetaal staat los van de prompttaal en de beoordelingsstatus van documentatie. Productnamen, opdracht-ID's, bestandsextensies, model-ID's van providers en door gebruikers gemaakte namen blijven identificatiemiddelen. Help volgt de geselecteerde interfacetaal wanneer een actuele vertaling beschikbaar is; machinevertalingen worden aangeduid met een label en het Engels blijft de canonieke referentie.

Opslaan past de weergegeven configuratie toe. Het resetten van de database of het terugzetten naar fabrieksinstellingen kan applicatiemetadata verwijderen; bewaar bestanden en een geteste back-up voordat u bewust een reset uitvoert. Deze bewerkingen zijn acties voor de lokale eigenaar. Gebruik ze niet als kortere weg om een mislukte workflow of een beschadigd record te onderzoeken.

Gerelateerde instructies: [Lokalisatie-instructies](../../LOCALIZATION.md) · [Gegevensherstel](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Vraag het de Help-assistent

Open Help, kies een opgeslagen verbonden preset in het assistentpaneel en stel vragen over ZIAForge. Antwoorden maken gebruik van de actuele canonieke Engelse gids en uw geselecteerde interfacetaal. Knoppen met sectieverwijzingen openen de relevante onderwerpen in de gids, zodat u de uitleg kunt vergelijken met de referentie.

Deze assistent houdt een afzonderlijk privégesprek bij van maximaal 100 opgeslagen items en 3 MiB. Voer een vraag in van maximaal 12,000 tekens; met Verzenden stelt u deze, met Stoppen annuleert u het actieve antwoord terwijl uw vraag beschikbaar blijft, en met Wissen verwijdert u dit Help-gesprek. Uw niet-verzonden concept en voorinstellingsselectie blijven behouden bij het sluiten of opnieuw openen van Help binnen dezelfde app-sessie, maar het concept wordt niet op schijf opgeslagen. De assistent verstuurt geen applicatieopdrachten, wijzigt geen workflow en accepteert geen gate. Advies is geen live verificatie van een taak, account of externe verbinding.

Claude Code- en API-Help-sessies handhaven het ondersteunde no-tools-beleid. Native Codex- en Antigravity-Help-sessies vereisen de bestaande native computermachtiging van de lokale eigenaar. Als deze is uitgeschakeld, legt de app de vereiste uit in plaats van een andere provider te kiezen. Alleen de eigenaar kan dit inschakelen in de instellingen voor lokaal beheer; de assistent kan dit niet zelf inschakelen.

Codex-Help gebruikt een sandbox met alleen-lezen en weigert verzoeken om toolgoedkeuring. Antigravity gebruikt de planmodus en de bijbehorende native sandbox-vlag. Deze native modi vormen geen universele garantie voor isolatie op besturingssysteemniveau. De bron-gidshash identificeert de referentie die voor het antwoord is gebruikt; een gegenereerde uitleg kan nog steeds onjuist zijn, dus inspecteer de gekoppelde secties voordat u handelt. Oudere antwoorden worden gemarkeerd wanneer hun versie van de brongids verschilt van de huidige gids.

Gerelateerde instructies: [Onderhoud van canonieke gids en vertalingen](../../HELP_MAINTENANCE.md) · [Applicatie-assistent en machtigingen](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Assistent en Telegram

De assistent gebruikt de geselecteerde preset en dezelfde API voor applicatiebeheer. Toestemming om de status te inspecteren en toestemming om bewerkingen uit te voeren zijn gescheiden. Controleer opdrachten en resultaten: toelichting van de assistent is geen bewijs dat een actie is voltooid.

Telegram wordt uitsluitend ingeschakeld door de lokale eigenaar, met een bestaand bottoken en een numerieke ID van de eigenaar. Beheer is bedoeld voor de privéchat van die eigenaar. Een niet-geconfigureerde of inactieve bot mag geen applicatieberichten ontvangen.

Plak een bottoken niet in een gewone chat. Het configureren van de integratie bewijst de connectiviteit met Telegram niet en maakt niet automatisch een bot aan. Schermafbeeldingen en antwoorden kunnen privégegevens uit de werkruimte bevatten.

Selecteer een assistent-preset en verleen toestemming voor applicatiebewerkingen afzonderlijk van inspectie. Uitvoering van de assistent via Codex en Antigravity vereist de native toestemming van de eigenaar; deze worden niet stilzwijgend vervangen door een toolvrije API- of Claude-sessie. Schermafbeeldingen kunnen worden weergegeven in het assistentgesprek, maar de huidige modelinvoer bevat geen beeldanalyse. Neem niet aan dat de assistent een afbeelding visueel heeft geïnspecteerd enkel omdat deze werd getoond.

De assistent kan samenvattingen, taken, chats, workflowstatus, procescontext en applicatievensters inspecteren via getypeerde tools. Deze kan toegestane gewone instellingen wijzigen en geautoriseerde applicatiebewerkingen starten. Deze kan geen native rechten toekennen, opgeslagen inloggegevens onthullen, de machtiging voor de hoofdwerkruimte op afstand wijzigen of een Forge-gate goedkeuren louter omdat dit handig is.

Gerelateerde instructies: [Contract voor applicatiebeheer](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Bedien uw privé-Telegram-bot

Maak of verkrijg uw eigen bot, start de bijbehorende privéchat en voer het token en uw numerieke Telegram-gebruikers-ID in bij de instellingen voor lokaal beheer. Schakel de integratie alleen in wanneer u wilt dat de app verbinding maakt. De ID van de eigenaar is een gebruikers-ID, geen gebruikersnaam of bot-ID. Alleen berichten van die gebruiker in diezelfde privéchat worden geaccepteerd.

Gebruik /start, /menu of /status voor een overzicht van de actieve versie, project-/taakaantallen en taakstatussen. Knoppen openen Projecten, Taken, Schermafbeelding, Help en Taal. Lijsten tonen acht items per pagina, met navigatie via Terug, Vernieuwen, Start en Vorige/Volgende. Projectknoppen filteren de takenlijst. Een taakkaart toont de opgeslagen workflowvoortgang, het model/de preset en openstaande vragen wanneer deze aanwezig zijn.

Open Chats van een taak om geopende/recente gesprekken en chats van workflowfasen te bekijken. Elk voorbeeld toont maximaal zes recente gebruikers-/assistentberichten, zichtbaar ingekort tot elk 200 tekens. Privé-redeneringen worden niet getoond. Het lezen van de geschiedenis start geen provider. Voorbeelden zijn alleen-lezen: gewone tekst en /ask TEXT zijn nog steeds gericht aan de applicatie-assistent, nooit impliciet aan de taakchat die u bekijkt.

Uitvoeren / Doorgaan leest de huidige Code- of Work-workflow opnieuw en start een in aanmerking komende opgeslagen workflow. Pauzeren verzoekt om onderbreking hiervan. Geen van beide accepteert vereisten, een specificatie, een plan, bevindingen uit een beoordeling of vragen; een openstaande beslissing verhindert Uitvoeren. Neem beslissingen in de applicatie, of gebruik een expliciet geautoriseerde getypeerde opdracht met de exacte actuele gate en revisie.

Gebruik Taal of /language om een van de 56 interfacetalen te selecteren op basis van de oorspronkelijke naam. Hiermee wordt een voorkeur opgeslagen voor uitsluitend deze bot en eigenaar. App-taal gebruiken wist die voorkeur. Het verandert noch de taal van de applicatie noch de toegangsmachtigingen; bestaande berichten worden niet automatisch opnieuw verzonden.

Navigatie werkt gewoonlijk hetzelfde gepubliceerde menubericht bij. Knoppen hebben niet-transparante identiteiten die na 15 minuten verlopen en eenmalig kunnen worden gebruikt; het wijzigen van een kaart maakt de oude knoppen ongeldig. Verlopen, verbruikte knoppen, knoppen met een niet-overeenkomend bericht en knoppen van een vorig proces kunnen geen actie uitvoeren. Een definitief niet-bewerkbaar bericht kan worden vervangen door een nieuwe kaart; een onbekende netwerkfout wordt niet opnieuw geprobeerd als een nieuw bericht.

Bij activering negeert de poller eerdere achterstallige invoer en registreert deze de acceptatie van de update vóór verzending, zodat onderbroken opdrachten niet automatisch opnieuw worden afgespeeld bij een herstart. Dit voorkomt opnieuw afspelen; het garandeert geen voltooiing. Controleer de status/context voordat u bewust nieuw werk uitzet na een fout. Er zijn geen automatische meldingen over de taakstatus.

Expliciete opdrachten blijven beschikbaar: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot en /ask TEXT. /new {JSON} maakt een taak aan via het getypeerde createTask; /command {JSON} verstuurt een expliciete catalogusopdracht. Raadpleeg de live catalogus voor de vorm van argumenten. Dezelfde backend-autorisatie en mapmachtigingen zijn van toepassing als in de applicatie.

De app stuurt opgeslagen bottokenwaarden nooit naar de assistent. Schermafbeeldingen, samenvattingen en gesprekteksten kunnen desondanks privégegevens van het project bevatten. Stop de integratie lokaal als het bot- of eigenaarsaccount niet langer wordt vertrouwd. Roteer een gelekt token bij de botprovider en werk daarna de lokale versleutelde configuratie bij.

Gerelateerde instructies: [Privébot en opdrachten](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Native computermachtiging alleen voor de eigenaar

Native computertoegang staat standaard uitgeschakeld. Alleen de eigenaar kan dit inschakelen in lokale Instellingen → Afstandsbediening. De assistent en opdrachten via HTTP/MCP/Telegram kunnen deze vlag niet voor zichzelf inschakelen. Als een bewerking wordt geweigerd, moet de assistent de instelling beschrijven en de eigenaar laten beslissen.

Wanneer expliciet ingeschakeld, accepteert computer.run een uitvoerbaar bestand, een argumentenreeks en een optionele absolute werkmap. Het gebruikt geen shell-interpolatie, heeft een limiet van 30 seconden en begrenst de uitvoer tot 1 MiB. Een opgegeven ontbrekende of ongeldige map wordt geweigerd; bij het weglaten van cwd wordt de instellingenmap van de app gebruikt, niet HOME. Afsluiten annuleert actieve eigen opdrachten en wacht op het opschonen van hun processen.

Applicatiebereik voor lezen/bewerken en native toegang zijn afzonderlijke beslissingen. Een worktree beperkt de bestandssysteemtoegang van een niet-ingeperkte provider niet. Trek native toegang na de taak weer in als deze niet langer nodig is, en inspecteer opdrachtbewijzen in plaats van toelichting van de assistent als bewijs te accepteren.

Gerelateerde instructies: [Beheercontract alleen voor de eigenaar](../../../shared/control.ts).

<a id="remote"></a>

## Browser en externe instanties

De lokale eigenaar schakelt de server in en kiest het adres, de poort en het bereik: lezen voor inspectie of bewerken voor acties. Het standaardadres 127.0.0.1 is alleen beschikbaar op deze computer. 0.0.0.0 luistert op netwerkinterfaces; controleer de netwerktoegang alvorens dit in te schakelen.

Een browser opent dezelfde interface na aanmelding met een token. Neem tokens niet op in openbare links of schermafbeeldingen. HTTP alleen versleutelt het verkeer niet; gebruik een beveiligd kanaal over een niet-vertrouwd netwerk.

De eigenaar configureert andere instanties via URL en token. De backend stuurt verzoeken door via een proxy; dit kopieert hun projecten niet naar de lokale computer. Controleer de geselecteerde instantie vóór elke actie.

Getypeerde opdrachten en gebeurtenissen dragen het applicatiebeheer. Het bereik lezen autoriseert geen taakmutaties. Native computerbeheer is een afzonderlijke keuze van de lokale eigenaar en staat standaard uitgeschakeld.

De app moet actief blijven voor beheer via browser, Telegram en externe agents. Elke instantie heeft een eigen privéprofiel, taakstatus, token en serverpoort. Gebruik één profiel niet gelijktijdig voor onafhankelijke instanties. Browsergebeurtenissen en antwoorden op opdrachten zijn beperkt tot de geselecteerde instantie; het wisselen van UI verplaatst geen bestanden en kopieert geen native login.

Gerelateerde instructies: [HTTP en instantiebeheer](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes en andere externe agents

Gebruik de geauthenticeerde API voor applicatiebeheer of de meegeleverde MCP-stdio-bridge. Schakel de server lokaal in, kies lezen of bewerken en configureer elke client met die instantie-URL en -token. Node.js 22 of nieuwer is vereist om de zelfstandige MCP-bridge uit te voeren; de Electron-app installeert uw agentclient niet. De browser-URL is geen streambaar HTTP-MCP-eindpunt: geef deze als ZIAFORGE_URL door aan de stdio-bridge.

De bridge stelt ziaforge_status, ziaforge_commands, ziaforge_command en ziaforge_screenshot beschikbaar. Begin met status en de live opdrachtcatalogus, en lees vervolgens system.context voor de geselecteerde taak. Getypeerde opdrachten volgen dezelfde controles voor revisie, gate, taakmap en opschoning als de lokale UI.

De live opdrachtcatalogus bevat documentation.guide, de canonieke Engelse help, met het bijbehorende bronpad en sourceSha256. De interne applicatiearchitect ontvangt dezelfde referentie via diens tools. Dit geeft agents de volledige productcontext zonder afhankelijk te zijn van oudere notities; documentatie verleent nooit toegang en vervangt geen actuele menselijke beslissing.

Agents horen vereisten, technische beslissingen en planning te bespreken op basis van een kort menselijk idee. Ze moeten expliciete menselijke gates, geselecteerde modellen, het handmatige/Auto-beleid en vereiste beoordelingen respecteren. Ze mogen geen goedkeuring verzinnen, onzekere opdrachten opnieuw afspelen onder een nieuwe ID, of Git-wijzigingen publiceren zonder de bedoeling van de eigenaar.

Configureer meerdere benoemde MCP-servers voor meerdere installaties. Het wisselen van instantie is een routeringsbeslissing, geen synchronisatie. Configuratievoorbeelden voor OpenClaw en Hermes staan in AGENT_CONTROL.md; clientspecifieke configuratie en compatibiliteit moeten worden gecontroleerd voor de geïnstalleerde clientversie.

De externe requestId-cache ontdubbelt slechts een begrensde set verzoeken zolang de app actief is. Duurzame bewerkingen gebruiken hun eigen identiteiten: createRequestId voor het aanmaken van taken, commandId voor workflowbeslissingen, clientMessageId voor berichten en operationId voor Git-mutaties. Behoud de oorspronkelijke identiteit en payload na een onbekende bevestiging; lees de opgeslagen status voordat u bewust nieuw werk uitzet.

Gerelateerde instructies: [Instructies voor MCP-clients](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## Lokale CLI en automatiseringslimieten

De ziaf-dispatcher bedient dezelfde actieve app en opgeslagen workflow. Gebruik vanaf de broncode npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID of npm run ziaf -- pause --task TASK_ID. Een geslaagde Start-bevestiging betekent niet dat de taak is voltooid.

--until-success schakelt bewust Auto in voor de opgeslagen workflow, maar vragen, beoordelingen, acceptatiegates, limieten en controlepunten blijven van toepassing. Ctrl+C sluit de toekijkende dispatcher af; dit stopt de applicatieworkflow niet impliciet. Zie CLI.md voor afsluitcodes, lokale eindpunten en profielverwerking.

De interface Automatiseringen slaat momenteel weergavedefinities en lokale uitvoeringstellers op. Het is geen gecertificeerde terugkerende planner en bewijst niet dat een achtergrondbeurt van het model is uitgevoerd. Gebruik voor de daadwerkelijke uitvoering de besturingselementen van de opgeslagen workflow, ziaf of de geauthenticeerde API en inspecteer hun bewijzen. Verwar het demonstratiepaneel niet met onbeheerde planning.

Gerelateerde instructies: [Dispatcher-opdrachten](../../CLI.md).

<a id="updates"></a>

## Versie en updates

Info toont de exacte actieve versie. Openbare updates vereisen een vertrouwde GitHub-release-repository en een stabiel of preview-kanaal. Controleren, downloaden en installeren hebben afzonderlijke statussen; een fout betekent niet dat een update is geïnstalleerd.

Automatische installatie is bedoeld voor ondertekende macOS-releases. Niet-ondertekende ontwikkelbuilds worden niet automatisch geïnstalleerd via dit mechanisme. Sluit voor handmatige vervanging de huidige app volledig af en gebruik een geverifieerd artefact.

Automatische controle wordt direct uitgevoerd wanneer dit is ingeschakeld, en vervolgens om de zes uur.

Stabiel sluit preview-releases uit; preview staat ook ontwikkelreleases toe. Een geslaagde controle stelt alleen de beschikbare release-metadata vast. Downloaden en installeren vereisen het platformpakket en de geconfigureerde releasefeed. Levering via Linux DEB is een afzonderlijk installatiepad; neem niet aan dat een DEB automatisch wordt bijgewerkt door het updatemechanisme van macOS.

Gerelateerde instructies: [Gereedheid voor release](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Herstarten en herstel

Gebruik op macOS Afsluiten / ⌘Q voor een volledige afsluiting. Het sluiten van het venster kan de app actief laten. Sluit de oude versie volledig af voordat u de applicatie vervangt.

Selecteer na het opstarten dezelfde taak. Geschiedenis en concepten keren terug. Hervatten herstelt een native/lokale context, maar verstuurt geen concept, hervat de wachtrij niet en autoriseert het herhalen van een onbekende bewerking niet.

Bewerk JSON niet met de hand als Herstel verschijnt. Inspecteer het getroffen documenttype, bewaar de originele bestanden en selecteer een gevalideerde back-up. Het herstellen van een oudere wachtrij markeert de items daarin als onzeker.

Wanneer de aflevering onbekend is, heeft een beheerde workflow mogelijk expliciete toestemming nodig voor een frisse context. Eerder werk en mislukte pogingen blijven behouden; een zichtbare weigering is veiliger dan gefabriceerd succes.

Maak een back-up van de taakbestanden en het app-profiel met alle app-instanties gesloten. Een gekopieerde map is geen geteste herstelbewerking. Als het herstelproces u vraagt een gevalideerde back-up te selecteren, bewaar dan ook exact de beschadigde bestanden. Het herstellen van een oudere workflow of wachtrij geeft geen toestemming om onzekere inferentie of Git-bewerkingen opnieuw uit te voeren.

Gerelateerde instructies: [Herstelcontract](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Probleemoplossing

CLI niet gevonden: controleer de installatie en versie in een gewone terminal en herstart daarna ZIAForge. De aanwezigheid van een uitvoerbaar bestand betekent niet dat u bent aangemeld. Gebruik het eigen aanmeldmechanisme van de provider.

Model niet beschikbaar of autorisatie mislukt: vernieuw de detectie, selecteer een beschikbare ID en controleer uw account en limieten. Herhaal een onzeker verzoek niet voordat u de geschiedenis ervan hebt geïnspecteerd.

Workflow gestopt: open de huidige fase, vraag, verificatiebewijs of CLI-logboeken. Los de specifieke oorzaak op: een onbeantwoorde vraag, opdracht, mapmachtiging of pogingslimiet. Doorgaan kan een mislukte controle niet omzetten in een succes.

Map ontbreekt of is vervangen: herstel de toegang tot de oorspronkelijke map of maak een nieuwe taak aan. De app mag niet verdergaan vanuit HOME. Als u een andere cwd waarneemt, stop dan de beurt en bewaar de diagnostische gegevens.

Neem voor een rapport de Info-versie, route, CLI/het model, verwacht en daadwerkelijk gedrag, een schermafbeelding en een veilig logboekfragment op. Verwijder geheimen, persoonlijke inhoud en paden die niet openbaar mogen worden gemaakt.

Externe pagina niet beschikbaar: controleer of de eigenaar de server heeft ingeschakeld, controleer het luisteradres en de poort, en authenticeer vervolgens met het juiste instantietoken. Een 401 wijst op authenticatie; een geweigerde mutatie kan te wijten zijn aan het bereik lezen of een beheeroptie alleen voor de eigenaar. Het wijzigen van het token sluit bestaande browserclients. Stel de afzonderlijke DevTools-inspectiepoort niet bloot als applicatiebeheer op afstand.

Opslaan in editor geweigerd: behoud het concept, inspecteer het huidige bestand op schijf en los het conflict met externe wijzigingen op. Omzeil de vergelijking niet door applicatiemetadata te herschrijven. Als het volledig laden van grote bestanden niet beschikbaar is, gebruik dan de ondersteunde vensterbewerking/-zoekfunctie of een externe editor.

Telegram niet beschikbaar: controleer lokaal het bottoken, de numerieke eigenaar, de privéchat en de status. Een conflicterende webhook of poller kan het pollen blokkeren; ZIAForge verwijdert niet automatisch een webhook en neemt geen andere poller over. Opdrachten die bij een onbekende grens worden geweigerd of onderbroken, worden niet automatisch opnieuw afgespeeld.

Gerelateerde instructies: [Testen en diagnose](../../TESTING.md).

<a id="diagnostics"></a>

## Problemen melden en bewijs inspecteren

Noteer de exacte actieve build uit Info, het OS/de architectuur, de taakmodus, de geselecteerde provider/het model en de stappen die het probleem reproduceren. Beschrijf het verwachte resultaat en het waargenomen resultaat. Voeg een veilige schermafbeelding en het relevante bewaarde opdracht- of verificatiebewijs toe, in plaats van een volledig privéprofiel.

CLI-logboeken, gebeurtenissenlogboeken, modeltranscripties, browsertraces en schermafbeeldingen kunnen broncode, persoonlijke paden of tokens bevatten. Inspecteer en anonimiseer deze vóór het delen. Een redactor voor logboeken op basis van best-effort certificeert een schermafbeelding of archief niet als publiceerbaar.

Voor bijdragers leest qa:doctor de omgevings-/build-identiteit; qa:inspect opent een geïsoleerd profiel met provider-stubs. Een fixture bewijst het geteste applicatiepad zonder contact op te nemen met een model. Live inferentie, Telegram-connectiviteit, native Linux-desktop-, ondertekenings- en controles op verpakte artefacten zijn afzonderlijke vormen van bewijs. Zie TESTING.md voor reproduceerbare opdrachten en opschoning.

Gerelateerde instructies: [Bewijsopdrachten](../../TESTING.md).

<a id="privacy"></a>

## Lokale gegevens en grenzen

Projecten, geschiedenis, plannen, documenten en diagnostische gegevens kunnen privétermen bevatten. Publiceer geen profielen, onbewerkte vastleggingen, sleutels of volledige logboeken samen met broncode.

Op Linux vereist het opslaan van inloggegevens voor API, beheer, Telegram en instanties een ontgrendelde GNOME Secret Service of KWallet; zonder een ondersteunde geheime opslag weigert ZIAForge deze geheimen op te slaan in plaats van de terugvaloptie basic_text van Electron te gebruiken.

Lokale opslag betekent niet dat verzoeken op uw computer blijven: de geselecteerde CLI/API stuurt deze naar de bijbehorende provider. Een werkmap en procestoezicht vormen geen isolatie op OS-niveau. Inspecteer de geselecteerde machtigingen.

Maak onderscheid tussen typen bewijsmateriaal: fixtures testen de applicatie zonder model; native live test een echte CLI/account; controles op verpakte software certificeren een specifiek artefact. Slagen voor het ene garandeert het slagen voor de andere niet.

Applicatiebereik, een worktree en een alleen-lezen prompt verschillen van afdwinging door het besturingssysteem. Het reviewer-/helperbeleid van Antigravity detecteert wijzigingen in verzameld bewijsmateriaal uit de werkruimte in plaats van alleen-lezen toegang tot het bestandssysteem af te dwingen. Native computerbeheer voert door de eigenaar geautoriseerde programma's uit buiten de reguliere grens van app-tools; schakel dit uit wanneer het niet langer nodig is.

Gerelateerde instructies: [Herkomst en publicatie](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Dit opensourceproject begrijpen en aanpassen

Lees eerst AGENTS.md en CONTRIBUTING.md, en vervolgens PROJECT_MAP.md voor de huidige brongrenzen. De geïmplementeerde getypeerde contracten en de huidige workflow-/providerdocumenten bepalen het gedrag. CONCEPT.md en de terminal-gerichte delen van ARCHITECTURE.md bewaren historische intenties en mogen niet worden verward met actuele releaseclaims.

De Engelse helpbron is docs/help/en.json. Bewerk de gegenereerde bestanden USER_GUIDE.md of website/guide.html niet handmatig. Wijzig de canonieke sectie, werk het betreffende contract bij en voer node scripts/help/generate.cjs uit. Help in de app leest dezelfde bron. Beoordeel toevoegingen aan de hand van de daadwerkelijke implementatie, inclusief limieten, machtigingen en niet-ondersteunde paden.

Elk van de 56 interface-locales heeft een afzonderlijke helpstatus in docs/help/locales.json. Ontbrekende of onvolledige help valt terug op het Engels. Volledige machinevertaalde teksten worden gelabeld en gekoppeld aan de Engelse bronhash, zonder aanspraak op menselijke controle. Een door mensen gecontroleerde vertaling legt daarnaast de beoordelaar vast. Elke vertaling moet sectie-ID's, acties, bestands-/opdracht-identifiers en technische limieten behouden, de juiste tekstrichting gebruiken en worden bijgewerkt wanneer de Engelse bron verandert.

Voer vóór levering node scripts/help/generate.cjs --check uit om verouderde gegenereerde uitvoer, ongeldige locale-steigers of verbroken lokale contractkoppelingen te detecteren. Controles op UI-vertalingen en controles op applicatiegedrag blijven gescheiden. HELP_MAINTENANCE.md beschrijft de bijwerkprocedure voor bijdragers en AI; documentatie mag geen geslaagde test claimen die niet is uitgevoerd.

Gerelateerde instructies: [Huidige projectkaart](../../PROJECT_MAP.md) · [Documentatieonderhoud](../../HELP_MAINTENANCE.md) · [Instructies voor bijdragers](../../../CONTRIBUTING.md) · [Instructies voor agents](../../../AGENTS.md).
