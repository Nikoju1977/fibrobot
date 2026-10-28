# FibroBot — Dossier de validation technique (27 octobre 2026)

**Statut : prototype public / candidat de livraison technique, NON VALIDÉ CLINIQUEMENT.**
La réussite d'une CI ou d'une démonstration web ne constitue pas une certification d'utilisation par des patients.

## Environnement et périmètre

- Application web statique/PWA hébergée par GitHub Pages.
- Assistant documentaire local et bibliothèque HAS/NCCIH/Nature Medicine, avec refus pour les questions non documentées.
- Option Gemma 4 E2B dans le navigateur via WebLLM 0.2.86 et WebGPU, non requise.
- Gemma 4 E4B : uniquement des **prototypes non compilés** Swift/Kotlin ; pas d'application native livrable.
- Toutes les informations de santé saisies dans l'application sont enregistrées localement dans une enveloppe AES-GCM du navigateur déverrouillé. Le coffre est une protection au repos, pas une garantie contre un appareil, un site web ou un fournisseur de ressources compromis.
- Les alertes de médicaments ne sont pas garanties lorsque la PWA est fermée. L'application n'est pas un outil de prescription ni de vérification des interactions.

## Matrice de validation

| Élément | Contrôle disponible | Résultat / limite |
| --- | --- | --- |
| Syntaxe JavaScript, manifest, fichier CSP et assets | GitHub Actions `test-app.yml` | Contrôle automatique ; consulter la CI du commit concerné |
| Chiffrement AES-GCM et phrase secrète erronée | `tests/vault-gemma.test.mjs` | Tests unitaires (WebCrypto Node) |
| Protection contre un coffre corrompu | `tests/vault-gemma.test.mjs` | Validation d'authenticité GCM |
| Écrasement par un onglet concurrent | `vault.mjs`, `tests/browser-e2e.mjs` | Transaction IndexedDB avec comparaison atomique |
| Création, verrouillage, récupération locale du coffre | `tests/browser-e2e.mjs` | Test navigateur Chromium automatisé |
| Ancien stockage en clair | `tests/browser-e2e.mjs` | Migration soumise au consentement, vérification avant suppression |
| Sauvegarde / restauration chiffrées | `tests/browser-e2e.mjs` | Test de restauration avec données fictives |
| Mode hors connexion | `tests/browser-e2e.mjs` | Test de chargement du shell et déverrouillage Chromium après première mise en cache |
| XSS et responsive | `tests/mobile-smoke.mjs` | Tests avec Chromium et WebKit sur Linux, avec tailles mobiles/tablettes |
| Protection des données à destination de Gemma | `tests/vault-gemma.test.mjs` | Noms de tâches, questions libres, médicaments et notes exclus du prompt |
| Réponses dangereuses et absence de preuves | `tests/core.test.mjs` | Jeu de tests représentatif, **pas** couverture exhaustive |
| Gemma 4 E2B WebGPU + téléchargements du modèle | Installation et benchmark matériel | **NON TESTÉ sur appareils réels** |
| Gemma 4 E4B natif | Xcode / Android Studio / matériel | **NON COMPILÉ, NON TESTÉ** |
| Voix strictement locale | Web Speech selon navigateur | **NON TESTÉ sur vrais iOS/Android** |
| Rappels de médicaments en arrière-plan | Limitations PWA | **PAS GARANTIS si application fermée** |
| Validité scientifique et recommandations individualisées | Revue médicale externe | **NON RÉALISÉE** |
| Conformité RGPD et statut de dispositif médical | Analyse réglementaire indépendante | **NON RÉALISÉE** |

## Confidentialité : éléments vérifiables

Les fichiers `core.mjs`, `medical-library.mjs`, `vault.mjs` et `vault-ui.mjs` exécutent le stockage et les réponses médicales sans appel à une API distante. La seule importation de code IA tiers est dans `gemma-worker.mjs`, après clic de téléchargement du modèle. Le Worker ne reçoit plus que des **indices temporaires de tâches, effort, priorité et énergie déclarée**. Les textes libres ne lui sont plus communiqués.

La **première visite** à GitHub Pages et le téléchargement du modèle contactent des hébergeurs Internet. Aucune promesse d'anonymat réseau total ne peut être faite. Les pages des sources sont également externes et s'ouvrent volontairement.

### Menaces hors périmètre du coffre

- Phrase secrète faible, appareil compromis, navigateur infecté ou extension malveillante.
- Session déverrouillée et données visibles à l'écran ou dans la mémoire.
- Sauvegardes imprimées ou fichiers exportés en clair (le rapport imprimable est non chiffré).
- Base historique `FibrobotDB` conservée si l'utilisateur refuse la migration ou si sa suppression est bloquée.
- Chaîne d'approvisionnement WebLLM/CDN, non auditée pour cette livraison.

## Conditions bloquantes avant un usage patient réel

1. Auditer la sécurité de l'application déployée, la chaîne d'approvisionnement des scripts externes, l'accessibilité et les permissions.
2. Tester au moins un iPhone compatible, un iPad, un smartphone Android et une tablette Android réels : coffre, récupération de sauvegarde, multitâche, stockage, voix et hors ligne.
3. Tester le téléchargement et l'inférence Gemma E2B sur plusieurs configurations représentatives, ainsi que la mémoire et les erreurs sans perte de données.
4. Construire, signer et tester les véritables applications natives si E4B doit être proposé.
5. Faire valider les fiches médicales et les scénarios d'alerte par des professionnels de santé ; prévoir la maintenance scientifique continue.
6. Réaliser les analyses RGPD et réglementaires nécessaires selon les fonctionnalités et les données collectées, et informer les utilisateurs.

**Ne pas demander aux patients de s'appuyer sur FibroBot pour décider d'une dose, d'une interaction ou d'une urgence.** En France, signes de danger immédiat : 15 ou 112 ; crise suicidaire : 3114.

## Contrôle complémentaire : routage du modèle et agents spécialisés

Les tests `tests/agent-hub.test.mjs` couvrent le catalogue des agents, le routage des domaines, les refus de prescription, les réponses urgentes et les sorties sourcées. Le contrôle navigateur simule également le clic sur un agent. La validation du chargement réel de Gemma/Qwen nécessite encore un appareil WebGPU avec les poids du modèle : elle ne fait pas partie des tests CI.

## Connecteurs Internet et sources documentaires — contrôle complémentaire

- Le fichier `network-library.mjs` choisit un fournisseur selon une question **publique non médicale** : Wikipédia, OpenAlex, Crossref, Open Library et GitHub.
- Les tests `tests/network-library.test.mjs` couvrent les domaines approuvés, les paramètres CORS, le filtrage des requêtes privées, la validation des URLs, les réponses JSON, les erreurs et les quotas.
- Le test navigateur `tests/browser-e2e.mjs` intercepte une requête Wikipédia **simulée**, vérifie la case réseau décochée au démarrage, le refus de consentement, une confirmation explicite et des liens vers les notices.
- Les requêtes médicales ne doivent pas être envoyées aux moteurs de culture générale. Europe PMC reste déclenché uniquement depuis Bibliothèque avec sujets prédéfinis et consentement.
- Les tests CI ne valident pas une disponibilité réseau réelle en permanence. Les tests matériels et la vérification médicale externe restent impératifs.

## Critères de qualité v2 — moteur JARVIS et sécurité patient

1. Aucun appel Internet à l'ouverture, avant le déverrouillage ou sans consentement par question.
2. Aucune requête privée ou médicale envoyée aux bibliothèques de culture générale ou à Mistral. Les sorties génératives sont filtrées et le dossier reste chiffré au repos.
3. Aucune clé Mistral enregistrée ; erreur API, CORS, quota ou refus de l'utilisateur gérés sans perte des données ni panne du module documentaire.
4. Les huit outils MCP refusent les noms et paramètres non autorisés ; le serveur MCP stdio ne publie **aucun** outil pouvant lire les dossiers patients.
5. Recherche médicale extractive à partir de fiches intégrées sourcées ; les index d'autres maladies restent des **liens**, non une base clinique exhaustive.
6. Tests `tests/brain-mcp.test.mjs`, `tests/mistral-bridge.test.mjs`, `tests/network-library.test.mjs`, `tests/browser-e2e.mjs`, workflow static et cache PWA.
7. Ne pas confondre « protocole MCP compatible », « réponse d'un modèle mocké », « poids téléchargés », « moteur exécuté sur téléphone réel » et « efficacité médicale validée ». Chacun nécessite un contrôle distinct.

## Validation supplémentaire — couverture Mistral sans données médicales privées

- \`tests/mistral-routing.test.mjs\` prouve le routage : question générale → Mistral ; question fibromyalgie documentée → fiche **publique** ; organisation → instructions **génériques** ; urgence, diagnostic, dose, dossier personnel et médecine inconnue → local.
- \`tests/mistral-bridge.test.mjs\` vérifie en simulation l'absence de question clinique ou de note privée transmise, la validation des sorties médicales générées et le respect des erreurs 429 sans répétition.
- \`tests/browser-e2e.mjs\` simule le consentement individuel avant Mistral, une explication sourcée et un planning anonyme, le refus des doses, puis le repli local après une erreur 429.
- Tests réels non couverts : facturation et quotas d'un compte Mistral, politique CORS du navigateur, pertinence clinique avec patients et professionnel de santé.

## Coffre chiffré de clé Mistral

- Clé non enregistrée par défaut ; sauvegarde volontaire avec case explicite.
- Lors de la sauvegarde : AES-GCM authentifié, nonce aléatoire, enveloppe dans `settings` elle-même chiffrée par le coffre.
- L'activation depuis le coffre n'a lieu que sur clic avec coffre ouvert et ne lance aucun appel API.
- Déconnexion, verrouillage, navigation hors page et effacement : suppression de la clé de la session lorsque possible.
- Tests de confidentialité : secret absent de la valeur de formulaire après soumission et des données IndexedDB en clair, suppression de la copie actuelle, échec avec mauvaise clé.
- Limitations non levées : exécution Javascript compromise, extensions, historique de sauvegardes, révocation de la clé côté prestataire, quota 429, compatibilité CORS.
