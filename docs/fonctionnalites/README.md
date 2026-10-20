# Fiches par sujet

| Fiche | Sujet | État |
|---|---|---|
| `maquette.md` | Écrans de la maquette (lot 0) | maquette faite, GO visuel attendu |
| `lot-1-produit-et-composition.md` | Code-barres, Open Food Facts, analyse des additifs, carte produit (lot 1) | codé, smoke-testé en conteneur (OFF injoignable), commité |
| `console-admin.md` | Connexion, garde, journal, surcharge des additifs | socle codé au lot 1, relu le 20/10/2026, commité ; BLOQUANT avant mise en ligne : rôle applicatif PostgreSQL distinct |
| `lot-2-listes-officielles.md` | Listes Consistoire et Rav Wolff : import à la console, analyseurs, niveau 2 de la carte, recherche par nom ou marque (lot 2) | serveur codé et smoke-testé le 20/10/2026 sur des échantillons FICTIFS, non commité ; écran en parallèle ; vrais PDF à importer depuis le Mac |

Restes connus et échéances : la liste du Rav Wolff 2026 est valable jusqu'au 01/11/2026 (passé ce jour, la carte dit « périmé », jamais « permis » : importer l'édition suivante à la console) ; la liste du Consistoire est l'édition 2025-2026 (juillet 2025). Les vrais PDF des listes restent à importer depuis le Mac, et les heuristiques des analyseurs à régler sur eux (`lot-2-listes-officielles.md`). Les lignes du catalogue d'additifs (leur nombre se lit dans `packages/shared-types/src/catalogues/additifs.ts`) sont « à confirmer par la liste de référence » : à valider ligne par ligne depuis la console.
