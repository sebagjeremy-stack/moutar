# Lot 4 — Dictée (secours par le moteur), historique local, partage

Deux sections : le serveur (ci-dessous, 20/10/2026) et l'écran (`apps/web`, par l'autre développeur, à compléter ici).

## Serveur — transcription de secours (`POST /api/v1/transcriptions`)
- **Principe** : la dictée se fait d'abord dans le navigateur (Web Speech API, cadrage § 3). Quand elle fait défaut (Firefox, iOS sans reconnaissance, bruit), l'écran enregistre (`MediaRecorder`) et envoie l'audio à cette route ; le texte rendu est RELU par l'utilisateur avant la recherche. **Rien n'est enregistré** : ni l'audio (jamais écrit sur disque ni en base), ni le texte ; le journal `journal_ia` reçoit une ligne `transcription` (fournisseur, modèle, durée, réussite, code d'erreur), sans contenu.
- **Route** : multipart, champ `audio` ; **5 Mo au plus** (multer, 413 `fichier_trop_grand`) ; type lu dans les **octets** (`common/validation/type-audio.ts` : WebM/EBML `1A 45 DF A3`, Ogg `OggS`, WAV `RIFF…WAVE`, MP4/M4A `ftyp` ; MP3, AAC nu, image, texte → 415 `type_audio_refuse`) ; absent → 400 `audio_absent` ; **30 s au plus QUAND la durée se lit** dans le conteneur (`dureeAudioSecondes` : WAV par l'en-tête, MP4 par `mvhd`, Ogg Opus par la position de granule de la dernière page, WebM par l'élément `Duration` s'il est écrit — `MediaRecorder` ne l'écrit pas toujours : la taille borne alors seule ; au-delà → 400 `audio_trop_long` avec `dureeSecondes`). Le nom de fichier transmis au moteur est le nôtre (`dictee.<ext>`), jamais celui du navigateur. Répond **200**.
- **Moteur** : `MoteurIa.transcrire` (lot 3) → OVH `audio/transcriptions`, modèle `IA_MODELE_AUDIO` (`whisper-large-v3-turbo`), **langue forcée `fr`** (à valider), `response_format: verbose_json` (vérifié sur OVH le 20/10/2026 : rend `language`, `duration`, `segments[].avg_logprob`, `no_speech_prob`) ; `confiance` = exp(moyenne des `avg_logprob`), bornée 0-1, null sans segment ; délai 30 s, une relance sur 5xx/réseau (lot 3). **Claude (`IA_FOURNISSEUR=anthropic`) → 501 `non_supporte`** : la dictée de secours demande le fournisseur OVH. Moteur non réglé → 503 `moteur_non_configure`.
- **Limite** : la même que les lectures d'image, **30 par 10 minutes et par adresse** (`LimiteLectures`, 429 `trop_de_lectures`) ; un fichier refusé ne compte pas.
- **Ce qui part au moteur** : l'audio, le modèle, la langue, le format — rien d'autre (ni EAN, ni produit, ni identité).

### Contrat pour le web
`POST /api/v1/transcriptions`, multipart `audio` (WebM, Ogg, WAV, MP4 ; 5 Mo ; 30 s) → 200 `TranscriptionAudio` (`@moutar/shared-types`) :
```json
{ "texte": "Galettes Saint-Michel au beurre", "langue": "fr", "confiance": 0.82 }
```
Erreurs `{ code, message }` : 400 `audio_absent` / `audio_trop_long` (+ `dureeSecondes`), 413 `fichier_trop_grand`, 415 `type_audio_refuse`, 429 `trop_de_lectures` / `moteur_sature`, 501 `non_supporte`, 502 `reponse_illisible`, 503 `moteur_non_configure` / `moteur_indisponible`. Compter 0,5 à 2 s. L'écran met `texte` dans le champ de recherche, modifiable, et ne lance la recherche qu'après relecture. **Whisper invente un texte sur du silence** (voir ci-dessous) : un `texte` court et sans rapport (« … », « Sous-titrage … », « Merci ») se traite comme vide — à l'écran, ne rien chercher automatiquement.

### Ce qui marche (smoke-tests RÉELS du 20/10/2026, en conteneur, OVH `whisper-large-v3-turbo`)
- **Pas de parole disponible** : le TTS d'OVH (`nvr-tts-en-us`) n'est pas joignable depuis le conteneur (son hôte `nvr-tts-en-us.endpoints.kepler.ai.cloud.ovh.net` est refusé par le mandataire ; l'hôte compatible OpenAI ne sert pas `/v1/audio/speech` : 404 « unknown endpoint »). Les essais se font donc sur des WAV générés en Node (`.devstack`/scratchpad : silence 1 s, bip 440 Hz 2 s, silence 40 s) ; **un essai avec une vraie dictée reste à faire sur le Mac** (téléphone → écran → route).
- Silence de 1 s (WAV 16 kHz) → **200** `{ "texte": "Sous-titrage MFP.", "langue": "fr", "confiance": 0.5 }` en 0,9 s — l'hallucination classique de Whisper sur du silence (en direct sur OVH : `no_speech_prob: 0.0`, un segment de 0 à 29,98 s). Bip de 2 s → `{ "texte": "...", "langue": "fr", "confiance": 0.42 }` en 0,5 s. D'où la consigne à l'écran ci-dessus.
- WAV de 40 s → 400 `audio_trop_long` (`dureeSecondes: 40`) sans appel au moteur ; faux MP3 → 415 ; sans fichier → 400 `audio_absent` ; 6 Mo → 413 `fichier_trop_grand` (le message cite désormais « 5 Mo pour un enregistrement »).
- `journal_ia` : deux lignes `transcription` (`ovh`, `whisper-large-v3-turbo`, 874 ms et 455 ms, `ok`), sans contenu.
- Tests : type audio 7 (nombres magiques des quatre conteneurs, refus, durées WAV/MP4/Ogg/WebM), audio reçu 4, OVH `transcrire` 2 (multipart `verbose_json`, confiance, réponse sans texte), service 4 (HTTP simulé, 5xx relancé, **501 Anthropic**, non configuré) ; les tests de l'API ne touchent jamais le réseau.

### À valider
1. Langue forcée au français (Whisper transcrit mieux ; un nom hébreu ou anglais dans une phrase française passe) — ou détection automatique (`language` omis).
2. 5 Mo et 30 s ; la durée ne se vérifie que si le conteneur la dit (WebM de `MediaRecorder` : souvent non — la taille borne seule).
3. La même limite que les photos (30 / 10 min / adresse), plutôt qu'une limite à part.
4. Le 501 chez Claude : la dictée de secours est absente quand `IA_FOURNISSEUR=anthropic` (l'écran garde la Web Speech API).

## Écran (historique local, partage, dictée) — section à compléter par le développeur web
