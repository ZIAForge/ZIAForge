<!-- Generated from docs/help/en.json; source SHA-256 21ff51922a44917fe69ca7698f61410dd7cf54ee890976bb869b64401f5b59b8. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: pl; served locale: pl; status: machine-translated. -->
# Podręcznik użytkownika ZIAForge

Od intencji do zweryfikowanego wyniku. Praktyczny przewodnik po trybach Code, Work oraz sterowaniu aplikacją.

Wersja angielska jest kanoniczna. Pomoc przetłumaczona maszynowo jest oznaczona oddzielnie od tłumaczeń zweryfikowanych przez człowieka. Automatyczne testy nie poświadczają poprawności w języku naturalnym.

> Ten przewodnik został przetłumaczony maszynowo z bieżącego źródła angielskiego. Weryfikacja przez człowieka jest mile widziana.

## Sekcje podręcznika

- [Pierwsze kroki](#start)
- [Zainstaluj odpowiedni pakiet na komputer stacjonarny](#install-platforms)
- [Code: pięć ścieżek](#code)
- [Dyskusja Forge](#forge)
- [Dokumenty i decyzje](#decisions)
- [Wykonanie i recenzja](#execution)
- [Równoległe zespoły recenzenckie i architekt raportu](#review-teams)
- [Specjalizacje agentów i zasady promptów](#specializations)
- [Work: od pytania do dokumentu](#work)
- [Szablony, modele i dostęp](#models)
- [Czaty, Zatrzymaj i kolejka](#chat)
- [Pliki, Git i ukończenie](#files)
- [API connections](#api)
- [Ustawienia, języki i bezpieczny reset](#settings)
- [Zapytaj asystenta Pomocy](#help-assistant)
- [Asystent i Telegram](#assistant-control)
- [Obsługa prywatnego bota Telegram](#telegram)
- [Uprawnienie natywne komputera zastrzeżone dla właściciela](#native-permissions)
- [Przeglądarka i instancje zdalne](#remote)
- [OpenClaw, Hermes i inne zewnętrzne agenty](#external-agents)
- [Lokalne CLI i ograniczenia automatyzacji](#local-cli)
- [Wersja i aktualizacje](#updates)
- [Ponowne uruchamianie i odzyskiwanie danych](#restart)
- [Rozwiązywanie problemów](#troubleshooting)
- [Zgłaszanie problemów i analiza danych diagnostycznych](#diagnostics)
- [Dane lokalne i granice ochrony](#privacy)
- [Zrozumienie i modyfikowanie projektu open source](#project-contributors)

<a id="start"></a>

## Pierwsze kroki

ZIAForge utrzymuje dyskusję, planowanie, wykonanie i weryfikację w jednym zadaniu. Wybierz Code dla projektu Git lub Work dla dokumentów, badań i innych rezultatów w zwykłym folderze.

Rozpocznij od małego zadania w osobnym projekcie. Jeśli wybierzesz natywne CLI, najpierw zainstaluj je i zaloguj się na własne konto w terminalu. Alternatywnie skonfiguruj połączenie API. Subskrypcja CLI oraz płatne API to odrębne metody połączenia; ZIAForge nie loguje użytkownika ani nie przenosi środków między nimi.

1. Otwórz Ustawienia i sprawdź folder przestrzeni roboczej oraz język. O programie wyświetla dokładną tożsamość uruchomionej kompilacji.
2. W przypadku trybu Code dodaj repozytorium Git na pasku bocznym. W przypadku trybu Work wybierz osobny folder podczas tworzenia zadania.
3. Zapisz szablon zawierający CLI, model, nakład rozumowania i poziom dostępu. Możesz także wybrać opcję Własne bezpośrednio, bez zapisanego szablonu.
4. Utwórz zadanie, wybierz jego ścieżkę, role oraz ręczne lub automatyczne przechodzenie kroków. Przejrzyj dokonane wybory przed kliknięciem Uruchom.

> Użyj artefaktu i sumy kontrolnej dostarczonych przez opiekuna projektu. Wersja zapoznawcza może być niepodpisana lub nie mieć opublikowanego kanału aktualizacji. Wsparcie dla platform stacjonarnych i natywnych dostawców musi być zweryfikowane dla dokładnego systemu OS, architektury i artefaktu; samo wsparcie w kodzie źródłowym nie stanowi certyfikacji wydania.

Powiązane instrukcje: [Przegląd projektu](../../../README.md) · [Zgodność dostawców](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Zainstaluj odpowiedni pakiet na komputer stacjonarny

Wybierz pakiet dla swojego systemu operacyjnego i architektury CPU: x64 lub arm64. Potok kompilacji może generować formaty macOS DMG/ZIP, Windows instalator NSIS/ZIP oraz Linux DEB/RPM/AppImage/tar.gz/ZIP. Wygenerowany plik lub kompilacja skrośna nie stanowi dowodu na to, że instalator i natywny interfejs UI zadziałały pomyślnie na Twojej maszynie; sprawdź rejestr weryfikacji danego wydania.

Kompilacje dla macOS korzystające z Electron 44 wymagają systemu macOS 13 lub nowszego. Użyj pakietu arm64 na układach Apple Silicon i pakietu x64 dla procesorów Intel. Przed podmianą całkowicie zamknij starszą aplikację. Pakiety poglądowe mogą być niepodpisane i nienotaryzowane; nie myl artefaktu deweloperskiego z podpisanym publicznym wydaniem.

System Windows wymaga wersji systemu operacyjnego obsługiwanej przez dołączoną wersję Electron oraz dostępności Git w zmiennej PATH. Wybierz pasującą architekturę. Niepodpisana wersja Preview nie posiada certyfikacji Authenticode. Wersja przenośna ZIP musi zachowywać kompletny katalog aplikacji i pliki środowiska uruchomieniowego, a nie tylko sam plik wykonywalny.

System Linux wymaga zgodnego pulpitu graficznego, bibliotek systemowych wymaganych przez Electron oraz Git. W przypadku zaszyfrowanych poświadczeń kontrolnych zapewnij działającą usługę Secret Service, taką jak gnome-libsecret lub KWallet; niezabezpieczony backend basic_text nie jest akceptowany. Testy dymne w trybie headless/kontenerowym nie poświadczają zgodności z każdym środowiskiem graficznym czy dystrybucją.

Zainstaluj pakiet DEB za pomocą apt install ./file.deb lub zainstaluj pakiet RPM przez menedżer pakietów swojej dystrybucji. Pakiet AppImage wymaga uprawnień wykonywania i odpowiedniej obsługi FUSE; alternatywą jest opcja --appimage-extract-and-run tam, gdzie jest obsługiwana. Wypakowuj pakiety tar.gz i ZIP wraz ze wszystkimi ich plikami wykonawczymi. Podczas wymiany pakietu zachowaj rozdzielność danych użytkownika i plików aplikacji.

Aby skompilować ze źródeł, użyj środowiska Node 24, Git oraz npm ci, w tym standardowego instalatora Electron. Przebudowa natywna wymaga narzędzi platformowych: Xcode command-line tools w systemie macOS; MSVC C++, Windows SDK i Python w systemie Windows; kompilatora, make, Python, pkg-config i wymaganych narzędzi pakietowania w systemie Linux. Postępuj zgodnie z PLATFORM_BUILDS.md, aby uzyskać dokładne polecenia i poznać aktualne ograniczenia platform.

Wersje wydań są rezerwowane centralnie, a wyniki kompilacji są niezmienne. Kompilacja weryfikacyjna CI nie jest opublikowanym instalatorem. Archiwa źródłowe zawierają kod źródłowy, plik blokady (lockfile), dokumentację i skrypty; zależności, poświadczenia, profile użytkowników i prywatne badania są wykluczone. Nigdy nie wnioskuj o walidacji dla natywnego ARM lub Windows na podstawie udanej kompilacji x64.

Powiązane instrukcje: [Pakiety platform, wymagania wstępne i ograniczenia weryfikacji](../../PLATFORM_BUILDS.md) · [Tożsamość kompilacji i kontrole wydań](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: pięć ścieżek

Tryb Auto ocenia zakres: proste pytanie może zakończyć się odpowiedzią, podczas gdy większe zadanie wymaga przygotowania. Napraw błąd bada przyczynę i przygotowuje poprawkę. Najpierw specyfikacja rozpoczyna od rozwiązania technicznego; Najpierw wymagania zaczyna od wymagań i kryteriów akceptacji.

Tryb wielomodelowy wykorzystuje osobne konteksty do analizy, projektowania, implementacji i weryfikacji. Nazwa ścieżki nie wymaga różnych dostawców: każda rola korzysta z wybranego szablonu lub konfiguracji Własne.

Struktura Worktree izoluje zmiany Git danego zadania. Gałąź działa w wybranym folderze roboczym. Przed rozpoczęciem sprawdź projekt, gałąź i model; opis zadania nie jest dodatkowo wysyłany do zwykłego czatu.

W przypadku pomysłu z nierozstrzygniętymi wyborami produktowymi lub technicznymi użyj opcji Najpierw wymagania i zbuduj fundament w dyskusji. Tryb Auto klasyfikuje żądanie; nie jest to polecenie natychmiastowego wdrażania każdej krótkiej frazy. Zapisz wersję roboczą zachowuje żądanie bez kontaktowania się z modelem; Uruchom zapisuje i uruchamia zarządzany przepływ jednorazowo. Od jednej do czterech kopii zadania ma niezależne identyfikatory utworzenia i ustawienia ról.

Powiązane instrukcje: [Kontrakt przepływu pracy Code](../../WORKFLOWS.md) · [Profile monitów Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Dyskusja Forge

Uruchom otwiera centralną dyskusję. Odpowiadaj naturalnie, zadawaj pytania wzajemne, dodawaj ograniczenia i omawiaj wybory techniczne. Rozmowa i pytania pozostają powiązane z zadaniem.

Wysłanie tekstu nie oznacza zaakceptowania dokumentu ani autoryzacji nowego planu implementacji. Wyjaśnienie w trakcie wykonywania najpierw wstrzymuje zarządzaną turę i ponownie analizuje objęty nim zakres. Odpowiedź na pytanie w ramach już zaakceptowanego kroku pozwala kontynuować ten krok.

Aby celowo powrócić do fundamentów, wybierz Wymagania, Specyfikacja lub Planowanie. Nowa wersja wymaga ponownej akceptacji zależnych decyzji. Ukończone kroki i ich dowody pozostają; zastąpione, niedokończone fazy pozostają w historii.

Sesje faz zarządzanych różnią się od swobodnego czatu. Używaj dyskusji Forge zamiast wysyłać ręczne monity bezpośrednio do sesji należącej do przepływu pracy.

Powiązane instrukcje: [Kontrakt dyskusji Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Dokumenty i decyzje

Otwórz dokument, sprawdź jego wersję i w razie potrzeby wprowadź zmiany. Przesłanie zmian poprzez dyskusję tworzy nową wersję; raporty i zweryfikowane wyniki nie są modyfikowane wstecznie.

Przed zaakceptowaniem proponowanego planu zmodyfikuj kolejność, instrukcje, kryteria akceptacji i polecenia weryfikacyjne. Autoryzuj konkretne polecenia, które rozumiesz: są one uruchamiane w folderze zadania. Tryb wielomodelowy proponuje jeden krok implementacji całego zadania ze szczegółami w swoich dokumentach i instrukcjach.

Zatwierdź to oddzielna, świadoma decyzja. Tryb Auto nie pomija pytań ani akceptacji wymagań, specyfikacji i planów. Zmodyfikowany zewnętrznie dokument nie może ponownie wykorzystać starego zatwierdzenia.

Pliki przygotowawcze pojawiają się jako artefakty. Ich wersja, faza tworząca i skrót wiążą je z wynikiem. Dokumenty Code są przechowywane poza drzewem roboczym (worktree) i nie trafiają automatycznie do commita.

Przed zaakceptowaniem sprawdź zarówno dokument, jak i wyświetloną decyzję. Akceptacja wiąże bieżący identyfikator bramki ID, wersję planu i zachowane skróty dokumentów. Poproś o zmiany, gdy zakres lub dowody są niepoprawne. Jeśli decyzja stała się nieaktualna, przeładuj zapisany stan przed dokonaniem nowego wyboru; zmieniony plik nie może zostać zaakceptowany w ramach wcześniejszej wersji.

Powiązane instrukcje: [Bramki przepływu pracy i wersje dokumentów](../../WORKFLOWS.md).

<a id="execution"></a>

## Wykonanie i recenzja

Sekcja Do zrobienia pokazuje rzeczywiste kroki, bieżącą próbę, weryfikację oraz wyniki recenzji. Stwierdzenie „gotowe” przez agenta nie kończy kroku: wymagane w planie dowody muszą istnieć.

Tryb ręczny wstrzymuje działanie między kwalifikującymi się krokami. Auto przechodzi przez zweryfikowane kroki i zezwala na ograniczoną liczbę ponownych prób. Zatrzymaj po zawsze tworzy punkt kontrolny. Wstrzymaj zatrzymuje aktywną pracę przepływu pracy; zamknięcie panelu jej nie zatrzymuje.

Niezależny recenzent korzysta z osobnego kontekstu z plikami i wynikami weryfikacji. Każde wymagane ustalenie blokujące musi zostać rozwiązane; wielu recenzentów nie może przegłosować błędu blokującego.

W trybie wielomodelowym poprawianie ustaleń wymaga jawnej decyzji. Poprawka nie uruchamia po cichu kolejnej recenzji: Sprawdź ponownie rozpoczyna nowy cykl. Uwagi z recenzji mogą zawierać prośbę o ponowne rozpatrzenie sprawy przez koordynatora bez powtarzania implementacji.

Ukończone kroki nie mogą być po cichu edytowane. W podejściu TDD faza Czerwona musi rzeczywiście zakończyć się niepowodzeniem z oczekiwanego powodu, a następnie faza Zielona musi zakończyć się sukcesem. Ograniczona liczba prób zapobiega nieskończonym powtórzeniom.

Zapisz niezależnych recenzentów CLI/API w Ustawienia → Zespoły recenzenckie, a następnie wybierz zespół w Code lub Work. Recenzenci działają równolegle, a po nich uruchamia się architekt raportu zespołu. Możesz także skonfigurować niezależnych recenzentów bez zapisanego zespołu. Architekt raportu otrzymuje wyłącznie anonimowe, ustrukturyzowane raporty, bez plików projektu ani narzędzi; ta izolacja wymaga obecnie Claude Code lub API.

Każdy krok implementacji wymaga wykonalnego sprawdzenia, wymaganej niezależnej recenzji lub obu tych elementów. Fazy przygotowawcze zachowują natomiast zwalidowane wyniki i potwierdzenia artefaktów; nie udają one, że wykonano testy implementacyjne. Polecenie kończy się sukcesem tylko wtedy, gdy potwierdzony zostanie jego rzeczywisty kod wyjścia i wyczyszczenie procesów potomnych. Sprawdzenie Czerwone w TDD musi zakończyć się niepowodzeniem w standardowy sposób przed implementacją i weryfikacją Zieloną; brak pliku wykonywalnego lub przekroczenie limitu czasu nie stanowi prawidłowego wyniku fazy Czerwonej.

Domyślne bezpieczniki zatrzymują działanie po trzech nieudanych próbach w jednym kroku lub łącznie po pięćdziesięciu próbach. Przerwanie zużywa próbę, ale samo w sobie nie liczy się jako nieudana próba. Limity i zgromadzone dowody są zachowywane po ponownym uruchomieniu; Ponów próbę ich nie resetuje. Zapoznaj się z zachowanym błędem przed autoryzacją kolejnej próby.

Powiązane instrukcje: [Weryfikacja i recenzja](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Równoległe zespoły recenzenckie i architekt raportu

Otwórz Ustawienia → Zespoły recenzenckie i zapisz zespół. Dodaj niezależnych recenzentów z ich własnym CLI lub API, modelem, nakładem rozumowania i specjalizacją, a następnie wybierz architekta raportu. Wybierz zespół w konfiguracji recenzji zadania. Szablon wykonawcy może być również użyty przez recenzenta, a opcja Własne pozostaje dostępna; niezależne role nadal zachowują osobne konteksty.

Recenzenci działają równolegle na tych samych dowodach zadania. Każdy wymagany raport, błąd i werdykt jest zachowywany. Architekt otrzymuje anonimowe, ponumerowane raporty bez nazwisk recenzentów, tożsamości modeli ani dostawców, oryginalnej zawartości zadania, dostępu do repozytorium czy narzędzi. Porównuje raporty i zwraca jeden ustrukturyzowany werdykt; nie przeprowadza nowej recenzji kodu źródłowego.

Ustalenie blokujące lub odrzucenie przez wymaganego recenzenta nie może zostać uchylone większością głosów ani preferencją architekta. Brakujące lub zniekształcone raporty uniemożliwiają zatwierdzenie. Sprawdź poszczególne ustalenia i zagregowaną decyzję przed zaakceptowaniem lub autoryzacją poprawek. Zapisany zespół jest ustalany i zamrażany na czas uruchomienia; edycja jego szablonu nie przepisuje ukończonych dowodów.

Architekt obsługujący wyłącznie raporty korzysta obecnie z obsługiwanych konfiguracji Claude lub API bez użycia narzędzi. Narzędzia Codex i Antigravity pozostają dostępne jako recenzenci, ale ich użycie jest odrzucane w tej izolowanej roli architekta do czasu utworzenia zweryfikowanego kontraktu bez użycia narzędzi. Sam monit z tekstem „bez narzędzi” nie jest wystarczający.

> Potok projektowania/recenzji trybu wielomodelowego w Code oraz zapisany równoległy zespół recenzencki to oddzielne elementy sterujące. Zachowaj wybraną niestandardową politykę recenzji; nie zakładaj, że jedna ścieżka włącza każdą funkcję recenzowania.

Powiązane instrukcje: [Konfiguracja zespołów typowanych](../../../shared/review-team.ts) · [Agregacja recenzji](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Specjalizacje agentów i zasady promptów

Model jest silnikiem wykonawczym; specjalizacja to profil instrukcji. Wybierz Brak, aby nie dodawać specjalizacji, Standardowy dla domyślnego przewodnika, Auto dla odpowiedniego wbudowanego przewodnika lub Ręcznie dla wybranych przewodników i własnych, ograniczonych instrukcji. Szablony mogą zachowywać ten wybór.

Oryginalny katalog obejmuje ogólne programowanie, architekturę, bezpieczeństwo, niezawodność, wydajność, testowanie i użyteczność interfejsu. Tryb Auto korzysta z dostępnego tekstu zadania/kroku do wyboru przewodnika; nie wywołuje potajemnie innego modelu ani nie poświadcza wiedzy eksperckiej. Sugestie planistyczne można przejrzeć i zmienić przed zaakceptowaniem planu implementacji.

Specjalizacje recenzenckie pomagają ukierunkować uwagę, ale nigdy nie zastępują niezależnych dowodów, limitów dostępu ani ustrukturyzowanego werdyktu. Traktuj niestandardowe instrukcje jako część zakresu zadania: nie używaj ich do omijania akceptacji dokumentów, zasad dotyczących narzędzi, uwierzytelniania ani niepowodzeń recenzentów.

Powiązane instrukcje: [Oryginalny katalog promptów](../../../shared/specializations.ts).

<a id="work"></a>

## Work: od pytania do dokumentu

Tryb Work nie wymaga systemu Git. Opcja Domyślne tworzy osobny folder zadania; Własne wybiera istniejący folder za pomocą natywnego okna wyboru. Zapisz wersję roboczą zapisuje ustawienia bez uruchamiania wnioskowania; Uruchom uruchamia pierwszą fazę.

Tryb Auto odpowiada bezpośrednio lub proponuje odpowiedni plan z rzeczywistymi zadaniami w sekcji Do zrobienia. Burza mózgów tworzy plik ideas.md, zanim wybierzesz więcej pomysłów lub ocenę. Badania zachowują plik findings.md, źródła i ograniczenia. Pisanie przechodzi od intencji i w razie potrzeby pliku outline.md do dokumentu opisowego lub pliku draft.md; rewizje zachowują poprzednie wersje.

Wybierz pliki wejściowe za pomocą natywnego selektora i odwołuj się do nich znakiem @. Aplikacja kopiuje je jako niezmienne dane wejściowe zadania i weryfikuje ich tożsamość przed uruchomieniem. Opcja Domyślne tworzy folder zadania należący do aplikacji; dostęp do folderu Własne jest zapisanym uprawnieniem właściciela. Zapisana, nierozpoczęta wersja robocza może zmienić swój folder.

Utwórz od 1 do 4 kopii z niezależnymi ustawieniami wykonawców. Zadania korzystające z nakładających się folderów nie mogą zapisywać danych jednocześnie. Ta koordynacja dotyczy operacji ZIAForge, a nie dowolnych programów zewnętrznych.

Pogłębiona burza mózgów domyślnie korzysta z trzech niezależnych wykonawców i obsługuje do ośmiu. Wybierz ich kolejność oraz konfiguracje, w tym ponowne użycie szablonu w osobnych kontekstach. Pytania wykonawców zachowują swoje pochodzenie; niepoprawnie sformatowane raporty otrzymują jedną próbę naprawy formatu. Częściowe niepowodzenie pozostaje widoczne, zamiast być prezentowane jako jednomyślny sukces.

Tryb Głęboki łączy zachowane raporty wykonawców w plik brainstorm_report.md i zawsze pyta o decyzję użytkownika. Drobne uzupełnienie koryguje raport za pośrednictwem koordynatora; większa zmiana uruchamia kolejną rundę zamrożonych wykonawców. Artefakty zachowują swoje wersje.

Ustalone role zostają zamrożone w momencie utworzenia zadania lub jawnego zapisania wersji roboczej. Po pierwszym wywołaniu można zmieniać jedynie automatyczne/ręczne przechodzenie kroków; aby użyć innych ustawień roli lub modelu, należy utworzyć nowe zadanie. Edycja globalnego szablonu nie wpływa po cichu na późniejsze fazy.

Tryb ręczny wstrzymuje działanie między kwalifikującymi się fazami, w tym przy obszernym konspekcie w trybie Pisanie. Tryb Auto może kontynuować pracę na podstawie tego konspektu. Pytania, proponowane plany wykonawcze, kierunek burzy mózgów i recenzja raportu z trybu Głębokiego pozostają jawnymi decyzjami nawet w trybie Auto. Sam cytat nie dowodzi przeglądania stron, a sam zachowany plik binarny nie dowodzi jego wyrenderowania.

Powiązane instrukcje: [Tryby i decyzje w Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Szablony, modele i dostęp

Szablon zapisuje CLI/API, model, nakład rozumowania i uprawnienia. Stopka czatu zawiera segmenty szablonu, CLI, modelu i opcji. Opcja Własne działa bez szablonu; Utwórz szablon zapisuje bieżący wybór.

Katalog pochodzi z wybranego, zainstalowanego CLI lub API, tam gdzie jest to obsługiwane. Odśwież aktualizuje listę bez zmiany dokonanego wyboru. Jeśli funkcja wykrywania jest niedostępna, wprowadź jawny ID modelu; dostawca nadal musi go obsługiwać. Poziomy rozumowania zależą od modelu i CLI. Wartość Domyślne dla dostawcy różni się od jawnego tokenu brak.

Wprowadzaj zmiany dopiero po potwierdzeniu przez backend. Przełączanie jest ograniczone podczas aktywnej tury lub niepustej kolejki. Wersje robocze i widoczna historia pozostają, lecz zmiana dostawców nie przenosi ich prywatnego stanu wewnętrznego.

W Forge etykieta roli ma znaczenie: faza przygotowawcza może korzystać z osobnego Planisty. Stopka zmienia wyświetlaną rolę; recenzenci i pomocnicy są wybierani w ustawieniach przepływu pracy. Zasady dotyczące już zweryfikowanej implementacji mogą zostać zablokowane.

Uprawnienia różnią się między dostawcami. Opcje Tylko do odczytu i Zapis w przestrzeni roboczej są dostępne tam, gdzie adapter je obsługuje. Antigravity korzysta z natywnych ustawień CLI lub jawnie wybranego pełnego dostępu. Pełny dostęp to nie piaskownica.

Specjalizacja dodaje wskazówki do promptu, a nie kolejny model czy uprawnienie. Szablony i role obsługują opcje Brak, Standardowy, Auto i Ręcznie. Auto wybiera profile na podstawie tekstu kroku bez dodatkowego wywołania modelu; opcja Ręcznie przyjmuje do czterech specjalizacji oraz własne instrukcje. Przypisania zaproponowane przez Planistę można edytować przed zaakceptowaniem planu.

Ręcznie wprowadzony ID modelu lub poziom rozumowania pozostaje Twoim wyborem, lecz dostawca może go odrzucić. Edycja globalnego szablonu nie zmienia wstecznie uruchomionego czatu ani zaakceptowanego planu. Aby celowo zmienić bezczynną konwersację, użyj jej własnych elementów sterujących konfiguracją i poczekaj na potwierdzenie. Wyłączona opcja powinna być interpretowana jako ograniczenie możliwości lub cyklu życia, a nie omijana poprzez edycję zapisanego pliku JSON.

Powiązane instrukcje: [Możliwości dostawców](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Czaty, Zatrzymaj i kolejka

Otwarte karty, sekcja Ostatnie oraz wersje robocze należą do jednego zadania. Zamknięcie karty usuwa ją z Otwartych, ale zachowuje w Ostatnich i nie zatrzymuje procesu dostawcy ani zarządzanego przepływu pracy. Przeszukuj historię, otwieraj czat ponownie lub zamykaj wszystkie dodatkowe karty z poziomu menu historii.

Zatrzymaj przerywa bieżącą turę. Poczekaj na zakończenie zatrzymywania przed kolejnym kliknięciem Wyślij: potwierdzenie przerwania nie oznacza zakończenia procesu. W międzyczasie możesz pisać kolejną wersję roboczą.

W zwykłym czacie opcja W kolejce zapisuje późniejsze żądanie oddzielnie od bieżącej wersji roboczej. Wstrzymaj kolejkę wstrzymuje dalsze dostarczanie. Akcje Zatrzymaj i Zakończ wstrzymują kolejkę. Po ponownym uruchomieniu najpierw wybierz Wznów, a następnie jawnie Kontynuuj kolejkę.

Status Niepewne oznacza, że stan doręczenia jest nieznany. Taki komunikat nie jest automatycznie wysyłany ponownie: przejrzyj historię, skopiuj tekst w razie potrzeby i odrzuć element z kolejki. Wysłanie go ponownie stanowi nowe, świadome żądanie.

Zarządzane czaty fazowe korzystają ze swojego przepływu pracy, a nie ze zwykłej kolejki. Śledź etap pokazuje bieżącą fazę; ręczne wybranie innej karty wyłącza śledzenie. Dzienniki CLI wyświetlają diagnostykę oddzielnie od odpowiedzi.

Odpowiedzi w formacie Markdown renderują nagłówki, listy, tabele, linki i bloki kodu. Karty narzędzi oraz diagnostyka CLI pozostają oddzielone od odpowiedzi. Raportowane przez model myślenie i metryki tokenów pojawiają się tylko wtedy, gdy dostawca faktycznie je udostępnia; nie należy wnioskować o wewnętrznym rozumowaniu ani zużyciu na podstawie animacji.

Po niepewnym wysłaniu lub potwierdzeniu zakolejkowania przejrzyj historię i ponawiaj próbę wyłącznie dla tego samego zachowanego żądania, jeśli jest dostępna taka opcja. Potwierdzenie kolejki oznacza, że magazyn przyjął element, a nie że zakończyło się wnioskowanie. Usuń niepewny zakolejkowany element tylko w ramach jawnego odrzucenia; nie spowoduje to wycofania monitu, który został już doręczony.

Powiązane instrukcje: [Trwała kolejka komunikatów](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Pliki, Git i ukończenie

Karta Pliki pokazuje folder zadania. Porównuj wyniki z wymaganiami, otwieraj dokumenty i przeglądaj zmiany (diff). Zachowanie pliku binarnego nie dowodzi jego poprawnego wyrenderowania w aplikacji docelowej.

System Git dostarcza status, zmiany i operacje z zarejestrowanymi wynikami. Zatwierdzanie (commit), scalanie (merge) i wypychanie (push) są domyślnie ręczne; operacje automatyczne to oddzielne opcje dla w pełni zweryfikowanego planu.

Nie zmieniaj plików roboczych między weryfikacją a publikacją: zatwierdzenie jest powiązane z dokładnymi bajtami. Konflikty, nieudane wypchnięcia i nieznane wyniki operacji blokują postęp do czasu podjęcia jawnej decyzji. Tryb Auto nie autoryzuje po cichu publikowania.

Tryb Work nie tworzy gałęzi Git ani nie przeprowadza finalizacji Git. Zachowaj wymagane dokumenty z wybranego folderu, w tym wersje i źródła.

Edytor plików zapewnia podświetlanie składni według rozszerzenia, wyszukiwanie i zamianę, historię cofania, zawijanie wierszy oraz wersje robocze per karta. Zapisywanie zachowuje obsługiwane kodowanie UTF-8/UTF-16 i odrzuca konflikty modyfikacji zewnętrznych. Inne kodowania i zawartość binarna wymagają edytora zewnętrznego. Niezapisane wersje robocze uniemożliwiają zamknięcie aplikacji (Zakończ), dopóki właściciel ich nie zapisze lub nie odrzuci.

Pełna składnia jest włączona do 8 MiB. Większe pliki tekstowe otwierają się w oknach 256 KiB; zakres 8–64 MiB można jawnie wczytać w całości bez składni. Powyżej 64 MiB stosowane jest edytowanie w oknach i ograniczone wyszukiwanie następnego dopasowania. Jest to ograniczony tryb dużych plików, a nie pełna zgodność z Sublime Text dla dowolnie wielkich dokumentów.

Otwórz folder używa kontekstu bieżącego zadania lub gałęzi/drzewa roboczego, zamiast po cichu otwierać tylko oryginalne repozytorium. Wiersz pliku może ujawnić katalog nadrzędny tego pliku. Ścieżki są weryfikowane przez backend pod kątem zarejestrowanych uprawnień zadania. Pliki binarne nie podlegają edycji jako zwykły tekst; użyj właściwej dla nich przeglądarki i zachowaj oryginalne bajty.

Usunięcie drzewa roboczego (worktree) to oddzielna, chroniona czynność. Przed jego usunięciem zakończ podłączone sesje ustrukturyzowane i terminale, w tym sesje bezczynne. Sprawdź zapisany wynik Git i stan odzyskiwania; usunięcie rekordu zadania nie zastępuje bezpiecznego zachowania niezatwierdzonych prac.

Powiązane instrukcje: [Typowany kontrakt edytora](../../../shared/editor.ts) · [Zasady Git](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> Pełny podręcznik nie został jeszcze przetłumaczony na język Twojego interfejsu. Wyświetlana jest wersja referencyjna w języku angielskim.

Connections adds an explicitly selected OpenAI-compatible endpoint. Enter a name, base URL, model and a key if needed. Select Chat Completions for existing integrations or Responses for function rounds, provider tool progress and generated images. Existing connections retain Chat Completions until you change them explicitly. For an existing connection, Set up Responses opens a draft for that same endpoint; review the profile and click Save connection. Choose Codex connector or Grok Connector v1 only for a gateway that supports that extension. The saved key is retained when the endpoint is unchanged and the key field stays blank.

HTTPS is required except for loopback HTTP. Use a plain endpoint without credentials, queries or fragments. Redirects are refused. Keys use supported OS encryption and are never returned to the UI. Changing the endpoint requires re-entering or clearing its key. Leaving the key field blank preserves a saved key.

Workspace file tools execute in the backend-resolved local task folder, with relative paths and checks against traversal and links. Every file write needs explicit approval and an unchanged expected revision. Read-only sessions expose only read tools. In Responses, Allow local commands separately enables approved executable/argument calls on macOS and Linux. Command supervision is unavailable on Windows; the adapter does not advertise that tool there. Commands always require owner approval and are not an operating-system sandbox.

The Codex connector profile identifies that gateway’s Responses tool-progress extension. Native provider tools execute on the server, separately from caller tools on your computer. Local read-only permissions do not constrain the server. A connector cannot be selected for a report-only architect that requires all tools disabled: unsupported isolation fails rather than silently allowing native tools. Select an endpoint that can enforce the required policy.

Generated PNG, JPEG and WebP results appear as separate image cards, with Save image, outside collapsed tool output. Images are validated and kept in private application storage; model-supplied URLs and Markdown images are not fetched automatically. Opening saved history, retrying an image read and saving a cached image do not request a new generation. Results are bounded to 32 MiB and 32 million pixels per image, with a 128 MiB private cache. Preserve needed images before manually clearing the private cache if it becomes full. Click a chat image to open the image viewer. Zoom in or out, choose Actual size (100%) or Fit to window, and drag to inspect a detail. Escape or Close image viewer returns to the chat. Viewing and zooming reuse the loaded private image; they do not request a new generation.

Responses conversations retain the acknowledged response identity and exact function call IDs. Interrupted inputs are not automatically resent. An uncertain local edit or command is not rerun after restart; preserve the history and explicitly create a new context after inspection. Changes to a saved transport or endpoint require explicit reconfiguration. Provider status, cancellation and expiry failures are reported without hiding them behind a CLI fallback. The chat header shows the protocol pinned to that run. After saving connection changes, open the chat’s CLI / API selector and click Apply, even if the same connection is already selected. This creates a new run with the saved configuration and retains chat history. Saving a connection alone does not migrate active chats. Older text-only image links remain text; switching protocol does not regenerate or import previous results.

API connections use their configured endpoint and authentication, separately from native CLI subscriptions. Some gateways use subscriptions internally; ZIAForge does not copy native authentication into an API. Models, tool policies, reasoning parameters and billing depend on the endpoint. Discovery alone does not prove inference. Keep keys in Connections, never in task prose or screenshots.

For Grok Connector v1, save an explicit Responses connection and use Inspect connector to read its advertised capabilities, models and usage without running inference. Model reasoning levels and context window choices come from the catalog. The optional native turn limit is 1–100. Missing quota percentages remain unknown; the usage period end is not a subscription payment or expiration date. Apply connection changes in each existing chat before they take effect there.

Grok questions appear as cards with the exact native question and option labels. Choose the requested answers or enter a custom response, then send once. Plan interviews can offer discussion or skip actions. Provider permission cards show the exact native choices and require your selection by default. These differ from local file/command approvals. Stop, expiry or restart makes old cards inactive; an uncertain submission is not repeated automatically.

In Connections, a Grok connection can enable Automatically approve one-time provider permissions; it is off by default. This applies to new chats or an existing chat after you explicitly reconfigure it with Apply. Saving the connection alone does not change a running chat. When enabled, ZIAForge automatically submits only one unambiguous, unexpired one-time permission offered by Grok and records that automatic decision before sending it. The card identifies an automatic approval. Questions and local file or command approvals still require your answer. Read-only chats keep manual provider permissions. Persistent permissions are never selected automatically; missing or ambiguous one-time choices remain manual. Old or uncertain submissions are never replayed or retried automatically.

In a Grok chat, the attachment button opens the system picker for PNG, JPEG and WebP. Four images are allowed per message, up to 16 MiB each and 20 MiB combined, with 32 million pixels per image. Private draft copies have a 128 MiB budget and belong to that chat run. They are transmitted only when you send. Failed or uncertain sends retain their draft identities. Image messages cannot use the text-only queue. Remove or explicitly discard a pending image draft before changing or resuming its run; discarding a draft does not undo an already delivered message. Accepted image messages retain private image cards for later inspection, zoom and saving.

Grok provider tools are restricted to supported web retrieval, images and interactive questions. Local project tools still execute on the computer in the backend-selected task folder. Read-only review excludes provider image generation/editing and questions as well as local writes and commands. Tool-free Help and report-only architect sessions cannot use this connector profile. Audio and video generation/playback are not offered; a discovered tool is not evidence of a verified usable result.

Powiązane instrukcje: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## Ustawienia, języki i bezpieczny reset

Ustawienia ogólne pozwalają wybrać przestrzeń roboczą, język interfejsu i wartości domyślne. Połączenia zarządzają punktami końcowymi API. Szablony i Zespoły recenzenckie zachowują konfiguracje ról. Sterowanie zdalne zarządza lokalnymi danymi uwierzytelniającymi, zakresem serwera i uprawnieniami właściciela; Aktualizacje zarządzają źródłem/kanałem wydań. O programie pokazuje dokładną wersję uruchomionej kompilacji.

Język interfejsu jest niezależny od języka promptów oraz statusu weryfikacji dokumentacji. Nazwy produktów, identyfikatory poleceń, rozszerzenia plików, identyfikatory modeli dostawców oraz nazwy utworzone przez użytkownika pozostają identyfikatorami. Pomoc dostosowuje się do wybranego języka interfejsu, gdy dostępne jest aktualne tłumaczenie; tłumaczenia maszynowe są odpowiednio oznaczone, a język angielski pozostaje kanonicznym źródłem referencyjnym.

Przycisk Zapisz stosuje wyświetloną konfigurację. Reset bazy danych lub przywrócenie ustawień fabrycznych może usunąć metadane aplikacji; zachowaj pliki i przetestowaną kopię zapasową przed świadomym użyciem resetowania. Operacje te należą do działań lokalnego właściciela. Nie używaj ich jako drogi na skróty do badania nieudanego przepływu pracy lub uszkodzonego rekordu.

Powiązane instrukcje: [Instrukcje dotyczące lokalizacji](../../LOCALIZATION.md) · [Odzyskiwanie danych](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Zapytaj asystenta Pomocy

Otwórz Pomoc, wybierz zapisany, połączony profil ustawień w panelu asystenta i zadaj pytanie dotyczące ZIAForge. Odpowiedzi opierają się na aktualnym, kanonicznym przewodniku w języku angielskim oraz wybranym języku interfejsu. Przyciski odsyłaczy do sekcji otwierają powiązane tematy przewodnika, co pozwala porównać wyjaśnienie ze źródłem.

Ten asystent prowadzi odrębną, prywatną konwersację obejmującą do 100 zapisanych wpisów i 3 MiB. Wprowadź pytanie o długości do 12,000 znaków; przycisk Wyślij przekazuje je, Zatrzymaj anuluje aktywną odpowiedź, zachowując wpisane pytanie, a Wyczyść usuwa tę konwersację Pomocy. Niewysłany szkic pytania oraz wybór profilu pozostają nienaruszone przy zamykaniu i ponownym otwieraniu Pomocy w tej samej sesji aplikacji, lecz szkic nie jest zapisywany na dysku. Asystent nie wysyła poleceń do aplikacji, nie zmienia przepływu pracy ani nie zatwierdza bramek. Jego porada nie stanowi weryfikacji na żywo zadania, konta ani połączenia zewnętrznego.

Sesje Pomocy Claude Code i API wymuszają obsługiwaną zasadę braku narzędzi. Natywne sesje Pomocy Codex i Antigravity wymagają istniejącego uprawnienia natywnego komputera lokalnego właściciela. Jeśli jest ono wyłączone, aplikacja informuje o wymaganym warunku wstępnym zamiast wybierać innego dostawcę. Włączyć je może wyłącznie właściciel w ustawieniach kontroli lokalnej; asystent nie może włączyć go samodzielnie.

Pomoc Codex działa w piaskownicy w trybie tylko do odczytu i odrzuca żądania zatwierdzenia narzędzi. Antigravity korzysta z trybu planowania i flagi natywnej piaskownicy. Te tryby natywne nie stanowią uniwersalnej gwarancji izolacji na poziomie systemu operacyjnego. Skrót źródłowego przewodnika identyfikuje wersję referencyjną użytą do udzielenia odpowiedzi; wygenerowane wyjaśnienie może zawierać błędy, dlatego przed podjęciem działań sprawdź połączone z nim sekcje. Starsze odpowiedzi są oznaczane, gdy wersja ich przewodnika źródłowego różni się od wersji bieżącej.

Powiązane instrukcje: [Utrzymanie kanonicznego przewodnika i tłumaczeń](../../HELP_MAINTENANCE.md) · [Asystent aplikacji i uprawnienia](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Asystent i Telegram

Asystent korzysta z wybranego profilu ustawień i tego samego API sterowania aplikacją. Uprawnienie do sprawdzania stanu oraz uprawnienie do wykonywania operacji są od siebie niezależne. Sprawdzaj polecenia i wyniki: tekst wygenerowany przez asystenta nie stanowi dowodu ukończenia operacji.

Telegram może zostać włączony wyłącznie przez lokalnego właściciela, przy użyciu istniejącego tokena bota i numerycznego ID właściciela. Sterowanie jest przeznaczone dla prywatnego czatu tego właściciela. Nieskonfigurowany lub nieaktywny bot nie może odbierać komunikatów aplikacji.

Nie wklejaj tokena bota do zwykłego czatu. Skonfigurowanie integracji nie dowodzi łączności z usługą Telegram ani nie tworzy automatycznie bota. Zrzuty ekranu i odpowiedzi mogą zawierać prywatne dane z obszaru roboczego.

Wybierz profil ustawień asystenta i nadaj uprawnienie do wykonywania operacji w aplikacji oddzielnie od uprawnienia do inspekcji. Uruchomienie asystenta Codex i Antigravity wymaga uprawnień natywnych właściciela; nie są one po cichu zastępowane sesją API lub Claude bez narzędzi. Zrzuty ekranu mogą być wyświetlane w konwersacji asystenta, jednak bieżące dane wejściowe modelu nie obejmują analizy obrazu. Nie zakładaj, że asystent dokonał wizualnej analizy obrazu tylko dlatego, że go wyświetlił.

Asystent może sprawdzać podsumowania, zadania, czaty, stan przepływu pracy, kontekst procesu i okna aplikacji za pomocą wprowadzanych narzędzi. Może zmieniać dozwolone ustawienia standardowe i uruchamiać autoryzowane operacje aplikacji. Nie może jednak nadawać uprawnień natywnych, ujawniać zapisanych danych uwierzytelniających, zdalnie zmieniać uprawnień do głównego obszaru roboczego ani zatwierdzać bramki Forge wyłącznie ze względu na wygodę.

Powiązane instrukcje: [Kontrakt sterowania aplikacją](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Obsługa prywatnego bota Telegram

Utwórz lub uzyskaj własnego bota, rozpocznij z nim prywatny czat, a następnie wprowadź jego token oraz swój numeryczny identyfikator użytkownika Telegram ID w lokalnych ustawieniach sterowania. Włącz integrację tylko wtedy, gdy chcesz, aby aplikacja nawiązała połączenie. Wartość ID właściciela jest identyfikatorem użytkownika, a nie nazwą użytkownika ani identyfikatorem bota ID. Akceptowane są wyłącznie wiadomości od tego użytkownika w tym samym prywatnym czacie.

Użyj /start, /menu lub /status, aby uzyskać podgląd uruchomionej wersji, liczby projektów/zadań i stanów zadań. Przyciski otwierają Projekty, Zadania, Zrzut ekranu, Pomoc i Język. Listy prezentują osiem pozycji na stronę, z nawigacją Wstecz, Odśwież, Początek oraz Poprzednia/Następna. Przyciski projektów filtrują listę zadań. Karta zadania pokazuje zapisany postęp przepływu pracy, model/profil oraz oczekujące pytania, jeśli występują.

Otwórz Czaty zadania, aby wyświetlić podgląd otwartych/ostatnich konwersacji oraz czatów faz przepływu pracy. Każdy podgląd wyświetla do sześciu najnowszych wiadomości użytkownika/asystenta, skróconych widocznie do 200 znaków każda. Prywatne rozumowanie nie jest wyświetlane. Odczytanie historii nie uruchamia dostawcy. Podglądy działają w trybie tylko do odczytu: zwykły tekst oraz /ask TEXT nadal kierowane są do asystenta aplikacji, nigdy niejawnie do przeglądanego czatu zadania.

Uruchom / Kontynuuj ponownie odczytuje bieżący przepływ pracy Code lub Work i uruchamia kwalifikujący się zapisany przepływ pracy. Wstrzymaj wysyła żądanie jego wstrzymania. Żadna z tych opcji nie przyjmuje wymagań, specyfikacji, planu, uwag z przeglądu ani pytań; oczekująca decyzja blokuje uruchomienie. Podejmuj decyzje w aplikacji lub użyj jawnie autoryzowanego typowanego polecenia z dokładną bieżącą bramką i wersją.

Użyj opcji Język lub polecenia /language, aby wybrać dowolny z 56 języków interfejsu według jego nazwy rodzimej. Zapisuje to preferencję wyłącznie dla tego bota i właściciela. Opcja Użyj języka aplikacji usuwa tę preferencję. Nie zmienia to języka samej aplikacji ani uprawnień dostępu; istniejące wiadomości nie są automatycznie wysyłane ponownie.

Nawigacja standardowo aktualizuje tę samą opublikowaną wiadomość menu. Przyciski mają nieprzezroczyste identyfikatory, które wygasają po 15 minutach i mogą być użyte jednokrotnie; zmiana karty unieważnia jej stare przyciski. Przyciski wygasłe, zużyte, niedopasowane do wiadomości lub pochodzące z poprzedniego procesu nie mogą wykonać akcji. Zdecydowanie niemodyfikowalna wiadomość może zostać zastąpiona nową kartą; nieznany błąd sieciowy nie jest ponawiany w postaci nowej wiadomości.

Po aktywacji proces odpytujący odrzuca wcześniejsze zaległości i rejestruje zaakceptowanie aktualizacji przed jej przekazaniem, dzięki czemu przerwane polecenia nie są automatycznie odtwarzane po restarcie. Zapobiega to powtórzeniom; nie gwarantuje jednak ukończenia. Sprawdź stan/kontekst przed świadomym zleceniem nowej pracy po wystąpieniu błędu. Aplikacja nie wysyła automatycznych powiadomień o stanie zadań.

Jawne polecenia pozostają dostępne: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot oraz /ask TEXT. /new {JSON} tworzy zadanie za pomocą typowanego createTask; /command {JSON} wysyła jawne polecenie z katalogu. Zapoznaj się z bieżącym katalogiem, aby poznać format argumentów. Obowiązują te same zasady autoryzacji w backendzie i uprawnienia do folderów, co w aplikacji.

Aplikacja nigdy nie przesyła zapisanych wartości tokena bota do asystenta. Zrzuty ekranu, podsumowania i treść rozmowy mogą jednak zawierać prywatne informacje o projekcie. Wyłącz integrację lokalnie, jeśli bot lub konto właściciela przestały być zaufane. W przypadku wycieku tokena zmień go u dostawcy bota, a następnie zaktualizuj lokalną zaszyfrowaną konfigurację.

Powiązane instrukcje: [Prywatny bot i polecenia](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Uprawnienie natywne komputera zastrzeżone dla właściciela

Natywny dostęp do komputera jest początkowo wyłączony. Włączyć go może wyłącznie właściciel w sekcji Ustawienia lokalne → Zdalne sterowanie. Asystent oraz polecenia HTTP/MCP/Telegram nie mogą włączyć tej flagi we własnym imieniu. W przypadku odrzucenia operacji asystent powinien opisać to ustawienie i pozostawić decyzję właścicielowi.

Po jawnym włączeniu polecenie computer.run przyjmuje plik wykonywalny, tablicę argumentów i opcjonalny bezwzględny katalog roboczy. Nie stosuje ono interpolacji powłoki, ma limit czasu wynoszący 30 sekund i ogranicza dane wyjściowe do 1 MiB. Wskazanie brakującego lub nieprawidłowego katalogu powoduje odmowę; pominięcie cwd powoduje użycie katalogu ustawień należącego do aplikacji, a nie katalogu HOME. Zakończenie aplikacji (Quit) anuluje aktywne własne polecenia i czeka na zakończenie procesów.

Zakres odczytu/obsługi aplikacji i dostęp natywny to niezależne decyzje. Drzewo robocze nie ogranicza dostępu do systemu plików dostawcy działającego bez ograniczeń. Po zakończeniu zadania odwołaj dostęp natywny, jeśli nie jest już wymagany, i weryfikuj potwierdzenia wykonania poleceń zamiast polegać na zapewnieniach asystenta.

Powiązane instrukcje: [Kontrakt sterowania zastrzeżony dla właściciela](../../../shared/control.ts).

<a id="remote"></a>

## Przeglądarka i instancje zdalne

Lokalny właściciel włącza serwer i wybiera jego adres, port oraz zakres: odczyt do celów inspekcji lub operacje do wykonywania działań. Domyślny adres 127.0.0.1 jest dostępny wyłącznie na tym komputerze. Adres 0.0.0.0 nasłuchuje na interfejsach sieciowych; przed jego włączeniem przeanalizuj reguły dostępu sieciowego.

Przeglądarka otwiera ten sam interfejs po zalogowaniu tokenem. Nie umieszczaj tokenów w linkach publicznych ani na zrzutach ekranu. Sam protokół HTTP nie szyfruje transmisji; w niezaufanej sieci korzystaj z bezpiecznego kanału.

Właściciel konfiguruje inne instancje przy użyciu adresu URL i tokena. Backend przekazuje żądania przez proxy; nie kopiuje to projektów na maszynę lokalną. Sprawdź wybraną instancję przed każdą akcją.

Polecenia typowane i zdarzenia realizują kontrolę nad aplikacją. Zakres odczytu nie upoważnia do modyfikowania zadań. Natywne sterowanie komputerem jest niezależnym wyborem lokalnego właściciela i jest domyślnie wyłączone.

Aplikacja musi pozostać uruchomiona, aby możliwe było sterowanie przez przeglądarkę, bota Telegram i zewnętrzne agenty. Każda instancja posiada własny profil prywatny, stan zadań, token i port serwera. Nie używaj jednocześnie jednego profilu w niezależnych instancjach. Zdarzenia przeglądarki i odpowiedzi na polecenia są przypisane do wybranej instancji; przełączenie interfejsu UI nie przenosi plików ani nie kopiuje natywnego logowania.

Powiązane instrukcje: [HTTP i sterowanie instancją](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes i inne zewnętrzne agenty

Skorzystaj z uwierzytelnionego API sterowania aplikacją lub dołączonego mostka stdio MCP. Włącz serwer lokalnie, wybierz uprawnienia do odczytu lub wykonywania operacji i skonfiguruj każdego klienta przy użyciu adresu URL oraz tokena tej instancji. Do uruchomienia autonomicznego mostka MCP wymagany jest Node.js w wersji 22 lub nowszej; aplikacja Electron nie instaluje klienta agenta. Adres URL przeglądarki nie jest strumieniowym punktem końcowym HTTP MCP: przekaż go jako ZIAFORGE_URL do mostka stdio.

Mostek udostępnia polecenia ziaforge_status, ziaforge_commands, ziaforge_command i ziaforge_screenshot. Rozpocznij od sprawdzenia stanu i bieżącego katalogu poleceń, a następnie odczytaj system.context dla wybranego zadania. Polecenia typowane podlegają tym samym weryfikacjom wersji, bramek, katalogu zadań i czyszczenia, co lokalny interfejs UI.

Bieżący katalog poleceń zawiera documentation.guide, czyli kanoniczną pomoc w języku angielskim wraz z jej ścieżką źródłową i sumą kontrolną sourceSha256. Wewnętrzny architekt aplikacji otrzymuje te same informacje referencyjne za pośrednictwem swoich narzędzi. Daje to agentom pełny kontekst produktu bez polegania na starszych notatkach; dokumentacja nigdy nie nadaje uprawnień dostępu ani nie zastępuje aktualnej decyzji człowieka.

Agenci powinni omawiać wymagania, decyzje techniczne i planowanie w oparciu o zwięzły pomysł przedstawiony przez człowieka. Muszą respektować jawne bramki decyzyjne człowieka, wybrane modele, zasady trybu ręcznego/Auto oraz wymagane przeglądy. Nie wolno im wymyślać zatwierdzeń, powtarzać niepewnych poleceń pod nowym identyfikatorem ID ani publikować zmian w systemie Git bez intencji właściciela.

Skonfiguruj kilka nazwanych serwerów MCP dla wielu instalacji. Przełączanie instancji jest decyzją o routingu, a nie synchronizacją. Przykłady konfiguracji dla agentów OpenClaw i Hermes znajdują się w pliku AGENT_CONTROL.md; konfigurację specyficzną dla klienta oraz zgodność należy sprawdzić pod kątem zainstalowanej wersji klienta.

Zewnętrzna pamięć podręczna requestId eliminuje duplikaty jedynie w ramach ograniczonego zestawu żądań podczas działania aplikacji. Trwałe operacje używają własnych identyfikatorów: createRequestId do tworzenia zadań, commandId do decyzji dotyczących przepływu pracy, clientMessageId dla wiadomości oraz operationId dla modyfikacji Git. Zachowaj pierwotną tożsamość i ładunek po otrzymaniu nieznanego potwierdzenia; sprawdź zapisany stan przed celowym zleceniem nowej pracy.

Powiązane instrukcje: [Instrukcje dla klienta MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## Lokalne CLI i ograniczenia automatyzacji

Dyspozytor ziaf steruje tą samą uruchomioną aplikacją i zapisanym przepływem pracy. Z poziomu kodu źródłowego użyj npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID lub npm run ziaf -- pause --task TASK_ID. Pomyślne potwierdzenie polecenia Start nie oznacza, że zadanie zostało ukończone.

Flaga --until-success celowo włącza tryb Auto dla zapisanego przepływu pracy, lecz pytania, przeglądy, bramki zatwierdzeń, limity i punkty kontrolne nadal obowiązują. Skrót Ctrl+C powoduje wyjście z monitorującego dyspozytora; nie zatrzymuje on automatycznie przepływu pracy w aplikacji. Zobacz plik CLI.md, aby uzyskać informacje o kodach wyjścia, lokalnych punktach końcowych i obsłudze profili.

Interfejs Automatyzacje przechowuje obecnie definicje wyświetlania i lokalne liczniki uruchomień. Nie jest certyfikowanym harmonogramem zadań cyklicznych i nie stanowi dowodu na wykonanie tury modelu w tle. Do faktycznego wykonania użyj kontrolek zapisanego przepływu pracy, narzędzia ziaf lub uwierzytelnionego API i sprawdź ich potwierdzenia. Nie myl panelu demonstracyjnego z nienadzorowanym harmonogramem zadań.

Powiązane instrukcje: [Polecenia dyspozytora](../../CLI.md).

<a id="updates"></a>

## Wersja i aktualizacje

Okno Informacje pokazuje dokładną wersję uruchomionej aplikacji. Oficjalne aktualizacje wymagają zaufanego repozytorium wydań GitHub oraz kanału stabilnego (stable) lub wersji zapoznawczej (preview). Sprawdzanie, pobieranie i instalacja mają odrębne stany; wystąpienie błędu nie oznacza, że aktualizacja została zainstalowana.

Automatyczna instalacja dotyczy podpisanych wydań dla systemu macOS. Niepodpisane kompilacje deweloperskie nie są instalowane automatycznie za pośrednictwem tego mechanizmu. W celu ręcznej wymiany całkowicie zamknij bieżącą aplikację i użyj zweryfikowanego artefaktu.

Automatyczne sprawdzanie jest uruchamiane natychmiast po włączeniu, a następnie co sześć godzin.

Kanał stabilny wyklucza wydania zapoznawcze; kanał preview dopuszcza również wydania deweloperskie. Pomyślne sprawdzenie potwierdza jedynie dostępność metadanych wydania. Pobranie i instalacja wymagają pakietu dla odpowiedniej platformy i skonfigurowanego kanału wydań. Dystrybucja pakietów DEB dla systemu Linux stanowi odrębną ścieżkę instalatora; nie należy zakładać, że pakiet DEB zostanie automatycznie zaktualizowany przez mechanizm aktualizacji systemu macOS.

Powiązane instrukcje: [Gotowość wydania](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Ponowne uruchamianie i odzyskiwanie danych

W systemie macOS użyj opcji Zakończ / ⌘Q, aby całkowicie zamknąć aplikację. Zamknięcie okna może pozostawić aplikację uruchomioną. Całkowicie zamknij starą wersję przed zastąpieniem aplikacji.

Po uruchomieniu wybierz to samo zadanie. Historia i wersje robocze zostaną przywrócone. Opcja Wznów przywraca kontekst natywny/lokalny, lecz nie wysyła wersji roboczej, nie wznawia kolejki ani nie autoryzuje powtórzenia nieznanej operacji.

Jeśli pojawi się ekran Odzyskiwanie, nie edytuj ręcznie formatu JSON. Sprawdź typ uszkodzonego dokumentu, zachowaj oryginalne pliki i wybierz zweryfikowaną kopię zapasową. Przywrócenie starszej kolejki oznacza jej elementy jako niepewne.

Gdy stan dostarczenia jest nieznany, zarządzany przepływ pracy może wymagać jawnej zgody na utworzenie nowego kontekstu. Wcześniejsze prace i nieudane próby zostają zachowane; widoczna odmowa jest bezpieczniejsza niż sfabrykowany sukces.

Wykonaj kopię zapasową plików zadania i profilu aplikacji przy zamkniętych wszystkich instancjach aplikacji. Skopiowany folder nie jest przetestowanym przywróceniem. Jeśli proces odzyskiwania poprosi o wybranie zweryfikowanej kopii zapasowej, zachowaj także uszkodzone pliki w nienaruszonym stanie. Przywrócenie starszego przepływu pracy lub kolejki nie autoryzuje ponownego wykonania niepewnego wnioskowania ani operacji w systemie Git.

Powiązane instrukcje: [Kontrakt odzyskiwania danych](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

Nie znaleziono CLI: sprawdź instalację i wersję w zwykłym terminalu, a następnie uruchom ponownie ZIAForge. Obecność pliku wykonywalnego nie oznacza, że nastąpiło zalogowanie. Skorzystaj z mechanizmu logowania udostępnionego przez dostawcę.

Model niedostępny lub autoryzacja nie powiodła się: odśwież wykrywanie, wybierz dostępny ID oraz sprawdź stan konta i limity. Nie ponawiaj niepewnego żądania przed sprawdzeniem jego historii.

Przepływ pracy zatrzymany: otwórz bieżącą fazę, pytanie, potwierdzenie weryfikacji lub dzienniki CLI. Usuń konkretną przyczynę: brak odpowiedzi na pytanie, polecenie, uprawnienia do folderu lub limit prób. Opcja Kontynuuj nie zamieni nieudanego sprawdzenia w sukces.

Brak folderu lub folder został zastąpiony: przywróć dostęp do pierwotnego folderu lub utwórz nowe zadanie. Aplikacja nie może kontynuować pracy z poziomu HOME. Jeśli zauważysz inny katalog roboczy cwd, zatrzymaj turę i zachowaj dane diagnostyczne.

Do zgłoszenia dołącz wersję z okna Informacje, trasę, CLI/model, zachowanie oczekiwane i zaobserwowane, zrzut ekranu oraz bezpieczny fragment dziennika. Usuń tajemnice, treści osobiste i ścieżki, które nie mogą zostać opublikowane.

Strona zdalna niedostępna: sprawdź, czy właściciel włączył serwer, zweryfikuj adres nasłuchiwania oraz port, a następnie uwierzytelnij się właściwym tokenem instancji. Kod 401 wskazuje na konieczność uwierzytelnienia; odmowa wykonania modyfikacji może wynikać z zakresu tylko do odczytu lub ograniczeń właściciela. Zmiana tokena powoduje odłączenie istniejących klientów przeglądarki. Nie udostępniaj osobnego portu inspekcji DevTools jako zdalnego sterowania aplikacją.

Odmowa zapisu w edytorze: zachowaj wersję roboczą, sprawdź bieżący plik na dysku i rozwiąż konflikt zmian zewnętrznych. Nie omijaj porównania poprzez nadpisywanie metadanych aplikacji. Jeśli pełne załadowanie dużego pliku nie jest dostępne, skorzystaj z obsługiwanego edytowania/wyszukiwania w oknie lub edytora zewnętrznego.

Telegram niedostępny: sprawdź lokalnie token bota, numeryczny identyfikator właściciela, prywatny czat oraz status. Kolizyjny webhook lub inny proces odpytujący może blokować odbieranie wiadomości; ZIAForge nie usuwa automatycznie webhooka ani nie przejmuje innego procesu odpytującego. Polecenia odrzucone lub przerwane na nieznanej granicy nie są automatycznie wznawiane.

Powiązane instrukcje: [Testowanie i diagnostyka](../../TESTING.md).

<a id="diagnostics"></a>

## Zgłaszanie problemów i analiza danych diagnostycznych

Zanotuj dokładną wersję kompilacji z okna Informacje, system operacyjny/architekturę OS, tryb zadania, wybranego dostawcę/model oraz kroki odtwarzające problem. Opisz oczekiwany oraz zaobserwowany wynik. Dołącz bezpieczny zrzut ekranu oraz odpowiednie zachowane potwierdzenie polecenia lub weryfikacji, zamiast całego prywatnego profilu.

Dzienniki CLI, kroniki zdarzeń, transkrypcje modelu, ślady przeglądarki i zrzuty ekranu mogą ujawnić kod źródłowy, ścieżki prywatne lub tokeny. Sprawdź je i zanonimizuj przed udostępnieniem. Mechanizm redagowania logów działający na zasadzie dokładać wszelkich starań nie gwarantuje, że zrzut ekranu lub archiwum nadają się do publikacji.

Dla współtwórców projekt udostępnia polecenie qa:doctor, które odczytuje tożsamość środowiska/kompilacji, oraz qa:inspect, które otwiera izolowany profil z zaślepkami dostawców. Próbka testowa (fixture) weryfikuje testowaną ścieżkę aplikacji bez łączenia się z modelem. Wnioskowanie na żywo, łączność z usługą Telegram, natywne środowisko graficzne Linux, podpisywanie oraz kontrole spakowanych artefaktów stanowią odrębne dowody. Zapoznaj się z plikiem TESTING.md, aby poznać powtarzalne polecenia i procedury czyszczenia.

Powiązane instrukcje: [Polecenia diagnostyczne i dowodowe](../../TESTING.md).

<a id="privacy"></a>

## Dane lokalne i granice ochrony

Projekty, historia, plany, dokumenty i dane diagnostyczne mogą zawierać prywatny tekst. Nie publikuj profili, nieprzetworzonych zrzutów, kluczy ani kompletnych dzienników wraz z kodem źródłowym.

W systemie Linux zapisywanie danych uwierzytelniających API, sterowania, integracji Telegram i instancji wymaga odblokowanej usługi GNOME Secret Service lub KWallet; w przypadku braku obsługiwanego magazynu wpisów tajnych ZIAForge odmawia zapisu tych danych, zamiast stosować mechanizm awaryjny basic_text środowiska Electron.

Lokalne przechowywanie danych nie oznacza, że żądania nie opuszczają Twojego komputera: wybrane CLI/API przesyła je do swojego dostawcy. Katalog roboczy i nadzór nad procesami nie stanowią izolacji na poziomie systemu operacyjnego OS. Sprawdzaj wybrane uprawnienia.

Rozróżniaj rodzaje danych dowodowych: próbki testowe badają aplikację bez modelu; natywne testy na żywo weryfikują prawdziwe CLI/konto; kontrole spakowanych aplikacji certyfikują konkretny artefakt. Pozytywny wynik jednego testu nie gwarantuje pomyślnego przejścia pozostałych.

Zakres aplikacji, drzewo robocze i prompt w trybie tylko do odczytu różnią się od wymuszeń na poziomie systemu operacyjnego. Zasady weryfikatora/pomocnika Antigravity wykrywają zmiany w zebranych dowodach obszaru roboczego, zamiast wymuszać dostęp do systemu plików tylko do odczytu. Natywne sterowanie komputerem wykonuje autoryzowane przez właściciela programy poza standardową granicą narzędzi aplikacji; wyłącz je, gdy nie jest już potrzebne.

Powiązane instrukcje: [Pochodzenie i publikacja](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Zrozumienie i modyfikowanie projektu open source

Przeczytaj najpierw AGENTS.md i CONTRIBUTING.md, a następnie PROJECT_MAP.md, aby poznać bieżące granice kodu źródłowego. Zaimplementowane kontrakty typowane oraz aktualne dokumenty dotyczące przepływów pracy/dostawców określają zachowanie systemu. Plik CONCEPT.md i fragmenty pliku ARCHITECTURE.md dotyczące trybu terminalowego odzwierciedlają zamierzenia historyczne i nie należy ich mylić z funkcjonalnościami bieżącego wydania.

Angielskim źródłem pomocy jest plik docs/help/en.json. Nie edytuj ręcznie wygenerowanego pliku USER_GUIDE.md ani website/guide.html. Zmodyfikuj sekcję kanoniczną, zaktualizuj powiązany kontrakt i uruchom polecenie node scripts/help/generate.cjs. Pomoc w aplikacji korzysta z tego samego źródła. Weryfikuj dodawane treści z faktyczną implementacją, uwzględniając limity, uprawnienia i nieobsługiwane ścieżki.

Każda z 56 wersji językowych interfejsu ma osobny status pomocy w pliku docs/help/locales.json. Brakująca lub niekompletna pomoc zastępowana jest wersją angielską. Kompletne treści przetłumaczone maszynowo są oznaczone etykietą i powiązane ze skrótem źródła angielskiego, bez deklaracji weryfikacji przez człowieka. Tłumaczenie zweryfikowane przez człowieka zawiera dodatkowo dane weryfikatora. Każde tłumaczenie musi zachowywać identyfikatory sekcji, akcje, identyfikatory plików/poleceń i limity techniczne, używać właściwego kierunku tekstu oraz być aktualizowane przy zmianie źródła angielskiego.

Przed wydaniem wersji uruchom polecenie node scripts/help/generate.cjs --check, aby wykryć nieaktualne wygenerowane pliki, nieprawidłowe szkielety wersji językowych lub uszkodzone odnośniki kontraktów lokalnych. Weryfikacja tłumaczeń interfejsu UI i testy zachowania aplikacji pozostają odrębne. Plik HELP_MAINTENANCE.md zawiera procedurę aktualizacji dla współtwórców i sztucznej inteligencji AI; dokumentacja nie może podawać, że test zakończył się sukcesem, jeśli nie został uruchomiony.

Powiązane instrukcje: [Bieżąca mapa projektu](../../PROJECT_MAP.md) · [Utrzymanie dokumentacji](../../HELP_MAINTENANCE.md) · [Instrukcje dla współtwórców](../../../CONTRIBUTING.md) · [Instrukcje dla agentów](../../../AGENTS.md).
