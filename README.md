# FibroBot — assistant de vie local

## Première prise en main · Studio Niko Design

**FibroBot est conçu pour un seul patient par navigateur / profil d'appareil.** Il ne propose aucun compte multi-utilisateur, aucune liste de patients, et ne demande pas de nom civil. Un seul coffre peut être créé sur cette installation. Pour utiliser un dossier différent, il faut effacer complètement le coffre existant (après sauvegarde si nécessaire). Une sauvegarde doit uniquement être restaurée par le patient auquel elle appartient.

1. Ouvrez FibroBot, créez une phrase secrète personnelle d'au moins 12 caractères et confirmez qu'il s'agit de **votre propre dossier**. La phrase secrète ne peut être récupérée si elle est perdue.
2. À la première ouverture du coffre, un guide **« 3 gestes simples »** explique comment noter son état, organiser sa journée et demander de l'aide. Le guide peut être masqué et rouvert depuis **« Mode d'emploi »**. L'état du guide est mémorisé **dans le coffre chiffré**, jamais dans un traceur externe.
3. Sur téléphone et tablette, la barre inférieure donne accès à Accueil, Tâches, Assistant et Santé ; **Plus** ouvre toutes les autres rubriques, notamment les traitements, rendez-vous, bibliothèque et mode crise.
4. Les réglages **Gemma 4** sont facultatifs et repliés par défaut : le patient n'a pas besoin de télécharger un modèle pour utiliser l'application. Les données médicales restent soumises aux refus prudents et aux sources documentaires.
5. Pour mettre l'application en sécurité, utilisez **Verrouiller** ; l'export du coffre chiffré se trouve dans **Mes données**.

**Conception interface et expérience utilisateur : Studio Niko Design.** Ce logiciel est expérimental, non évalué cliniquement. Les tests de navigation sur navigateurs émulés ne prouvent pas la compatibilité sur tous les appareils réels.


FibroBot est un assistant de vie pour les personnes vivant avec la fibromyalgie et d'autres maladies chroniques. Il conserve un profil multi-maladies, un journal de santé, des tâches quotidiennes, un inventaire de traitements déclarés et des rendez-vous.

**Statut : prototype expérimental non validé cliniquement.** Il ne remplace ni médecin, ni pharmacien, ni service d'urgence.

## Fonctionnalités

- Organiser les tâches selon une énergie que la personne renseigne, sans déduire l'énergie de la douleur.
- Tenir un journal avec douleur, énergie, fatigue, sommeil, symptômes et maladies associées.
- Enregistrer les autres maladies chroniques, les traitements réels (tels que déclarés), les horaires et questions à poser.
- Rappels de médicaments pour un horaire quotidien par traitement : confirmer « pris » ou « ignoré ». Les notifications ne sont pas garanties quand le navigateur est fermé.
- Enregistrer les rendez-vous, les questions médicales et produire un rapport imprimable.
- Mode Crise : sécurité, relaxation et respiration facultatives, aide aux tâches et liens institutionnels.
- Afficher la date et l'heure de l'appareil. Ne pas inventer la météo réelle.
- Fiches médicales embarquées avec sources et indications sur la qualité des preuves.
- Exporter en JSON ou supprimer toutes les données de ce navigateur.
- Application PWA adaptée aux smartphones et tablettes iOS/Android, hors ligne après mise en cache initiale.

## Moteur de réponse

Le volet médical utilise un moteur **déterministe et sourcé** : fiche pré-rédigée ou refus explicite. Aucune prescription ni vérification d'interactions médicamenteuses n'est générée.

Gemma 4 E2B est facultatif et réservé au **classement de tâches**, après téléchargement volontaire. Seuls des indices temporaires, niveaux d'effort, priorités et énergie déclarée lui sont présentés ; aucun texte libre de tâche ou question, aucun traitement ni symptôme. L'exécution réelle sur appareils mobiles n'est pas encore validée. Les modèles génératifs peuvent halluciner, d'où la sortie limitée à des indices existants.

## Voix et météo : limitations

La lecture vocale n'est proposée que lorsque le navigateur expose une voix française marquée comme locale. La dictée intégrée est refusée si le navigateur n'expose pas explicitement un mode de reconnaissance local. La dictée proposée par le clavier du système relève des réglages de confidentialité de ce dernier.

La météo nécessite des données extérieures actualisées. Elle est volontairement indisponible en mode strictement local. L'heure et la date proviennent de l'appareil.

## Rappels : limitations impératives

Un seul horaire de rappel quotidien est disponible par traitement déclaré. FibroBot vérifie les rappels pendant qu'il est ouvert et affiche les rappels passés à sa réouverture. **Il ne garantit aucune notification quand l'application est fermée**, notamment sur iOS. Utilisez une alarme système pour toute prise importante.

## Traitements et soins complémentaires

Les doses et les fréquences sont recopiées par la personne et jamais vérifiées par FibroBot. Aucune vérification automatisée des interactions, contre-indications, allergies ou ajustements de prescription. Faites réviser la liste par votre médecin ou pharmacien. Méditation et hypnose : pratiques facultatives, preuves souvent limitées, jamais une substitution aux soins.

## Confidentialité

Le **coffre chiffré AES-256-GCM** conserve les données dans IndexedDB. Les exports JSON du coffre sont chiffrés, mais les rapports imprimables sont en clair. La clé n'est pas sauvegardée. Une ancienne base non chiffrée peut rester si la migration n'est pas autorisée ou échoue ; vérifiez son effacement.

Le téléchargement volontaire de Gemma charge un runtime WebLLM tiers dans un Worker isolé. Aucun texte clinique n'est transmis à ce Worker, mais la chaîne d'approvisionnement du CDN n'a pas été auditée. Le navigateur contacte l'hébergeur au premier chargement, et les liens externes s'ouvrent à la demande.

## Utilisation et validation

Voir le [dossier de validation technique](VALIDATION.md) et la liste des essais et vérifications manquants.

Servir les fichiers par un serveur statique HTTP(S), par exemple avec python3 -m http.server 8000. Les tests automatisés utilisent node --test tests/*.test.mjs. Les modules ne sont pas garantis en ouvrant directement index.html en mode fichier.

Avant un usage patient en production : revue clinique externe, audit de sécurité et d'accessibilité, tests sur iOS/Android/tablettes, validation des données scientifiques, analyse RGPD et éventuel statut de dispositif médical.

## Sources

- HAS : https://www.has-sante.fr/jcms/p_3634512/fr/fibromyalgie-de-l-adulte-conduite-diagnostique-et-strategie-therapeutique
- HAS pour le public : https://www.has-sante.fr/jcms/p_3686005/fr/fibromyalgie-comprendre-la-maladie-pour-mieux-vivre-avec-ses-symptomes
- NCCIH : https://www.nccih.nih.gov/health/fibromyalgia-in-depth
- Médicaments : https://base-donnees-publique.medicaments.gouv.fr/

Urgences en France : 15 ou 112 ; crise suicidaire : 3114.

Studio Niko Design.

## Coffre-fort local chiffré

- Toutes les tables applicatives désormais persistées dans une unique enveloppe AES-256-GCM dans `FibroBotVault-v1` (IndexedDB). La clé est dérivée côté navigateur par PBKDF2-SHA256 (600 000 itérations) et n'est pas sauvegardée. Une phrase secrète de 12 caractères minimum est requise.
- Sans la phrase secrète, FibroBot ne peut pas ouvrir le dossier. En cas de perte de cette phrase, aucune récupération n'est possible. Le coffre ne protège pas les données d'un navigateur ou appareil déjà compromis ni les copies d'écran, les rapports imprimés, l'historique du clavier ou la mémoire d'une session déverrouillée.
- Après consentement explicite, l'ancienne base non chiffrée `FibrobotDB` est lue une fois, réécrite chiffrée et relue pour validation des effectifs avant tentative de suppression. Si la suppression échoue ou si la personne ne choisit pas la migration, l'ancienne base reste non chiffrée ; un bouton de suppression manuelle est prévu.
- L'export JSON exporte **l'enveloppe chiffrée**, pas le contenu en clair. La restauration de cette enveloppe depuis le formulaire du coffre est implémentée, mais n'a pas encore été validée sur iOS/Android. Les rapports imprimables, eux, sont en clair.
- Les données de santé ne passent pas par un serveur de traitement, et le modèle ne reçoit pas les posologies pour faire des décisions thérapeutiques.

## Gemma 4 locale : périmètre effectivement implémenté

Le chargement est facultatif et déclenché par un clic explicite dans le chat. `gemma-local.mjs` détecte WebGPU et charge dynamiquement WebLLM **0.2.86** et Gemma 4 **E2B** quantifié `q4f16_1` (si FP16 est disponible) ou `q4f32_1` (sans cette capacité). Le runtime et les poids sont téléchargés depuis les domaines indiqués par l'écosystème WebLLM/Hugging Face. Aucune clé API Mistral n'est utilisée.

**Inférence locale :** les demandes de planification quotidienne autorisées sont envoyées au runtime WebGPU **dans le navigateur**, pas à une API d'inférence. Le modèle reçoit uniquement des indices anonymes de tâches (effort/priorité) et l'énergie déclarée, sans leurs intitulés ni question libre. Le routage médical déterministe reste prioritaire ; les réponses non documentées sont refusées. **Un modèle génératif peut toujours halluciner** : ses réponses de planification ne sont pas des recommandations médicales.

**E4B : non implémenté dans la PWA.** Google publie E2B et E4B pour LiteRT-LM natif (Swift iOS et Kotlin Android) mais une application native et sa compilation, des dizaines de tests de performance et des contrôles de sécurité clinique seraient nécessaires. La présente PR ne prétend pas exécuter E4B sur iPhone ou tablette.

**Compatibilité mobile :** WebGPU a été ajouté par Safari 26 sur iOS/iPadOS, et Chrome Android peut l'exposer sur des appareils compatibles. La présence de WebGPU ne garantit pas la mémoire nécessaire aux modèles. L'application teste les capacités et retombe sur le mode local documentaire si le téléchargement, le cache ou l'inférence échoue. Ni la RAM ni le poids du modèle ne sont chiffrés avec le dossier de santé.

**Mode hors ligne :** le shell PWA et la bibliothèque sont mis en cache ; le chargement initial du runtime et du modèle exige le réseau. Leur disponibilité hors ligne après rechargement dépend des caches et n'est pas garantie par cette PR. Toute mise à jour du runtime demande un nouvel audit de provenance. Le code du runtime est chargé depuis un CDN épinglé à une version, dans un Web Worker séparé. Ce Worker ne reçoit jamais la clé du coffre ni les posologies. Le code tiers reste non audité/vendored : une revue de la chaîne d'approvisionnement reste nécessaire.

### Vérifications

`node --test tests/*.test.mjs` et les vérifications de syntaxe de GitHub Actions couvrent le round-trip chiffrement/déchiffrement, la détection d'altération, les phrases secrètes, la prévention de réponses médicales génératives et les fonctions métier déjà présentes. Les téléchargements multi-Go, l'exécution réelle WebGPU, la migration IndexedDB dans Safari et Android et les notifications ne sont **pas validés** tant qu'ils n'ont pas été testés sur des appareils réels. Un test d'intégration Chromium du coffre et du filtrage médical est également disponible, avec son propre workflow GitHub Actions.

### Documentation des moteurs

- WebLLM version 0.2.86 : https://github.com/mlc-ai/web-llm/releases/tag/v0.2.86
- Gemma 4 E2B WebGPU : https://huggingface.co/mlc-ai/gemma-4-E2B-it-q4f16_1-MLC
- Gemma 4 E2B variante FP32 : https://huggingface.co/mlc-ai/gemma-4-E2B-it-q4f32_1-MLC
- LiteRT-LM E2B et E4B pour mobiles : https://gemma.ai/deployment/litert/
- WebGPU Safari : https://webkit.org/blog/17333/webkit-features-in-safari-26-0/

Les fichiers `native/ios` et `native/android` ne sont que des **prototypes de runners** documentés pour Gemma 4 E4B ; ils ne constituent pas des applications iOS/Android livrables et n'ont pas été compilés.

## Assistant local étendu (Studio Niko Design)

- Le mode sans LLM conserve toutes les fonctions de base. Les fonctions descriptives (planning sur tâches existantes, moyennes de valeurs déclarées, préparation de consultation) fonctionnent sans WebGPU ; elles ne produisent pas de diagnostic.
- Les modèles génératifs WebLLM sont **facultatifs**. Le bouton « Vérifier mon appareil et les modèles » charge le runtime tiers et son catalogue sans télécharger les poids du modèle. « Léger automatique » sélectionne un modèle selon les informations de VRAM publiées par le runtime et un budget conservateur ; Gemma 4 E2B est un choix manuel plus exigeant. La compatibilité réelle sur smartphone reste non prouvée. Aucune garantie de repli après un crash fatal du navigateur n'est possible.
- Le dialogue libre passe au modèle local **uniquement** si l'intention est non médicale ; aucun dossier médical, note de santé ou question médicale n'est transmis à son Worker. Les requêtes de santé gardent le refus prudent ou les fiches de sources.
- Une recherche bibliographique Europe PMC s'effectue seulement sur clic et avec des thèmes fixes (aucune recherche textuelle libre ou donnée de santé transmise). Un article trouvé n'est pas une preuve de sécurité ou d'efficacité clinique.
- Les rappels de traitement ne sont toujours pas garantis après fermeture du navigateur. Le modèle génératif ne conseille ni prescription, ni dosage, ni changements de traitement.

## Renforcement final — assistant et PWA

- Le dialogue génératif général rejette les questions contenant une demande pharmaceutique identifiée ou des informations personnelles reconnaissables ; les réponses génératives contenant un thème médical, une posologie, une référence à un traitement ou un lien non vérifié sont refusées avant affichage.
- Un bouton « Annuler le chargement » apparaît pendant l’installation d’un modèle optionnel. Les notes chiffrées et l’assistant documentaire restent utilisables si le modèle échoue.
- La PWA cache les fichiers statiques (service worker `fibrobot-shell-v10`), pas la clé du coffre ou les observations en clair. La compatibilité WebGPU réelle doit être validée sur les appareils concernés.

## Agents de soutien et dialogue IA — correctif octobre 2026

Le panneau Assistant présente **sept agents de soutien locaux** : douleurs et fibromyalgie, sommeil, fatigue/cognition, activités et énergie, coordination des soins, traitements déclarés et bibliothèque scientifique. Leurs implémentations se trouvent dans `agent-hub.mjs`. Ce sont des outils spécialisés déterministes, **pas sept LLM entraînés séparément ni des professionnels médicaux**. Ils travaillent sur les notes déchiffrées uniquement pendant la session, ne font pas de requêtes réseau et ne prescrivent jamais. Les réponses affichent les références des fiches intégrées quand il en existe.

Le LLM facultatif, sélectionné dans `gemma-local.mjs` et exécuté dans `gemma-worker.mjs`, est maintenant **activé automatiquement après le chargement volontaire**. La barre d'état indique la provenance de la réponse (agent local, bibliothèque ou IA générative) ; le bouton « 3. Tester la réponse IA » effectue une vraie génération **sans aucune donnée patient**, plutôt que de confondre « poids téléchargés » et « modèle opérationnel ». Les salutations et questions générales passent au LLM chargé ; les urgences et questions médicales restent gérées par les garde-fous documentaires. Une erreur du LLM entraîne un repli affiché, pas une réponse inventée.

Après fermeture ou redémarrage de la PWA, les poids peuvent rester en cache, mais l'inférence doit être **rechargée en mémoire GPU** : le statut affiche alors « non chargé dans cette session ». Le téléchargement initial reste soumis au consentement, à la disponibilité WebGPU et à la mémoire. Test du modèle sur smartphones physiques toujours nécessaire.

## Recherche Internet sourcée — connecteurs publics (octobre 2026)

L’Assistant propose désormais une **recherche Internet facultative**, sans clé API ni serveur applicatif, avec cinq connecteurs publics : Wikipédia (MediaWiki Action API avec `origin=*`), OpenAlex, Crossref, Open Library et GitHub. La recherche bibliographique **Europe PMC** intégrée à Bibliothèque conserve son fonctionnement par thèmes fixes, élargi à dix thèmes ; les fiches HAS et ameli se lisent hors connexion après cache du shell.

**Confidentialité :** le mode Internet est désactivé par défaut et n'est autorisé que pour la session courante. Pour chaque question de culture générale, une fenêtre indique la **question exacte et les fournisseurs concernés** et exige une confirmation. Aucune question médicale, médicament, observation de santé ni dossier chiffré n'est envoyé automatiquement. Cette protection repose sur un routage conservateur **et** la validation explicite de la question affichée. Ne confirmez pas une demande contenant une information privée. Les serveurs interrogés reçoivent l'adresse IP de l'appareil et le texte de la recherche (et peuvent avoir leur propre politique de conservation). Les réponses ne sont pas des diagnostics ni des sources de prescription.

**Qualité des réponses :** des notices et extraits publics sont présentés avec des liens numérotés réellement issus des API ; FibroBot n'invente ni source ni résultat. Wikipédia et les résultats de moteurs bibliographiques doivent être vérifiés dans les publications originales : une notice indexée n'est pas une preuve scientifique. Si Internet ne marche pas, les agents locaux, le coffre et la bibliothèque embarquée restent accessibles. Les recherches externes nécessitent CORS, réseau et limites de quota propres aux fournisseurs ; la compatibilité réelle est à vérifier sur chaque appareil.

**Conception de sécurité :** la liste des fournisseurs et des domaines de liens est fixe ; les réponses distantes ne sont jamais traitées comme des instructions ni insérées avec `innerHTML`. Le cache PWA `fibrobot-shell-v12` conserve les fichiers statiques nécessaires, **pas les résultats des recherches**. Les références d'une conversation peuvent être conservées **dans le coffre chiffré**, sans transfert automatique.

Documentation API : [MediaWiki CORS](https://www.mediawiki.org/wiki/API:Cross-site_requests), [OpenAlex](https://help.openalex.org/api/), [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/), [Open Library](https://openlibrary.org/developers/api), [GitHub REST](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests).

### Vérification manuelle après déploiement

1. Ouvrir le coffre, aller dans Assistant : le mode réseau doit être **désactivé** et la PWA doit fonctionner sans Internet.
2. Activer le réseau dans l'Assistant, demander « Qui était Marie Curie ? », vérifier la demande de confirmation et refuser une fois : aucune requête ne doit partir.
3. Reposer la question et accepter : le résultat Wikipédia et son lien vérifiable doivent s'afficher. Vérifier les quatre autres connecteurs avec les exemples proposés.
4. Envoyer une demande médicale : elle doit rester orientée vers les fiches médicales ou le refus prudent, sans envoyer le contenu aux bibliothèques générales.
5. Repasser hors connexion : la navigation, le coffre et les données locales doivent rester accessibles. La recherche Internet doit simplement se replier et expliquer l'indisponibilité.

L'accès HTTP réel aux cinq services, leurs quotas et la puissance du LLM WebGPU ne peuvent pas être garantis par les seuls tests automatisés.

## JARVIS fibromyalgie — moteur de connaissances v2 (28 octobre 2026)

Le cerveau FibroBot combine des **outils vérifiables et gratuits** (routage, fiches, agents, sélection des extraits, bibliothèques institutionnelles), un **LLM local facultatif** (WebLLM dans le navigateur avec WebGPU) et **Mistral AI facultatif** (API distante nécessitant une clé personnelle, facturation possible).

### Recherche générale et bibliothèques

- La question de culture générale peut être envoyée après une double autorisation explicite, renouvelée pour chaque question.
- Un routeur de connaissances (`knowledge-router.mjs`) détecte les domaines « encyclopédie », « livres », « logiciels », « publications » ou « langue ». Le module `network-library.mjs` recherche Wikipédia FR, Wikidata, Wiktionnaire, OpenAlex, Crossref, Open Library, GitHub et, si nécessaire, Wikipédia EN. Les résultats sont classés selon les intitulés et mots-clés. **Les notices ne constituent pas une validation indépendante.**
- Si l'utilisateur active « Synthétiser les extraits publics », le LLM local déjà chargé peut les reformuler à partir d'un prompt borné, sans notes de santé, et les **sources originales restent visibles**. La synthèse peut contenir des erreurs ; les recherches et références subsistent même si le LLM plante.

### Base médicale

- **Fibromyalgie** : fiches intégrées, références HAS 2025, ameli, NCCIH, bibliographie Europe PMC et outils locaux spécialisés.
- **Autres pathologies** : index français d'ameli, catégories institutionnelles et MedlinePlus (NLM/NIH, anglais) via liens. L'application **ne prétend pas posséder ni valider les connaissances de toutes les maladies**. Une fiche absente n'est pas remplacée par des conseils cliniques générés.
- `medical-rag.mjs` trie les fiches médicales embarquées et n'affiche que des extraits existants et référencés. Les portails institutionnels sont proposés comme liens, sans scraping ni requête de dossier.
- L'IA générative n'est jamais utilisée pour une prescription, un diagnostic, une modification de dose ou une estimation de risque. Toute information sur des symptômes nouveaux ou inquiétants doit être discutée avec un professionnel.

### MCP spécialisé

- `mcp-fibro-tools.mjs` fournit huit outils à arguments fermés : agents, fiches médicales, sujets scientifiques, bilan descriptif, préparation d'une consultation, planning quotidien et orientation de sécurité.
- La PWA utilise les mêmes outils pour son écran « agents spécialisés » ; ils tournent **localement**, une fois le coffre déverrouillé.
- `node mcp-server.mjs` démarre un **serveur MCP stdio facultatif** pour les clients compatibles. Il n'expose que les outils documentaires **publics** : aucune lecture du coffre, aucune donnée de symptômes, aucun agent patient privé. Le protocole MCP ne transforme pas les sept outils en sept modèles entraînés.
- Ce serveur est distinct de GitHub Pages et ne s'exécute pas de façon persistante dans la PWA Android/iOS.

### Mistral AI — option réseau

1. Ouvrir Assistant → **Mistral AI · moteur facultatif en ligne**. Saisir sa **propre clé API** : elle reste uniquement en mémoire de l'onglet et n'est pas sauvegardée dans le coffre, les réglages, une URL ou le dépôt.
2. Cliquer sur **Activer ma clé**, puis éventuellement **Tester Mistral** (requête publique d'arithmétique ; potentiellement facturée).
3. Cocher l'utilisation pour le dialogue général. Avant **chaque** question, FibroBot affiche le texte exact et demande une autorisation distincte d'envoi.
4. Seule la question générale acceptée est envoyée : **aucun historique de conversation, traitement ni observation patient**. Si Mistral échoue (CORS, 401, 402, 429, perte de connexion), le mode local/documentaire reste disponible.
5. Cliquer **Effacer la clé** pour la retirer de la mémoire du navigateur. Un navigateur compromis, une extension malveillante ou un appareil déverrouillé peuvent néanmoins exposer toute clé saisie dans une page. Ne pas partager de clés ni de dossiers médicaux.

**Important :** l'appel API navigateur direct peut être bloqué par les règles CORS de Mistral. Aucune passerelle distante de clés et aucun hébergement payant n'ont été ajoutés. Même si l'API répond, Mistral n'est pas un modèle médical validé, et son accès peut nécessiter un contrat ou un paiement. Les modèles WebLLM (par exemple Qwen, Gemma et autres modèles réellement répertoriés) restent une alternative locale suivant la mémoire et WebGPU.

### Qualité et limites

Des tests Node et navigateur couvrent le routage, les listes de fournisseurs, les références, le système MCP, Mistral simulé, les refus à risque, le coffre chiffré, la PWA hors ligne et les écrans tactiles émulés. **Aucun modèle multi-Go ni serveur Mistral réel n'est testé automatiquement** ; la compatibilité physique Android/iPhone, la précision clinique, la conformité réglementaire et l'utilité patient nécessitent une validation indépendante par des professionnels et des utilisateurs concernés. FibroBot reste un assistant de soutien et d'information, **pas un dispositif médical certifié**.

## Correction de panne Mistral 429 et dialogue permanent (28 octobre 2026)

Une erreur HTTP **429 Too Many Requests** peut signifier qu'une limite de requêtes, de tokens ou de dépenses de l'espace Mistral est atteinte. Ce n'est pas une erreur réparable par une répétition immédiate. Vérifier les plafonds depuis [Mistral — Usage et limites](https://docs.mistral.ai/admin/billing-usage/usage-limits) et le tableau de bord du compte. **Aucune clé API du patient n'est nécessaire pour les fiches médicales ou les agents locaux.**

- FibroBot ne boucle plus sur les erreurs 429. Il lit `Retry-After` lorsque cet en-tête est accessible au navigateur, impose un délai temporaire (15 secondes à 15 minutes) et refuse les appels répétés pendant ce délai. Ce délai **n'efface pas un plafond mensuel** ; réessayer au-delà peut encore renvoyer 429.
- L'appel Mistral est plafonné à 12 secondes et n'emporte ni conversation médicale, ni historique, ni dossier. Une erreur peut être due aux CORS, à la clé, aux limites ou au réseau. La réponse de secours apparaît sans attendre une nouvelle tentative distante.
- La réponse est maintenant **affichée avant sa sauvegarde** ; une erreur IndexedDB affiche un avertissement sans masquer la réponse. La zone de messages affiche immédiatement « FibroBot prépare sa réponse… » afin de distinguer un calcul lent d'un bouton sans effet.
- Le bouton **« Mode local immédiat (sans Mistral) »** dans l'Assistant désactive les requêtes réseau libres et les inférences génératives en cours, puis permet de répondre avec les fiches et outils locaux. L'annulation d'un calcul WebLLM peut nécessiter de recharger son moteur à nouveau ; le coffre n'est jamais effacé.
- Les générations WebLLM sont plafonnées dans cette version à 40 secondes pour ne pas bloquer indéfiniment l'interface, avec un message de secours si l'inférence échoue. Ce délai est un compromis mobile et peut être insuffisant pour certains modèles très lents.
- Si le coffre est verrouillé, la question n'est plus effacée silencieusement : un message demande de déverrouiller le stockage.
- Le service worker v14 renouvelle le cache de l'application. Après un déploiement, fermer puis rouvrir la PWA ; ne pas effacer les données du site ni son IndexedDB sans sauvegarde chiffrée.

Le correctif est validé avec tests API Mistral simulée 429, test du délai `Retry-After`, navigation Chrome/WebKit simulée et vérification du repli local. Il **ne peut pas lever les limites serveur du compte Mistral**, ni garantir le comportement d'un smartphone physique sans test sur cet appareil.

## Mistral intégré aux réponses de FibroBot — 29 octobre 2026

Lorsque **Mistral** est connecté et activé, il est prioritaire pour les questions de conversation générale. Il peut maintenant aussi :
- **expliquer les fiches médicales publiques préapprouvées** (fibromyalgie, sommeil, activités, etc.) : l'API ne reçoit que le titre et l'extrait de la fiche institutionnelle, **jamais le texte de la question personnelle** ; la fiche de référence reste affichée en regard de la reformulation ;
- proposer des **conseils génériques pour organiser les tâches** : aucun nom de tâche, score personnel d'énergie ni détail de santé n'est transmis ;
- rester facultatif pour toute requête, avec un **accord distinct avant chaque transmission**.

Le routage est décrit dans \`mistral-routing.mjs\` et l'appel distant protégé dans \`mistral-bridge.mjs\`. Les refus et urgences, informations personnelles, résultats du carnet, ordonnances, diagnostics, doses, consultations et données issues du coffre restent gérés par les agents et les fiches locales. Il ne s'agit pas d'une IA « autorisée à prescrire » ni d'un médecin virtuel certifié. Une maladie sans fiche vérifiée n'est pas improvisée par Mistral.

**Priorité et repli :** si Mistral est désactivé, FibroBot utilise les sources Internet autorisées, le moteur WebLLM local s'il fonctionne, ou sa bibliothèque. Le code respecte les erreurs API 429 et \`Retry-After\` sans boucler ni changer de modèle pour contourner une limite. Une API Mistral fonctionnelle nécessite une clé et peut être facturée ; les limites dépendent du compte et du modèle. La compatibilité CORS de la PWA et l'inférence Mistral réelle doivent être testées sur appareil physique.

**Confidentialité :** ne jamais saisir une clé API dans le chat ; seul le champ dédié est autorisé. La clé reste uniquement dans la mémoire du navigateur et les détails privés ne sont pas transférés automatiquement. L'accord par question indique exactement la catégorie de données envoyées.

## Protection renforcée de la clé API Mistral — coffre chiffré (29 octobre 2026)

**Comportement par défaut :** lorsque vous saisissez la clé Mistral, FibroBot efface immédiatement la zone de saisie et conserve la clé **uniquement en mémoire durant cette session**, sans la publier, l'ajouter à une URL, l'écrire dans les journaux ou l'enregistrer dans une base en clair.

**Sauvegarde volontaire :** si vous cochez **« Enregistrer aussi ma clé dans mon coffre personnel chiffré »** avant l'activation, `mistral-credential-vault.mjs` chiffre la clé par **AES-256-GCM avec un nonce aléatoire et un contexte d'authentification dédié**, puis conserve seulement l'objet chiffré dans la table `settings` du coffre patient. Le coffre principal est lui-même chiffré par AES-256-GCM avec une clé dérivée de votre phrase secrète (PBKDF2-SHA256). Les sauvegardes exportées du coffre contiennent cette **copie chiffrée**, jamais la clé en clair.

**Après fermeture ou verrouillage :** Mistral est déconnecté et le secret effacé de la mémoire de session autant que JavaScript le permet. À la prochaine ouverture, déverrouillez le coffre, puis cliquez sur **« Activer la clé de mon coffre »**. Le déchiffrement exige le coffre ouvert et un clic explicite ; aucune requête Mistral n'est déclenchée par le déchiffrement lui-même. L'utilisation pour une question reste séparément autorisée.

**Suppression :** « Déconnecter » efface seulement la clé de la mémoire de session. « Supprimer la clé du coffre » supprime la copie enregistrée et déconnecte le moteur. Cela ne supprime pas les **anciennes sauvegardes** du coffre et ne révoque pas la clé côté Mistral. Pour une clé exposée, révoquez-la depuis le compte Mistral, puis créez une nouvelle clé avec limites de budget et permissions adaptées.

**Limites importantes :** une API appelée directement depuis une PWA statique est utilisée dans le navigateur : le chiffrement au repos ne protège pas une clé lorsqu'elle est déchiffrée pour un appel réseau. Un navigateur, une extension ou un script tiers compromis peut l'intercepter. Une clé API ne devient véritablement secrète côté serveur qu'avec un **proxy/backend de confiance**, idéalement avec contrôle d'authentification et de débit. GitHub Pages seul ne peut pas offrir ce niveau d'isolation. Ne jamais commiter de clé API dans le dépôt et ne pas la transmettre dans le chat.

Tests : `tests/mistral-credential-vault.test.mjs` (chiffrement, restauration, suppression, détection des altérations, refus coffre verrouillé) et scénario navigateur E2E (aucune exposition en clair dans IndexedDB, restauration volontaire, retrait de la clé).

## Fiabilité de l'assistant et diagnostic autonome — octobre 2026

Dans **Assistant → Diagnostic du cerveau de FibroBot**, le bouton **Tester les réponses locales et les moteurs** réalise **quatre contrôles de réponse sans réseau, sans clé API ni dossier patient** : accueil, fiche fibromyalgie sourcée, refus de prescription et orientation d'urgence. Il expose séparément l'état du coffre, de la bibliothèque médicale, du modèle WebLLM, de Mistral (y compris la durée de limitation HTTP 429) et de la recherche Internet.

Les questions médicales documentées sont maintenant conservées **dans le texte de la fiche institutionnelle**, et ne sont plus automatiquement remplacées par une explication d'agent plus générale. Jusqu'à trois liens de référence issus des fiches locales approuvées sont affichés pour contrôle. Les questions de prescription ou d'urgence n'obtiennent pas de citations générées artificiellement.

Le diagnostic hors ligne **ne valide pas l'accès à Mistral, sa facturation, les quotas, la présence d'un modèle en VRAM, ni une efficacité médicale** : il vérifie le moteur local et affiche les états disponibles. Un test réel de Mistral nécessite toujours la clé de l'utilisateur, sa confirmation et le réseau. En cas de 429, le mécanisme de repli déjà publié reste actif.


## Intégrité des données et confidentialité — 29 octobre 2026

- Les scores d'observation vides, blancs ou booléens ne sont plus interprétés comme des notes **0/10**. Un véritable zéro explicitement saisi reste valide ; les notes absentes sont exclues des moyennes descriptives.
- Les synthèses ignorent les dates impossibles et les entrées incomplètes, sans modifier ni effacer le coffre chiffré existant. Les rendez-vous mal formés ne doivent plus bloquer la préparation d'une consultation.
- Les messages contenant des formulations courantes d'identité, de situation familiale ou de traitements personnels ne peuvent plus partir en conversation libre Mistral ni vers la recherche Internet publique. Il s'agit d'un **filtre de réduction du risque**, non d'une garantie de détection exhaustive des données personnelles.
- En l'absence d'un indicateur d'énergie, FibroBot évite d'afficher une valeur non renseignée comme si le patient l'avait saisie. Le classement pratique des tâches conserve sa valeur par défaut, à ajuster.
- La PWA passe au cache `fibrobot-shell-v18` pour distribuer les nouveaux modules. L'historique du patient reste séparé dans IndexedDB et ne doit pas être supprimé en actualisant la PWA.
- Tests de régression : `node --test tests/patient-data-privacy.test.mjs`. **Aucune validation clinique ni sur téléphone physique n'est déduite de ces tests unitaires.**
