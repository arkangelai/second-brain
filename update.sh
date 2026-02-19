#!/bin/bash
set -e

# Second Brain - Update
# Pulls latest templates and improvements without overwriting your notes.
# https://github.com/arkangelai/second-brain

VAULT_PATH="${SECOND_BRAIN_PATH:-$HOME/Documents/Second_Brain}"
REPO_BRANCH="initial-setup"

echo ""
echo "  Second Brain - Update"
echo "  ====================="
echo ""

# ─── Check we're in a git repo ──────────────────────────────────────

if [ ! -d "$VAULT_PATH/.git" ]; then
  echo "  ✗ No git repo found at $VAULT_PATH"
  echo "    Run setup.sh first, or clone the repo manually."
  exit 1
fi

# ─── Pull latest changes ────────────────────────────────────────────

echo "  Pulling latest changes..."
git -C "$VAULT_PATH" fetch origin "$REPO_BRANCH" --quiet
git -C "$VAULT_PATH" merge origin/"$REPO_BRANCH" --no-edit --quiet 2>/dev/null || {
  echo "  ⚠ Merge conflict detected. Your notes are safe."
  echo "    Resolve conflicts in Obsidian or your editor, then run:"
  echo "    cd $VAULT_PATH && git add -A && git commit -m 'resolve merge'"
  exit 1
}
echo "  ✓ Latest changes pulled"

# ─── Copy new template files (won't overwrite existing) ─────────────

if [ -d "$VAULT_PATH/vault" ]; then
  echo "  Copying new templates (won't overwrite your files)..."
  cp -rn "$VAULT_PATH/vault/"* "$VAULT_PATH/" 2>/dev/null || true
  echo "  ✓ Templates updated"
fi

# ─── Ensure all directories exist ───────────────────────────────────

mkdir -p "$VAULT_PATH/00_inbox"
mkdir -p "$VAULT_PATH/01_thinking/notes"
mkdir -p "$VAULT_PATH/02_reference/approaches"
mkdir -p "$VAULT_PATH/02_reference/tools"
mkdir -p "$VAULT_PATH/02_reference/sources/books"
mkdir -p "$VAULT_PATH/02_reference/sources/podcasts"
mkdir -p "$VAULT_PATH/02_reference/sources/articles"
mkdir -p "$VAULT_PATH/03_creating/drafts"
mkdir -p "$VAULT_PATH/03_creating/pipeline"
mkdir -p "$VAULT_PATH/04_published"
mkdir -p "$VAULT_PATH/05_archive"
mkdir -p "$VAULT_PATH/06_system/content-engine"
mkdir -p "$VAULT_PATH/06_system/templates"
mkdir -p "$VAULT_PATH/06_system/scripts"
mkdir -p "$VAULT_PATH/attachments"

# ─── Update QMD ─────────────────────────────────────────────────────

if command -v qmd &> /dev/null; then
  echo "  Checking for QMD updates..."
  bun install -g @tobilu/qmd 2>/dev/null && echo "  ✓ QMD up to date" || echo "  ⚠ QMD update failed — run 'bun install -g @tobilu/qmd' manually"
else
  echo "  ⚠ QMD not found. Install with: bun install -g @tobilu/qmd"
fi

# ─── Re-index ───────────────────────────────────────────────────────

echo "  Re-indexing vault..."
qmd update 2>/dev/null || true
qmd embed 2>/dev/null || echo "  ⚠ Embedding failed — run 'qmd embed' manually"

echo ""
echo "  ✓ Update complete!"
echo ""
echo "  What's new: https://github.com/arkangelai/second-brain/commits/initial-setup"
echo ""
