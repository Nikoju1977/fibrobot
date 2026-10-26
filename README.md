# FibroBot — assistant de vie local

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

Le moteur actuel est **déterministe et vérifiable**. Ce n'est PAS un grand modèle d'IA générative open source, ni une encyclopédie exhaustive des traitements. Les réponses de santé sont sélectionnées parmi des fiches pré-rédigées et liées à des sources. Une question sans réponse autorisée déclenche un refus explicite. Les autres maladies sont enregistrées mais ne donnent pas lieu à des traitements déduits automatiquement.

Un modèle génératif sur l'appareil nécessiterait un téléchargement initial, une mémoire et une puissance variables et une validation de sécurité ; il n'est pas implémenté dans cette version. Aucun modèle ne peut garantir zéro hallucination.

## Voix et météo : limitations

La lecture vocale n'est proposée que lorsque le navigateur expose une voix française marquée comme locale. La dictée intégrée est refusée si le navigateur n'expose pas explicitement un mode de reconnaissance local. La dictée proposée par le clavier du système relève des réglages de confidentialité de ce dernier.

La météo nécessite des données extérieures actualisées. Elle est volontairement indisponible en mode strictement local. L'heure et la date proviennent de l'appareil.

## Rappels : limitations impératives

Un seul horaire de rappel quotidien est disponible par traitement déclaré. FibroBot vérifie les rappels pendant qu'il est ouvert et affiche les rappels passés à sa réouverture. **Il ne garantit aucune notification quand l'application est fermée**, notamment sur iOS. Utilisez une alarme système pour toute prise importante.

## Traitements et soins complémentaires

Les doses et les fréquences sont recopiées par la personne et jamais vérifiées par FibroBot. Aucune vérification automatisée des interactions, contre-indications, allergies ou ajustements de prescription. Faites réviser la liste par votre médecin ou pharmacien. Méditation et hypnose : pratiques facultatives, preuves souvent limitées, jamais une substitution aux soins.

## Confidentialité

Données stockées dans IndexedDB, non chiffrées par FibroBot. Aucun script ni service d'IA tiers utilisé. Les fichiers JSON exportés et les rapports imprimables contiennent des informations de santé en clair. Protégez-les. Le navigateur contacte l'hébergeur au premier chargement et lors des mises à jour. Les liens médicaux externes ne sont ouverts que par action volontaire.

Les anciens objets IndexedDB restent présents après migration ; la sauvegarde et l'effacement incluent aussi les données historiques de la version antérieure.

## Utilisation et validation

Servir les fichiers par un serveur statique HTTP(S), par exemple avec python3 -m http.server 8000. Les tests automatisés utilisent node --test tests/*.test.mjs. Les modules ne sont pas garantis en ouvrant directement index.html en mode fichier.

Avant un usage patient en production : revue clinique externe, audit de sécurité et d'accessibilité, tests sur iOS/Android/tablettes, validation des données scientifiques, analyse RGPD et éventuel statut de dispositif médical.

## Sources

- HAS : https://www.has-sante.fr/jcms/p_3634512/fr/fibromyalgie-de-l-adulte-conduite-diagnostique-et-strategie-therapeutique
- HAS pour le public : https://www.has-sante.fr/jcms/p_3686005/fr/fibromyalgie-comprendre-la-maladie-pour-mieux-vivre-avec-ses-symptomes
- NCCIH : https://www.nccih.nih.gov/health/fibromyalgia-in-depth
- Médicaments : https://base-donnees-publique.medicaments.gouv.fr/

Urgences en France : 15 ou 112 ; crise suicidaire : 3114.

Studio Niko Design.