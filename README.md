# FibroBot V32 — compagnon de vie spécialisé dans la fibromyalgie

**[Ouvrir FibroBot](https://nikoju1977.github.io/fibrobot/)**

FibroBot est une PWA expérimentale pour un seul patient : coffre-fort chiffré, journal des symptômes, énergie, tâches, rendez-vous, médicaments déclarés et informations médicales sourcées. Conception : Studio Niko Design.

**Version active : V32.** Documentation : [V32.md](V32.md), [VALIDATION.md](VALIDATION.md), [SECURITY.md](SECURITY.md). Les anciens guides de version V27 à V31 sont retirés de la branche principale ; ils restent accessibles dans l'historique Git.

## Démarrage

1. Ouvrir l'application en HTTPS sur Android, iOS ou ordinateur, puis créer ou déverrouiller le coffre avec une phrase secrète.
2. Dans Assistant, saisir sa clé Agnes AI puis tester la connexion. Il est possible de la conserver chiffrée dans le coffre. Aucun modèle conversationnel local à télécharger.
3. Poser sa question. Les règles de sécurité et fiches médicales intégrées priment pour les sujets de santé.
4. Pour les données météo et qualité de l'air, renseigner une ville et autoriser les flux publics actualisés.

Agnes demande un accès API valide et Internet. L'API peut être payante, limitée ou bloquée par les restrictions CORS du navigateur. Les tests automatisés emploient des réponses simulées et ne valident pas un compte Agnes réel.

## Fonctionnalités V32

- Assistant conversationnel Agnes : réponses générales, avec contrôle des données transmises. Les données de santé personnelles ne sont pas envoyées automatiquement.
- Huit espaces thématiques d'information sur la fibromyalgie : douleur, médicaments, ergonomie, suivi, orientation, soutien émotionnel, nutrition et vie sociale / travail. Ce ne sont pas des professionnels de santé.
- Sources publiques à la demande : Open-Meteo pour météo et air, Nager.Date pour jours fériés, Wikipédia, GitHub et bibliothèques scientifiques.
- Suivi local chiffré : symptômes, fatigue, sommeil, énergie, médicaments et tâches déclarés, recherche privée, tendances descriptives.
- Saisie rapide (« douleur 7 fatigue 8 »), respiration guidée facultative, ambiances sonores, lecture et voix selon les capacités du navigateur.
- PWA partiellement utilisable hors ligne : les API et prévisions actuelles exigent Internet.

Les flux ne sont pas suivis en continu lorsque l'application est fermée. Les rappels au premier plan ne sont pas des alarmes Android/iOS garanties. Utiliser une alarme système pour les médicaments importants.

## Confidentialité et limites

Les observations privées sont stockées dans le coffre chiffré sur l'appareil. Conservez votre phrase secrète et protégez vos sauvegardes. La clé Agnes peut être stockée chiffrée à votre demande. Les scripts ou extensions d'un appareil compromis peuvent toujours exposer une clé API en cours d'utilisation ; limitez ses permissions et son budget.

FibroBot n'est pas un dispositif médical. Il ne pose pas de diagnostic et ne prescrit ni ne modifie les traitements. En cas d'urgence en France : 15 ou 112 ; prévention du suicide : 3114.

## Qualité technique

L'application emploie HTML, CSS et des modules JavaScript. GitHub Actions exécute des tests métier, contrôles statiques et parcours de navigateur Chromium / WebKit sur formats mobiles émulés. Une émulation ne remplace pas des essais réels sur téléphone. Voir [VALIDATION.md](VALIDATION.md).

Le nettoyage des anciennes branches PR conserve la branche principale, les PR historiques et les commits fusionnés. Les branches encore associées à une pull request ouverte sont protégées par le script de maintenance.
