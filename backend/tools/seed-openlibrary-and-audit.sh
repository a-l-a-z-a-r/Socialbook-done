#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "MONGODB_URI is required"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export COVER_MIN_BYTES="${COVER_MIN_BYTES:-2048}"
export COVER_MIN_DIMENSION="${COVER_MIN_DIMENSION:-2}"
export COVER_PROBE_BYTES="${COVER_PROBE_BYTES:-16384}"
export COVER_TIMEOUT_MS="${COVER_TIMEOUT_MS:-5000}"
export COVER_AUDIT_CONCURRENCY="${COVER_AUDIT_CONCURRENCY:-5}"

echo "Seeding reviews from Open Library into ${MONGODB_URI}..."
node "${ROOT_DIR}/scripts/seed-openlibrary.js"

echo "Auditing seeded cover URLs and deleting invalid entries..."
export COVER_AUDIT_DELETE=true
node "${ROOT_DIR}/backend/tools/cover-audit.js"

echo "Seed and cover audit completed."
