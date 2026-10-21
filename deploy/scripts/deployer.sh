#!/usr/bin/env bash
# Déploie (ou redéploie) Moutar sur le serveur, depuis un poste : copie du code (sans node_modules ni secrets), contrôle
# du compose, sauvegarde de la base, construction des images, démarrage (migrations + droits, puis l'API, puis Caddy),
# vérification de santé. Idempotent : se relance tel quel pour une mise à jour.
#
#   bash deploy/scripts/deployer.sh <hôte>            (hôte = IP ou nom DNS du VPS)
#
# Variables (toutes facultatives) : MOUTAR_SSH_UTILISATEUR (root), MOUTAR_DIR (/srv/moutar, sur le serveur),
# MOUTAR_CLE_SSH (clé privée ; sinon l'agent SSH), SANS_SAUVEGARDE=1 (passe la sauvegarde préalable).
set -euo pipefail
HOTE="${1:?hôte manquant (IP ou nom DNS du serveur)}"
UTILISATEUR="${MOUTAR_SSH_UTILISATEUR:-root}"
DIR="${MOUTAR_DIR:-/srv/moutar}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPTS_SSH=(-o StrictHostKeyChecking=accept-new -o ControlMaster=auto -o "ControlPath=$HOME/.ssh/cm-moutar-%h" -o ControlPersist=300)
if [ -n "${MOUTAR_CLE_SSH:-}" ]; then OPTS_SSH+=(-i "$MOUTAR_CLE_SSH" -o IdentitiesOnly=yes); fi
SSH=(ssh "${OPTS_SSH[@]}" "${UTILISATEUR}@${HOTE}")
COMPOSE="cd ${DIR}/app/deploy && MOUTAR_DIR=${DIR} docker compose --env-file ${DIR}/.env.prod"

log() { printf '\033[1;34m▸\033[0m %s\n' "$*"; }

# La version exacte voyage avec le code ; on prévient si elle n'est pas committée.
VERSION=$(cd "$RACINE" && git describe --always --dirty 2>/dev/null || echo inconnue)
if [ -n "$(cd "$RACINE" && git status --porcelain --untracked-files=no)" ]; then
  echo "⚠ modifications non committées déployées (version ${VERSION})." >&2
fi

log "Copie du code vers ${UTILISATEUR}@${HOTE}:${DIR}/app (version ${VERSION})"
"${SSH[@]}" "mkdir -p ${DIR}/app ${DIR}/sauvegardes && chmod 700 ${DIR}"
rsync -az --delete -e "ssh ${OPTS_SSH[*]}" \
  --exclude node_modules --exclude .git --exclude .devstack --exclude dist \
  --exclude '.env' --exclude '.env.*' --exclude '*.log' --exclude '.DS_Store' --exclude mockups \
  "$RACINE/" "${UTILISATEUR}@${HOTE}:${DIR}/app/"
"${SSH[@]}" "printf '%s\n' '${VERSION}' > ${DIR}/app/VERSION"

# Les secrets vivent HORS du code, dans ${DIR}/.env.prod (deploy/env.prod.example) : sans lui, rien n'est démarré.
if ! "${SSH[@]}" "test -f ${DIR}/.env.prod"; then
  echo "✗ ${DIR}/.env.prod absent sur le serveur : copier deploy/env.prod.example, le remplir (DOMAINE, ACME_EMAIL, POSTGRES_PASSWORD, IA_API_KEY…), chmod 600, puis relancer." >&2
  exit 1
fi
# Le mot de passe du rôle applicatif `moutar_app` : tiré SUR LE SERVEUR, ajouté à .env.prod s'il y manque, jamais affiché ;
# le service `migrate` crée le rôle avec (db:droits). AVANT tout `docker compose` : le compose exige la variable.
"${SSH[@]}" "ENV=${DIR}/.env.prod; chmod 600 \"\$ENV\"; if ! grep -q '^MOUTAR_APP_PASSWORD=.\+' \"\$ENV\"; then sed -i '/^MOUTAR_APP_PASSWORD=\$/d' \"\$ENV\"; (umask 077; printf 'MOUTAR_APP_PASSWORD=%s\n' \"\$(openssl rand -hex 24)\" >> \"\$ENV\"); echo 'MOUTAR_APP_PASSWORD ajouté à '\"\$ENV\"' (rôle applicatif moutar_app)'; fi"

# Le fichier compose doit se lire AVANT de s'en servir : un refus (variable manquante, YAML cassé) est un échec visible.
log "Contrôle du fichier compose"
"${SSH[@]}" "${COMPOSE} config -q" \
  || { echo "✗ docker compose refuse deploy/docker-compose.yml avec ${DIR}/.env.prod : rien n'a été démarré." >&2; exit 1; }

# Une sauvegarde fraîche AVANT les migrations (au premier déploiement, la base n'existe pas : rien à sauvegarder).
if [ "${SANS_SAUVEGARDE:-}" != "1" ]; then
  log "Sauvegarde avant les migrations"
  "${SSH[@]}" "if [ -n \"\$(${COMPOSE} ps -q --status running db)\" ]; then MOUTAR_DIR=${DIR} bash ${DIR}/app/deploy/scripts/sauvegarde.sh; else echo 'base pas encore démarrée : pas de sauvegarde préalable'; fi"
fi

log "Construction des images (les précédentes gardées sous l'étiquette « precedente » : retour arrière sans rebuild)"
"${SSH[@]}" "(docker tag moutar-api:latest moutar-api:precedente 2>/dev/null || true) && (docker tag moutar-web:latest moutar-web:precedente 2>/dev/null || true) && ${COMPOSE} build --pull"

log "Démarrage (migrations et droits d'abord, dans leur conteneur, puis l'API, puis Caddy)"
if ! "${SSH[@]}" "${COMPOSE} up -d --remove-orphans"; then
  echo "✗ le démarrage a échoué ; état des services (les journaux : en SSH, docker compose logs <service>) :" >&2
  "${SSH[@]}" "${COMPOSE} ps -a" >&2 || true
  exit 1
fi
"${SSH[@]}" "docker image prune -f >/dev/null" || echo "⚠ le nettoyage des images a échoué : sans effet sur la mise en ligne" >&2

DOMAINE=$("${SSH[@]}" "grep '^DOMAINE=' ${DIR}/.env.prod | cut -d= -f2 | tr -d '[:space:]'")
IP=$("${SSH[@]}" "curl -4 -fsS --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")
log "Attente de l'API derrière https://${DOMAINE} (serveur ${IP})"
for i in $(seq 1 30); do
  # --resolve : le contrôle ne dépend pas du DNS du poste (ni d'un enregistrement pas encore propagé).
  if curl -fsS --max-time 5 --resolve "${DOMAINE}:443:${IP}" "https://${DOMAINE}/api/v1/health" >/dev/null 2>&1; then
    echo "santé : $(curl -fsS --max-time 5 --resolve "${DOMAINE}:443:${IP}" "https://${DOMAINE}/api/v1/health")"
    break
  fi
  if [ "$i" = 30 ]; then
    echo "✗ l'API ne répond pas derrière https://${DOMAINE} ; état des services :" >&2
    "${SSH[@]}" "${COMPOSE} ps -a" >&2 || true
    exit 1
  fi
  sleep 5
done

mkdir -p "$RACINE/.devstack" && printf '%s\n%s\n' "$VERSION" "$(date -Iseconds)" > "$RACINE/.devstack/VERSION-deployee"
log "Déployé : https://${DOMAINE} (version ${VERSION})"
"${SSH[@]}" "docker builder prune -af >/dev/null 2>&1 || true; echo \"disque : \$(df -h ${DIR} | tail -1 | awk '{print \$5\" occupés, \"\$4\" libres\"}')\"" || true
