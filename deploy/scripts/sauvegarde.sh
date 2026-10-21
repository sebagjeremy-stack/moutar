#!/usr/bin/env bash
# Sauvegarde de la base SUR LE SERVEUR : un dump PostgreSQL (format « custom », compressé) dans ${MOUTAR_DIR}/sauvegardes,
# 14 jours de rotation. À poser en cron (deploy/README.md) ; deployer.sh l'appelle aussi avant chaque mise en ligne.
#
#   15 3 * * * MOUTAR_DIR=/srv/moutar bash /srv/moutar/app/deploy/scripts/sauvegarde.sh >> /srv/moutar/sauvegarde.log 2>&1
#
# `--no-acl --no-owner` : les GRANT du rôle applicatif `moutar_app` ne sont pas dans le dump ; ils se recréent par
# `db:droits` (service `migrate`) après une restauration. Aucune donnée personnelle dans cette base (cadrage § 8) : le
# dump n'est pas chiffré ; le dossier est en mode 700. Copier une sauvegarde HORS du serveur reste à décider (README).
set -euo pipefail
DIR="${MOUTAR_DIR:-/srv/moutar}"
DEST="${DIR}/sauvegardes"
RETENTION_JOURS="${MOUTAR_RETENTION_JOURS:-14}"
HORODATAGE=$(date +%Y%m%d-%H%M)
FICHIER="${DEST}/moutar-${HORODATAGE}.dump"
umask 077
mkdir -p "$DEST"
cd "${DIR}/app/deploy"

# Une sauvegarde à la fois (cron et mise en ligne) : le verrou tombe avec le processus.
exec 9> "${DIR}/sauvegarde.verrou"
if ! flock -w 600 9; then
  echo "une autre sauvegarde tourne depuis plus de 10 minutes : celle-ci n'a pas eu lieu" >&2
  exit 1
fi

# Un dump qui échoue en route (base arrêtée, disque plein) ne laisse pas de fichier tronqué.
trap 'rm -f "$FICHIER"; echo "✗ sauvegarde échouée (ligne $LINENO)" >&2' ERR

MOUTAR_DIR="$DIR" docker compose --env-file "${DIR}/.env.prod" exec -T db \
  pg_dump -U moutar -d moutar --format=custom --compress=6 --no-acl --no-owner > "$FICHIER"
if [ ! -s "$FICHIER" ]; then
  echo "✗ dump vide : rien n'a été gardé" >&2
  rm -f "$FICHIER"
  exit 1
fi
# Le fichier se relit (en-tête et table des matières) avant d'être compté comme une sauvegarde.
docker compose --env-file "${DIR}/.env.prod" exec -T db pg_restore --list /dev/stdin < "$FICHIER" > /dev/null

# Rotation : les dumps de plus de RETENTION_JOURS jours s'effacent (jamais le dernier).
find "$DEST" -name 'moutar-*.dump' -type f -mtime "+${RETENTION_JOURS}" ! -newer "$FICHIER" -delete
echo "sauvegarde : ${FICHIER} ($(du -h "$FICHIER" | cut -f1)) ; $(find "$DEST" -name 'moutar-*.dump' -type f | wc -l) dump(s) conservé(s)"
