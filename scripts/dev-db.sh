#!/usr/bin/env bash
# PostgreSQL local de développement : cluster dans .devstack/pg/pgdata, port 5433, utilisateur et base « moutar ».
# Usage : scripts/dev-db.sh start | stop | status
set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_DIR="$ROOT/.devstack/pg"
DATA="$PG_DIR/pgdata"
LOG="$PG_DIR/pg.log"
SOCK="$PG_DIR"
PORT=5433

mkdir -p "$PG_DIR"

# PostgreSQL refuse de tourner en root (conteneur de développement) : on se relance sous l'utilisateur « postgres ».
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  chown -R postgres:postgres "$PG_DIR"
  exec runuser -u postgres -- bash "${BASH_SOURCE[0]}" "$@"
fi

initialiser() {
  if [ -d "$DATA" ]; then return; fi
  echo "Initialisation du cluster dans $DATA…"
  "$PG_BIN/initdb" -D "$DATA" -U moutar --auth=trust --encoding=UTF8 --locale=C.UTF-8 >"$LOG" 2>&1
}

demarrer() {
  initialiser
  if "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
    echo "PostgreSQL est déjà démarré (port $PORT)."
  else
    "$PG_BIN/pg_ctl" -D "$DATA" -l "$LOG" -o "-p $PORT -k $SOCK -c listen_addresses=127.0.0.1" -w start
    echo "PostgreSQL démarré (port $PORT)."
  fi
  # La base « moutar » appartient à l'utilisateur « moutar ».
  if ! "$PG_BIN/psql" -h "$SOCK" -p "$PORT" -U moutar -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='moutar'" | grep -q 1; then
    "$PG_BIN/createdb" -h "$SOCK" -p "$PORT" -U moutar moutar
    echo "Base « moutar » créée."
  fi
  # Le rôle APPLICATIF de développement (`moutar_app`, mot de passe de dev `moutar_app` : l'API s'y connecte, DATABASE_URL
  # de .env.example) ; ses droits se posent par `pnpm db:droits` après `pnpm db:migrate` (apps/api/src/database/droits-application.ts).
  if ! "$PG_BIN/psql" -h "$SOCK" -p "$PORT" -U moutar -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='moutar_app'" | grep -q 1; then
    "$PG_BIN/psql" -h "$SOCK" -p "$PORT" -U moutar -d postgres -q -c "CREATE ROLE moutar_app WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'moutar_app'"
    echo "Rôle applicatif « moutar_app » créé (développement)."
  fi
}

case "${1:-start}" in
  start) demarrer ;;
  stop) "$PG_BIN/pg_ctl" -D "$DATA" -w stop ; echo "PostgreSQL arrêté." ;;
  status) "$PG_BIN/pg_ctl" -D "$DATA" status ;;
  *) echo "Usage : $0 start | stop | status" >&2 ; exit 1 ;;
esac
