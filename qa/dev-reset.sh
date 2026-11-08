#!/usr/bin/env bash
# Fresh local stack for manual testing / E2E: new database, empty mail file, dev server on :8788
set -e
cd "$(dirname "$0")/.."
pkill -f "qa/dev-server.mjs" 2>/dev/null || true
sleep 0.5
PGURL=${PG_ADMIN_URL:-postgres://oss@127.0.0.1:5433/postgres}
psql "$PGURL" -qc "drop database if exists oss_dev" -c "create database oss_dev" >/dev/null
rm -f /tmp/oss-mail.jsonl
DATABASE_URL=${DATABASE_URL:-postgres://oss@127.0.0.1:5433/oss_dev} AUTH_SECRET=dev-secret-dev-secret-dev-secret-0001 MAIL_PROVIDER=file MAIL_FILE=/tmp/oss-mail.jsonl ADMIN_BOOTSTRAP_EMAILS=admin@example.org nohup node qa/dev-server.mjs 8788 > /tmp/dev.log 2>&1 &
sleep 2
curl -sf http://127.0.0.1:8788/api/health && echo
