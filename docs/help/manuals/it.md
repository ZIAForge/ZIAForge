<!-- Generated from docs/help/en.json; source SHA-256 eaf22fddcc4ae04e49389249e9b06c0e4c060d2a1470f8ecbc39c46cb96868d3. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: it; served locale: it; status: machine-translated. -->
# Guida utente di ZIAForge

Dall'intento a un risultato verificato. Una guida pratica a Code, Work e al controllo dell'applicazione.

L'inglese è la versione canonica. La guida tradotta automaticamente è etichettata separatamente dalle traduzioni revisionate da persone. I controlli automatizzati non certificano l'accuratezza nella lingua madre.

> Questa guida è tradotta automaticamente dalla sorgente inglese attuale. Una revisione umana è sempre benvenuta.

## Sezioni della guida

- [Primi passi](#start)
- [Installa il pacchetto desktop corretto](#install-platforms)
- [Code: cinque percorsi](#code)
- [Discussione di Forge](#forge)
- [Documenti e decisioni](#decisions)
- [Esecuzione e revisione](#execution)
- [Team di revisione parallela e l'architetto del report](#review-teams)
- [Specializzazioni degli agenti e criteri dei prompt](#specializations)
- [Work: dalla domanda al documento](#work)
- [Preset, modelli e accesso](#models)
- [Chat, Arresta e la coda](#chat)
- [File, Git e completamento](#files)
- [Connessioni API](#api)
- [Impostazioni, lingue e ripristino sicuro](#settings)
- [Chiedi all'assistente della Guida](#help-assistant)
- [Assistente e Telegram](#assistant-control)
- [Gestisci il tuo bot privato Telegram](#telegram)
- [Autorizzazione computer nativa riservata al proprietario](#native-permissions)
- [Browser e istanze remote](#remote)
- [OpenClaw, Hermes e altri agenti esterni](#external-agents)
- [CLI locale e limiti di automazione](#local-cli)
- [Version and updates](#updates)
- [Riavvio e ripristino](#restart)
- [Risoluzione dei problemi](#troubleshooting)
- [Segnala problemi ed esamina le evidenze](#diagnostics)
- [Dati locali e limiti](#privacy)
- [Comprendere e modificare questo progetto open source](#project-contributors)

<a id="start"></a>

## Primi passi

ZIAForge racchiude discussione, pianificazione, esecuzione e verifica in un'unica attività. Scegli Code per un progetto Git oppure Work per documenti, ricerche e altri risultati in una cartella ordinaria.

Inizia con una piccola attività in un progetto separato. Se scegli una CLI nativa, installala ed effettua prima l'accesso con il rispettivo account in un terminale. In alternativa, configura una connessione API. Un abbonamento CLI e un'API a pagamento sono metodi di connessione distinti; ZIAForge non effettua l'accesso né trasferisce crediti tra di essi.

1. Apri Impostazioni e verifica la cartella dell'area di lavoro e la lingua. Informazioni mostra l'esatta identità della build in esecuzione.
2. Per Code, aggiungi un repository Git nella barra laterale. Per Work, scegli una cartella separata durante la creazione dell'attività.
3. Salva un preset con CLI, modello, livello di ragionamento e livello di accesso. Puoi anche selezionare direttamente Personalizzato senza un preset salvato.
4. Crea un'attività, scegli il percorso, i ruoli e l'avanzamento manuale o automatico. Rivedi le scelte prima di fare clic su Avvia.

> Usa l'artefatto e il checksum forniti dal manutentore. Un'anteprima potrebbe non essere firmata o essere priva di un feed di aggiornamento pubblicato. Il supporto per desktop e provider nativi deve essere verificato per il rispettivo OS, l'architettura e l'artefatto specifici; il solo supporto nel codice sorgente non costituisce una certificazione di rilascio.

Istruzioni correlate: [Panoramica del progetto](../../../README.md) · [Compatibilità dei provider](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Installa il pacchetto desktop corretto

Scegli un pacchetto per il tuo sistema operativo e per l'architettura della CPU: x64 o arm64. La pipeline di compilazione può produrre formati macOS DMG/ZIP, programmi di installazione Windows NSIS/ZIP e Linux DEB/RPM/AppImage/tar.gz/ZIP. Un file generato o una cross-compilazione non provano che il relativo programma di installazione e l'UI nativa abbiano superato i test sulla tua macchina; consulta il registro di verifica di quel rilascio.

Le compilazioni per macOS basate su Electron 44 richiedono macOS 13 o versioni successive. Usa il pacchetto arm64 su Apple Silicon e il pacchetto x64 per Intel. Chiudi completamente un'applicazione precedente prima di sostituirla. I pacchetti di anteprima potrebbero non essere firmati né autenticati tramite notarizzazione; non scambiare un artefatto di sviluppo per un rilascio pubblico firmato.

Windows richiede un sistema operativo supportato dalla versione inclusa di Electron e la disponibilità di Git nel PATH. Scegli l'architettura corrispondente. Un'anteprima non firmata non dispone della certificazione Authenticode. Uno ZIP portabile deve conservare l'intera cartella dell'applicazione e i file di runtime, non soltanto il relativo eseguibile.

Linux richiede un ambiente grafico compatibile, le librerie di sistema richieste da Electron e Git. Per credenziali di controllo crittografate, fornisci un Secret Service funzionante come gnome-libsecret o KWallet; il backend non sicuro basic_text non è accettato. I test di fumo headless o in container non certificano ogni ambiente desktop o distribuzione.

Installa un DEB con apt install ./file.deb oppure installa un RPM tramite il gestore di pacchetti della tua distribuzione. Un'AppImage necessita dei permessi di esecuzione e di un supporto FUSE adeguato; --appimage-extract-and-run rappresenta un'alternativa dove supportata. Estrai i pacchetti tar.gz e ZIP con tutti i relativi file di runtime. Mantieni distinti i dati utente e i file dell'applicazione durante la sostituzione di un pacchetto.

Per compilare dal sorgente, utilizza Node 24, Git e npm ci, compreso il normale programma di installazione di Electron. Le ricompilazioni native richiedono strumenti di piattaforma: gli strumenti da riga di comando di Xcode su macOS; MSVC C++, Windows SDK e Python su Windows; compilatore, make, Python, pkg-config e gli strumenti di pacchettizzazione richiesti su Linux. Segui PLATFORM_BUILDS.md per i comandi esatti e gli attuali limiti di piattaforma.

Le versioni di rilascio sono riservate centralmente e gli output sono immutabili. Una build di verifica CI non costituisce un programma di installazione pubblicato. Gli archivi dei sorgenti contengono sorgenti, file di lock, documentazione e script; dipendenze, credenziali, profili utente e ricerche private sono esclusi. Non desumere mai la convalida nativa per ARM o Windows da una compilazione x64 riuscita.

Istruzioni correlate: [Pacchetti di piattaforma, prerequisiti e limiti di verifica](../../PLATFORM_BUILDS.md) · [Identità di compilazione e controlli di rilascio](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: cinque percorsi

Auto valuta l'ambito: una domanda semplice può concludersi con una risposta, mentre un'attività più ampia richiede preparazione. Correggi bug esamina una causa e predispone una correzione. Prima le specifiche parte dalla soluzione tecnica; Prima i requisiti parte dai requisiti e dai criteri di accettazione.

Multi-modello impiega contesti separati per esplorazione, progettazione, implementazione e revisione. Il nome del percorso non richiede provider differenti: ogni ruolo usa il preset o la configurazione Personalizzato che scegli.

Un worktree isola le modifiche Git di un'attività. Ramo opera nel checkout selezionato. Controlla il progetto, il ramo e il modello prima di iniziare; la descrizione dell'attività non viene inviata anche a una chat ordinaria.

Per un'idea con scelte di prodotto o tecniche non definite, usa Prima i requisiti e getta le basi nella discussione. Auto classifica la richiesta; non è un comando per implementare immediatamente ogni breve frase. Salva bozza memorizza la richiesta senza contattare alcun modello; Avvia salva e avvia il flusso gestito una sola volta. Da una a quattro copie dell'attività possiedono ID di creazione e impostazioni dei ruoli indipendenti.

Istruzioni correlate: [Contratto del flusso di lavoro Code](../../WORKFLOWS.md) · [Profili di prompt per Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Discussione di Forge

Avvia apre la discussione centrale. Rispondi in modo naturale, poni controdomande, aggiungi vincoli e discuti le scelte tecniche. La conversazione e le domande restano associate all'attività.

L'invio di testo non comporta l'accettazione di un documento né l'autorizzazione di un nuovo piano di implementazione. Un chiarimento durante l'esecuzione mette prima in pausa il turno gestito e riesamina l'ambito interessato. La risposta a una domanda all'interno di un passaggio già accettato può far proseguire quel passaggio.

Per riesaminare deliberatamente le basi, seleziona Requisiti, Specifica o Pianificazione. Una nuova versione richiede una nuova accettazione delle decisioni dipendenti. I passaggi completati e le relative prove rimangono; le fasi non completate sostituite restano nella cronologia.

Le sessioni di fase gestite differiscono dalla chat libera. Usa la discussione di Forge invece di inviare prompt manuali direttamente a una sessione controllata dal flusso di lavoro.

Istruzioni correlate: [Contratto di discussione di Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Documenti e decisioni

Apri un documento, ispezionane la versione e apporta modifiche quando necessario. L'invio di modifiche tramite la discussione genera una nuova versione; i report e i risultati verificati non vengono riscritti retroattivamente.

Prima di accettare un piano proposto, modifica l'ordine, le istruzioni, i criteri di accettazione e i comandi di verifica. Autorizza comandi concreti che comprendi: vengono eseguiti nella cartella dell'attività. Multi-modello propone un unico passaggio di implementazione per l'intera attività, con dettagli nei relativi documenti e nelle istruzioni.

Approva è una decisione separata e deliberata. Auto non ignora le domande né l'accettazione di requisiti, specifiche e piani. Un documento modificato esternamente non può riutilizzare una precedente approvazione.

I file di preparazione compaiono come artefatti. La loro versione, la fase di generazione e l'hash li vincolano a un risultato. I documenti di Code sono conservati all'esterno del worktree e non entrano automaticamente in un commit.

Verifica sia il documento sia la decisione visualizzata prima di accettare. L'accettazione vincola l'ID del gate corrente, la revisione del piano e gli hash dei documenti memorizzati. Richiedi modifiche quando l'ambito o le prove non sono corretti. Se una decisione è diventata obsoleta, ricarica lo stato salvato prima di effettuare una nuova scelta; un file modificato non può essere accettato con una versione precedente.

Istruzioni correlate: [Gate del flusso di lavoro e versioni dei documenti](../../WORKFLOWS.md).

<a id="execution"></a>

## Esecuzione e revisione

Attività mostra i passaggi effettivi, il tentativo corrente, i risultati della verifica e della revisione. L'affermazione di un agente che dice “fatto” non completa un passaggio: le prove richieste dal piano devono esistere.

La modalità manuale si ferma tra passaggi idonei. Auto fa avanzare i passaggi verificati e consente tentativi delimitati. Ferma dopo crea sempre un punto di ripristino. Pausa arresta il lavoro attivo del flusso di lavoro; chiudere un pannello non lo interrompe.

Un revisore indipendente utilizza un contesto separato con file e risultati di verifica. Ogni rilievo bloccante obbligatorio deve essere risolto; la presenza di più revisori non annulla a maggioranza un errore bloccante.

In Multi-modello, la correzione dei rilievi richiede una decisione esplicita. Una correzione non avvia silenziosamente un'altra revisione: Rivedi apre un nuovo ciclo. I commenti di revisione possono richiedere il riesame del coordinatore senza ripetere l'implementazione.

I passaggi completati non possono essere modificati silenziosamente. Con TDD, Red deve fallire effettivamente per il motivo previsto, quindi Green deve avere successo. Il limite di tentativi previene ripetizioni infinite.

Salva revisori indipendenti CLI/API in Impostazioni → Team di revisione, quindi seleziona il team in Code o Work. I revisori operano in parallelo, seguiti dall'architetto del report del team. È inoltre possibile configurare revisori indipendenti senza un team salvato. L'architetto del report riceve solo report strutturati anonimi, senza file di progetto né strumenti; tale isolamento richiede attualmente Claude Code o API.

Ciascun passaggio di implementazione necessita di un controllo eseguibile, di una revisione indipendente obbligatoria o di entrambi. Le fasi di preparazione conservano invece risultati convalidati e ricevute degli artefatti; questi non simulano l'avvenuta esecuzione dei test di implementazione. Un comando ha successo solo quando vengono confermati il suo stato di uscita effettivo e la pulizia dei processi di sua pertinenza. Un controllo Red per TDD deve fallire regolarmente prima dell'implementazione e della verifica Green; un eseguibile mancante o un timeout non costituisce un risultato Red valido.

Gli interruttori di sicurezza predefiniti si arrestano dopo tre tentativi falliti su un singolo passaggio o cinquanta tentativi complessivi. Un'interruzione consuma un tentativo ma non conta di per sé come tentativo fallito. I limiti e le prove completate persistono al riavvio; Riprova non li azzera. Leggi l'errore registrato prima di autorizzare un altro tentativo.

Istruzioni correlate: [Verifica e revisione](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Team di revisione parallela e l'architetto del report

Apri Impostazioni → Team di revisione e salva un team. Aggiungi revisori indipendenti con i rispettivi CLI o API, modello, livello di ragionamento e specializzazione, quindi scegli un architetto del report. Seleziona il team nella configurazione di revisione dell'attività. Un preset dell'esecutore può anche essere utilizzato da un revisore, e Personalizzato rimane disponibile; i ruoli indipendenti mantengono comunque contesti separati.

I revisori operano in parallelo sulle stesse prove dell'attività. Ogni report richiesto, errore e verdetto viene conservato. L'architetto riceve report numerati anonimi senza nomi dei revisori, identità di modelli o provider, contenuti originali dell'attività, accesso al repository o strumenti. Confronta i report e restituisce un unico verdetto strutturato; non conduce una nuova revisione del codice sorgente.

Un rilievo bloccante o il rifiuto di un revisore obbligatorio non possono essere annullati tramite voto di maggioranza o preferenza dell'architetto. Report mancanti o non validi impediscono l'approvazione. Esamina i singoli rilievi e la decisione aggregata prima di accettare o autorizzare correzioni. Un team salvato viene risolto e congelato per l'esecuzione; la modifica del suo preset non riscrive le prove completate.

L'architetto di soli report impiega attualmente configurazioni supportate prive di strumenti con Claude o API. Codex e Antigravity rimangono disponibili come revisori, ma vengono rifiutati per questo ruolo isolato di architetto finché non esisterà un contratto verificato privo di strumenti. Un prompt che indichi unicamente “nessuno strumento” non è sufficiente.

> La pipeline di progettazione/revisione di Multi-modello in Code e un team di revisione parallela salvato sono controlli separati. Mantieni i criteri di revisione personalizzati selezionati; non dare per scontato che un unico percorso abiliti tutte le funzionalità di revisione.

Istruzioni correlate: [Configurazione del team tipizzato](../../../shared/review-team.ts) · [Aggregazione delle revisioni](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Specializzazioni degli agenti e criteri dei prompt

Un modello costituisce il motore di esecuzione; una specializzazione è un profilo di istruzioni. Scegli Nessuna per nessuna specializzazione aggiuntiva, Standard per la guida predefinita, Auto per una guida integrata pertinente o Manuale per le guide selezionate e per le tue istruzioni delimitate. I preset possono memorizzare la selezione.

Il catalogo originale copre programmazione generale, architettura, sicurezza, affidabilità, prestazioni, test e usabilità dell'interfaccia. Auto usa il testo disponibile dell'attività/fase per selezionare una guida; non chiama di nascosto un altro modello né certifica competenza. I suggerimenti di pianificazione possono essere esaminati e modificati prima di accettare il piano di implementazione.

Le specializzazioni di revisione aiutano a orientare l'attenzione, ma non sostituiscono mai le prove indipendenti, i limiti di accesso o il verdetto strutturato. Tratta le istruzioni personalizzate come parte dell'ambito dell'attività: non utilizzarle per eludere l'accettazione dei documenti, i criteri degli strumenti, l'autenticazione o gli errori riscontrati dai revisori.

Istruzioni correlate: [Catalogo originale dei prompt](../../../shared/specializations.ts).

<a id="work"></a>

## Work: dalla domanda al documento

Work non richiede Git. Predefinito crea una cartella dedicata per l'attività; Personalizzato seleziona una cartella esistente tramite il selettore nativo. Salva bozza memorizza le impostazioni senza inferenza; Avvia esegue la prima fase.

Auto risponde direttamente o propone un piano adeguato con attività effettive. Brainstorm crea ideas.md prima che tu scelga ulteriori idee o una valutazione. Ricerca conserva findings.md, fonti e limitazioni. Scrivi muove dall'intento e, se utile, da outline.md verso un documento descrittivo o draft.md; le revisioni conservano le versioni precedenti.

Seleziona i file di input tramite il selettore nativo e fai riferimento a essi con @. L'applicazione li copia come input immutabili dell'attività e ne convalida l'identità prima dell'esecuzione. Predefinito crea una cartella dell'attività gestita dall'applicazione; l'accesso alla cartella in Personalizzato è un'autorizzazione del proprietario salvata. Una bozza salvata e non avviata consente di modificare la cartella.

Crea da 1 a 4 copie con impostazioni dell'esecutore indipendenti. Le attività che condividono cartelle sovrapposte non possono scrivere contemporaneamente. Questo coordinamento si applica alle operazioni di ZIAForge, non a programmi esterni arbitrari.

Brainstorm approfondito è impostato in modo predefinito su tre worker indipendenti e ne supporta fino a otto. Seleziona il loro ordine e le configurazioni, compreso il riutilizzo di un preset in contesti separati. Le domande dei worker mantengono la loro origine; ai report con formato non valido viene concesso un tentativo di ripristino. Un fallimento parziale rimane visibile anziché essere presentato come un successo unanime.

Approfondito unisce i report conservati dei worker in brainstorm_report.md e richiede sempre una decisione dell'utente. Un piccolo approfondimento corregge il report tramite il coordinatore; una modifica rilevante avvia un nuovo ciclo con i worker congelati. Gli artefatti mantengono le rispettive versioni.

I ruoli definiti vengono congelati alla creazione dell'attività o al salvataggio esplicito della bozza. Dopo la prima invocazione, solo l'avanzamento automatico/manuale può essere modificato; crea una nuova attività per impostazioni di ruoli o modelli differenti. La modifica di un preset globale non modifica silenziosamente le fasi successive.

La modalità manuale si ferma tra fasi idonee, inclusa una struttura Scrivi sostanziale. Auto può proseguire attraverso tale struttura. Domande, piani eseguibili proposti, direzione del Brainstorm e revisione del report Approfondito rimangono decisioni esplicite anche in Auto. Una sola citazione non prova che sia avvenuta la navigazione web, e un file binario conservato non prova da solo il corretto rendering.

Istruzioni correlate: [Modalità e decisioni di Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Preset, modelli e accesso

Un preset memorizza CLI/API, modello, livello di ragionamento e permessi. Il piè di pagina della chat contiene le sezioni per preset, CLI, modello e opzioni. Personalizzato funziona senza un preset; Crea preset salva la selezione corrente.

Il catalogo proviene dalla CLI o dall'API installata e selezionata, ove supportato. Aggiorna rinnova l'elenco senza modificare la selezione. Se il rilevamento non è disponibile, inserisci un ID di modello esplicito; il provider deve comunque supportarlo. I livelli di ragionamento dipendono dal modello e dalla CLI. Il valore predefinito del provider è distinto dal token esplicito none.

Applica le modifiche solo dopo la conferma del backend. Il passaggio ad altro provider è limitato durante un turno attivo o con una coda non vuota. Le bozze e la cronologia visibile rimangono, ma il cambio di provider non trasferisce il loro stato interno privato.

In Forge, l'etichetta del ruolo ha importanza: la preparazione può impiegare un Pianificatore dedicato. Il piè di pagina modifica il ruolo visualizzato; i revisori e gli assistenti vengono selezionati nelle impostazioni del flusso di lavoro. I criteri per un'implementazione già verificata potrebbero essere bloccati.

I permessi variano a seconda dei provider. Sola lettura e Scrittura nell'area di lavoro sono disponibili dove l'adattatore li supporta. Antigravity utilizza le impostazioni native della CLI o l'accesso completo selezionato esplicitamente. L'accesso completo non costituisce una sandbox.

La specializzazione aggiunge linee guida al prompt, non un altro modello o permesso. I preset e i ruoli supportano Nessuno, Standard, Auto e Manuale. Auto seleziona i profili dal testo del passaggio senza un'ulteriore chiamata al modello; Manuale accetta fino a quattro specializzazioni e istruzioni personalizzate. Le assegnazioni proposte dal Pianificatore possono essere modificate prima di accettare il piano.

L'ID del modello o il livello di ragionamento inseriti manualmente restano una tua scelta, ma il provider potrebbe rifiutarli. La modifica di un preset globale non cambia retroattivamente una chat in esecuzione o un piano accettato. Per modificare deliberatamente una conversazione inattiva, usa i relativi controlli di configurazione e attendi la conferma. Un'opzione disabilitata deve essere interpretata come un limite di funzionalità o di ciclo di vita, non aggirata modificando il JSON salvato.

Istruzioni correlate: [Funzionalità dei provider](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Chat, Arresta e la coda

Le schede aperte, Recenti e le bozze appartengono a una singola attività. Chiudere una scheda la rimuove da Aperte ma la conserva in Recenti e non interrompe il processo del relativo provider né il flusso di lavoro gestito. Cerca nella cronologia, riapri una chat o chiudi tutte le schede aggiuntive dal menu della cronologia.

Arresta interrompe il turno corrente. Attendi che l'interruzione sia completata prima del successivo Invia: la conferma di un'interruzione non corrisponde al completamento del processo. Nel frattempo puoi digitare la bozza successiva.

Nella chat ordinaria, Accoda salva una richiesta successiva separatamente dalla bozza corrente. Sospendi coda blocca l'ulteriore recapito. Arresta ed Esci mettono in pausa la coda. Dopo il riavvio, esegui prima Riprendi, quindi esplicitamente Continua coda.

Incerto significa che l'esito del recapito è sconosciuto. Un messaggio di questo tipo non viene reinviato automaticamente: esamina la cronologia, copia il testo se appropriato ed elimina l'elemento in coda. Inviarlo di nuovo costituisce una nuova richiesta deliberata.

Le chat di fase gestite utilizzano il proprio flusso di lavoro, non la coda ordinaria. Segui fase mostra la fase corrente; selezionare manualmente un'altra scheda interrompe il monitoraggio. I log della CLI mostrano la diagnostica separatamente dalla risposta.

Le risposte in Markdown eseguono il rendering di intestazioni, elenchi, tabelle, collegamenti e blocchi di codice delimitati. Le schede degli strumenti e la diagnostica della CLI rimangono separate dalla risposta. Il ragionamento e le metriche dei token riportati dal modello compaiono solo quando il provider li espone effettivamente; non dedurre il ragionamento privato o il consumo da un'animazione.

Dopo un invio incerto o una conferma di accodamento, esamina la cronologia e riprova solo la stessa richiesta memorizzata, se offerto. Una ricevuta di coda indica che l'archiviazione ha accettato l'elemento, non che l'inferenza sia terminata. Rimuovi un elemento incerto in coda solo come scarto deliberato; tale azione non può revocare un prompt già recapitato.

Istruzioni correlate: [Coda messaggi persistente](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## File, Git e completamento

File mostra la cartella dell'attività. Confronta i risultati con i requisiti, apri i documenti ed esamina i diff. Conservare un file binario non dimostra il corretto rendering nell'applicazione di destinazione.

Git fornisce stato, modifiche e operazioni con esiti registrati. Commit, merge e push sono manuali per impostazione predefinita; le operazioni automatiche sono scelte separate per un piano completamente verificato.

Non modificare i file di lavoro tra la verifica e la pubblicazione: l'approvazione è legata ai byte esatti. Conflitti, push non riusciti ed esiti operativi sconosciuti bloccano l'avanzamento fino a una decisione esplicita. Auto non autorizza la pubblicazione in modo silenzioso.

Work non crea rami Git e non prevede alcuna finalizzazione in Git. Mantieni i documenti richiesti dalla cartella selezionata, incluse le versioni e le fonti.

L'editor di file offre evidenziazione della sintassi per estensione, cerca e sostituisci, cronologia degli annullamenti, a capo automatico e bozze per scheda. I salvataggi preservano la codifica supportata UTF-8/UTF-16 e respingono i conflitti di modifica esterna. Le altre codifiche e i contenuti binari richiedono un editor esterno. Le bozze non salvate impediscono la chiusura dell'applicazione finché l'utente non le salva o le elimina.

La sintassi completa è abilitata fino a 8 MiB. I file di testo più grandi si aprono in finestre da 256 KiB; i file tra 8 e 64 MiB possono essere caricati esplicitamente per intero senza sintassi. Al di sopra di 64 MiB usa la modifica a finestre e la ricerca delimitata della corrispondenza successiva. Si tratta di una modalità limitata per file di grandi dimensioni, non di una parità con Sublime Text per documenti arbitrariamente grandi.

Apri cartella utilizza il contesto corrente dell'attività o del ramo/worktree, anziché aprire silenziosamente solo il repository originale. Una riga di file può mostrare la cartella principale di quel file. I percorsi vengono convalidati dal backend a fronte delle autorizzazioni registrate dell'attività. I file binari non sono modificabili come testo normale; usa il visualizzatore di destinazione e conserva i byte originali.

La rimozione del worktree è un'azione protetta separata. Termina le sessioni strutturate e i terminali collegati prima di rimuoverlo, comprese le sessioni inattive. Esamina il risultato Git salvato e lo stato di ripristino; eliminare il record di un'attività non sostituisce la conservazione sicura del lavoro non sottoposto a commit.

Istruzioni correlate: [Contratto dell'editor tipizzato](../../../shared/editor.ts) · [Criteri di Git](../../WORKFLOWS.md).

<a id="api"></a>

## Connessioni API

Connessioni aggiunge un endpoint API selezionato esplicitamente. Inserisci un nome, l'URL di base, il modello e una chiave se necessario. Seleziona Chat Completions per le integrazioni compatibili esistenti, Responses per i cicli di funzioni e i file multimediali del provider, oppure Anthropic Messages con Claude Connector v1 per tale connettore. Le connessioni esistenti mantengono Chat Completions finché non le modifichi esplicitamente. Per una connessione esistente, Configura Responses apre una bozza per lo stesso endpoint; esamina il profilo e fai clic su Salva connessione. Scegli il connettore Codex, Grok Connector v1 o Claude Connector v1 solo per un gateway che supporta l'estensione selezionata. La chiave salvata viene conservata quando l'endpoint non viene modificato e il campo della chiave rimane vuoto.

HTTPS è obbligatorio, ad eccezione di HTTP di loopback. Utilizza un endpoint semplice senza credenziali, query o frammenti. I reindirizzamenti vengono rifiutati. Le chiavi utilizzano la crittografia del OS supportata e non vengono mai restituite all'UI. La modifica dell'endpoint richiede di immettere nuovamente o cancellare la relativa chiave. Lasciare vuoto il campo della chiave conserva una chiave salvata.

Gli strumenti per i file dell'area di lavoro vengono eseguiti nella cartella dell'attività locale risolta dal backend, con percorsi relativi e controlli contro l'attraversamento di directory e collegamenti. Ogni scrittura di file richiede un'approvazione esplicita e una revisione prevista non modificata. Le sessioni in sola lettura espongono unicamente strumenti di lettura. In Responses e nella modalità chiamante di Claude, Consenti comandi locali abilita separatamente le chiamate approvate a eseguibili/argomenti su macOS e Linux. La supervisione dei comandi non è disponibile su Windows; l'adattatore non annuncia tale strumento su quel sistema. I comandi richiedono sempre l'approvazione del proprietario e non costituiscono una sandbox del sistema operativo.

Il profilo del connettore Codex identifica l'estensione di avanzamento degli strumenti di Responses di quel gateway. Gli strumenti nativi del provider vengono eseguiti sul server, separatamente dagli strumenti del chiamante presenti sul tuo computer. I permessi locali di sola lettura non vincolano il server. Un connettore non può essere selezionato per un architetto di soli report che richiede la disattivazione di tutti gli strumenti: un isolamento non supportato genera un errore anziché consentire silenziosamente gli strumenti nativi. Seleziona un endpoint in grado di applicare il criterio richiesto.

I risultati generati in PNG, JPEG e WebP vengono visualizzati come schede immagine separate, con Salva immagine, all'esterno dell'output compresso degli strumenti. Le immagini vengono convalidate e conservate nell'archivio privato dell'applicazione; gli URL forniti dal modello e le immagini Markdown non vengono recuperati automaticamente. L'apertura della cronologia salvata, il nuovo tentativo di lettura di un'immagine e il salvataggio di un'immagine memorizzata nella cache non richiedono una nuova generazione. I risultati sono limitati a 32 MiB e 32 milioni di pixel per immagine, con una cache multimediale privata condivisa di 512 MiB. Conserva le immagini necessarie prima di cancellare manualmente la cache privata qualora diventi piena. Fai clic su un'immagine della chat per aprire il visualizzatore di immagini. Ingrandisci o rimpicciolisci, scegli Dimensioni reali (100%) o Adatta alla finestra e trascina per esaminare un dettaglio. Esc o Chiudi visualizzatore immagini ti riporta alla chat. La visualizzazione e lo zoom riutilizzano l'immagine privata caricata; non richiedono una nuova generazione.

Le conversazioni di Responses mantengono l'identità della risposta confermata e gli ID esatti delle chiamate di funzione. Gli input interrotti non vengono reinviati automaticamente. Una modifica locale o un comando incerto non viene rieseguito dopo il riavvio; conserva la cronologia e crea esplicitamente un nuovo contesto dopo l'ispezione. Le modifiche a un trasporto salvato o a un endpoint richiedono una riconfigurazione esplicita. Gli errori relativi a stato del provider, annullamento e scadenza vengono segnalati senza nasconderli dietro un fallback da CLI. L'intestazione della chat mostra il protocollo associato a tale esecuzione. Dopo aver salvato le modifiche alla connessione, apri il selettore CLI / API della chat e fai clic su Applica, anche se la stessa connessione è già selezionata. Questo crea una nuova esecuzione con la configurazione salvata e mantiene la cronologia della chat. Il solo salvataggio di una connessione non migra le chat attive. I collegamenti alle immagini di solo testo precedenti rimangono testuali; il cambio di protocollo non rigenera né importa i risultati precedenti.

Le connessioni API utilizzano l'endpoint e l'autenticazione configurati, separatamente dagli abbonamenti nativi di CLI. Alcuni gateway utilizzano abbonamenti internamente; ZIAForge non copia l'autenticazione nativa in un'API. I modelli, i criteri degli strumenti, i parametri di ragionamento e la fatturazione dipendono dall'endpoint. L'individuazione da sola non prova l'inferenza. Conserva le chiavi in Connessioni, mai nel testo delle attività o negli screenshot.

Per Grok Connector v1, salva una connessione Responses esplicita e usa Ispeziona connettore per leggere le funzionalità annunciate, i modelli e l'utilizzo senza eseguire inferenza. I livelli di ragionamento del modello e le scelte della finestra di contesto provengono dal catalogo. Il limite di turni nativo opzionale è 1–100. Le percentuali di quota mancanti rimangono sconosciute; il termine del periodo di utilizzo non corrisponde al pagamento di un abbonamento o a una data di scadenza. Applica le modifiche alla connessione in ciascuna chat esistente prima che abbiano effetto lì.

Le domande di Grok appaiono come schede con le etichette native esatte della domanda e delle opzioni. Scegli le risposte richieste o inserisci una risposta personalizzata, quindi invia una sola volta. Le interviste del piano possono offrire azioni di discussione o di salto. Le schede dei permessi del provider mostrano le opzioni native esatte e richiedono la tua selezione per impostazione predefinita. Queste differiscono dalle approvazioni di file/comandi locali. Stop, scadenza o riavvio rendono inattive le vecchie schede; un invio incerto non viene ripetuto automaticamente.

In Connessioni, una connessione Grok può abilitare Approva automaticamente i permessi monouso del provider; l'opzione è disattivata per impostazione predefinita. Ciò si applica alle nuove chat o a una chat esistente dopo averla riconfigurata esplicitamente con Applica. Il solo salvataggio della connessione non modifica una chat in esecuzione. Quando è abilitato, ZIAForge invia automaticamente solo un singolo permesso monouso univoco e non scaduto offerto da Grok e registra tale decisione automatica prima di inviarla. La scheda identifica un'approvazione automatica. Le domande e le approvazioni locali di file o comandi richiedono comunque la tua risposta. Le chat in sola lettura mantengono i permessi manuali del provider. I permessi persistenti non vengono mai selezionati automaticamente; le scelte monouso mancanti o ambigue rimangono manuali. Gli invii vecchi o incerti non vengono mai riprodotti o ritentati automaticamente.

In una chat di Grok, il pulsante degli allegati apre il selettore di sistema per PNG, JPEG e WebP. Sono consentite quattro immagini per messaggio, fino a 16 MiB ciascuna e 20 MiB complessivi, con 32 milioni di pixel per immagine. Le copie bozza private hanno un budget di 128 MiB e appartengono a tale esecuzione della chat. Vengono trasmesse solo al momento dell'invio. Gli invii non riusciti o incerti mantengono le proprie identità di bozza. I messaggi con immagini non possono utilizzare la coda di solo testo. Rimuovi o scarta esplicitamente una bozza di immagine in sospeso prima di modificare o riprendere la sua esecuzione; scartare una bozza non annulla un messaggio già consegnato. I messaggi con immagini accettati mantengono schede immagine private per successive ispezioni, zoom e salvataggio.

Gli strumenti del provider Grok sono limitati al recupero web supportato, alle immagini, alle domande interattive e alla generazione video subordinata alle funzionalità. Gli strumenti locali del progetto continuano a essere eseguiti sul computer nella cartella dell'attività selezionata dal backend. La revisione in sola lettura esclude la generazione e la modifica di immagini/video del provider, le domande, le scritture locali e i comandi. Le sessioni della Guida senza strumenti e quelle di architettura di soli report non possono utilizzare questo profilo del connettore. La generazione audio, la trascrizione e la voce in tempo reale non sono offerte; un file MP4 può contenere la sua traccia audio normale. La sola presenza di uno strumento individuato non costituisce la prova di un risultato utilizzabile.

Per i video, usa una chat di Grok abilitata alla scrittura, allega un'immagine di riferimento o prosegui la chat che ne ha creata una, e descrivi il movimento e i parametri desiderati. Per scegliere esplicitamente un'immagine meno recente, usa Salva immagine e allega il file salvato. La visualizzazione o il salvataggio dell'immagine non la rigenera. Non è presente un modulo separato per i parametri video: la richiesta utilizza la conversazione e le sue schede native di domande/permessi. Prima di un nuovo turno dell'utente, ZIAForge abilita solo gli strumenti video che il connettore dichiara disponibili, abilitati e verificati. Un errore di individuazione rende il video non disponibile per quel turno. Le modifiche alle funzionalità native possono avviare un nuovo contesto del provider con la cronologia visibile e le immagini memorizzate nella cache idonee, mantenendo al contempo la chat locale; le operazioni interrotte non vengono rieseguite. Se un'immagine non rientra nei limiti degli allegati, il passaggio segnala tale omissione; allega esplicitamente il riferimento desiderato.

Il connettore offre image_to_video con un'immagine di riferimento obbligatoria, 6 o 10 secondi e impostazioni predefinite 480p/720p. La sua modalità reference_to_video supporta 1–15 secondi e proporzioni 1:1, 16:9, 9:16, 4:3, 3:4, 3:2 o 2:3; l'agente può prima generare un riferimento, se necessario. Richiedi le impostazioni desiderate nella chat. ZIAForge non espone l'endpoint separato /grok/media né il suo selettore automatico. I preset e i parametri supportati sono funzionalità del provider, non una garanzia dell'altezza esatta in pixel, della temporizzazione dei fotogrammi o di ciascun risultato artistico.

Un video completato di Grok appare solo dopo che il file MP4 protetto è stato scaricato e sono stati verificati il tipo MIME, le dimensioni, il valore SHA-256 e la struttura. Un testo che dichiara che un video è pronto, un'immagine di ripiego o un link di archiviazione non costituiscono un video riproducibile. Gli errori rimangono visibili senza richiedere una generazione sostitutiva. Utilizza i controlli della scheda video per riprodurre, mettere in pausa, avanzare o regolare l'audio quando presente. La riproduzione non si avvia automaticamente. Salva video apre la finestra di dialogo di destinazione del sistema. La cronologia della chat salvata mantiene il file MP4 privato anche dopo la chiusura completa (Esci) o il riavvio dell'applicazione; la riproduzione e il salvataggio utilizzano i byte locali senza inferenza o un ulteriore download dal provider. I video sono limitati a 128 MiB ciascuno all'interno della cache multimediale privata condivisa di 512 MiB. Salva i file multimediali necessari prima di svuotare manualmente una cache piena. Il computer deve supportare il codec video; i file non supportati o danneggiati mostrano un errore.

Per Claude Connector v1, seleziona Anthropic Messages e inserisci l'origine HTTPS del connettore senza /v1. Salva, quindi usa Ispeziona connettore per leggere gli strumenti annunciati, le opzioni del modello, lo stato e l'utilizzo senza inferenza. Scegli l'esecuzione dal chiamante o nativa del provider, una selezione esplicita degli strumenti nativi, la modalità dei permessi nativi, i limiti di turni/output e i controlli supportati del ragionamento; sono disponibili anche uno schema di output JSON opzionale e la modalità per la cronologia a freddo. I valori predefiniti utilizzano la modalità chiamante, permessi nativi manuali e nessuno strumento nativo. I valori di utilizzo mancanti rimangono sconosciuti; un azzeramento dell'utilizzo non rappresenta la data di pagamento o di scadenza dell'abbonamento. La chiave API del connettore rimane separata dall'autenticazione del relativo abbonamento nativo. Applica le modifiche salvate in ciascuna chat esistente prima che abbiano effetto.

Gli strumenti del chiamante di Claude operano nella cartella dell'attività locale con approvazioni separate per le scritture e i comandi supportati. Solo WebSearch e WebFetch esplicitamente selezionati possono essere eseguiti in modo nativo nella modalità chiamante. La modalità nativa del provider esegue gli strumenti selezionati nell'area di lavoro del server del connettore e non fornisce strumenti locali per file o comandi. Descrivere la cartella locale al server non concede l'accesso ad essa. Le sessioni in sola lettura rifiutano strumenti nativi di modifica o eseguibili; le sessioni prive di strumenti non devono contenere strumenti nativi. Una scheda di avanzamento dello strumento del server non esegue mai i suoi contenuti sul computer. La disponibilità degli strumenti nativi e la modalità dei permessi nativi sono impostazioni distinte.

Le schede dei permessi nativi di Claude richiedono una decisione esplicita di autorizzazione o rifiuto quando richiesta. Non possono sostituire l'input dello strumento né concedere l'approvazione per file o comandi locali. Le domande mostrano il testo esatto proposto e le regole di selezione; scegli le risposte o inserisci una risposta personalizzata, quindi invia una sola volta. L'opzione di autorizzazione automatica di Grok non si applica a Claude. Scadenza, Stop, riavvio o recapito incerto rendono inattive le vecchie schede. La prosecuzione mantiene la risposta associata e la configurazione vincolata; le richieste, gli strumenti e le risposte interrotte non vengono riprodotti. La modalità di contesto per cronologia a freddo è un'importazione esplicita con perdita di informazioni, non il recupero di una sessione nativa. Stop annulla l'operazione associata quando la sua risposta è nota; non annulla gli effetti completati né arresta servizi non correlati. Un annullamento incerto rimane visibile.

In una chat di Claude, i selettori di allegati di sistema accettano immagini PNG, JPEG, GIF e WebP, documenti PDF e documenti di testo UTF-8. Il compositore dispone di quattro slot di allegati condivisi. Immagini e PDF consentono 16 MiB ciascuno; i documenti di testo consentono 1 MiB. Le immagini consentono 32 milioni di pixel. Le bozze di immagini e le bozze di documenti consentono ciascuna 20 MiB complessivi e dispongono di budget di archiviazione privata separati pari a 128 MiB. La richiesta presenta inoltre un limite decodificato combinato di 32 MiB, che il sovraccarico della richiesta codificata può potenzialmente ridurre. Le copie private appartengono all'esecuzione corrente della chat e vengono trasmesse solo al momento dell'invio. Gli invii non riusciti o incerti mantengono la propria identità di bozza; i messaggi con allegati non possono entrare nella coda di solo testo. Rimuovi o elimina esplicitamente gli allegati in sospeso prima di modificare o riprendere l'esecuzione. Le immagini accettate rimangono disponibili per l'anteprima privata e il salvataggio; i documenti non vengono incorporati come PDF o HTML.

Gli strumenti del server di Claude possono creare file scaricabili. Una scheda file appare dopo che il suo contenuto protetto è stato scaricato e ne sono stati verificati il tipo MIME, la dimensione esatta e il valore SHA-256. Rimane all'esterno dell'output compresso degli strumenti e mostra il nome, la dimensione, il tipo e i metadati di revisione o sostituzione forniti. Usa Salva per scegliere una destinazione nella finestra di dialogo di sistema. Una versione immutabile più recente mantiene disponibile la versione precedente. I file consentono 128 MiB ciascuno all'interno di una cache privata separata degli artefatti pari a 1 GiB; salva i file necessari prima di svuotare manualmente una cache piena. La cronologia memorizzata nella cache e il salvataggio non richiedono inferenza né un altro download. Tutte le schede di artefatti sono di solo salvataggio (Salva), compresi i file PDF; HTML, SVG e i formati sconosciuti rimangono download generici e non vengono mai eseguiti. Gli URL forniti dal modello e le immagini Markdown non vengono recuperati automaticamente. I file creati dagli strumenti del server non implicano la generazione nativa di foto, video, audio o voce da parte di Claude.

Istruzioni correlate: [Connessioni API](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md) · [Claude Connector v1](../../CLAUDE_CONNECTOR_V1.md).

<a id="settings"></a>

## Impostazioni, lingue e ripristino sicuro

Le impostazioni generali selezionano l'area di lavoro, la lingua dell'interfaccia e le impostazioni predefinite. Connessioni gestisce gli endpoint API. Preset e Team di revisione memorizzano le configurazioni dei ruoli. Controllo remoto gestisce le credenziali locali, l'ambito del server e i permessi del proprietario; Aggiornamenti gestisce la sorgente/canale di rilascio. Informazioni mostra l'esatta build in esecuzione.

La lingua dell'interfaccia è separata dalla lingua del prompt e dallo stato di revisione della documentazione. I nomi dei prodotti, gli ID dei comandi, le estensioni dei file, gli ID dei modelli dei provider e i nomi creati dall'utente rimangono identificatori. La Guida segue la lingua dell'interfaccia selezionata quando è disponibile una traduzione aggiornata; le traduzioni automatiche sono etichettate e l'inglese rimane il riferimento canonico.

Salva applica la configurazione visualizzata. Un ripristino del database o un ripristino alle impostazioni di fabbrica può rimuovere i metadati dell'applicazione; conserva i file e un backup verificato prima di utilizzare intenzionalmente il ripristino. Queste operazioni sono azioni riservate al proprietario locale. Non usarle come scorciatoia per analizzare un flusso di lavoro non riuscito o un record corrotto.

Istruzioni correlate: [Istruzioni di localizzazione](../../LOCALIZATION.md) · [Recupero dati](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Chiedi all'assistente della Guida

Apri la Guida, scegli un preset connesso salvato nel pannello dell'assistente e fai domande su ZIAForge. Le risposte utilizzano la guida canonica attuale in inglese e la lingua dell'interfaccia selezionata. I pulsanti di riferimento alle sezioni aprono gli argomenti pertinenti della guida, consentendoti di confrontare la spiegazione con il testo di riferimento.

Questo assistente mantiene una conversazione privata separata con un massimo di 100 voci salvate e 3 MiB. Inserisci una domanda composta al massimo da 12,000 caratteri; Invia la pone, Interrompi annulla la risposta attiva mantenendo disponibile la domanda, e Cancella rimuove questa conversazione della Guida. La bozza non inviata e la selezione del preset persistono alla chiusura o riapertura della Guida nella stessa sessione dell'app, ma la bozza non viene salvata su disco. L'assistente non invia comandi dell'applicazione, non modifica un flusso di lavoro né accetta un gate. I consigli non costituiscono una verifica in tempo reale di un'attività, di un account o di una connessione esterna.

Le sessioni della Guida con Claude Code e API applicano la politica supportata senza strumenti. Le sessioni native della Guida con Codex e Antigravity richiedono l'autorizzazione computer nativa esistente del proprietario locale. Se è disabilitata, l'app spiega il prerequisito invece di scegliere un provider diverso. Solo il proprietario può abilitarla nelle impostazioni di controllo locale; l'assistente non può abilitarla autonomamente.

La Guida di Codex utilizza una sandbox di sola lettura e rifiuta le richieste di approvazione degli strumenti. Antigravity utilizza la modalità pianificazione e il relativo flag di sandbox nativa. Queste modalità native non costituiscono una garanzia universale di confinamento a livello di sistema operativo. L'hash della guida sorgente identifica il testo di riferimento utilizzato per la risposta; una spiegazione generata può comunque essere errata, quindi esamina le sezioni collegate prima di agire. Le risposte meno recenti vengono contrassegnate quando la versione della guida sorgente differisce da quella attuale.

Istruzioni correlate: [Guida canonica e manutenzione delle traduzioni](../../HELP_MAINTENANCE.md) · [Assistente dell'applicazione e autorizzazioni](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Assistente e Telegram

L'assistente utilizza il preset selezionato e la medesima API di controllo dell'applicazione. L'autorizzazione a esaminare lo stato e quella a eseguire operazioni sono separate. Ispeziona i comandi e i risultati: il testo dell'assistente non costituisce una prova del completamento di un'azione.

Telegram viene abilitato solo dal proprietario locale, con un token bot esistente e un ID numerico del proprietario. Il controllo è riservato alla chat privata di tale proprietario. Un bot non configurato o inattivo non deve ricevere messaggi dell'applicazione.

Non incollare il token del bot in una chat ordinaria. Configurare l'integrazione non dimostra la connettività di Telegram e non crea automaticamente un bot. Gli screenshot e le risposte possono contenere dati privati dell'area di lavoro.

Seleziona un preset dell'assistente e concedi l'autorizzazione a eseguire operazioni nell'applicazione separatamente dall'ispezione. L'esecuzione dell'assistente con Codex e Antigravity richiede l'autorizzazione nativa del proprietario; non vengono sostituiti silenziosamente con una sessione senza strumenti di API o Claude. Gli screenshot possono essere mostrati nella conversazione con l'assistente, ma l'input del modello attuale non include l'analisi delle immagini. Non dare per scontato che l'assistente abbia esaminato visivamente un'immagine solo perché l'ha mostrata.

L'assistente può esaminare riepiloghi, attività, chat, stato del flusso di lavoro, contesto del processo e finestre dell'applicazione tramite strumenti tipizzati. Può modificare le impostazioni ordinarie consentite e avviare operazioni autorizzate dell'applicazione. Non può concedere privilegi nativi, rivelare credenziali memorizzate, modificare da remoto la concessione dell'area di lavoro radice né approvare un gate di Forge per mera comodità.

Istruzioni correlate: [Contratto di controllo dell'applicazione](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Gestisci il tuo bot privato Telegram

Crea o ottieni il tuo bot, avvia la sua chat privata e inserisci il relativo token e il tuo ID utente numerico di Telegram nelle impostazioni di controllo locale. Abilita l'integrazione solo quando desideri che l'app si connetta. L'ID del proprietario è un identificatore utente, non un nome utente o un ID del bot. Vengono accettati solo i messaggi provenienti da quell'utente nella medesima chat privata.

Usa /start, /menu o /status per una panoramica della versione in esecuzione, dei conteggi di progetti/attività e degli stati delle attività. I pulsanti aprono Progetti, Attività, Screenshot, Guida e Lingua. Gli elenchi mostrano otto elementi per pagina, con navigazione Indietro, Aggiorna, Home e Precedente/Successivo. I pulsanti dei progetti filtrano l'elenco delle attività. Una scheda attività mostra l'avanzamento salvato del flusso di lavoro, il modello/preset e le eventuali domande in sospeso.

Apri Chat di un'attività per visualizzare l'anteprima delle conversazioni aperte/recenti e delle chat delle fasi del flusso di lavoro. Ciascuna anteprima mostra fino a sei messaggi recenti dell'utente/assistente, visibilmente abbreviati a 200 caratteri ciascuno. Il ragionamento privato non viene mostrato. La lettura della cronologia non avvia un provider. Le anteprime sono di sola lettura: il testo ordinario e /ask TEXT si rivolgono sempre all'assistente dell'applicazione, mai implicitamente alla chat dell'attività che stai visualizzando.

Esegui / Continua rilegge il flusso di lavoro corrente di Code o Work e avvia un flusso di lavoro salvato idoneo. Pausa ne richiede la sospensione. Nessuno dei due accetta requisiti, una specifica, un piano, rilievi di revisione o domande; una decisione in sospeso impedisce Esegui. Prendi le decisioni nell'applicazione oppure utilizza un comando tipizzato esplicitamente autorizzato indicando esattamente il gate e la revisione correnti.

Usa Lingua o /language per selezionare una qualsiasi delle 56 lingue dell'interfaccia tramite il suo nome nativo. Questo memorizza una preferenza valida solo per questo bot e proprietario. Usa lingua dell'app cancella tale preferenza. Non modifica la lingua dell'applicazione né le autorizzazioni di accesso; i messaggi esistenti non vengono reinviati automaticamente.

La navigazione aggiorna normalmente lo stesso messaggio di menu pubblicato. I pulsanti hanno identità opache che scadono dopo 15 minuti e possono essere utilizzati una sola volta; la modifica di una scheda invalida i suoi vecchi pulsanti. I pulsanti scaduti, già utilizzati, non corrispondenti al messaggio o relativi a un processo precedente non possono eseguire alcuna azione. Un messaggio definitivamente non modificabile può essere sostituito con una nuova scheda; un errore di rete sconosciuto non viene ritentato come nuovo messaggio.

All'attivazione, il poller elimina il backlog precedente e registra l'accettazione dell'aggiornamento prima dell'inoltro, in modo che i comandi interrotti non vengano rieseguiti automaticamente al riavvio. Ciò impedisce la riesecuzione; non garantisce il completamento. Verifica lo stato/contesto prima di assegnare deliberatamente nuovo lavoro dopo un errore. Non sono previste notifiche automatiche sullo stato delle attività.

I comandi espliciti rimangono disponibili: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot e /ask TEXT. /new {JSON} crea un'attività tramite il comando tipizzato createTask; /command {JSON} invia un comando esplicito del catalogo. Consulta il catalogo in tempo reale per la struttura degli argomenti. Si applicano le stesse autorizzazioni di backend e concessioni di cartelle dell'applicazione.

L'app non invia mai i valori memorizzati dei token del bot all'assistente. Gli screenshot, i riepiloghi e il testo delle conversazioni potrebbero tuttavia contenere informazioni private sui progetti. Interrompi l'integrazione a livello locale se il bot o l'account proprietario non sono più ritenuti attendibili. Rigenera un token compromesso presso il provider del bot, quindi aggiorna la configurazione crittografata locale.

Istruzioni correlate: [Bot privato e comandi](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Autorizzazione computer nativa riservata al proprietario

L'accesso al computer nativo è inizialmente disabilitato. Solo il proprietario può abilitarlo nelle Impostazioni locali → Controllo remoto. L'assistente e i comandi HTTP/MCP/Telegram non possono abilitare questo flag per se stessi. Se un'operazione viene negata, l'assistente deve descrivere l'impostazione e lasciare che sia il proprietario a decidere.

Quando esplicitamente abilitato, computer.run accetta un eseguibile, un array di argomenti e una directory di lavoro assoluta facoltativa. Non utilizza interpolazione della shell, ha un limite di 30 secondi e delimita l'output a 1 MiB. Se viene fornita una directory mancante o non valida, questa viene rifiutata; omettendo cwd si utilizza la directory delle impostazioni appartenente all'app, non HOME. Esci annulla i comandi attivi di proprietà e attende la pulizia dei relativi processi.

L'ambito di lettura/operazione dell'applicazione e l'accesso nativo sono decisioni separate. Un worktree non vincola l'accesso al file system di un provider senza restrizioni. Revoca l'accesso nativo al termine dell'attività se non è più necessario ed esamina le ricevute dei comandi invece di considerare il testo dell'assistente come prova.

Istruzioni correlate: [Contratto di controllo riservato al proprietario](../../../shared/control.ts).

<a id="remote"></a>

## Browser e istanze remote

Il proprietario locale abilita il server e ne sceglie l'indirizzo, la porta e l'ambito: lettura per l'ispezione o operazione per le azioni. L'indirizzo predefinito 127.0.0.1 è disponibile solo su questo computer. 0.0.0.0 ascolta sulle interfacce di rete; verifica l'accesso alla rete prima di abilitarlo.

Un browser apre la medesima interfaccia dopo l'accesso tramite token. Non includere i token in link pubblici o screenshot. HTTP da solo non crittografa il traffico; utilizza un canale protetto su reti non attendibili.

Il proprietario configura altre istanze tramite URL e token. Il backend fa da proxy per le richieste; questo non copia i relativi progetti sulla macchina locale. Verifica l'istanza selezionata prima di ogni azione.

I comandi tipizzati e gli eventi veicolano il controllo dell'applicazione. L'ambito di lettura non autorizza modifiche alle attività. Il controllo nativo del computer è una scelta separata del proprietario locale ed è inizialmente disabilitato.

L'app deve rimanere in esecuzione per il controllo da browser, Telegram e agenti esterni. Ciascuna istanza ha il proprio profilo privato, stato delle attività, token e porta del server. Non riutilizzare contemporaneamente un profilo tra istanze indipendenti. Gli eventi del browser e le risposte ai comandi sono limitati all'istanza selezionata; cambiare la UI non sposta i file né copia l'accesso nativo.

Istruzioni correlate: [HTTP e controllo delle istanze](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes e altri agenti esterni

Utilizza l'API autenticata di controllo dell'applicazione o il bridge stdio MCP incluso. Abilita il server localmente, scegli lettura o operazione e configura ciascun client con l'URL e il token di quell'istanza. È richiesto Node.js 22 o versione successiva per eseguire il bridge MCP autonomo; l'app Electron non installa il client del tuo agente. L'URL del browser non è un endpoint HTTP MCP di tipo Streamable: forniscilo come ZIAFORGE_URL al bridge stdio.

Il bridge espone ziaforge_status, ziaforge_commands, ziaforge_command e ziaforge_screenshot. Inizia con lo stato e il catalogo comandi in tempo reale, quindi leggi system.context per l'attività selezionata. I comandi tipizzati seguono gli stessi controlli di revisione, gate, cartella dell'attività e pulizia della UI locale.

Il catalogo comandi in tempo reale include documentation.guide, la guida canonica in inglese, con il relativo percorso sorgente e sourceSha256. L'architetto interno dell'applicazione riceve il medesimo testo di riferimento tramite i suoi strumenti. Questo offre agli agenti l'intero contesto del prodotto senza dipendere da note obsolete; la documentazione non concede mai accessi né si sostituisce a una decisione umana attuale.

Gli agenti devono discutere i requisiti, le decisioni tecniche e la pianificazione a partire da una breve idea umana. Devono rispettare i gate umani espliciti, i modelli selezionati, le policy manuale/Auto e la revisione richiesta. Non devono inventare approvazioni, rieseguire comandi incerti con un nuovo ID né pubblicare modifiche Git senza l'intento esplicito del proprietario.

Configura diversi server MCP con nome per installazioni multiple. Il passaggio da un'istanza all'altra è una decisione di instradamento, non di sincronizzazione. Esempi di configurazione per OpenClaw ed Hermes sono disponibili in AGENT_CONTROL.md; l'impostazione specifica del client e la compatibilità devono essere verificate per la versione del client installata.

La cache esterna dei requestId deduplica solo un insieme limitato di richieste durante l'esecuzione dell'app. Le operazioni persistenti utilizzano identità proprie: createRequestId per la creazione di attività, commandId per le decisioni sul flusso di lavoro, clientMessageId per i messaggi e operationId per le modifiche di Git. Mantieni l'identità e il payload originali dopo una conferma sconosciuta; leggi lo stato salvato prima di assegnare deliberatamente nuovo lavoro.

Istruzioni correlate: [Istruzioni per il client MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI locale e limiti di automazione

Il dispatcher ziaf controlla la stessa app in esecuzione e il flusso di lavoro salvato. Dai sorgenti, usa npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID oppure npm run ziaf -- pause --task TASK_ID. Una conferma di avvio avvenuto con successo non significa che l'attività sia stata completata.

--until-success abilita deliberatamente Auto per il flusso di lavoro salvato, ma domande, revisione, gate di accettazione, limiti e checkpoint rimangono applicabili. Ctrl+C interrompe l'osservazione del dispatcher; non arresta implicitamente il flusso di lavoro dell'applicazione. Consulta CLI.md per i codici di uscita, gli endpoint locali e la gestione dei profili.

L'interfaccia Automazioni memorizza attualmente definizioni di visualizzazione e contatori di esecuzione locali. Non è uno scheduler ricorrente certificato e non dimostra che un turno del modello in background sia stato eseguito. Per l'esecuzione effettiva usa i controlli del flusso di lavoro salvato, ziaf o l'API autenticata e ispeziona le relative ricevute. Non confondere il pannello dimostrativo con una pianificazione autonoma non presidiata.

Istruzioni correlate: [Comandi del dispatcher](../../CLI.md).

<a id="updates"></a>

## Version and updates

> La guida completa non è ancora tradotta nella lingua dell'interfaccia. Viene mostrato il riferimento in inglese.

Open Settings → Updates and choose Check for updates. The official GitHub repository ZIAForge/ZIAForge and the Stable channel are configured by default. The panel shows the running version and any newer compatible release. Preview includes prereleases; Stable excludes them. Checking never installs an update.

When an update is available, Update downloads the package for this operating system and architecture, verifies its published size and SHA-256, prepares the installer and requests a normal application restart. Save file edits first. Installation is armed only after application services stop, and the installer waits for the current process to exit. Your profile, settings, task history and project files are kept.

Supported installation paths are a writable macOS application bundle, the Windows installer, Linux AppImage and the distribution package manager for DEB/RPM. System installation or authentication prompts may still appear. A development checkout, a read-only or translocated macOS app, or an unsupported portable layout may require manual installation; the panel explains that case and links to the release. Move a macOS application out of the mounted disk image before using in-place updates.

Automatic checking and downloading is optional. When enabled, it checks immediately and every six hours. Installing and restarting remains a separate owner action. A failed download or checksum check retains the existing installation and never runs the downloaded file.

Downloaded package hashes establish that the files match the selected GitHub release. They do not replace code signing or notarization. The updater does not disable operating-system security checks. Repository and channel changes, downloads and installation are local owner actions; remote agents can read update status only.

Istruzioni correlate: [Application update behavior and installation limits](../../UPDATES.md) · [Release readiness](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Riavvio e ripristino

Su macOS, usa Esci / ⌘Q per un arresto completo. La chiusura della finestra potrebbe lasciare l'app in esecuzione. Chiudi completamente la vecchia versione prima di sostituire l'applicazione.

Dopo l'avvio, seleziona la stessa attività. La cronologia e le bozze vengono ripristinate. Riprendi ripristina un contesto nativo/locale, ma non invia una bozza, non riattiva la coda in pausa né autorizza la ripetizione di un'operazione sconosciuta.

Se compare Ripristino, non modificare il file JSON manualmente. Ispeziona il tipo di documento interessato, preserva i file originali e seleziona un backup convalidato. Il ripristino di una coda precedente contrassegna i suoi elementi come incerti.

Quando la consegna è sconosciuta, un flusso di lavoro gestito potrebbe richiedere un'autorizzazione esplicita per un nuovo contesto. Il lavoro precedente e i tentativi falliti rimangono; un rifiuto visibile è più sicuro di un successo fabbricato.

Esegui il backup dei file dell'attività e del profilo dell'app con tutte le istanze dell'applicazione chiuse. Una cartella copiata non costituisce un ripristino verificato. Se la procedura di ripristino richiede di selezionare un backup convalidato, conserva anche gli esatti file danneggiati. Il ripristino di un flusso di lavoro o di una coda precedente non autorizza la riesecuzione di inferenze incerte o di operazioni Git.

Istruzioni correlate: [Contratto di ripristino](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Risoluzione dei problemi

CLI non trovata: controlla la sua installazione e versione in un normale terminale, quindi riavvia ZIAForge. La presenza di un eseguibile non indica che hai effettuato l'accesso. Utilizza il meccanismo di autenticazione del provider stesso.

Modello non disponibile o autorizzazione non riuscita: aggiorna il rilevamento, seleziona un ID disponibile e controlla il tuo account e i limiti. Non ripetere una richiesta incerta prima di averne esaminato la cronologia.

Flusso di lavoro interrotto: apri la fase corrente, la domanda, la ricevuta di verifica o i log della CLI. Risolvi la causa specifica: una domanda senza risposta, un comando, i permessi della cartella o il superamento dei tentativi massimi. Continua non può trasformare un controllo fallito in un successo.

Cartella mancante o sostituita: ripristina l'accesso alla cartella originale o crea una nuova attività. L'app non deve proseguire da HOME. Se rilevi un'altra cwd, interrompi il turno e conserva i dati di diagnostica.

Per una segnalazione, includi la versione indicata in Informazioni, il percorso, la CLI/modello, il comportamento previsto ed effettivo, uno screenshot e un estratto sicuro dei log. Rimuovi segreti, dati personali e percorsi che non possono essere pubblicati.

Pagina remota non disponibile: verifica che il proprietario abbia abilitato il server, controlla l'indirizzo e la porta di ascolto, quindi autenticati con il token dell'istanza corretto. Un errore 401 indica problemi di autenticazione; una modifica negata può dipendere dall'ambito di sola lettura o da un controllo riservato al proprietario. La modifica del token disconnette i client browser esistenti. Non esporre la porta di ispezione separata di DevTools come controllo remoto dell'applicazione.

Salvataggio dell'editor rifiutato: conserva la bozza, esamina il file attuale sul disco e risolvi il conflitto di modifica esterna. Non aggirare il confronto riscrivendo i metadati dell'applicazione. Se il caricamento completo di file di grandi dimensioni non è disponibile, usa la modalità di modifica/ricerca per finestre supportata o un editor esterno.

Telegram non disponibile: verifica localmente il token del bot, il proprietario numerico, la chat privata e lo stato. Un webhook o un poller concorrente può bloccare il polling; ZIAForge non cancella automaticamente un webhook né assume il controllo di un altro poller. I comandi rifiutati o interrotti a una soglia sconosciuta non vengono rieseguiti automaticamente.

Istruzioni correlate: [Test e diagnosi](../../TESTING.md).

<a id="diagnostics"></a>

## Segnala problemi ed esamina le evidenze

Registra l'esatta build in esecuzione da Informazioni, OS/architettura, modalità dell'attività, provider/modello selezionato e i passaggi per riprodurre il problema. Descrivi il risultato previsto e quello osservato. Includi uno screenshot sicuro e la ricevuta pertinente del comando conservato o della verifica, anziché un intero profilo privato.

I log della CLI, i registri degli eventi, le trascrizioni dei modelli, le tracce del browser e gli screenshot possono esporre codice sorgente, percorsi personali o token. Esaminali e rimuovi le informazioni riservate prima di condividerli. Uno strumento di oscuramento dei log senza garanzie non certifica che uno screenshot o un archivio siano pubblicabili.

Per i collaboratori, qa:doctor legge l'identità dell'ambiente/build; qa:inspect apre un profilo isolato con stub del provider. Una fixture verifica il percorso dell'applicazione testato senza contattare un modello. L'inferenza in tempo reale, la connettività di Telegram, il desktop Linux nativo, la firma e le verifiche dei pacchetti generati costituiscono evidenze distinte. Consulta TESTING.md per i comandi riproducibili e la pulizia.

Istruzioni correlate: [Comandi di evidenza](../../TESTING.md).

<a id="privacy"></a>

## Dati locali e limiti

I progetti, la cronologia, i piani, i documenti e la diagnostica possono contenere testo privato. Non pubblicare profili, acquisizioni non elaborate, chiavi o log completi contenenti codice sorgente.

Su Linux, il salvataggio delle credenziali per API, controllo, Telegram e istanze richiede un servizio segreto GNOME sbloccato o KWallet; senza un gestore di segreti supportato, ZIAForge rifiuta di salvare questi segreti anziché ricorrere al fallback basic_text di Electron.

L'archiviazione locale non significa che le richieste rimangano sul tuo computer: la CLI/API selezionata le invia al relativo provider. Una cartella di lavoro e la supervisione dei processi non costituiscono un isolamento dell'OS. Esamina le autorizzazioni selezionate.

Distingui i tipi di evidenza: le fixture testano l'applicazione senza un modello; le verifiche native in tempo reale utilizzano un account/CLI reali; i controlli sui pacchetti certificano uno specifico elemento generato. Il superamento di uno non garantisce gli altri.

L'ambito dell'applicazione, un worktree e un prompt di sola lettura sono diversi da un'applicazione a livello di sistema operativo. Le policy di revisione/assistenza di Antigravity rilevano le modifiche nelle evidenze raccolte nell'area di lavoro anziché imporre un accesso in sola lettura al file system. Il controllo nativo del computer esegue programmi autorizzati dal proprietario al di fuori del consueto limite degli strumenti dell'app; disattivalo quando non è più necessario.

Istruzioni correlate: [Provenienza e pubblicazione](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Comprendere e modificare questo progetto open source

Leggi prima AGENTS.md e CONTRIBUTING.md, quindi PROJECT_MAP.md per i limiti attuali del codice sorgente. I contratti tipizzati implementati e i documenti correnti su flussi di lavoro/provider ne regolano il comportamento. CONCEPT.md e le parti orientate al terminale di ARCHITECTURE.md conservano l'intento storico e non devono essere scambiati per caratteristiche della versione attuale.

La sorgente della guida in inglese è docs/help/en.json. Non modificare manualmente i file generati USER_GUIDE.md o website/guide.html. Modifica la sezione canonica, aggiorna il contratto interessato ed esegui node scripts/help/generate.cjs. La Guida integrata nell'app legge la medesima sorgente. Esamina le aggiunte confrontandole con l'effettiva implementazione, inclusi limiti, autorizzazioni e percorsi non supportati.

Ciascuna delle 56 impostazioni internazionali dell'interfaccia ha uno stato della guida distinto in docs/help/locales.json. Le guide mancanti o incomplete ricorrono all'inglese come fallback. I testi completi tradotti automaticamente sono etichettati e vincolati all'hash del testo sorgente inglese, senza alcuna pretesa di revisione umana. Una traduzione revisionata da un essere umano registra inoltre il relativo revisore. Ogni traduzione deve preservare gli ID di sezione, le azioni, gli identificatori di file/comandi e i limiti tecnici, usare la direzione di scrittura corretta ed essere aggiornata quando cambia il relativo testo sorgente inglese.

Prima della distribuzione, esegui node scripts/help/generate.cjs --check per rilevare output generati obsoleti, scaffold di localizzazione non validi o collegamenti a contratti locali interrotti. Le verifiche delle traduzioni della UI e i controlli del comportamento dell'applicazione rimangono distinti. HELP_MAINTENANCE.md descrive la procedura di aggiornamento per i collaboratori e l'AI; la documentazione non deve dichiarare superato un test che non è stato eseguito.

Istruzioni correlate: [Mappa attuale del progetto](../../PROJECT_MAP.md) · [Manutenzione della documentazione](../../HELP_MAINTENANCE.md) · [Istruzioni per i collaboratori](../../../CONTRIBUTING.md) · [Istruzioni per gli agenti](../../../AGENTS.md).
