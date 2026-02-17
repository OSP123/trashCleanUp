#!/bin/sh
set -e

# Fly volumes are mounted as root (uid 0, chmod 0755).
# The postgres user can't create subdirectories in a root-owned dir.
# Create PGDATA and hand ownership to postgres before the official
# entrypoint runs initdb (which expects PGDATA to already exist).
mkdir -p "$PGDATA"
chown postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

exec docker-entrypoint.sh "$@"
