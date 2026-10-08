<!-- Generated from docs/help/en.json; source SHA-256 132e99f829c744c67a5160004c5a9db678393731d2e56b8eab14a0b4fd6df903. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: de; served locale: de; status: machine-translated. -->
# ZIAForge-Benutzerhandbuch

Von der Absicht zu einem verifizierten Ergebnis. Ein praktischer Leitfaden zu Code, Work und der Anwendungssteuerung.

Englisch ist verbindlich. Maschinell übersetzte Hilfe ist getrennt von durch Menschen geprüften Übersetzungen gekennzeichnet. Automatische Prüfungen bescheinigen keine muttersprachliche Genauigkeit.

> Diese Anleitung wurde maschinell aus der aktuellen englischen Quelle übersetzt. Eine menschliche Überprüfung ist weiterhin willkommen.

## Abschnitte des Handbuchs

- [Erste Schritte](#start)
- [Das richtige Desktop-Paket installieren](#install-platforms)
- [Code: fünf Routen](#code)
- [Forge-Diskussion](#forge)
- [Dokumente und Entscheidungen](#decisions)
- [Ausführung und Überprüfung](#execution)
- [Parallele Prüfteams und der Berichtarchitekt](#review-teams)
- [Agenten-Spezialisierungen und Prompt-Richtlinie](#specializations)
- [Work: von der Frage zum Dokument](#work)
- [Voreinstellungen, Modelle und Zugriff](#models)
- [Chats, Stopp und die Warteschlange](#chat)
- [Dateien, Git und Fertigstellung](#files)
- [API connections](#api)
- [Einstellungen, Sprachen und sicheres Zurücksetzen](#settings)
- [Den Hilfe-Assistenten fragen](#help-assistant)
- [Assistent und Telegram](#assistant-control)
- [Bedienen Sie Ihren privaten Telegram-Bot](#telegram)
- [Natives Computer-Zugriffsrecht nur für den Eigentümer](#native-permissions)
- [Browser- und Remote-Instanzen](#remote)
- [OpenClaw, Hermes und andere externe Agenten](#external-agents)
- [Lokale CLI- und Automatisierungsgrenzen](#local-cli)
- [Version und Updates](#updates)
- [Neustart und Wiederherstellung](#restart)
- [Fehlerbehebung](#troubleshooting)
- [Probleme melden und Nachweise prüfen](#diagnostics)
- [Lokale Daten und Grenzen](#privacy)
- [Dieses Open-Source-Projekt verstehen und ändern](#project-contributors)

<a id="start"></a>

## Erste Schritte

ZIAForge vereint Diskussion, Planung, Ausführung und Verifizierung in einer einzigen Aufgabe. Wählen Sie Code für ein Git-Projekt oder Work für Dokumente, Recherche und andere Ergebnisse in einem gewöhnlichen Ordner.

Beginnen Sie mit einer kleinen Aufgabe in einem separaten Projekt. Wenn Sie ein natives CLI wählen, installieren Sie es und melden Sie sich zuerst in einem Terminal mit dessen eigenem Konto an. Konfigurieren Sie alternativ eine API-Verbindung. Ein CLI-Abonnement und eine kostenpflichtige API sind getrennte Verbindungsmethoden; ZIAForge meldet Sie nicht an und überträgt kein Guthaben zwischen ihnen.

1. Öffnen Sie die Einstellungen und überprüfen Sie Arbeitsbereichsordner und Sprache. „Über“ zeigt die genaue Identität des laufenden Builds.
2. Fügen Sie für Code ein Git-Repository in der Seitenleiste hinzu. Wählen Sie für Work beim Erstellen der Aufgabe einen separaten Ordner.
3. Speichern Sie eine Voreinstellung mit einem CLI, Modell, Reasoning-Aufwand und einer Zugriffsebene. Sie können „Benutzerdefiniert“ auch direkt ohne gespeicherte Voreinstellung auswählen.
4. Erstellen Sie eine Aufgabe, wählen Sie Route, Rollen sowie manuelles oder automatisches Vorrücken. Überprüfen Sie die Auswahl vor dem Start.

> Verwenden Sie das vom Maintainer bereitgestellte Artefakt und die Prüfsumme. Eine Vorschauversion ist möglicherweise nicht signiert oder verfügt über keinen veröffentlichten Update-Feed. Die Unterstützung für Desktop und native Anbieter muss für das genaue OS, die Architektur und das Artefakt verifiziert werden; die reine Quellcodeunterstützung ist keine Release-Zertifizierung.

Zugehörige Anweisungen: [Projektübersicht](../../../README.md) · [Anbieterkompatibilität](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Das richtige Desktop-Paket installieren

Wählen Sie ein Paket für Ihr Betriebssystem und Ihre CPU-Architektur: x64 oder arm64. Die Build-Pipeline kann Formate für macOS DMG/ZIP, Windows-NSIS-Installer/ZIP sowie Linux DEB/RPM/AppImage/tar.gz/ZIP erzeugen. Eine generierte Datei oder ein Cross-Build ist kein Beweis dafür, dass Installationsprogramm und native UI auf Ihrem Rechner bestanden haben; schlagen Sie im Verifizierungsdatensatz dieser Version nach.

macOS-Builds mit Electron 44 erfordern macOS 13 oder neuer. Verwenden Sie das arm64-Paket auf Apple Silicon und das x64-Paket für Intel. Beenden Sie eine ältere Anwendung vor dem Ersetzen vollständig. Vorschaupakete sind möglicherweise nicht signiert und nicht beglaubigt; verwechseln Sie ein Entwicklungsartefakt nicht mit einer signierten öffentlichen Veröffentlichung.

Windows erfordert ein Betriebssystem, das von der gebündelten Electron-Version unterstützt wird, sowie in PATH verfügbares Git. Wählen Sie die passende Architektur. Einer unsignierten Vorschau fehlt die Authenticode-Zertifizierung. Eine portable ZIP muss das vollständige Anwendungsverzeichnis und die Laufzeitdateien enthalten, nicht nur deren ausführbare Datei.

Linux benötigt eine kompatible grafische Benutzeroberfläche, die von Electron vorausgesetzten Systembibliotheken sowie Git. Stellen Sie für verschlüsselte Steuerungsanmeldedaten einen funktionierenden Secret Service wie gnome-libsecret oder KWallet bereit; das unsichere Backend basic_text wird nicht akzeptiert. Headless-/Container-Smoke-Nachweise bescheinigen nicht jede Desktop-Umgebung oder Distribution.

Installieren Sie ein DEB mit apt install ./file.deb oder ein RPM über den Paketmanager Ihrer Distribution. Ein AppImage benötigt Ausführungsrechte und geeignete FUSE-Unterstützung; --appimage-extract-and-run ist eine Alternative, sofern unterstützt. Entpacken Sie tar.gz- und ZIP-Pakete mit all ihren Laufzeitdateien. Halten Sie Benutzerdaten und Anwendungsdateien beim Ersetzen eines Pakets getrennt.

Verwenden Sie für den Build aus dem Quellcode Node 24, Git und npm ci einschließlich des regulären Electron-Installationsprogramms. Native Neuerstellungen erfordern Plattformwerkzeuge: Xcode-Befehlszeilenwerkzeuge unter macOS; MSVC C++, Windows SDK und Python unter Windows; Compiler, make, Python, pkg-config und die erforderlichen Paketierungswerkzeuge unter Linux. Befolgen Sie PLATFORM_BUILDS.md für die genauen Befehle und aktuellen Plattformbeschränkungen.

Release-Versionen werden zentral reserviert und Ausgaben sind unveränderlich. Ein CI-Verifizierungsbuild ist kein veröffentlichtes Installationsprogramm. Quellarchive enthalten Quellcode, Lockfile, Dokumentation und Skripte; Abhängigkeiten, Anmeldedaten, Benutzerprofile und private Forschung sind ausgeschlossen. Schließen Sie niemals aus einem erfolgreichen x64-Build auf eine native ARM- oder Windows-Validierung.

Zugehörige Anweisungen: [Plattformpakete, Voraussetzungen und Verifizierungsgrenzen](../../PLATFORM_BUILDS.md) · [Build-Identität und Release-Prüfungen](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: fünf Routen

Auto bewertet den Umfang: Eine einfache Frage kann mit einer Antwort enden, während eine größere Aufgabe Vorbereitung erfordert. „Fehler beheben“ untersucht eine Ursache und bereitet eine Korrektur vor. „Zuerst Spezifikation“ beginnt mit der technischen Lösung; „Zuerst Anforderungen“ beginnt mit Anforderungen und Akzeptanzkriterien.

Multi-Model verwendet getrennte Kontexte für Erkundung, Entwurf, Implementierung und Überprüfung. Der Routenname erfordert keine unterschiedlichen Anbieter: Jede Rolle verwendet die Voreinstellung oder benutzerdefinierte Konfiguration, die Sie wählen.

Ein Worktree isoliert die Git-Änderungen einer Aufgabe. „Branch“ arbeitet im ausgewählten Checkout. Prüfen Sie Projekt, Branch und Modell vor dem Start; die Aufgabenbeschreibung wird nicht zusätzlich an einen normalen Chat gesendet.

Nutzen Sie für eine Idee mit ungeklärten Produkt- oder Technikentscheidungen „Zuerst Anforderungen“ und schaffen Sie die Grundlage in der Diskussion. Auto klassifiziert die Anfrage; es handelt sich nicht um einen Befehl, jede kurze Formulierung sofort umzusetzen. „Entwurf speichern“ behält die Anfrage bei, ohne ein Modell zu kontaktieren; „Start“ speichert und startet den verwalteten Ablauf einmalig. Ein bis vier Aufgabenkopien besitzen unabhängige Erstellungs-IDs und Rolleneinstellungen.

Zugehörige Anweisungen: [Code-Workflow-Vertrag](../../WORKFLOWS.md) · [Code-Prompt-Profile](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Forge-Diskussion

„Start“ öffnet die zentrale Diskussion. Antworten Sie ganz natürlich, stellen Sie Gegenfragen, fügen Sie Einschränkungen hinzu und diskutieren Sie technische Entscheidungen. Das Gespräch und die Fragen bleiben bei der Aufgabe.

Das Senden von Text bedeutet weder die Annahme eines Dokuments noch die Autorisierung eines neuen Implementierungsplans. Eine Klärung während der Ausführung pausiert zunächst den verwalteten Zug und greift den betroffenen Umfang wieder auf. Die Antwort auf eine Frage innerhalb eines bereits angenommenen Schritts kann diesen Schritt fortsetzen.

Um die Grundlage gezielt neu zu betrachten, wählen Sie „Anforderungen“, „Spezifikation“ oder „Planung“. Eine neue Version erfordert die erneute Annahme abhängiger Entscheidungen. Abgeschlossene Schritte und ihre Belege bleiben erhalten; abgelöste, unvollendete Phasen verbleiben im Verlauf.

Geführte Phasensitzungen unterscheiden sich vom freien Chat. Nutzen Sie die Forge-Diskussion, statt manuelle Prompts direkt an eine workflow-eigene Sitzung zu senden.

Zugehörige Anweisungen: [Forge-Diskussionsvertrag](../../WORKFLOWS.md).

<a id="decisions"></a>

## Dokumente und Entscheidungen

Öffnen Sie ein Dokument, prüfen Sie seine Version und nehmen Sie bei Bedarf Änderungen vor. Das Einreichen von Änderungen über die Diskussion erzeugt eine neue Version; Berichte und verifizierte Ergebnisse werden nicht rückwirkend umgeschrieben.

Bevor Sie einen vorgeschlagenen Plan annehmen, bearbeiten Sie die Reihenfolge, die Anweisungen, die Akzeptanzkriterien und die Verifizierungsbefehle. Autorisieren Sie konkrete Befehle, die Sie verstehen: Sie werden im Aufgabenordner ausgeführt. Multi-Model schlägt einen Implementierungsschritt für die gesamte Aufgabe vor, mit Details in seinen Dokumenten und Anweisungen.

„Genehmigen“ ist eine separate, bewusste Entscheidung. Auto umgeht weder Rückfragen noch die Annahme von Anforderungen, Spezifikationen und Plänen. Ein extern geändertes Dokument kann eine alte Genehmigung nicht wiederverwenden.

Vorbereitungsdateien erscheinen als Artefakte. Ihre Version, die erzeugende Phase und ihr Hash binden sie an ein Ergebnis. Code-Dokumente werden außerhalb des Worktrees aufbewahrt und gelangen nicht automatisch in einen Commit.

Prüfen Sie vor der Annahme sowohl das Dokument als auch die angezeigte Entscheidung. Die Annahme bindet das aktuelle Gate-ID, die Planrevision und die beibehaltenen Dokument-Hashes. Fordern Sie Änderungen an, wenn Umfang oder Belege fehlerhaft sind. Wenn eine Entscheidung veraltet ist, laden Sie den gespeicherten Zustand neu, bevor Sie eine neue Wahl treffen; eine geänderte Datei kann nicht unter einer früheren Version angenommen werden.

Zugehörige Anweisungen: [Workflow-Gates und Dokumentversionen](../../WORKFLOWS.md).

<a id="execution"></a>

## Ausführung und Überprüfung

„Aufgabenliste“ zeigt reale Schritte, den aktuellen Versuch, Verifizierungs- und Überprüfungsergebnisse. Wenn ein Agent „fertig“ sagt, schließt das einen Schritt nicht ab: Die vom Plan geforderten Belege müssen vorliegen.

Der manuelle Modus pausiert zwischen berechtigten Schritten. Auto rückt verifizierte Schritte vor und erlaubt begrenzte Wiederholungsversuche. „Anhalten nach“ erstellt immer einen Prüfpunkt. „Pause“ stoppt die aktive Arbeit des Workflows; das Schließen eines Panels stoppt sie nicht.

Ein unabhängiger Prüfer verwendet einen separaten Kontext mit Dateien und Verifizierungsergebnissen. Jeder erforderliche blockierende Befund muss behoben werden; mehrere Prüfer können einen blockierenden Fehler nicht durch Abstimmung aufheben.

In Multi-Model erfordert das Korrigieren von Befunden eine explizite Entscheidung. Eine Korrektur startet nicht stillschweigend eine weitere Überprüfung: „Erneut überprüfen“ öffnet einen frischen Zyklus. Prüfkommentare können eine erneute Prüfung durch den Koordinator anfordern, ohne die Implementierung zu wiederholen.

Abgeschlossene Schritte können nicht stillschweigend bearbeitet werden. Bei TDD muss Rot tatsächlich aus dem erwarteten Grund fehlschlagen, danach muss Grün bestehen. Begrenzte Versuche verhindern endlose Wiederholungen.

Speichern Sie unabhängige CLI/API-Prüfer in Einstellungen → Prüfteams und wählen Sie das Team anschließend in Code oder Work aus. Die Prüfer laufen parallel, gefolgt vom Berichtarchitekten des Teams. Sie können unabhängige Prüfer auch ohne gespeichertes Team konfigurieren. Der Berichtarchitekt erhält ausschließlich anonyme strukturierte Berichte ohne Projektdateien oder Werkzeuge; diese Isolation erfordert derzeit Claude Code oder API.

Jeder Implementierungsschritt benötigt eine ausführbare Prüfung, eine erforderliche unabhängige Überprüfung oder beides. Vorbereitungsphasen behalten stattdessen validierte Ergebnisse und Artefaktbelege; diese geben nicht vor, dass Implementierungstests gelaufen sind. Ein Befehl ist nur dann erfolgreich, wenn sein tatsächlicher Exit-Status und das Aufräumen eigener Prozesse bestätigt sind. Eine Rot-Prüfung für TDD muss vor der Implementierung und der Grün-Verifizierung regulär fehlschlagen; eine fehlende ausführbare Datei oder eine Zeitüberschreitung ist kein gültiges Rot-Ergebnis.

Standard-Trennschalter stoppen nach drei fehlgeschlagenen Versuchen bei einem Schritt oder fünfzig Versuchen insgesamt. Eine Unterbrechung verbraucht einen Versuch, zählt selbst jedoch nicht als fehlgeschlagener Versuch. Grenzwerte und abgeschlossene Belege überstehen einen Neustart; „Wiederholen“ setzt sie nicht zurück. Lesen Sie den beibehaltenen Fehlschlag, bevor Sie einen weiteren Versuch autorisieren.

Zugehörige Anweisungen: [Verifizierung und Überprüfung](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Parallele Prüfteams und der Berichtarchitekt

Öffnen Sie Einstellungen → Prüfteams und speichern Sie ein Team. Fügen Sie unabhängige Prüfer mit eigenem CLI oder API, Modell, Reasoning-Aufwand und eigener Spezialisierung hinzu und wählen Sie dann einen Berichtarchitekten. Wählen Sie das Team in der Prüfkonfiguration der Aufgabe aus. Eine Ausführer-Voreinstellung kann auch von einem Prüfer verwendet werden, und „Benutzerdefiniert“ bleibt verfügbar; unabhängige Rollen besitzen weiterhin separate Kontexte.

Prüfer laufen parallel auf denselben Aufgabenbelegen. Jeder erforderliche Bericht, Fehler und jedes Urteil wird beibehalten. Der Architekt erhält anonyme nummerierte Berichte ohne Namen der Prüfer, Modell- oder Anbieteridentitäten, ursprüngliche Aufgabeninhalte, Repository-Zugriff oder Werkzeuge. Er vergleicht Berichte und liefert ein einziges strukturiertes Urteil zurück; er führt keine erneute Quellcodeüberprüfung durch.

Ein blockierender Befund oder die Ablehnung eines erforderlichen Prüfers kann weder durch Mehrheitsbeschluss noch durch Präferenz des Architekten übergangen werden. Fehlende oder fehlerhafte Berichte verhindern eine Genehmigung. Prüfen Sie die einzelnen Befunde und die Gesamtscheidung, bevor Sie Korrekturen annehmen oder autorisieren. Ein gespeichertes Team wird für den Lauf aufgelöst und eingefroren; das Bearbeiten seiner Voreinstellung schreibt abgeschlossene Belege nicht um.

Der Nur-Bericht-Architekt nutzt derzeit unterstützte werkzeuglose Konfigurationen von Claude oder API. Codex und Antigravity bleiben als Prüfer verfügbar, werden jedoch für diese isolierte Architektenrolle abgelehnt, bis ein verifizierter werkzeugloser Vertrag vorliegt. Eine Eingabeaufforderung mit dem bloßen Wortlaut „keine Werkzeuge“ reicht nicht aus.

> Die Entwurfs-/Überprüfungspipeline von Code Multi-Model und ein gespeichertes paralleles Prüfteam sind getrennte Steuerungen. Behalten Sie die ausgewählte benutzerdefinierte Prüfrichtlinie bei; gehen Sie nicht davon aus, dass eine Route jede Prüffunktion aktiviert.

Zugehörige Anweisungen: [Typisierte Teamkonfiguration](../../../shared/review-team.ts) · [Überprüfungsaggregation](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Agenten-Spezialisierungen und Prompt-Richtlinie

Ein Modell ist die Ausführungs-Engine; eine Spezialisierung ist ein Anweisungsprofil. Wählen Sie „Keine“ für keine zusätzliche Spezialisierung, „Standard“ für den Standardleitfaden, Auto für einen relevanten integrierten Leitfaden oder „Manuell“ für ausgewählte Leitfäden und eigene begrenzte Anweisungen. Voreinstellungen können die Auswahl beibehalten.

Der ursprüngliche Katalog umfasst allgemeine Programmierung, Architektur, Sicherheit, Zuverlässigkeit, Leistung, Testen und Oberflächenbenutzbarkeit. Auto verwendet den verfügbaren Aufgaben-/Schritttext, um einen Leitfaden auszuwählen; es ruft nicht heimlich ein anderes Modell auf und bescheinigt kein Fachwissen. Planungsvorschläge können vor der Annahme des Implementierungsplans geprüft und geändert werden.

Überprüfungsspezialisierungen helfen dabei, die Aufmerksamkeit zu lenken, ersetzen jedoch niemals unabhängige Belege, Zugriffsgrenzen oder das strukturierte Urteil. Behandeln Sie benutzerdefinierte Anweisungen als Teil des Aufgabenbereichs: Nutzen Sie sie nicht, um Dokumentenannahme, Werkzeugrichtlinien, Authentifizierung oder Prüferfehler zu umgehen.

Zugehörige Anweisungen: [Ursprünglicher Prompt-Katalog](../../../shared/specializations.ts).

<a id="work"></a>

## Work: von der Frage zum Dokument

Work erfordert kein Git. „Standard“ erstellt einen separaten Aufgabenordner; „Benutzerdefiniert“ wählt einen vorhandenen Ordner über die native Auswahl aus. „Entwurf speichern“ speichert Einstellungen ohne Inferenz; „Start“ führt die erste Phase aus.

Auto antwortet direkt oder schlägt einen passenden Plan mit echten Aufgaben vor. „Brainstorming“ erstellt ideas.md, bevor Sie weitere Ideen oder eine Bewertung auswählen. „Recherche“ hält findings.md, Quellen und Grenzen fest. „Schreiben“ führt von der Absicht und – sofern nützlich – outline.md zu einem beschreibenden Dokument oder draft.md; Überarbeitungen behalten frühere Versionen bei.

Wählen Sie Dateieingaben über die native Auswahl aus und referenzieren Sie diese mit @. Die Anwendung kopiert sie als unveränderliche Aufgabeneingaben und validiert deren Identität vor einem Durchlauf. „Standard“ erstellt einen anwendungseigenen Aufgabenordner; der Zugriff auf benutzerdefinierte Ordner ist eine gespeicherte Eigentümergenehmigung. Ein gespeicherter, noch nicht gestarteter Entwurf kann seinen Ordner ändern.

Erstellen Sie 1–4-Kopien mit unabhängigen Ausführereinstellungen. Aufgaben, die überlappende Ordner nutzen, können nicht gleichzeitig schreiben. Diese Koordination gilt für ZIAForge-Operationen, nicht für beliebige externe Programme.

Deep Brainstorming verwendet standardmäßig drei unabhängige Bearbeiter und unterstützt bis zu acht. Wählen Sie deren Reihenfolge und Konfigurationen, einschließlich der Wiederverwendung einer Voreinstellung in getrennten Kontexten. Fragen der Bearbeiter behalten ihre Herkunft; fehlerhafte Berichte erhalten einen Versuch zur Formatreparatur. Ein teilweiser Fehlschlag bleibt sichtbar, statt als einhelliger Erfolg dargestellt zu werden.

Deep fasst beibehaltene Bearbeiterberichte in brainstorm_report.md zusammen und verlangt stets eine Benutzerentscheidung. Ein kleiner Nachgang überarbeitet den Bericht über den Koordinator; eine größere Änderung startet eine weitere Runde der eingefrorenen Bearbeiter. Artefakte behalten ihre Versionen.

Aufgelöste Rollen werden bei der Aufgabenerstellung oder beim expliziten Speichern des Entwurfs eingefroren. Nach dem ersten Aufruf kann sich nur noch das automatische/manuelle Vorrücken ändern; nutzen Sie eine neue Aufgabe für andere Rollen- oder Modelleinstellungen. Das Bearbeiten einer globalen Voreinstellung ändert spätere Phasen nicht stillschweigend.

Der manuelle Modus pausiert zwischen berechtigten Phasen, einschließlich einer substanziellen Gliederung in „Schreiben“. Auto kann durch diese Gliederung hindurch fortfahren. Fragen, vorgeschlagene ausführbare Pläne, die Richtung im Brainstorming und die Überprüfung von Deep-Berichten bleiben selbst in Auto explizite Entscheidungen. Ein Zitat allein beweist keinen Browsing-Vorgang, und eine beibehaltene Binärdatei allein beweist nicht deren Darstellung.

Zugehörige Anweisungen: [Work-Modi und Entscheidungen](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Voreinstellungen, Modelle und Zugriff

Eine Voreinstellung speichert einen CLI/API, ein Modell, den Reasoning-Aufwand und Berechtigungen. Die Chat-Fußzeile enthält Abschnitte für Voreinstellung, CLI, Modell und Optionen. „Benutzerdefiniert“ funktioniert ohne Voreinstellung; „Voreinstellung erstellen“ speichert die aktuelle Auswahl.

Der Katalog stammt vom ausgewählten installierten CLI oder API, sofern unterstützt. „Aktualisieren“ erneuert die Liste, ohne die Auswahl zu ändern. Falls die Erkennung nicht verfügbar ist, geben Sie ein explizites Modell-ID ein; der Anbieter muss es dennoch unterstützen. Reasoning-Stufen hängen vom Modell und CLI ab. Der Standardwert des Anbieters unterscheidet sich vom expliziten none-Token.

Wenden Sie Änderungen erst nach Bestätigung durch das Backend an. Ein Wechsel ist während eines aktiven Zugs oder einer nicht leeren Warteschlange eingeschränkt. Entwürfe und der sichtbare Verlauf bleiben erhalten, ein Anbieterwechsel überträgt jedoch nicht deren privaten internen Zustand.

In Forge spielt die Rollenbezeichnung eine Rolle: Die Vorbereitung kann einen separaten Planer verwenden. Die Fußzeile ändert die angezeigte Rolle; Prüfer und Helfer werden in den Workflow-Einstellungen ausgewählt. Richtlinien für bereits verifizierte Implementierungen sind möglicherweise gesperrt.

Berechtigungen unterscheiden sich je nach Anbieter. „Nur Lesen“ und „Workspace-Schreibzugriff“ sind verfügbar, wo der Adapter sie unterstützt. Antigravity verwendet native CLI-Einstellungen oder explizit ausgewählten Vollzugriff. Vollzugriff ist keine Sandbox.

Eine Spezialisierung fügt Prompt-Anleitung hinzu, kein weiteres Modell oder Recht. Voreinstellungen und Rollen unterstützen „Keine“, „Standard“, Auto und „Manuell“. Auto wählt Profile aus dem Schritttext ohne zusätzlichen Modellaufruf; „Manuell“ akzeptiert bis zu vier Fachgebiete und benutzerdefinierte Anweisungen. Vom Planer vorgeschlagene Zuweisungen können vor Annahme des Plans bearbeitet werden.

Ein manuell eingegebenes Modell-ID oder ein manuell festgelegter Aufwand bleibt Ihre Wahl, der Anbieter kann dies jedoch ablehnen. Das Bearbeiten einer globalen Voreinstellung ändert einen laufenden Chat oder einen angenommenen Plan nicht rückwirkend. Um eine inaktive Unterhaltung bewusst zu ändern, verwenden Sie deren eigene Konfigurationssteuerelemente und warten Sie auf die Bestätigung. Eine deaktivierte Option sollte als Funktions- oder Lebenszyklusgrenze verstanden und nicht durch Bearbeiten gespeicherter JSON umgangen werden.

Zugehörige Anweisungen: [Anbieterfunktionen](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Chats, Stopp und die Warteschlange

Offene Tabs, „Zuletzt verwendet“ und Entwürfe gehören zu einer Aufgabe. Das Schließen eines Tabs entfernt ihn aus „Offen“, behält ihn jedoch in „Zuletzt verwendet“ und stoppt weder seinen Anbieterprozess noch seinen verwalteten Workflow. Durchsuchen Sie den Verlauf, öffnen Sie einen Chat erneut oder schließen Sie alle zusätzlichen Tabs über das Verlaufsmenü.

„Stopp“ unterbricht den aktuellen Zug. Warten Sie, bis das Anhalten abgeschlossen ist, bevor Sie erneut auf „Senden“ klicken: Eine Unterbrechungsbestätigung ist kein Abschluss des Prozesses. In der Zwischenzeit können Sie den nächsten Entwurf eingeben.

Im regulären Chat speichert „In die Warteschlange“ eine spätere Anfrage getrennt vom aktuellen Entwurf. „Warteschlange anhalten“ stoppt die weitere Zustellung. „Stopp“ und „Beenden“ pausieren die Warteschlange. Nach einem Neustart wählen Sie zuerst „Fortsetzen“ und dann explizit „Warteschlange fortsetzen“.

„Ungewiss“ bedeutet, dass die Zustellung unbekannt ist. Eine solche Nachricht wird nicht automatisch erneut gesendet: Prüfen Sie den Verlauf, kopieren Sie gegebenenfalls Text und verwerfen Sie den Eintrag in der Warteschlange. Ein erneutes Senden ist eine neue, bewusste Anfrage.

Geführte Phasenchats nutzen ihren Workflow, nicht die gewöhnliche Warteschlange. „Phase folgen“ zeigt die aktuelle Phase an; das manuelle Auswählen eines anderen Tabs beendet das Folgen. CLI-Protokolle zeigen Diagnosen getrennt von der Antwort an.

Markdown-Antworten rendern Überschriften, Listen, Tabellen, Links und Codeblöcke mit Syntax-Hervorhebung. Tool-Karten und CLI-Diagnosen bleiben von der Antwort getrennt. Vom Modell gemeldete Thinking- und Token-Metriken erscheinen nur dann, wenn der Anbieter sie tatsächlich bereitstellt; schließen Sie nicht anhand von Animationen auf private Gedankengänge oder den Verbrauch.

Prüfen Sie nach einem ungewissen Sendeversuch oder einer Warteschlangenbestätigung den Verlauf und wiederholen Sie nur dieselbe beibehaltene Anfrage, sofern dies angeboten wird. Ein Warteschlangenbeleg bedeutet, dass der Speicher das Element angenommen hat, nicht dass die Inferenz abgeschlossen ist. Entfernen Sie ein ungewisses Warteschlangenelement nur als explizite Verwerfung; dadurch kann kein bereits zugestellter Prompt zurückgezogen werden.

Zugehörige Anweisungen: [Dauerhafte Nachrichtenwarteschlange](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Dateien, Git und Fertigstellung

„Dateien“ zeigt den Aufgabenordner an. Vergleichen Sie Ergebnisse mit Anforderungen, öffnen Sie Dokumente und prüfen Sie Diffs. Das Beibehalten einer Binärdatei beweist keine fehlerfreie Darstellung in der Zielanwendung.

Git liefert Status, Änderungen und Operationen mit protokollierten Ergebnissen. Commit, Merge und Push erfolgen standardmäßig manuell; automatische Operationen sind separate Optionen für einen vollständig verifizierten Plan.

Ändern Sie Arbeitsdateien nicht zwischen Verifizierung und Veröffentlichung: Die Genehmigung ist an die exakten Bytes gebunden. Konflikte, fehlgeschlagene Pushes und unbekannte Operationsergebnisse blockieren den Fortschritt bis zu einer expliziten Entscheidung. Auto autorisiert das Veröffentlichen nicht stillschweigend.

Work erstellt keine Git-Branches und besitzt keine Git-Finalisierung. Behalten Sie die erforderlichen Dokumente aus dem ausgewählten Ordner, einschließlich Versionen und Quellen.

Der Datei-Editor bietet Syntaxhervorhebung nach Dateiendung, Suchen und Ersetzen, Rückgängig-Verlauf, Zeilenumbruch und Entwürfe pro Tab. Speichervorgänge wahren die unterstützte UTF-8/UTF-16-Codierung und weisen Konflikte durch externe Änderungen ab. Andere Codierungen und binäre Inhalte erfordern einen externen Editor. Nicht gespeicherte Entwürfe verhindern das Beenden der Anwendung, bis der Eigentümer sie speichert oder verwirft.

Vollständige Syntaxhervorhebung ist bis zu 8 MiB aktiviert. Größere Textdateien werden in Fenstern von 256 KiB geöffnet; 8–64 MiB können explizit vollständig ohne Syntax geladen werden. Verwenden Sie oberhalb von 64 MiB die Fensterbearbeitung und begrenzte Weitersuche nach Treffern. Dies ist ein eingeschränkter Modus für große Dateien und keine Gleichwertigkeit mit Sublime Text für beliebig große Dokumente.

„Ordner öffnen“ verwendet den Kontext der aktuellen Aufgabe oder des aktuellen Branch/Worktree, anstatt stillschweigend nur das ursprüngliche Repository zu öffnen. Eine Dateizeile kann das übergeordnete Verzeichnis dieser Datei einblenden. Pfade werden vom Backend anhand registrierter Aufgabengenehmigungen validiert. Binärdateien können nicht als Klartext bearbeitet werden; nutzen Sie deren Zielanzeige und behalten Sie die Original-Bytes bei.

Das Entfernen von Worktrees ist eine separate, geschützte Aktion. Beenden Sie angehängte strukturierte Sitzungen und Terminals vor dem Entfernen, einschließlich inaktiver Sitzungen. Prüfen Sie das gespeicherte Git-Ergebnis und den Wiederherstellungsstatus; das Löschen eines Aufgabendatensatzes ersetzt nicht die sichere Aufbewahrung nicht committeter Arbeit.

Zugehörige Anweisungen: [Typisierter Editor-Vertrag](../../../shared/editor.ts) · [Git-Richtlinien](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> Das vollständige Handbuch ist noch nicht in Ihre Benutzeroberflächensprache übersetzt. Angezeigt wird die englische Referenz.

Connections adds an explicitly selected OpenAI-compatible endpoint. Enter a name, base URL, model and a key if needed. Select Chat Completions for existing integrations or Responses for function rounds, provider tool progress and generated images. Existing connections retain Chat Completions until you change them explicitly. For an existing connection, Set up Responses opens a draft for that same endpoint; review the profile and click Save connection. Choose Codex connector only for a gateway that supports its extension. The saved key is retained when the endpoint is unchanged and the key field stays blank.

HTTPS is required except for loopback HTTP. Use a plain endpoint without credentials, queries or fragments. Redirects are refused. Keys use supported OS encryption and are never returned to the UI. Changing the endpoint requires re-entering or clearing its key. Leaving the key field blank preserves a saved key.

Workspace file tools execute in the backend-resolved local task folder, with relative paths and checks against traversal and links. Every file write needs explicit approval and an unchanged expected revision. Read-only sessions expose only read tools. In Responses, Allow local commands separately enables approved executable/argument calls on macOS and Linux. Command supervision is unavailable on Windows; the adapter does not advertise that tool there. Commands always require owner approval and are not an operating-system sandbox.

The Codex connector profile identifies that gateway’s Responses tool-progress extension. Native provider tools execute on the server, separately from caller tools on your computer. Local read-only permissions do not constrain the server. A connector cannot be selected for a report-only architect that requires all tools disabled: unsupported isolation fails rather than silently allowing native tools. Select an endpoint that can enforce the required policy.

Generated PNG, JPEG and WebP results appear as separate image cards, with Save image, outside collapsed tool output. Images are validated and kept in private application storage; model-supplied URLs and Markdown images are not fetched automatically. Opening saved history, retrying an image read and saving a cached image do not request a new generation. Results are bounded to 32 MiB and 32 million pixels per image, with a 128 MiB private cache. Preserve needed images before manually clearing the private cache if it becomes full. Click a chat image to open the image viewer. Zoom in or out, choose Actual size (100%) or Fit to window, and drag to inspect a detail. Escape or Close image viewer returns to the chat. Viewing and zooming reuse the loaded private image; they do not request a new generation.

Responses conversations retain the acknowledged response identity and exact function call IDs. Interrupted inputs are not automatically resent. An uncertain local edit or command is not rerun after restart; preserve the history and explicitly create a new context after inspection. Changes to a saved transport or endpoint require explicit reconfiguration. Provider status, cancellation and expiry failures are reported without hiding them behind a CLI fallback. The chat header shows the protocol pinned to that run. After saving connection changes, open the chat’s CLI / API selector and click Apply, even if the same connection is already selected. This creates a new run with the saved configuration and retains chat history. Saving a connection alone does not migrate active chats. Older text-only image links remain text; switching protocol does not regenerate or import previous results.

API connections use their configured endpoint and authentication, separately from native CLI subscriptions. Some gateways use subscriptions internally; ZIAForge does not copy native authentication into an API. Models, tool policies, reasoning parameters and billing depend on the endpoint. Discovery alone does not prove inference. Keep keys in Connections, never in task prose or screenshots.

Zugehörige Anweisungen: [API connections](../../API_CONNECTIONS.md).

<a id="settings"></a>

## Einstellungen, Sprachen und sicheres Zurücksetzen

Allgemeine Einstellungen wählen Arbeitsbereich, Oberflächensprache und Standardwerte aus. „Verbindungen“ verwaltet API-Endpunkte. „Voreinstellungen“ und „Prüfteams“ behalten Rollenkonfigurationen bei. „Fernsteuerung“ verwaltet lokale Anmeldedaten, Serverbereich und Eigentümerberechtigungen; „Updates“ verwaltet die Release-Quelle bzw. den Release-Kanal. „Über“ zeigt den exakten laufenden Build.

Die Benutzeroberflächensprache ist unabhängig von der Prompt-Sprache und dem Prüfstatus der Dokumentation. Produktnamen, Befehls-IDs, Dateiendungen, Anbieter-Modell-IDs und vom Benutzer erstellte Namen bleiben Bezeichner. Die Hilfe folgt der ausgewählten Benutzeroberflächensprache, wenn eine aktuelle Übersetzung verfügbar ist; maschinelle Übersetzungen sind gekennzeichnet und Englisch bleibt die kanonische Referenz.

„Speichern“ wendet die angezeigte Konfiguration an. Ein Zurücksetzen der Datenbank oder auf Werkseinstellungen kann Anwendungsmetadaten entfernen; sichern Sie Dateien und ein getestetes Backup, bevor Sie das Zurücksetzen vorsätzlich verwenden. Diese Vorgänge sind Aktionen des lokalen Eigentümers. Verwenden Sie sie nicht als Abkürzung zur Untersuchung eines fehlgeschlagenen Workflows oder eines beschädigten Datensatzes.

Zugehörige Anweisungen: [Lokalisierungsanweisungen](../../LOCALIZATION.md) · [Datenwiederherstellung](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Den Hilfe-Assistenten fragen

Öffnen Sie die Hilfe, wählen Sie eine gespeicherte verbundene Voreinstellung in deren Assistentenbereich und fragen Sie nach ZIAForge. Antworten nutzen die aktuelle kanonische englische Anleitung und Ihre ausgewählte Benutzeroberflächensprache. Schaltflächen für Abschnittsreferenzen öffnen die relevanten Anleitungs-Themen, sodass Sie die Erklärung mit der Referenz vergleichen können.

Dieser Assistent führt eine separate private Konversation mit bis zu 100 gespeicherten Einträgen und 3 MiB. Geben Sie eine Frage mit bis zu 12,000 Zeichen ein; „Senden“ stellt sie, „Stopp“ bricht die aktive Antwort ab, während Ihre Frage verfügbar bleibt, und „Löschen“ entfernt diese Hilfe-Konversation. Ihr ungesendeter Entwurf und die Auswahl der Voreinstellung bleiben beim Schließen oder Wiederöffnen der Hilfe in derselben App-Sitzung erhalten, der Entwurf wird jedoch nicht auf der Festplatte gespeichert. Der Assistent sendet keine Anwendungsbefehle, ändert keinen Workflow und akzeptiert kein Gate. Ratschläge stellen keine Live-Verifizierung einer Aufgabe, eines Kontos oder einer externen Verbindung dar.

Hilfesitzungen für Claude Code und API setzen die unterstützte Richtlinie ohne Tools durch. Native Hilfesitzungen für Codex und Antigravity erfordern die vorhandene native Computerberechtigung des lokalen Eigentümers. Wenn sie deaktiviert ist, erklärt die App die Voraussetzung, anstatt einen anderen Anbieter auszuwählen. Nur der Eigentümer kann sie in den lokalen Steuerungseinstellungen aktivieren; der Assistent kann sie nicht selbst aktivieren.

Codex-Hilfe verwendet eine schreibgeschützte Sandbox und lehnt Werkzeuggenehmigungsanfragen ab. Antigravity verwendet den Plan-Modus und dessen natives Sandbox-Flag. Diese nativen Modi sind keine universelle Garantie für eine Kapselung auf Betriebssystemebene. Der Quell-Anleitungs-Hash identifiziert die für die Antwort verwendete Referenz; eine generierte Erklärung kann dennoch fehlerhaft sein, prüfen Sie daher deren verlinkte Abschnitte, bevor Sie handeln. Ältere Antworten werden gekennzeichnet, wenn sich ihre Quell-Anleitungsversion von der aktuellen Anleitung unterscheidet.

Zugehörige Anweisungen: [Kanonische Anleitung und Übersetzungspflege](../../HELP_MAINTENANCE.md) · [Anwendungsassistent und Berechtigungen](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Assistent und Telegram

Der Assistent verwendet die ausgewählte Voreinstellung und dieselbe Anwendungssteuerung API. Die Berechtigung zum Prüfen des Status und die Berechtigung zum Durchführen von Operationen sind getrennt. Prüfen Sie Befehle und Ergebnisse: Assistentenprosa ist kein Beweis dafür, dass eine Aktion abgeschlossen wurde.

Telegram wird nur durch den lokalen Eigentümer mit einem vorhandenen Bot-Token und einer numerischen Eigentümer-ID aktiviert. Die Steuerung ist für den privaten Chat dieses Eigentümers bestimmt. Ein unkonfigurierter oder inaktiver Bot darf keine Anwendungsnachrichten empfangen.

Fügen Sie kein Bot-Token in normale Chats ein. Das Konfigurieren der Integration beweist nicht die Telegram-Konnektivität und erstellt nicht automatisch einen Bot. Screenshots und Antworten können private Arbeitsbereichsdaten enthalten.

Wählen Sie eine Assistentenvoreinstellung und erteilen Sie die Berechtigung für Anwendungsoperationen getrennt von der Inspektion. Die Assistentenausführung von Codex und Antigravity erfordert die native Berechtigung des Eigentümers; sie werden nicht stillschweigend durch eine werkzeuglose API- oder Claude-Sitzung ersetzt. Screenshots können in der Assistentenkonversation angezeigt werden, aber die aktuelle Modelleingabe beinhaltet keine Bildanalyse. Nehmen Sie nicht an, dass der Assistent ein Bild visuell geprüft hat, nur weil er es angezeigt hat.

Der Assistent kann über getippte Werkzeuge Zusammenfassungen, Aufgaben, Chats, Workflow-Status, Prozesskontexte und Anwendungsfenster einsehen. Er kann zulässige gewöhnliche Einstellungen ändern und autorisierte Anwendungsoperationen starten. Er kann keine nativen Rechte vergeben, gespeicherte Anmeldedaten offenlegen, die Root-Arbeitsbereichsfreigabe aus der Ferne ändern oder ein Forge-Gate genehmigen, bloß weil es bequem ist.

Zugehörige Anweisungen: [Anwendungssteuerungsvertrag](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Bedienen Sie Ihren privaten Telegram-Bot

Erstellen oder beschaffen Sie Ihren eigenen Bot, starten Sie dessen privaten Chat und geben Sie dessen Token sowie Ihre numerische Telegram-Benutzer-ID in den lokalen Steuerungseinstellungen ein. Aktivieren Sie die Integration nur, wenn Sie beabsichtigen, dass die App eine Verbindung herstellt. Die Eigentümer-ID ist eine Benutzerkennung, kein Benutzername oder Bot-ID. Nur Nachrichten von diesem Benutzer in genau diesem privaten Chat werden akzeptiert.

Verwenden Sie /start, /menu oder /status für eine Übersicht über die laufende Version, Projekt-/Aufgabenzahlen und Aufgabenstatus. Schaltflächen öffnen Projekte, Aufgaben, Screenshot, Hilfe und Sprache. Listen zeigen acht Einträge pro Seite mit Zurück-, Aktualisieren-, Start- und Vorherige/Nächste-Navigation. Projektschaltflächen filtern die Aufgabenliste. Eine Aufgabenkarte zeigt ihren gespeicherten Workflow-Fortschritt, Modell/Voreinstellung und ausstehende Fragen, sofern vorhanden.

Öffnen Sie die Chats einer Aufgabe, um eine Vorschau offener/kürzlicher Konversationen und Chats von Workflow-Phasen anzuzeigen. Jede Vorschau zeigt bis zu sechs der neuesten Benutzer-/Assistentennachrichten, sichtbar gekürzt auf jeweils 200 Zeichen. Private Gedankengänge werden nicht angezeigt. Das Lesen des Verlaufs startet keinen Anbieter. Vorschauen sind schreibgeschützt: normaler Text und /ask TEXT richten sich weiterhin an den Anwendungsassistenten, niemals implizit an den Aufgaben-Chat, den Sie gerade ansehen.

„Ausführen / Fortsetzen“ liest den aktuellen Code- oder Work-Workflow erneut ein und startet einen geeigneten gespeicherten Workflow. „Pause“ fordert dessen Anhalten an. Keines von beiden akzeptiert Anforderungen, eine Spezifikation, einen Plan, Prüfergebnisse oder Fragen; eine ausstehende Entscheidung verhindert das Ausführen. Treffen Sie Entscheidungen in der Anwendung oder verwenden Sie einen explizit autorisierten typisierten Befehl mit seinem exakten aktuellen Gate und seiner Revision.

Verwenden Sie Sprache oder /language, um eine der 56 Benutzeroberflächensprachen über ihren nativen Namen auszuwählen. Dies speichert eine Präferenz nur für diesen Bot und Eigentümer. „App-Sprache verwenden“ löscht diese Präferenz. Es ändert weder die Sprache der Anwendung noch die Zugriffsberechtigungen; bestehende Nachrichten werden nicht automatisch erneut gesendet.

Die Navigation aktualisiert normalerweise dieselbe veröffentlichte Menünachricht. Schaltflächen besitzen opake Identitäten, die nach 15 Minuten ablaufen und einmalig verwendet werden können; das Ändern einer Karte macht ihre alten Schaltflächen ungültig. Abgelaufene, verbrauchte, nachrichteninkonsistente und Schaltflächen früherer Prozesse können keine Aktion ausführen. Eine definitiv nicht bearbeitbare Nachricht kann durch eine neue Karte ersetzt werden; bei einem unbekannten Netzwerkfehler wird kein erneuter Versuch als neue Nachricht unternommen.

Bei der Aktivierung verwirft der Poller früheren Rückstand und erfasst die Aktualisierungsannahme vor dem Versand, sodass unterbrochene Befehle beim Neustart nicht automatisch erneut abgespielt werden. Dies verhindert eine Wiederholung; es garantiert keinen Abschluss. Prüfen Sie Status/Kontext, bevor Sie nach einem Fehler bewusst neue Arbeit anweisen. Es gibt keine automatischen Aufgabenstatus-Benachrichtigungen.

Explizite Befehle bleiben verfügbar: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot und /ask TEXT. /new {JSON} erstellt eine Aufgabe über typisiertes createTask; /command {JSON} sendet einen expliziten Katalogbefehl. Lesen Sie den Live-Katalog für Argumentstrukturen. Es gelten dieselben Backend-Autorisierungen und Ordnerfreigaben wie in der Anwendung.

Die App sendet niemals gespeicherte Bot-Token-Werte an den Assistenten. Screenshots, Zusammenfassungen und Konversationstexte können dennoch private Projektinformationen enthalten. Stoppen Sie die Integration lokal, wenn dem Bot oder dem Eigentümerkonto nicht mehr vertraut wird. Tauschen Sie ein kompromittiertes Token beim Bot-Anbieter aus und aktualisieren Sie anschließend dessen lokale verschlüsselte Konfiguration.

Zugehörige Anweisungen: [Privater Bot und Befehle](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Natives Computer-Zugriffsrecht nur für den Eigentümer

Der native Computerzugriff ist anfänglich deaktiviert. Nur der Eigentümer kann ihn unter lokale Einstellungen → Fernsteuerung aktivieren. Der Assistent und HTTP/MCP/Telegram-Befehle können dieses Flag nicht für sich selbst aktivieren. Wenn eine Operation verweigert wird, sollte der Assistent die Einstellung beschreiben und den Eigentümer entscheiden lassen.

Wenn explizit aktiviert, akzeptiert computer.run eine ausführbare Datei, ein Argument-Array und ein optionales absolutes Arbeitsverzeichnis. Es verwendet keine Shell-Interpolation, hat ein Limit von 30 Sekunden und begrenzt die Ausgabe auf 1 MiB. Ein angegebenes fehlendes oder ungültiges Verzeichnis wird abgelehnt; das Weglassen des Arbeitsverzeichnisses verwendet das app-eigene Einstellungsverzeichnis, nicht HOME. Beenden bricht aktive eigene Befehle ab und wartet auf deren Prozessbereinigung.

Der Lese-/Bedienbereich der Anwendung und der native Zugriff sind getrennte Entscheidungen. Ein Worktree schränkt den Dateisystemzugriff eines uneingeschränkten Anbieters nicht ein. Widerrufen Sie den nativen Zugriff nach der Aufgabe, wenn er nicht mehr benötigt wird, und prüfen Sie Befehlsnachweise, anstatt Assistentenprosa als Beweis zu akzeptieren.

Zugehörige Anweisungen: [Steuerungsvertrag nur für Eigentümer](../../../shared/control.ts).

<a id="remote"></a>

## Browser- und Remote-Instanzen

Der lokale Eigentümer aktiviert den Server und wählt dessen Adresse, Port und Bereich: Lesen zur Inspektion oder Bedienen für Aktionen. Die Standardadresse 127.0.0.1 ist nur auf diesem Computer verfügbar. 0.0.0.0 lauscht an Netzwerkschnittstellen; überprüfen Sie den Netzwerkzugriff vor der Aktivierung.

Ein Browser öffnet nach der Token-Anmeldung dieselbe Oberfläche. Fügen Sie keine Tokens in öffentliche Links oder Screenshots ein. HTTP allein verschlüsselt den Datenverkehr nicht; verwenden Sie einen geschützten Kanal über ein nicht vertrauenswürdiges Netzwerk.

Der Eigentümer konfiguriert andere Instanzen über URL und Token. Das Backend leitet Anfragen weiter; dies kopiert deren Projekte nicht auf den lokalen Rechner. Überprüfen Sie die ausgewählte Instanz vor jeder Aktion.

Typisierte Befehle und Ereignisse übertragen die Anwendungssteuerung. Der Lesebereich berechtigt nicht zu Aufgabenmutationen. Die native Computersteuerung ist eine separate Wahl des lokalen Eigentümers und ist anfänglich deaktiviert.

Die App muss für die Steuerung über Browser, Telegram und externe Agenten weiterlaufen. Jede Instanz verfügt über ihr eigenes privates Profil, ihren Aufgabenstatus, ihr Token und ihren Server-Port. Verwenden Sie ein Profil nicht gleichzeitig über unabhängige Instanzen hinweg wieder. Browserereignisse und Befehlsantworten sind auf die ausgewählte Instanz beschränkt; das Umschalten der UI verlagert keine Dateien und kopiert keine nativen Anmeldungen.

Zugehörige Anweisungen: [HTTP- und Instanzsteuerung](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes und andere externe Agenten

Verwenden Sie die authentifizierte Anwendungssteuerungs-API oder die gebündelte MCP-stdio-Brücke. Aktivieren Sie den Server lokal, wählen Sie „Lesen“ oder „Bedienen“ und konfigurieren Sie jeden Client mit der URL und dem Token dieser Instanz. Node.js 22 oder neuer ist erforderlich, um die eigenständige MCP-Brücke auszuführen; die Electron-App installiert Ihren Agent-Client nicht. Der Browser-URL ist kein streambares HTTP-MCP-Endgerät: übergeben Sie ihn als ZIAFORGE_URL an die stdio-Brücke.

Die Brücke stellt ziaforge_status, ziaforge_commands, ziaforge_command und ziaforge_screenshot bereit. Beginnen Sie mit dem Status und dem Live-Befehlskatalog und lesen Sie dann system.context für die ausgewählte Aufgabe. Typisierte Befehle folgen denselben Revisions-, Gate-, Aufgabenordner- und Bereinigungsprüfungen wie die lokale UI.

Der Live-Befehlskatalog enthält documentation.guide, die kanonische englische Hilfe, mit ihrem Quellpfad und sourceSha256. Der interne Anwendungsarchitekt erhält dieselbe Referenz über seine Werkzeuge. Dies vermittelt Agenten den gesamten Produktkontext, ohne sich auf ältere Notizen zu verlassen; Dokumentation gewährt niemals Zugriff und ersetzt keine aktuelle menschliche Entscheidung.

Agenten sollten Anforderungen, technische Entscheidungen und Planung ausgehend von einer kurzen menschlichen Idee diskutieren. Sie müssen explizite menschliche Gates, ausgewählte Modelle, manuelle/Auto-Richtlinien und erforderliche Überprüfungen beibehalten. Sie dürfen keine Genehmigung erfinden, unsichere Befehle unter einer neuen ID wiederholen oder Git-Änderungen ohne die Absicht des Eigentümers veröffentlichen.

Konfigurieren Sie mehrere benannte MCP-Server für mehrere Installationen. Der Instanzwechsel ist eine Routing-Entscheidung, keine Synchronisierung. Konfigurationsbeispiele für OpenClaw und Hermes finden sich in AGENT_CONTROL.md; client-spezifische Einrichtung und Kompatibilität müssen für die installierte Client-Version geprüft werden.

Der äußere requestId-Cache dedupliziert nur eine begrenzte Menge von Anfragen während der Laufzeit der App. Dauerhafte Operationen nutzen eigene Identitäten: createRequestId für Aufgabenerstellung, commandId für Workflow-Entscheidungen, clientMessageId für Nachrichten und operationId für Git-Mutationen. Behalten Sie die ursprüngliche Identität und Nutzlast nach einer unbekannten Bestätigung bei; lesen Sie den gespeicherten Status, bevor Sie vorsätzlich neue Arbeit anweisen.

Zugehörige Anweisungen: [MCP-Client-Anweisungen](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## Lokale CLI- und Automatisierungsgrenzen

Der ziaf-Dispatcher steuert dieselbe laufende App und denselben gespeicherten Workflow. Verwenden Sie aus dem Quellcode npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID oder npm run ziaf -- pause --task TASK_ID. Eine erfolgreiche Start-Bestätigung bedeutet nicht, dass die Aufgabe abgeschlossen ist.

--until-success aktiviert bewusst Auto für den gespeicherten Workflow, aber Fragen, Überprüfungen, Abnahmegates, Limits und Prüfpunkte gelten weiterhin. Strg+C beendet den beobachtenden Dispatcher; es stoppt den Anwendungs-Workflow nicht implizit. Siehe CLI.md für Exit-Codes, lokale Endpunkte und Profilbehandlung.

Die Automatisierungsoberfläche speichert derzeit Anzeigedefinitionen und lokale Ausführungszähler. Sie ist kein zertifizierter wiederkehrender Scheduler und beweist nicht, dass ein Modellzug im Hintergrund ausgeführt wurde. Verwenden Sie für die tatsächliche Ausführung die Steuerelemente des gespeicherten Workflows, ziaf oder die authentifizierte API und überprüfen Sie deren Nachweise. Verwechseln Sie das Demonstrationspanel nicht mit einer unbeaufsichtigten Ablaufsteuerung.

Zugehörige Anweisungen: [Dispatcher-Befehle](../../CLI.md).

<a id="updates"></a>

## Version und Updates

„Über“ zeigt die genaue laufende Version. Öffentliche Updates erfordern ein vertrauenswürdiges GitHub-Release-Repository und einen Stable- oder Preview-Kanal. Prüfung, Download und Installation haben separate Status; ein Fehler bedeutet nicht, dass ein Update installiert wurde.

Die automatische Installation gilt für signierte macOS-Releases. Unsignierte Entwicklungs-Builds werden über diesen Mechanismus nicht automatisch installiert. Beenden Sie für einen manuellen Austausch die aktuelle App vollständig und verwenden Sie ein verifiziertes Artefakt.

Die automatische Überprüfung läuft sofort bei Aktivierung und danach alle sechs Stunden.

„Stable“ schließt Preview-Releases aus; „Preview“ lässt auch Entwicklungs-Releases zu. Eine erfolgreiche Prüfung stellt lediglich die verfügbaren Release-Metadaten fest. Download und Installation erfordern das Plattform-Paket und den konfigurierten Release-Feed. Die Bereitstellung von Linux DEB ist ein separater Installationspfad; nehmen Sie nicht an, dass ein DEB automatisch durch den macOS-Aktualisierungsmechanismus aktualisiert wird.

Zugehörige Anweisungen: [Release-Bereitschaft](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Neustart und Wiederherstellung

Verwenden Sie unter macOS Beenden / ⌘Q für ein vollständiges Herunterfahren. Das Schließen des Fensters kann die App weiterlaufen lassen. Beenden Sie die alte Version vollständig, bevor Sie die Anwendung ersetzen.

Wählen Sie nach dem Start dieselbe Aufgabe aus. Verlauf und Entwürfe kehren zurück. Fortsetzen stellt einen nativen/lokalen Kontext wieder her, sendet jedoch keinen Entwurf, hebt das Anhalten der Warteschlange nicht auf und autorisiert nicht das Wiederholen einer unbekannten Operation.

Wenn die Wiederherstellung erscheint, bearbeiten Sie JSON nicht von Hand. Prüfen Sie den betroffenen Dokumenttyp, bewahren Sie die Originaldateien auf und wählen Sie ein validiertes Backup aus. Das Wiederherstellen einer älteren Warteschlange markiert deren Elemente als unsicher.

Wenn die Zustellung unbekannt ist, benötigt ein verwalteter Workflow möglicherweise die explizite Berechtigung für einen neuen Kontext. Frühere Arbeiten und fehlgeschlagene Versuche bleiben erhalten; eine sichtbare Verweigerung ist sicherer als ein vorgetäuschter Erfolg.

Sichern Sie die Aufgabendateien und das App-Profil bei geschlossenen App-Instanzen. Ein kopierter Ordner ist keine getestete Wiederherstellung. Wenn die Wiederherstellung Sie auffordert, ein validiertes Backup auszuwählen, behalten Sie auch die exakten beschädigten Dateien. Das Wiederherstellen eines älteren Workflows oder einer Warteschlange autorisiert nicht das erneute Abspielen unsicherer Inferenz- oder Git-Operationen.

Zugehörige Anweisungen: [Wiederherstellungsvertrag](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Fehlerbehebung

CLI nicht gefunden: Überprüfen Sie Installation und Version in einem gewöhnlichen Terminal und starten Sie dann ZIAForge neu. Das Vorhandensein einer ausführbaren Datei bedeutet nicht, dass Sie angemeldet sind. Verwenden Sie den anbietereigenen Anmeldemechanismus.

Modell nicht verfügbar oder Autorisierung fehlgeschlagen: Aktualisieren Sie die Erkennung, wählen Sie ein verfügbares ID und überprüfen Sie Ihr Konto und Ihre Limits. Wiederholen Sie eine unsichere Anfrage nicht, bevor Sie deren Verlauf geprüft haben.

Workflow gestoppt: Öffnen Sie die aktuelle Phase, die Frage, den Überprüfungsnachweis oder CLI-Protokolle. Beheben Sie die spezifische Ursache: eine unbeantwortete Frage, ein Befehl, Ordnerberechtigungen oder ein Versuchslimit. Fortsetzen kann eine fehlgeschlagene Prüfung nicht in einen Erfolg verwandeln.

Ordner fehlt oder wurde ersetzt: Stellen Sie den Zugriff auf den ursprünglichen Ordner wieder her oder erstellen Sie eine neue Aufgabe. Die App darf nicht von HOME aus fortfahren. Wenn Sie ein anderes Arbeitsverzeichnis beobachten, stoppen Sie den Zug und sichern Sie die Diagnosedaten.

Fügen Sie einem Bericht die Version aus „Über“, Route, CLI/Modell, erwartetes und tatsächliches Verhalten, einen Screenshot und einen sicheren Protokollauszug bei. Entfernen Sie Geheimnisse, persönliche Inhalte und Pfade, die nicht veröffentlicht werden dürfen.

Remote-Seite nicht verfügbar: Überprüfen Sie, ob der Eigentümer den Server aktiviert hat, prüfen Sie die Überwachungsadresse und den Port und authentifizieren Sie sich dann mit dem korrekten Instanz-Token. Ein 401 zeigt eine Authentifizierung an; eine verweigerte Mutation kann auf den Lesebereich oder eine Eigentümer-Steuerung zurückzuführen sein. Das Ändern des Tokens schließt bestehende Browser-Clients. Legen Sie den separaten DevTools-Inspektionsport nicht als Remote-Anwendungssteuerung offen.

Speichern im Editor verweigert: Behalten Sie den Entwurf, überprüfen Sie die aktuelle Datei auf der Festplatte und lösen Sie den Konflikt durch externe Änderungen. Umgehen Sie den Abgleich nicht durch das Umschreiben von Anwendungsmetadaten. Wenn das vollständige Laden großer Dateien nicht verfügbar ist, verwenden Sie die unterstützte Fensterbearbeitung/-suche oder einen externen Editor.

Telegram nicht verfügbar: Bestätigen Sie das Bot-Token, den numerischen Eigentümer, den privaten Chat und den Status lokal. Ein konkurrierender Webhook oder Poller kann das Polling blockieren; ZIAForge löscht nicht automatisch einen Webhook oder übernimmt einen anderen Poller. Befehle, die an einer unbekannten Grenze abgelehnt oder unterbrochen wurden, werden nicht automatisch wiederholt.

Zugehörige Anweisungen: [Testen und Diagnose](../../TESTING.md).

<a id="diagnostics"></a>

## Probleme melden und Nachweise prüfen

Erfassen Sie den exakten laufenden Build aus „Über“, OS/Architektur, Aufgabenmodus, ausgewählten Anbieter/Modell und die Schritte zur Reproduktion des Problems. Beschreiben Sie das erwartete und das beobachtete Ergebnis. Fügen Sie einen sicheren Screenshot und den relevanten einbehaltenen Befehl oder Prüfnachweis bei, anstatt eines vollständigen privaten Profils.

CLI-Protokolle, Ereignisjournale, Modelltranskripte, Browser-Traces und Screenshots können Quellcode, persönliche Pfade oder Tokens offenlegen. Prüfen und bereinigen Sie diese vor dem Teilen. Ein Best-Effort-Protokollbereiniger bescheinigt nicht, dass ein Screenshot oder Archiv veröffentlichungsreif ist.

Für Mitwirkende liest qa:doctor die Umgebungs-/Build-Identität; qa:inspect öffnet ein isoliertes Profil mit Anbieter-Stubs. Ein Fixture belegt den getesteten Anwendungspfad, ohne ein Modell zu kontaktieren. Live-Inferenz, Telegram-Konnektivität, nativer Linux-Desktop, Signierung und Prüfungen paketierter Artefakte sind separate Nachweise. Siehe TESTING.md für reproduzierbare Befehle und Bereinigung.

Zugehörige Anweisungen: [Beweisbefehle](../../TESTING.md).

<a id="privacy"></a>

## Lokale Daten und Grenzen

Projekte, Verlauf, Pläne, Dokumente und Diagnosedaten können privaten Text enthalten. Veröffentlichen Sie keine Profile, Rohaufnahmen, Schlüssel oder vollständigen Protokolle mit Quellcode.

Unter Linux erfordert das Speichern von API, Steuerung, Telegram und Instanz-Anmeldedaten einen entsperrten GNOME Secret Service oder KWallet; ohne einen unterstützten Schlüsselspeicher verweigert ZIAForge das Speichern dieser Geheimnisse, anstatt den basic_text-Fallback von Electron zu verwenden.

Lokale Speicherung bedeutet nicht, dass Anfragen auf Ihrem Computer verbleiben: das ausgewählte CLI/API sendet sie an seinen Anbieter. Ein Arbeitsordner und Prozessüberwachung stellen keine OS-Isolation dar. Prüfen Sie ausgewählte Berechtigungen.

Unterscheiden Sie Nachweistypen: Fixtures testen die Anwendung ohne Modell; natives Live erprobt ein echtes CLI/Konto; paketierte Prüfungen zertifizieren ein spezifisches Artefakt. Das Bestehen eines Tests garantiert nicht das Bestehen der anderen.

Anwendungsbereich, ein Worktree und ein schreibgeschützter Prompt unterscheiden sich von einer Durchsetzung auf Betriebssystemebene. Antigravity-Reviewer-/Helfer-Richtlinien erkennen Änderungen in erfassten Arbeitsbereichsnachweisen, anstatt einen schreibgeschützten Dateisystemzugriff zu erzwingen. Die native Computersteuerung führt eigentümerautorisierte Programme außerhalb der normalen App-Werkzeuggrenze aus; schalten Sie sie aus, wenn sie nicht mehr benötigt wird.

Zugehörige Anweisungen: [Herkunft und Veröffentlichung](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Dieses Open-Source-Projekt verstehen und ändern

Lesen Sie zuerst AGENTS.md und CONTRIBUTING.md, dann PROJECT_MAP.md für die aktuellen Quellcode-Grenzen. Die implementierten typisierten Verträge und aktuellen Workflow-/Anbieterdokumente bestimmen das Verhalten. CONCEPT.md und die Terminal-orientierten Teile von ARCHITECTURE.md bewahren historische Absichten und dürfen nicht mit aktuellen Release-Aussagen verwechselt werden.

Die englische Hilfequelle ist docs/help/en.json. Bearbeiten Sie das generierte USER_GUIDE.md oder website/guide.html nicht manuell. Ändern Sie den kanonischen Abschnitt, aktualisieren Sie den betroffenen Vertrag und führen Sie node scripts/help/generate.cjs aus. Die In-App-Hilfe liest dieselbe Quelle. Überprüfen Sie Ergänzungen anhand der tatsächlichen Implementierung, einschließlich Limits, Berechtigungen und nicht unterstützter Pfade.

Jedes der 56 Benutzeroberflächen-Gebietsschemata verfügt über einen separaten Hilfestatus in docs/help/locales.json. Fehlende oder unvollständige Hilfe greift auf Englisch zurück. Vollständige maschinenübersetzte Texte werden gekennzeichnet und an den englischen Quell-Hash gebunden, ohne Anspruch auf menschliche Prüfung. Eine von Menschen geprüfte Übersetzung erfasst zusätzlich ihren Prüfer. Jede Übersetzung muss Abschnitts-IDs, Aktionen, Datei-/Befehlsbezeichner und technische Grenzen beibehalten, die korrekte Richtung verwenden und aktualisiert werden, wenn sich ihre englische Quelle ändert.

Führen Sie vor der Auslieferung node scripts/help/generate.cjs --check aus, um veraltete generierte Ausgaben, ungültige Locale-Gerüste oder fehlerhafte lokale Vertragslinks zu erkennen. UI-Übersetzungsprüfungen und Prüfungen des Anwendungsverhaltens bleiben getrennt. HELP_MAINTENANCE.md enthält das Update-Verfahren für Mitwirkende und AI; die Dokumentation darf keinen bestandenen Test behaupten, der nicht ausgeführt wurde.

Zugehörige Anweisungen: [Aktuelle Projektübersicht](../../PROJECT_MAP.md) · [Dokumentationspflege](../../HELP_MAINTENANCE.md) · [Anweisungen für Mitwirkende](../../../CONTRIBUTING.md) · [Agentenanweisungen](../../../AGENTS.md).
