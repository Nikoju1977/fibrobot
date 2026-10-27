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
