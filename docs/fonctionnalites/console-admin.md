# Console d'administration (`/admin`)

Socle posé au lot 1 (20/10/2026). Un seul compte, celui du médecin-utilisateur ; aucune donnée personnelle d'utilisateur n'y transite.

## Décisions
- **Connexion par e-mail + mot de passe** (`POST /api/v1/admin/connexion`) : hash **bcrypt coût 12** (`bcryptjs`, pur JavaScript, aucun binaire) ; réponse identique que le compte existe ou non (401 `identifiants_invalides`, comparaison contre un hash leurre) ; **10 essais par quart d'heure, par e-mail ET par adresse** (`common/auth/limite-de-debit.ts`, en mémoire : 429 `trop_de_demandes`).
- **Session** : jeton aléatoire de 32 octets, gardé **haché** (SHA-256) dans `session_admin`, 12 h, révocable ; cookie `moutar_admin` HttpOnly, SameSite=Lax, Secure hors développement.
- **Garde** `AdminGuard` sur tout `/api/v1/admin/*` sauf la connexion : session **relue en base à chaque requête** (vivante, non expirée, compte actif) ; sans cookie 401 (l'écran renvoie à la connexion), cookie présent mais session morte 403 explicite.
- **Journal** `journal_admin` en ajout seul : chaque connexion, déconnexion et surcharge d'additif y écrit une ligne ; **la protection est par déclencheur** : `BEFORE UPDATE OR DELETE … FOR EACH ROW` (migration `0000_initial`) et `BEFORE TRUNCATE … FOR EACH STATEMENT` (migration `0001_journal_truncate`, 20/10/2026) lèvent une exception. **En développement, le rôle `moutar` est superutilisateur** (propriétaire du cluster) : un superutilisateur pourrait retirer les déclencheurs ; la protection ne vaut donc que contre le code et les erreurs, pas contre un rôle qui a tous les droits. `DELETE /admin/journal` répond 405 pour le dire.
- **Connexion refusée** (relecture du 20/10/2026) : un mauvais mot de passe (ou un compte inconnu) écrit `connexion.refusee` au journal, `compte_id` null, `detail: { email, ip }` avec l'e-mail TRONQUÉ (trois premiers caractères + `…@` + domaine : jamais l'adresse entière d'un essai refusé) ; la réponse reste identique que le compte existe ou non. Une connexion RÉUSSIE remet à zéro les compteurs de la limite de débit (e-mail et adresse). `POST /admin/deconnexion` répond 200 (`@HttpCode(200)`).
- **Aucune clé de session** : `SESSION_SECRET` est retiré du schéma d'environnement (20/10/2026) ; le jeton du cookie est aléatoire (32 octets) et seul son haché est en base, rien n'est signé.
- **En-têtes** : `helmet` sur l'API (réglages par défaut ; CSP stricte en production — `default-src 'self'`, images depuis `images.openfoodfacts.org` et `static.openfoodfacts.org` seulement, `connect-src 'self'` — ; pas de CSP en développement, où Vite sert l'écran), `Referrer-Policy: no-referrer`. Filtre d'erreurs : corps de plus de 100 Ko → 413 `corps_trop_grand`, JSON illisible → 400 `requete_invalide`.
- **Compte initial** : `pnpm db:seed-admin` lit `ADMIN_EMAIL_INITIAL` et imprime UNE fois un mot de passe aléatoire (24 caractères) — jamais dans un fichier ; aucun mot de passe de développement n'est documenté.
- **Pages** : Additifs (catalogue en code fusionné aux surcharges ; statut, source obligatoire, note ; filtre), Produits (50 derniers lus), Journal (200 dernières lignes). Mêmes jetons que l'application, largeur 1100 px tolérée.

## Reste
- **BLOQUANT avant mise en ligne : un rôle applicatif PostgreSQL distinct, non superutilisateur, sans droit UPDATE/DELETE/TRUNCATE sur les journaux** (l'API s'y connecte ; les migrations gardent le propriétaire). Tant qu'il n'existe pas, l'ajout seul du journal ne tient que par les déclencheurs.
- Changer son mot de passe depuis la console ; plusieurs comptes (modérateurs du lot 5).
- Désactivation d'un certificateur (`certificateur_surcharge`, lot 3) ; validation des contributions (lot 5).
- Limite de débit en mémoire : suffisante pour une instance ; à revoir si plusieurs.
