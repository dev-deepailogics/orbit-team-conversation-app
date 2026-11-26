#!/bin/sh
# Runs as root only long enough to make the uploads volume writable by the unprivileged app user, then drops privileges.
# Existing volumes created by older (root) images are fixed automatically on first start.
set -e

if [ "$(id -u)" = "0" ]; then
  UPLOADS="${UPLOAD_DIR:-/data/uploads}"
  mkdir -p "$UPLOADS"
  if [ "$(stat -c %u "$UPLOADS")" != "$(id -u node)" ]; then
    chown -R node:node "$UPLOADS"
  fi
  exec su-exec node "$@"
fi

exec "$@"
