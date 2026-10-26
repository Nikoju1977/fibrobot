# Runners natifs Gemma 4 E2B / E4B — prototypes

Ces fichiers sont des exemples d'adaptateurs, **pas des applications compilées ni validées**.
- iOS : integrer la dépendance SPM LiteRTLM puis un .litertlm local vérifié.
- Android : intégrer LiteRT-LM Gradle, les bibliothèques natives du GPU et un .litertlm local vérifié.
- Une application distribuable nécessitera la gestion sécurisée des modèles, les autorisations et le routage strict des demandes médicales.
- Les modèles E2B (env. 2,58 Go) et E4B (env. 3,65 Go) ne sont pas inclus dans ce dépôt.
- Aucun test Swift/Kotlin, de chargement E4B ni essai iPhone/Android réels n'a été exécuté.
- L'API navigateur actuelle ne charge qu'E2B. Ces runners ne sont pas liés à la PWA.

Références :
https://developers.google.com/edge/litert-lm/swift
https://developers.google.com/edge/litert-lm/android
https://developers.google.com/edge/litert-lm/models/gemma-4
