<!-- Generated from docs/help/en.json; source SHA-256 19977b173c646929e3b4afd5f8a5c30639cc32ca620657d7c2aed5e71419b947. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: fr; served locale: fr; status: machine-translated. -->
# Guide de l'utilisateur ZIAForge

De l'intention à un résultat vérifié. Un guide pratique de Code, de Work et du contrôle de l'application.

L'anglais est la version de référence. L'aide issue d'une traduction automatique est étiquetée séparément des traductions révisées par des humains. Les vérifications automatisées ne certifient pas l'exactitude dans la langue maternelle.

> Ce guide a été traduit automatiquement à partir de la source anglaise actuelle. Une révision humaine est toujours la bienvenue.

## Sections du guide

- [Premiers pas](#start)
- [Installer le package de bureau approprié](#install-platforms)
- [Code : cinq itinéraires](#code)
- [Discussion Forge](#forge)
- [Documents et décisions](#decisions)
- [Exécution et révision](#execution)
- [Équipes de révision parallèles et architecte de rapport](#review-teams)
- [Spécialisations des agents et politique d'invite](#specializations)
- [Work : de la question au document](#work)
- [Préréglages, modèles et accès](#models)
- [Chats, Arrêter et file d'attente](#chat)
- [Fichiers, Git et finalisation](#files)
- [Connexions API](#api)
- [Paramètres, langues et réinitialisation sécurisée](#settings)
- [Interroger l’assistant d’Aide](#help-assistant)
- [Assistant et Telegram](#assistant-control)
- [Gérer votre bot Telegram privé](#telegram)
- [Permission native de l’ordinateur réservée au propriétaire](#native-permissions)
- [Navigateur et instances distantes](#remote)
- [OpenClaw, Hermes et autres agents externes](#external-agents)
- [CLI local et limites d’automatisation](#local-cli)
- [Version et mises à jour](#updates)
- [Redémarrage et récupération](#restart)
- [Dépannage](#troubleshooting)
- [Signaler des problèmes et inspecter les preuves](#diagnostics)
- [Données locales et limites](#privacy)
- [Comprendre et faire évoluer ce projet open source](#project-contributors)

<a id="start"></a>

## Premiers pas

ZIAForge regroupe la discussion, la planification, l'exécution et la vérification au sein d'une même tâche. Choisissez Code pour un projet Git, ou Work pour des documents, des recherches et d'autres résultats dans un dossier ordinaire.

Commencez par une petite tâche dans un projet distinct. Si vous choisissez une CLI native, installez-la et connectez-vous d'abord avec son propre compte dans un terminal. Vous pouvez également configurer une connexion API. Un abonnement CLI et une API payante sont des méthodes de connexion distinctes ; ZIAForge ne vous connecte pas et ne transfère pas de crédits entre elles.

1. Ouvrez les Paramètres et vérifiez le dossier de l'espace de travail ainsi que la langue. « À propos » indique l'identité exacte du build en cours d'exécution.
2. Pour Code, ajoutez un dépôt Git dans la barre latérale. Pour Work, choisissez un dossier distinct lors de la création de la tâche.
3. Enregistrez un préréglage avec une CLI, un modèle, un effort de raisonnement et un niveau d'accès. Vous pouvez également sélectionner Personnalisé directement sans préréglage enregistré.
4. Créez une tâche, choisissez son itinéraire, ses rôles ainsi que l'avancement manuel ou automatique. Passez en revue les choix avant de cliquer sur Démarrer.

> Utilisez l'artefact et la somme de contrôle fournis par le mainteneur. Une préversion peut être non signée ou ne pas disposer d'un flux de mise à jour publié. La prise en charge de l'environnement de bureau et des fournisseurs natifs doit être vérifiée pour la version exacte du OS, l'architecture et l'artefact ; la prise en charge au niveau du code source ne constitue pas à elle seule une certification de version.

Instructions associées: [Présentation du projet](../../../README.md) · [Compatibilité des fournisseurs](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Installer le package de bureau approprié

Choisissez un package pour votre système d'exploitation et l'architecture de votre CPU : x64 ou arm64. Le pipeline de build peut produire des formats macOS DMG/ZIP, des installateurs Windows NSIS/ZIP et Linux DEB/RPM/AppImage/tar.gz/ZIP. Un fichier généré ou une compilation croisée ne prouve pas que son installateur et son UI native fonctionnent avec succès sur votre machine ; consultez le registre de vérification de cette version.

Les builds macOS utilisant Electron 44 nécessitent macOS 13 ou une version ultérieure. Utilisez le package arm64 sur Apple Silicon et le package x64 pour Intel. Quittez complètement toute ancienne version de l'application avant son remplacement. Les packages de préversion peuvent être non signés et non notarisés ; ne confondez pas un artefact de développement avec une version publique signée.

Windows requiert un système d'exploitation pris en charge par la version intégrée d'Electron ainsi que Git disponible dans le PATH. Choisissez l'architecture correspondante. Une préversion non signée ne possède pas de certification Authenticode. Un ZIP portable doit conserver le répertoire complet de l'application et les fichiers d'exécution, et pas seulement son exécutable.

Linux nécessite un environnement de bureau graphique compatible, les bibliothèques système requises par Electron et Git. Pour les identifiants de contrôle chiffrés, fournissez un Secret Service fonctionnel tel que gnome-libsecret ou KWallet ; le backend non sécurisé basic_text n'est pas accepté. Les tests préliminaires en mode headless ou conteneur ne certifient pas tous les environnements de bureau ou distributions.

Installez un paquet DEB avec apt install ./file.deb, ou installez un RPM via le gestionnaire de paquets de votre distribution. Un fichier AppImage nécessite les permissions d'exécution et une prise en charge appropriée de FUSE ; --appimage-extract-and-run est une alternative lorsqu'elle est prise en charge. Extrayez les packages tar.gz et ZIP avec l'intégralité de leurs fichiers d'exécution. Maintenez bien séparés les données utilisateur et les fichiers de l'application lors du remplacement d'un package.

Pour compiler à partir des sources, utilisez Node 24, Git et npm ci, y compris le programme d'installation habituel d'Electron. Les recompilations natives nécessitent des outils spécifiques à la plateforme : les outils en ligne de commande Xcode sur macOS ; MSVC C++, le Windows SDK et Python sur Windows ; un compilateur, make, Python, pkg-config et les outils d'empaquetage requis sur Linux. Suivez PLATFORM_BUILDS.md pour connaître les commandes exactes et les limites actuelles de chaque plateforme.

Les numéros de version sont réservés de manière centralisée et les livrables sont immuables. Un build de vérification de CI n'est pas un installateur publié. Les archives sources contiennent le code source, le lockfile, la documentation et les scripts ; les dépendances, identifiants, profils utilisateur et recherches privées sont exclus. Ne déduisez jamais la validation native sous ARM ou Windows du succès d'un build x64.

Instructions associées: [Packages de plateforme, prérequis et limites de vérification](../../PLATFORM_BUILDS.md) · [Identité du build et contrôles de version](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code : cinq itinéraires

Auto évalue la portée : une question simple peut s'achever par une réponse, tandis qu'une tâche plus vaste nécessite une préparation. « Corriger un bug » analyse la cause et prépare une correction. « Spécification d'abord » commence par la solution technique ; « Exigences d'abord » commence par les exigences et les critères d'acceptation.

Multi-modèle utilise des contextes distincts pour l'exploration, la conception, l'implémentation et la révision. Le nom de cet itinéraire n'exige pas de fournisseurs différents : chaque rôle utilise le préréglage ou la configuration Personnalisé que vous choisissez.

Un Worktree isole les modifications Git d'une tâche. Branche travaille dans l'extraction sélectionnée. Vérifiez le projet, la branche et le modèle avant de commencer ; la description de la tâche n'est pas également envoyée à un chat ordinaire.

Pour une idée comportant des choix produit ou techniques non résolus, utilisez « Exigences d'abord » et posez les bases dans la discussion. Auto classifie la requête ; ce n'est pas un ordre d'implémenter immédiatement chaque courte phrase. « Enregistrer le brouillon » conserve la requête sans contacter de modèle ; « Démarrer » enregistre et lance le flux géré une seule fois. De une à quatre copies de tâche disposent d'identifiants de création et de paramètres de rôles indépendants.

Instructions associées: [Contrat de flux de travail Code](../../WORKFLOWS.md) · [Profils d'invite de Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Discussion Forge

« Démarrer » ouvre la discussion centrale. Répondez naturellement, posez des contre-questions, ajoutez des contraintes et échangez sur les choix techniques. La conversation et les questions restent associées à la tâche.

L'envoi de texte ne vaut ni acceptation d'un document ni autorisation d'un nouveau plan d'implémentation. Une clarification en cours d'exécution met d'abord en pause le tour géré et réexamine le périmètre concerné. Une réponse à une question au sein d'une étape déjà acceptée peut poursuivre cette étape.

Pour réexaminer délibérément les bases, sélectionnez Exigences, Spécification ou Planification. Une nouvelle version nécessite une nouvelle acceptation des décisions dépendantes. Les étapes terminées et leurs preuves sont conservées ; les phases inachevées remplacées restent dans l'historique.

Les sessions de phases gérées diffèrent d'un chat libre. Utilisez la discussion Forge au lieu d'envoyer des invites manuelles directement à une session détenue par le flux de travail.

Instructions associées: [Contrat de discussion Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Documents et décisions

Ouvrez un document, examinez sa version et apportez des modifications si nécessaire. La soumission de modifications via la discussion génère une nouvelle version ; les rapports et les résultats vérifiés ne sont pas réécrits rétrospectivement.

Avant d'accepter un plan proposé, modifiez l'ordre, les instructions, les critères d'acceptation et les commandes de vérification. N'autorisez que des commandes concrètes que vous comprenez : elles s'exécutent dans le dossier de la tâche. Multi-modèle propose une étape d'implémentation pour l'ensemble de la tâche, les détails figurant dans ses documents et ses instructions.

« Approuver » est une décision délibérée distincte. Auto ne contourne ni les questions ni l'acceptation des exigences, des spécifications et des plans. Un document modifié de manière externe ne peut pas réutiliser une approbation passée.

Les fichiers de préparation apparaissent sous forme d'artefacts. Leur version, leur phase de production et leur hachage les lient à un résultat. Les documents Code sont conservés en dehors du worktree et ne sont pas automatiquement intégrés dans un commit.

Vérifiez à la fois le document et la décision affichée avant d'accepter. L'acceptation lie l'ID de la porte de validation actuelle, la révision du plan et les hachages des documents conservés. Demandez des modifications lorsque le périmètre ou les preuves sont incorrects. Si une décision est devenue obsolète, rechargez l'état enregistré avant de faire un nouveau choix ; un fichier modifié ne peut pas être accepté sous une version antérieure.

Instructions associées: [Portes de validation du flux de travail et versions des documents](../../WORKFLOWS.md).

<a id="execution"></a>

## Exécution et révision

« À faire » affiche les étapes réelles, la tentative en cours, la vérification et les résultats de la révision. Un agent affirmant « terminé » ne valide pas une étape : les preuves requises par le plan doivent exister.

Le mode manuel marque une pause entre les étapes admissibles. Auto fait avancer les étapes vérifiées et autorise un nombre limité de nouvelles tentatives. « Arrêter après » crée toujours un point de contrôle. « Pause » interrompt le travail actif du flux de travail ; fermer un panneau ne l'arrête pas.

Un réviseur indépendant utilise un contexte distinct contenant les fichiers et les résultats de vérification. Chaque observation bloquante obligatoire doit être résolue ; la présence de plusieurs réviseurs ne permet pas d'écarter une erreur bloquante par un vote.

Dans Multi-modèle, la correction des observations requiert une décision explicite. Une correction ne lance pas silencieusement une autre révision : « Réviser à nouveau » ouvre un nouveau cycle. Les commentaires de révision peuvent demander un réexamen au coordinateur sans réitérer l'implémentation.

Les étapes terminées ne peuvent pas être modifiées en silence. Avec le TDD, l'étape Rouge doit réellement échouer pour la raison attendue, puis l'étape Verte doit réussir. Le nombre limité de tentatives évite les boucles infinies.

Enregistrez des réviseurs CLI/API indépendants dans Paramètres → Équipes de révision, puis sélectionnez l'équipe dans Code ou Work. Les réviseurs s'exécutent en parallèle, suivis par l'architecte de rapport de l'équipe. Vous pouvez également configurer des réviseurs indépendants sans équipe enregistrée. L'architecte de rapport ne reçoit que des rapports structurés anonymes, sans aucun fichier de projet ni outil ; cette isolation nécessite actuellement Claude Code ou une API.

Chaque étape d'implémentation nécessite une vérification exécutable, une révision indépendante requise, ou les deux. Les phases de préparation conservent quant à elles des résultats validés et des accusés de réception d'artefacts ; ceux-ci ne prétendent pas que les tests d'implémentation ont été exécutés. Une commande ne réussit que lorsque son code de sortie effectif et le nettoyage des processus enfants sont confirmés. Une vérification Rouge pour le TDD doit échouer normalement avant l'implémentation et la vérification Verte ; un exécutable manquant ou un dépassement de délai ne constitue pas un résultat Rouge valide.

Les disjoncteurs par défaut s'arrêtent après trois tentatives échouées sur une même étape ou cinquante tentatives au total. Une interruption consomme une tentative mais ne compte pas en elle-même comme une tentative échouée. Les limites et les preuves acquises subsistent après un redémarrage ; « Réessayer » ne les réinitialise pas. Prenez connaissance de l'échec consigné avant d'autoriser une nouvelle tentative.

Instructions associées: [Vérification et révision](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Équipes de révision parallèles et architecte de rapport

Ouvrez Paramètres → Équipes de révision et enregistrez une équipe. Ajoutez des réviseurs indépendants dotés de leur propre CLI ou API, modèle, effort de raisonnement et spécialisation, puis choisissez un architecte de rapport. Sélectionnez l'équipe dans la configuration de révision de la tâche. Un préréglage d'exécuteur peut également être utilisé par un réviseur, et Personnalisé reste disponible ; les rôles indépendants conservent toujours des contextes distincts.

Les réviseurs s'exécutent en parallèle sur les mêmes éléments de preuve de la tâche. Chaque rapport, erreur et verdict requis est conservé. L'architecte reçoit des rapports numérotés anonymes, sans les noms des réviseurs, sans l'identité des modèles ou fournisseurs, sans le contenu initial de la tâche, sans accès au dépôt et sans outils. Il compare les rapports et renvoie un verdict structuré unique ; il n'effectue pas une nouvelle révision du code source.

Une observation bloquante ou le rejet émis par un réviseur requis ne peut pas être levé par un vote majoritaire ou par la préférence de l'architecte. Des rapports manquants ou mal formés empêchent toute approbation. Inspectez les observations individuelles et la décision globale avant d'accepter ou d'autoriser des corrections. Une équipe enregistrée est résolue et figée pour l'exécution ; modifier son préréglage ne réécrit pas les preuves déjà établies.

L'architecte dédié aux rapports utilise actuellement des configurations sans outils prises en charge basées sur Claude ou une API. Codex et Antigravity restent disponibles comme réviseurs mais sont refusés pour ce rôle d'architecte isolé tant qu'un contrat sans outils vérifié n'existe pas. Une invite indiquant simplement « sans outils » ne suffit pas.

> Le pipeline de conception/révision de Code Multi-modèle et une équipe de révision parallèle enregistrée constituent des contrôles distincts. Conservez la politique de révision personnalisée sélectionnée ; ne présumez pas qu'un itinéraire active automatiquement toutes les fonctionnalités de révision.

Instructions associées: [Configuration typée de l'équipe](../../../shared/review-team.ts) · [Agrégation des révisions](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Spécialisations des agents et politique d'invite

Un modèle est le moteur d'exécution ; une spécialisation est un profil d'instructions. Choisissez Aucun pour n'ajouter aucune spécialisation, Standard pour le guide par défaut, Auto pour un guide intégré pertinent, ou Manuel pour les guides sélectionnés et vos propres instructions délimitées. Les préréglages peuvent conserver cette sélection.

Le catalogue d'origine couvre le développement général, l'architecture, la sécurité, la fiabilité, les performances, les tests et l'ergonomie de l'interface. Auto utilise le texte disponible de la tâche ou de l'étape pour sélectionner un guide ; il n'appelle pas secrètement un autre modèle et ne certifie pas une quelconque expertise. Les suggestions de planification peuvent être inspectées et modifiées avant d'accepter le plan d'implémentation.

Les spécialisations de révision aident à orienter l'attention mais ne remplacent jamais les preuves indépendantes, les limites d'accès ou le verdict structuré. Considérez les instructions personnalisées comme faisant partie intégrante du périmètre de la tâche : ne les utilisez pas pour contourner l'acceptation des documents, la politique des outils, l'authentification ou les échecs des réviseurs.

Instructions associées: [Catalogue d'invites d'origine](../../../shared/specializations.ts).

<a id="work"></a>

## Work : de la question au document

Work ne requiert pas Git. Par défaut crée un dossier de tâche distinct ; Personnalisé sélectionne un dossier existant via le sélecteur natif. « Enregistrer le brouillon » stocke les paramètres sans inférence ; « Démarrer » exécute la première phase.

Auto répond directement ou propose un plan adapté avec de réelles tâches à faire. Brainstorm crée ideas.md avant que vous ne choisissiez d'autres idées ou une évaluation. Recherche conserve findings.md, les sources et les limites. Rédiger passe de l'intention et, lorsque cela est utile, d'outline.md à un document descriptif ou à draft.md ; les révisions conservent les versions précédentes.

Sélectionnez les fichiers d'entrée via le sélecteur natif et référencez-les avec @. L'application les copie en tant qu'entrées de tâche immuables et valide leur identité avant une exécution. Par défaut crée un dossier de tâche géré par l'application ; l'accès au dossier Personnalisé constitue une autorisation accordée par le propriétaire et enregistrée. Un brouillon enregistré et non démarré peut changer de dossier.

Créez de 1 à 4 copies avec des paramètres d'exécuteur indépendants. Les tâches utilisant des dossiers qui se chevauchent ne peuvent pas écrire simultanément. Cette coordination s'applique aux opérations de ZIAForge, et non à des programmes externes arbitraires.

Brainstorming approfondi utilise par défaut trois agents indépendants et en prend en charge jusqu'à huit. Sélectionnez leur ordre et leurs configurations, y compris la réutilisation d'un préréglage dans des contextes distincts. Les questions des agents conservent leur origine ; les rapports mal formés bénéficient d'une tentative de réparation de format. Les échecs partiels restent visibles plutôt que d'être présentés comme un succès unanime.

La version approfondie combine les rapports conservés des agents dans brainstorm_report.md et sollicite systématiquement une décision de l'utilisateur. Un ajustement mineur révise le rapport via le coordinateur ; une modification majeure lance une nouvelle série avec les agents figés. Les artefacts conservent leurs versions.

Les rôles résolus sont figés lors de la création de la tâche ou de l'enregistrement explicite du brouillon. Après la première invocation, seul l'avancement automatique/manuel peut être modifié ; utilisez une nouvelle tâche pour des paramètres de rôle ou de modèle différents. La modification d'un préréglage global ne modifie pas silencieusement les phases ultérieures.

Le mode manuel marque une pause entre les phases admissibles, y compris lors d'un plan de rédaction substantiel. Auto peut continuer à travers ce plan. Les questions, les plans exécutables proposés, l'orientation du Brainstorming et la révision du rapport approfondi restent des décisions explicites, même en mode Auto. Une citation ne prouve pas à elle seule qu'une navigation sur le Web a eu lieu, et un fichier binaire conservé ne prouve pas à lui seul son bon rendu.

Instructions associées: [Modes et décisions de Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Préréglages, modèles et accès

Un préréglage enregistre une CLI/API, un modèle, un effort de raisonnement et des autorisations. Le pied de page du chat comporte les sections préréglage, CLI, modèle et options. Personnalisé fonctionne sans préréglage ; « Créer un préréglage » enregistre la sélection actuelle.

Le catalogue provient de la CLI ou de l'API installée sélectionnée lorsque cela est pris en charge. « Actualiser » met à jour la liste sans modifier la sélection. Si la détection automatique est indisponible, saisissez un ID de modèle explicite ; le fournisseur doit toujours le prendre en charge. Les niveaux de raisonnement dépendent du modèle et de la CLI. La valeur par défaut du fournisseur est distincte du jeton explicite « none ».

N'appliquez les modifications qu'après confirmation du backend. Le changement est restreint pendant un tour actif ou lorsque la file d'attente n'est pas vide. Les brouillons et l'historique visible subsistent, mais changer de fournisseur ne transfère pas leur état interne privé.

Dans Forge, le libellé du rôle a son importance : la préparation peut utiliser un planificateur distinct. Le pied de page permet de modifier le rôle affiché ; les réviseurs et assistants sont sélectionnés dans les paramètres du flux de travail. La politique appliquée à une implémentation déjà vérifiée peut être verrouillée.

Les autorisations varient selon les fournisseurs. « Lecture seule » et « Écriture dans l'espace de travail » sont disponibles lorsque l'adaptateur les prend en charge. Antigravity utilise les paramètres natifs de la CLI ou un accès complet explicitement sélectionné. L'accès complet n'est pas un bac à sable.

La spécialisation ajoute des conseils d'invite, et non un autre modèle ou une nouvelle autorisation. Les préréglages et les rôles prennent en charge Aucun, Standard, Auto et Manuel. Auto sélectionne des profils à partir du texte de l'étape sans appel de modèle supplémentaire ; Manuel accepte jusqu'à quatre spécialités et des instructions personnalisées. Les attributions proposées par le planificateur peuvent être modifiées avant d'accepter le plan.

Un ID de modèle ou un effort saisi manuellement reste votre choix, mais le fournisseur peut le rejeter. Modifier un préréglage global ne modifie pas rétroactivement un chat en cours ou un plan accepté. Pour modifier délibérément une conversation inactive, utilisez ses propres commandes de configuration et attendez la confirmation. Une option désactivée doit être interprétée comme une limite de capacité ou de cycle de vie, et non contournée en modifiant le fichier JSON enregistré.

Instructions associées: [Capacités du fournisseur](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Chats, Arrêter et file d'attente

Les onglets ouverts, Récents et les brouillons appartiennent à une seule tâche. Fermer un onglet le retire des onglets ouverts mais le conserve dans Récents et n'arrête pas le processus de son fournisseur ni le flux de travail géré. Recherchez dans l'historique, rouvrez un chat ou fermez tous les onglets secondaires depuis le menu d'historique.

« Arrêter » interrompt le tour en cours. Attendez que l'arrêt soit complet avant le prochain envoi : l'accusé de réception de l'interruption ne signifie pas que le processus est terminé. Vous pouvez saisir le brouillon suivant pendant ce temps.

Dans un chat ordinaire, « Mettre en file d'attente » enregistre une demande ultérieure séparément du brouillon actuel. « Suspendre la file d'attente » bloque les distributions suivantes. « Arrêter » et « Quitter » mettent la file d'attente en pause. Après un redémarrage, cliquez d'abord sur « Reprendre », puis explicitement sur « Continuer la file d'attente ».

« Incertain » signifie que la remise du message est inconnue. Un tel message n'est pas renvoyé automatiquement : examinez l'historique, copiez le texte si nécessaire et rejetez l'élément en file d'attente. L'envoyer à nouveau constitue une nouvelle demande délibérée.

Les chats de phase gérée utilisent leur flux de travail, et non la file d'attente ordinaire. « Suivre l'étape » affiche la phase en cours ; sélectionner manuellement un autre onglet interrompt ce suivi. Les journaux de la CLI affichent les diagnostics séparément de la réponse.

Les réponses au format Markdown restituent les titres, listes, tableaux, liens et blocs de code délimités. Les cartes d'outils et les diagnostics de la CLI restent séparés de la réponse. Les réflexions et métriques de jetons rapportées par le modèle n'apparaissent que si le fournisseur les expose réellement ; ne déduisez aucun raisonnement privé ou consommation à partir d'une simple animation.

Après un envoi incertain ou un accusé de réception de file d'attente, inspectez l'historique et ne réessayez que la même requête conservée lorsque cela est proposé. Un reçu de file d'attente signifie que le stockage a accepté l'élément, et non que l'inférence est terminée. Ne supprimez un élément en file d'attente incertain que par un rejet explicite ; cela ne peut pas rétracter une invite déjà remise.

Instructions associées: [File d'attente de messages durable](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Fichiers, Git et finalisation

« Fichiers » affiche le dossier de la tâche. Comparez les résultats aux exigences, ouvrez des documents et inspectez les diffs. La conservation d'un fichier binaire ne prouve pas son rendu correct dans son application cible.

Git fournit l'état, les modifications et les opérations accompagnées des résultats consignés. Le commit, la fusion et le push sont manuels par défaut ; les opérations automatiques constituent des choix distincts pour un plan entièrement vérifié.

Ne modifiez pas les fichiers de travail entre la vérification et la publication : l'approbation est liée aux octets exacts. Les conflits, les échecs de push et les résultats d'opération inconnus bloquent la progression jusqu'à ce qu'une décision explicite soit prise. Auto n'autorise pas la publication de manière tacite.

Work ne crée aucune branche Git et ne comporte aucune finalisation Git. Conservez les documents requis depuis le dossier sélectionné, y compris les versions et les sources.

L'éditeur de fichiers propose la coloration syntaxique par extension, la recherche et le remplacement, l'historique d'annulation, le retour à la ligne automatique et des brouillons par onglet. Les enregistrements préservent les encodages UTF-8/UTF-16 pris en charge et rejettent les conflits de modification externe. Les autres encodages et contenus binaires nécessitent un éditeur externe. Les brouillons non enregistrés empêchent de quitter l'application tant que le propriétaire ne les a pas enregistrés ou ignorés.

La coloration syntaxique complète est activée jusqu'à 8 Mio. Les fichiers texte plus volumineux s'ouvrent par fenêtres de 256 Kio ; les fichiers de 8 à 64 Mio peuvent être explicitement chargés dans leur intégralité sans syntaxe. Au-delà de 64 Mio, utilisez l'édition par fenêtres et la recherche limitée de l'occurrence suivante. Il s'agit d'un mode restreint pour gros fichiers, et non d'une parité avec Sublime Text pour des documents arbitrairement volumineux.

« Ouvrir le dossier » utilise le contexte actuel de la tâche ou de la branche/worktree, au lieu d'ouvrir silencieusement le dépôt d'origine uniquement. Une ligne de fichier peut révéler le répertoire parent de ce fichier. Les chemins d'accès sont validés par le backend par rapport aux autorisations accordées à la tâche. Les fichiers binaires ne sont pas modifiables sous forme de texte brut ; utilisez leur visionneuse dédiée et conservez les octets d'origine.

La suppression d'un worktree est une action protégée distincte. Mettez fin aux sessions structurées et aux terminaux associés avant de le supprimer, y compris les sessions inactives. Examinez le résultat Git enregistré et l'état de récupération ; la suppression de l'enregistrement d'une tâche ne remplace pas la préservation sécurisée des travaux non validés.

Instructions associées: [Contrat d'éditeur typé](../../../shared/editor.ts) · [Politiques Git](../../WORKFLOWS.md).

<a id="api"></a>

## Connexions API

« Connexions » ajoute un point de terminaison compatible OpenAI explicitement sélectionné. Saisissez un nom, l'URL de base, un modèle et une clé si nécessaire. De nombreux serveurs nécessitent une URL de base se terminant par /v1 ; consultez la documentation de votre point de terminaison.

HTTPS est obligatoire, sauf pour HTTP en boucle locale. Utilisez un point de terminaison standard sans identifiants intégrés dans l'URL. Les clés utilisent le chiffrement pris en charge par le OS et ne sont jamais renvoyées à l'UI. Modifier le point de terminaison oblige à saisir à nouveau sa clé. Laisser le champ de clé vide conserve la clé enregistrée ; « Supprimer la clé enregistrée » l'efface explicitement.

Les appels API n'utilisent pas d'abonnement CLI. Les outils et modèles diffèrent des sessions natives, et la détection réussie d'un modèle ne garantit pas l'inférence. L'utilisation des jetons n'apparaît que si le fournisseur la transmet effectivement.

Conservez les identifiants dans Connexions plutôt que dans le texte de la tâche ou les instructions de préréglage. Les réviseurs en lecture seule ne reçoivent que les outils de fichiers API qui leur sont autorisés ; l'architecte de rapport ne dispose d'aucun outil. Les appels d'outils non pris en charge sont rejetés plutôt qu'exécutés silencieusement. Les serveurs diffèrent par leurs paramètres de raisonnement, leur prise en charge des outils et leurs catalogues de modèles ; comparez toute erreur au contrat propre à votre point de terminaison.

Instructions associées: [Connexions API](../../API_CONNECTIONS.md).

<a id="settings"></a>

## Paramètres, langues et réinitialisation sécurisée

Les paramètres généraux permettent de sélectionner l'espace de travail, la langue de l'interface et les valeurs par défaut. Connexions gère les points de terminaison API. Les préréglages et les équipes de révision conservent les configurations des rôles. Contrôle à distance gère les identifiants locaux, le périmètre du serveur et les autorisations du propriétaire ; Mises à jour gère la source et le canal de publication. « À propos » affiche la version exacte du build en cours d'exécution.

La langue de l’interface est distincte de la langue des invites et du statut de révision de la documentation. Les noms de produits, identifiants de commande, extensions de fichier, identifiants de modèle de fournisseur et noms créés par l’utilisateur restent des identifiants. L’aide suit la langue d’interface sélectionnée lorsqu’une traduction à jour est disponible ; les traductions automatiques sont étiquetées et l’anglais demeure la référence canonique.

Enregistrer applique la configuration affichée. Une réinitialisation de la base de données ou un rétablissement des paramètres d’usine peut supprimer les métadonnées de l’application ; conservez les fichiers et une sauvegarde testée avant d’utiliser délibérément la réinitialisation. Ces opérations sont des actions réservées au propriétaire local. Ne les utilisez pas comme un raccourci pour examiner un flux de travail ayant échoué ou un enregistrement corrompu.

Instructions associées: [Instructions de localisation](../../LOCALIZATION.md) · [Récupération de données](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Interroger l’assistant d’Aide

Ouvrez l’Aide, choisissez un préréglage connecté enregistré dans son panneau d’assistant et posez vos questions sur ZIAForge. Les réponses utilisent le guide canonique actuel en anglais et la langue d’interface que vous avez sélectionnée. Des boutons de référence de section ouvrent les rubriques pertinentes du guide, afin que vous puissiez comparer l’explication avec la référence.

Cet assistant conserve une conversation privée distincte pouvant contenir jusqu’à 100 entrées enregistrées et 3 Mio. Saisissez une question contenant jusqu’à 12,000 caractères ; Envoyer la transmet, Arrêter annule la réponse active tout en conservant votre question disponible, et Effacer supprime cette conversation d’Aide. Votre brouillon non envoyé et votre choix de préréglage subsistent après la fermeture ou la réouverture de l’Aide au cours de la même session d’application, mais le brouillon n’est pas enregistré sur le disque. L’assistant n’envoie pas de commandes à l’application, ne modifie pas de flux de travail et n’accepte aucun point de validation. Les conseils ne constituent pas une vérification en temps réel d’une tâche, d’un compte ou d’une connexion externe.

Les sessions d’Aide Claude Code et API appliquent la politique prise en charge d’interdiction d’outils (no-tools). Les sessions d’Aide natives Codex et Antigravity requièrent la permission existante d’accès natif à l’ordinateur du propriétaire local. Si elle est désactivée, l’application explique ce prérequis au lieu de choisir un autre fournisseur. Seul le propriétaire peut l’activer dans les paramètres de contrôle local ; l’assistant ne peut pas l’activer de lui-même.

L’Aide Codex utilise un bac à sable en lecture seule et refuse les demandes d’approbation d’outils. Antigravity utilise le mode plan et son indicateur de bac à sable natif. Ces modes natifs ne constituent pas une garantie universelle de confinement par le système d’exploitation. Le hachage du guide source identifie la référence utilisée pour la réponse ; une explication générée pouvant toujours être erronée, inspectez ses sections liées avant d’agir. Les réponses plus anciennes sont signalées lorsque leur version du guide source diffère de celle du guide actuel.

Instructions associées: [Guide canonique et maintenance des traductions](../../HELP_MAINTENANCE.md) · [Assistant applicatif et permissions](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Assistant et Telegram

L’assistant utilise le préréglage sélectionné et la même API de contrôle de l’application. La permission d’inspecter l’état et la permission d’effectuer des opérations sont distinctes. Inspectez les commandes et les résultats : la prose de l’assistant ne constitue pas une preuve qu’une action a été accomplie.

Telegram est activé uniquement par le propriétaire local, avec un jeton de bot existant et un identifiant numérique de propriétaire (ID). Le contrôle est réservé au chat privé de ce propriétaire. Un bot non configuré ou inactif ne doit recevoir aucun message de l’application.

Ne collez pas de jeton de bot dans une conversation ordinaire. Configurer l’intégration ne prouve pas la connectivité à Telegram et ne crée pas automatiquement de bot. Les captures d’écran et les réponses peuvent contenir des données privées de l’espace de travail.

Sélectionnez un préréglage d’assistant et accordez la permission d’effectuer des opérations sur l’application séparément de l’inspection. L’exécution de l’assistant Codex et Antigravity requiert la permission native du propriétaire ; ils ne sont pas silencieusement remplacés par une session API ou Claude sans outils. Des captures d’écran peuvent être affichées dans la conversation de l’assistant, mais l’entrée actuelle du modèle n’inclut pas d’analyse d’image. Ne présumez pas que l’assistant a inspecté visuellement une image simplement parce qu’il l’a affichée.

L’assistant peut inspecter les résumés, les tâches, les conversations, l’état du flux de travail, le contexte des processus et les fenêtres de l’application via des outils typés. Il peut modifier les paramètres ordinaires autorisés et lancer des opérations applicatives autorisées. Il ne peut pas accorder de droits natifs, révéler des identifiants stockés, modifier à distance l’accès accordé à l’espace de travail racine ou approuver un point de validation Forge simplement par commodité.

Instructions associées: [Contrat de contrôle de l’application](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Gérer votre bot Telegram privé

Créez ou obtenez votre propre bot, démarrez son chat privé, puis saisissez son jeton et votre identifiant numérique d’utilisateur Telegram (ID) dans les paramètres de contrôle local. N’activez l’intégration que lorsque vous souhaitez que l’application se connecte. L’ID du propriétaire est un identifiant d’utilisateur, non un nom d’utilisateur ni un ID de bot. Seuls les messages provenant de cet utilisateur dans ce même chat privé sont acceptés.

Utilisez /start, /menu ou /status pour obtenir une vue d’ensemble de la version en cours d’exécution, du nombre de projets/tâches et des statuts des tâches. Des boutons ouvrent Projets, Tâches, Capture d’écran, Aide et Langue. Les listes affichent huit éléments par page, avec une navigation Retour, Actualiser, Accueil et Précédent/Suivant. Les boutons de projet filtrent la liste des tâches. Une fiche de tâche indique la progression enregistrée de son flux de travail, le modèle/préréglage et les questions en attente le cas échéant.

Ouvrez les Conversations d’une tâche pour prévisualiser les conversations ouvertes/récentes et les échanges de phase du flux de travail. Chaque aperçu affiche jusqu’à six des derniers messages utilisateur/assistant, visiblement raccourcis à 200 caractères chacun. Le raisonnement privé n’est pas affiché. La lecture de l’historique ne démarre pas de fournisseur. Les aperçus sont en lecture seule : le texte ordinaire et /ask TEXT continuent de s’adresser à l’assistant applicatif, jamais implicitement à la conversation de la tâche en cours de consultation.

Exécuter / Continuer relit le flux de travail actuel en mode Code ou Work et démarre un flux de travail enregistré éligible. Pause demande sa mise en pause. Aucun des deux n’accepte d’exigences, de spécification, de plan, de conclusions de révision ni de questions ; une décision en attente empêche l’exécution. Prenez vos décisions dans l’application, ou utilisez une commande typée explicitement autorisée avec son point de validation et sa révision exacts actuels.

Utilisez Langue ou /language pour sélectionner l’une des 56 langues d’interface par son nom natif. Cela enregistre une préférence pour ce bot et ce propriétaire uniquement. Utiliser la langue de l’application efface cette préférence. Cela ne modifie ni la langue de l’application ni les permissions d’accès ; les messages existants ne sont pas automatiquement renvoyés.

La navigation met normalement à jour le même message de menu publié. Les boutons possèdent des identités opaques qui expirent après 15 minutes et ne peuvent être utilisés qu’une seule fois ; modifier une fiche invalide ses anciens boutons. Les boutons expirés, consommés, associés à un message discordant ou issus d’un processus antérieur ne peuvent effectuer aucune action. Un message définitivement non modifiable peut être remplacé par une nouvelle fiche ; une erreur réseau inconnue n’est pas réessayée sous forme de nouveau message.

Lors de l’activation, le mécanisme de scrutation (poller) ignore l’arriéré antérieur et enregistre l’acceptation de la mise à jour avant la distribution afin que les commandes interrompues ne soient pas automatiquement rejouées au redémarrage. Cela empêche le rejeu ; cela ne garantit pas l’achèvement. Vérifiez l’état/le contexte avant d’émettre délibérément un nouveau travail après une erreur. Il n’y a pas de notifications automatiques de statut de tâche.

Les commandes explicites restent disponibles : /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot et /ask TEXT. /new {JSON} crée une tâche via la commande typée createTask ; /command {JSON} envoie une commande de catalogue explicite. Consultez le catalogue en direct pour le format des arguments. Les mêmes autorisations de backend et accords de dossiers s’appliquent que dans l’application.

L’application n’envoie jamais les valeurs de jeton de bot stockées à l’assistant. Les captures d’écran, résumés et textes de conversation peuvent néanmoins contenir des informations de projet privées. Arrêtez l’intégration localement si le compte du bot ou du propriétaire n’est plus digne de confiance. Renouvelez un jeton ayant fuité auprès du fournisseur de bot, puis mettez à jour sa configuration chiffrée locale.

Instructions associées: [Bot privé et commandes](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Permission native de l’ordinateur réservée au propriétaire

L’accès natif à l’ordinateur démarre désactivé. Seul le propriétaire peut l’activer dans Paramètres locaux → Contrôle à distance. L’assistant et les commandes HTTP/MCP/Telegram ne peuvent pas activer cet indicateur pour eux-mêmes. Si une opération est refusée, l’assistant doit décrire le paramètre et laisser le propriétaire décider.

Lorsqu’elle est explicitement activée, computer.run accepte un exécutable, un tableau d’arguments et un répertoire de travail absolu optionnel. Elle n’utilise aucune interpolation de shell, a une limite de 30 secondes et restreint la sortie à 1 Mio. Un répertoire fourni introuvable ou invalide est refusé ; omettre cwd utilise le répertoire des paramètres appartenant à l’application, non HOME. Quitter annule les commandes possédées actives et attend le nettoyage de leurs processus.

La portée de lecture/opération de l’application et l’accès natif relèvent de décisions distinctes. Un arbre de travail (worktree) ne restreint pas l’accès au système de fichiers d’un fournisseur sans restriction. Révoquez l’accès natif après la tâche s’il n’est plus requis, et inspectez les reçus de commande plutôt que d’accepter la prose de l’assistant comme preuve.

Instructions associées: [Contrat de contrôle réservé au propriétaire](../../../shared/control.ts).

<a id="remote"></a>

## Navigateur et instances distantes

Le propriétaire local active le serveur et choisit son adresse, son port et sa portée : lecture pour l’inspection ou opération pour les actions. L’adresse par défaut 127.0.0.1 n’est disponible que sur cet ordinateur. 0.0.0.0 écoute sur les interfaces réseau ; examinez l’accès réseau avant de l’activer.

Un navigateur ouvre la même interface après connexion par jeton. N’incluez pas de jetons dans des liens publics ou des captures d’écran. HTTP seul ne chiffre pas le trafic ; utilisez un canal sécurisé sur un réseau non fiable.

Le propriétaire configure les autres instances par URL et jeton. Le backend relaie les requêtes (proxy) ; cela ne copie pas leurs projets sur la machine locale. Vérifiez l’instance sélectionnée avant chaque action.

Les commandes typées et les événements portent le contrôle de l’application. La portée de lecture n’autorise pas les mutations de tâches. Le contrôle natif de l’ordinateur est un choix distinct du propriétaire local et démarre désactivé.

L’application doit rester ouverte pour le contrôle par navigateur, Telegram et les agents externes. Chaque instance possède son propre profil privé, son état de tâche, son jeton et son port de serveur. Ne réutilisez pas un même profil simultanément entre des instances indépendantes. Les événements de navigateur et les réponses aux commandes sont limités à l’instance sélectionnée ; changer l’UI ne déplace pas les fichiers et ne copie pas la connexion native.

Instructions associées: [Contrôle d’instances et HTTP](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes et autres agents externes

Utilisez l’API de contrôle applicatif authentifiée ou le pont stdio MCP intégré. Activez le serveur localement, choisissez lecture ou opération et configurez chaque client avec l’URL et le jeton de cette instance. Node.js 22 ou version ultérieure est requis pour exécuter le pont MCP autonome ; l’application Electron n’installe pas votre client agent. L’URL de navigateur n’est pas un point de terminaison HTTP MCP diffusable en continu (Streamable) : fournissez-la en tant que ZIAFORGE_URL au pont stdio.

Le pont expose ziaforge_status, ziaforge_commands, ziaforge_command et ziaforge_screenshot. Commencez par le statut et le catalogue de commandes en direct, puis lisez system.context pour la tâche sélectionnée. Les commandes typées respectent les mêmes vérifications de révision, de point de validation, de dossier de tâche et de nettoyage que l’UI locale.

Le catalogue de commandes en direct inclut documentation.guide, l’aide canonique en anglais, avec son chemin source et son sourceSha256. L’architecte applicatif interne reçoit la même référence par le biais de ses outils. Cela donne aux agents l’intégralité du contexte du produit sans dépendre de notes obsolètes ; la documentation n’accorde jamais d’accès et ne remplace pas une décision humaine actuelle.

Les agents doivent discuter des exigences, des décisions techniques et de la planification à partir d’une brève idée humaine. Ils doivent préserver les points de validation humains explicites, les modèles sélectionnés, la politique manuelle/Auto et la révision requise. Ils ne doivent pas inventer d’approbation, rejouer des commandes incertaines sous un nouvel ID, ni publier de modifications Git sans l’intention explicite du propriétaire.

Configurez plusieurs serveurs MCP nommés pour plusieurs installations. Le basculement d’instance est une décision de routage, non une synchronisation. Des exemples de configuration pour OpenClaw et Hermes figurent dans AGENT_CONTROL.md ; la configuration spécifique et la compatibilité du client doivent être vérifiées pour la version installée du client.

Le cache externe de requestId déduplique uniquement un ensemble délimité de requêtes pendant l’exécution de l’application. Les opérations durables utilisent leurs propres identifiants : createRequestId pour la création de tâche, commandId pour les décisions de flux de travail, clientMessageId pour les messages et operationId pour les mutations Git. Préservez l’identifiant et la charge utile d’origine après un accusé de réception inconnu ; lisez l’état sauvegardé avant d’émettre délibérément un nouveau travail.

Instructions associées: [Instructions pour les clients MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI local et limites d’automatisation

Le répartiteur ziaf contrôle la même application en cours d’exécution et le même flux de travail enregistré. Depuis les sources, utilisez npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID ou npm run ziaf -- pause --task TASK_ID. Un accusé de réception Start réussi ne signifie pas que la tâche est terminée.

--until-success active délibérément Auto pour le flux de travail enregistré, mais les questions, la révision, les points de validation d’acceptation, les limites et les points de contrôle continuent de s’appliquer. Ctrl+C quitte le répartiteur d’observation ; cela n’arrête pas implicitement le flux de travail de l’application. Consultez CLI.md pour les codes de sortie, le point de terminaison local et la gestion des profils.

L’interface Automatisations stocke actuellement les définitions d’affichage et les compteurs d’exécution locaux. Il ne s’agit pas d’un planificateur périodique certifié et cela ne prouve pas qu’un tour de modèle en arrière-plan s’est exécuté. Pour l’exécution réelle, utilisez les commandes du flux de travail enregistré, ziaf ou l’API authentifiée et inspectez leurs reçus. Ne confondez pas le panneau de démonstration avec une planification sans surveillance.

Instructions associées: [Commandes du répartiteur](../../CLI.md).

<a id="updates"></a>

## Version et mises à jour

À propos affiche la version exacte en cours d’exécution. Les mises à jour publiques nécessitent un dépôt de versions GitHub de confiance et un canal stable ou d’aperçu (preview). La vérification, le téléchargement et l’installation possèdent des états distincts ; une erreur ne signifie pas qu’une mise à jour a été installée.

L’installation automatique est destinée aux versions macOS signées. Les versions de développement non signées ne sont pas installées automatiquement par ce mécanisme. Pour un remplacement manuel, quittez complètement l’application actuelle et utilisez un artefact vérifié.

La vérification automatique s’exécute immédiatement lorsqu’elle est activée, puis toutes les six heures.

Stable exclut les versions préliminaires ; preview autorise également les versions de développement. Une vérification réussie établit uniquement les métadonnées de la version disponible. Le téléchargement et l’installation nécessitent le paquet adapté à la plateforme et le flux de distribution configuré. La distribution Linux DEB emprunte un chemin d’installation distinct ; ne partez pas du principe qu’un DEB est automatiquement mis à niveau par le mécanisme de mise à jour macOS.

Instructions associées: [Préparation des versions](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Redémarrage et récupération

Sous macOS, utilisez Quitter / ⌘Q pour un arrêt complet. Fermer la fenêtre peut laisser l’application en cours d’exécution. Quittez complètement l’ancienne version avant de remplacer l’application.

Après le lancement, sélectionnez la même tâche. L’historique et les brouillons réapparaissent. Reprendre restaure un contexte natif/local mais n’envoie pas de brouillon, ne réactive pas la file d’attente suspendue et n’autorise pas la répétition d’une opération inconnue.

Si Récupération apparaît, ne modifiez pas de JSON à la main. Inspectez le type de document affecté, conservez les fichiers d’origine et sélectionnez une sauvegarde validée. Restaurer une file d’attente plus ancienne marque ses éléments comme incertains.

Lorsque la remise est inconnue, un flux de travail géré peut nécessiter une permission explicite pour obtenir un contexte frais. Le travail antérieur et les tentatives échouées subsistent ; un refus visible est plus sûr qu’un succès fabriqué.

Sauvegardez les fichiers de tâche et le profil de l’application avec toutes les instances de l’application fermées. Un dossier copié n’est pas une restauration testée. Si la récupération vous demande de sélectionner une sauvegarde validée, conservez également les fichiers endommagés exacts. Restaurer un flux de travail ou une file d’attente plus ancien n’autorise pas à rejouer une inférence ou des opérations Git incertaines.

Instructions associées: [Contrat de récupération](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Dépannage

CLI introuvable : vérifiez son installation et sa version dans un terminal ordinaire, puis redémarrez ZIAForge. La présence d’un exécutable ne signifie pas que vous êtes connecté. Utilisez le mécanisme de connexion propre au fournisseur.

Modèle indisponible ou échec d’autorisation : actualisez la découverte, sélectionnez un ID disponible et vérifiez votre compte ainsi que vos limites. Ne renouvelez pas une requête incertaine avant d’avoir inspecté son historique.

Flux de travail arrêté : ouvrez la phase en cours, la question, le reçu de vérification ou les journaux du CLI. Traitez la cause spécifique : une question sans réponse, une commande, une permission de dossier ou une limite de tentatives. Continuer ne peut pas transformer une vérification échouée en succès.

Dossier manquant ou remplacé : restaurez l’accès au dossier d’origine ou créez une nouvelle tâche. L’application ne doit pas continuer depuis HOME. Si vous observez un autre répertoire courant (cwd), arrêtez le tour et préservez les diagnostics.

Pour un rapport, incluez la version indiquée dans À propos, la route, le CLI/modèle, le comportement attendu et observé, une capture d’écran et un extrait sûr des journaux. Supprimez les secrets, le contenu personnel et les chemins qui ne peuvent pas être publiés.

Page distante indisponible : vérifiez que le propriétaire a activé le serveur, vérifiez l’adresse d’écoute et le port, puis authentifiez-vous avec le jeton d’instance correct. Une erreur 401 indique un problème d’authentification ; une mutation refusée peut résulter d’une portée limitée à la lecture ou d’un contrôle réservé au propriétaire. Modifier le jeton déconnecte les clients de navigation existants. N’exposez pas le port d’inspection distinct des DevTools comme s’il s’agissait d’un contrôle d’application à distance.

Enregistrement refusé dans l’éditeur : conservez le brouillon, inspectez le fichier actuel sur le disque et résolvez le conflit lié à une modification externe. Ne contournez pas la comparaison en réécrivant les métadonnées de l’application. Si le chargement complet des fichiers volumineux est indisponible, utilisez l’édition par fenêtre/la recherche prise en charge ou un éditeur externe.

Telegram indisponible : confirmez localement le jeton du bot, le propriétaire numérique, le chat privé et le statut. Un webhook ou un poller concurrent peut bloquer la scrutation ; ZIAForge ne supprime pas automatiquement un webhook et ne prend pas le pas sur un autre poller. Les commandes rejetées ou interrompues à une frontière inconnue ne sont pas automatiquement rejouées.

Instructions associées: [Tests et diagnostic](../../TESTING.md).

<a id="diagnostics"></a>

## Signaler des problèmes et inspecter les preuves

Notez la version exacte en cours d’exécution depuis À propos, l’OS/l’architecture, le mode de tâche, le fournisseur/modèle sélectionné ainsi que les étapes reproduisant le problème. Décrivez le résultat attendu et le résultat observé. Incluez une capture d’écran sûre et la commande conservée ou le reçu de vérification pertinent, plutôt qu’un profil privé complet.

Les journaux du CLI, les journaux d’événements, les transcriptions de modèles, les traces de navigation et les captures d’écran peuvent exposer du code source, des chemins personnels ou des jetons. Inspectez et caviardez avant tout partage. Un outil de caviardage de journaux au mieux ne certifie pas qu’une capture d’écran ou une archive soit publiable.

Pour les contributeurs, qa:doctor lit l’identité de l’environnement/du build ; qa:inspect ouvre un profil isolé avec des bouchons de fournisseur. Un jeu d’essai prouve le bon cheminement de l’application testée sans contacter de modèle. L’inférence en direct, la connectivité Telegram, le bureau natif Linux, la signature et les vérifications d’artefacts empaquetés constituent des preuves distinctes. Consultez TESTING.md pour les commandes reproductibles et les procédures de nettoyage.

Instructions associées: [Commandes de recueil de preuves](../../TESTING.md).

<a id="privacy"></a>

## Données locales et limites

Les projets, l’historique, les plans, les documents et les diagnostics peuvent contenir du texte privé. Ne publiez pas de profils, de captures brutes, de clés ou de journaux complets avec le code source.

Sous Linux, l’enregistrement des identifiants d’API, de contrôle, de Telegram et d’instance nécessite un service de secrets GNOME ou un KWallet déverrouillé ; sans magasin de secrets pris en charge, ZIAForge refuse d’enregistrer ces secrets au lieu d’utiliser le mécanisme de repli basic_text d’Electron.

Le stockage local ne signifie pas que les requêtes restent sur votre ordinateur : le CLI/l’API sélectionné les envoie à son fournisseur. Un dossier de travail et la supervision des processus ne constituent pas une isolation au niveau de l’OS. Inspectez les permissions sélectionnées.

Distinguez les types de preuves : les jeux d’essai testent l’application sans modèle ; les essais réels natifs utilisent un véritable compte/CLI ; les vérifications empaquetées certifient un artefact spécifique. La réussite de l’un ne garantit pas celle des autres.

La portée applicative, un arbre de travail et une invite en lecture seule sont différents d’une contrainte imposée par le système d’exploitation. Les politiques de réviseur/d’assistant d’Antigravity détectent les modifications dans les preuves collectées de l’espace de travail plutôt que d’imposer un accès en lecture seule au système de fichiers. Le contrôle natif de l’ordinateur exécute des programmes autorisés par le propriétaire en dehors de la limite ordinaire des outils de l’application ; désactivez-le lorsqu’il n’est plus nécessaire.

Instructions associées: [Provenance et publication](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Comprendre et faire évoluer ce projet open source

Lisez d’abord AGENTS.md et CONTRIBUTING.md, puis PROJECT_MAP.md pour connaître les limites actuelles du code source. Les contrats typés implémentés ainsi que les documents actuels de flux de travail/fournisseurs régissent le comportement. CONCEPT.md et les sections orientées terminal d’ARCHITECTURE.md conservent l’intention historique et ne doivent pas être confondus avec les affirmations de la version actuelle.

La source de l’aide en anglais est docs/help/en.json. Ne modifiez pas à la main le fichier généré USER_GUIDE.md ni website/guide.html. Modifiez la section canonique, mettez à jour le contrat concerné et exécutez node scripts/help/generate.cjs. L’Aide intégrée à l’application lit la même source. Vérifiez les ajouts par rapport à l’implémentation réelle, y compris les limites, les permissions et les voies non prises en charge.

Chacun des 56 paramètres régionaux d’interface possède un statut d’aide distinct dans docs/help/locales.json. Une aide manquante ou incomplète bascule sur l’anglais. Les corpus complets traduits par machine sont étiquetés et liés au hachage de la source anglaise, sans prétention de révision humaine. Une traduction révisée par un humain enregistre en outre son réviseur. Chaque traduction doit conserver les identifiants de section, les actions, les identifiants de fichier/commande et les limites techniques, utiliser la direction correcte, et être actualisée dès que sa source anglaise change.

Avant de livrer, exécutez node scripts/help/generate.cjs --check pour détecter les sorties générées obsolètes, les canevas régionaux invalides ou les liens de contrats locaux rompus. Les vérifications de traduction d’UI et les vérifications de comportement de l’application restent distinctes. HELP_MAINTENANCE.md détaille la procédure de mise à jour pour le contributeur et l’AI ; la documentation ne doit pas prétendre qu’un test a réussi s’il n’a pas été exécuté.

Instructions associées: [Carte actuelle du projet](../../PROJECT_MAP.md) · [Maintenance de la documentation](../../HELP_MAINTENANCE.md) · [Instructions pour les contributeurs](../../../CONTRIBUTING.md) · [Instructions pour les agents](../../../AGENTS.md).
