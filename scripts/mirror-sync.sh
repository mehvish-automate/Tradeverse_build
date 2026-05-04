#!/usr/bin/env bash
# scripts/mirror-sync.sh
#
# Refresh a local mirror of the repo and create a snapshot commit there.
# Run this after every `git push` so the mirror tracks remote-pushed
# state. The mirror is its own independent git repo — useful for
# offline browsing, diffing snapshots, or restoring lost changes.
#
# Usage:
#   bash scripts/mirror-sync.sh                # default path
#   bash scripts/mirror-sync.sh /custom/path   # override
#   TRADEVERSE_MIRROR=/custom/path bash scripts/mirror-sync.sh
#
# What it does:
#   1. Initializes <mirror>/ as a git repo on first run.
#   2. Wipes the mirror's working tree (preserving its .git/).
#   3. Extracts current HEAD via `git archive` so only tracked files
#      land in the mirror — node_modules, .next, .env.local etc. stay
#      out automatically.
#   4. Commits with message "snapshot @ <sha>: <source HEAD message>".
#   5. No-op if the mirror is already at this snapshot.

set -euo pipefail

SRC="$(git rev-parse --show-toplevel)"
DEST="${1:-${TRADEVERSE_MIRROR:-$HOME/Tradeverse_build_mirror}}"

if [ ! -d "$SRC/.git" ]; then
  echo "✗ Run from inside the TradeVerse repo working tree." >&2
  exit 1
fi

mkdir -p "$DEST"

if [ ! -d "$DEST/.git" ]; then
  echo "→ Initialising mirror at $DEST"
  git -C "$DEST" init -q
  # Match the source's default branch shape so log commands feel familiar.
  git -C "$DEST" symbolic-ref HEAD refs/heads/main 2>/dev/null || true
fi

HEAD_SHA="$(git -C "$SRC" rev-parse --short HEAD)"
HEAD_MSG="$(git -C "$SRC" log -1 --pretty=%s)"

# Wipe everything except the mirror's own .git/.
find "$DEST" -mindepth 1 -maxdepth 1 \
  ! -name '.git' \
  -exec rm -rf {} +

# Extract current HEAD (only tracked files) into the mirror.
git -C "$SRC" archive HEAD | tar -x -C "$DEST"

git -C "$DEST" add -A
if git -C "$DEST" diff --cached --quiet; then
  echo "✓ Mirror already at snapshot @ ${HEAD_SHA}"
  exit 0
fi

git -C "$DEST" commit -q -m "snapshot @ ${HEAD_SHA}: ${HEAD_MSG}"
echo "✓ Mirror updated → $DEST (snapshot @ ${HEAD_SHA})"
