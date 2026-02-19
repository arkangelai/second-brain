#!/bin/bash
set -e

# Second Brain - Quickstart Setup
# https://github.com/arkangelai/second-brain

VAULT_PATH="${SECOND_BRAIN_PATH:-$HOME/Documents/Second_Brain}"
QMD_CONFIG="$HOME/.config/qmd/index.yml"
REPO_URL="https://github.com/arkangelai/second-brain.git"
REPO_BRANCH="initial-setup"

echo ""
echo "  Second Brain - Setup"
echo "  ====================="
echo ""
echo "  Vault path: $VAULT_PATH"
echo ""

# ─── Check prerequisites ───────────────────────────────────────────

check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "  ✗ $1 not found."
    echo "    $2"
    exit 1
  else
    echo "  ✓ $1 found"
  fi
}

echo "  Checking prerequisites..."
echo ""

check_command "bun" "Install Bun: curl -fsSL https://bun.sh/install | bash"
check_command "git" "Install git: https://git-scm.com"

echo ""

# ─── Clone the repo ─────────────────────────────────────────────────

if [ -d "$VAULT_PATH/.git" ]; then
  echo "  Vault already exists at $VAULT_PATH — pulling latest..."
  git -C "$VAULT_PATH" pull --ff-only 2>/dev/null || true
else
  if [ -d "$VAULT_PATH" ] && [ "$(ls -A "$VAULT_PATH" 2>/dev/null)" ]; then
    echo "  ⚠ Directory $VAULT_PATH already exists and is not empty."
    echo "    Back it up or remove it, then run this script again."
    exit 1
  fi
  echo "  Cloning repo..."
  git clone -b "$REPO_BRANCH" "$REPO_URL" "$VAULT_PATH"
  echo "  ✓ Repo cloned"
fi

# ─── Move vault files to root ────────────────────────────────────────

# The repo has template files under vault/. Copy them to the vault root
# so the user works directly in the Second_Brain directory.
if [ -d "$VAULT_PATH/vault" ]; then
  echo "  Setting up vault files..."
  cp -rn "$VAULT_PATH/vault/"* "$VAULT_PATH/" 2>/dev/null || true
  echo "  ✓ Vault files ready"
fi

# ─── Create any missing directories ─────────────────────────────────

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

echo "  ✓ Directory structure ready"

# ─── Install QMD ────────────────────────────────────────────────────

echo ""
if command -v qmd &> /dev/null; then
  echo "  ✓ QMD already installed"
else
  echo "  Installing QMD..."
  bun install -g @tobilu/qmd
  echo "  ✓ QMD installed"
fi

# ─── Configure QMD ──────────────────────────────────────────────────

if [ -f "$QMD_CONFIG" ]; then
  echo "  ✓ QMD config already exists at $QMD_CONFIG"
else
  mkdir -p "$(dirname "$QMD_CONFIG")"
  cat > "$QMD_CONFIG" << EOF
collections:
  second-brain:
    path: $VAULT_PATH
    pattern: "**/*.md"
EOF
  echo "  ✓ QMD config created at $QMD_CONFIG"
fi

# ─── Index the vault ────────────────────────────────────────────────

echo ""
echo "  Indexing vault..."
qmd update 2>/dev/null || qmd collection add "$VAULT_PATH" --name second-brain 2>/dev/null || true
echo "  ✓ Vault indexed"

echo ""
echo "  Generating embeddings (this downloads ~2GB of models on first run)..."
qmd embed 2>/dev/null || echo "  ⚠ Embedding failed — you can run 'qmd embed' manually later"

echo ""
echo "  ✓ Setup complete!"
echo ""
echo "  ─── Next steps ───────────────────────────────────"
echo ""
echo "  1. Open Obsidian → 'Open folder as vault' → $VAULT_PATH"
echo "  2. Edit AGENTS.md and voice-profile.md with your info"
echo "  3. Start adding notes to 00_inbox/"
echo "  4. Use any AI agent:"
echo ""
echo "     Claude Code:  cd $VAULT_PATH && claude"
echo "     Cursor:       Open folder in Cursor"
echo "     Codex:        cd $VAULT_PATH && codex"
echo ""
echo "  5. First prompt to try:"
echo "     'Read AGENTS.md and INDEX.md. Summarize this vault.'"
echo ""
echo "  ─── Useful commands ──────────────────────────────"
echo ""
echo "  qmd status                  # Check index health"
echo "  qmd query \"your question\"   # Search your brain"
echo "  qmd update && qmd embed     # Re-index after adding files"
echo ""
