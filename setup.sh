#!/bin/bash
set -e

# Second Brain - Quickstart Setup
# https://github.com/arkangelai/second-brain

VAULT_PATH="${SECOND_BRAIN_PATH:-$HOME/Documents/Second_Brain}"
QMD_CONFIG="$HOME/.config/qmd/index.yml"

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

# ─── Clone or copy vault structure ──────────────────────────────────

if [ -d "$VAULT_PATH/.git" ]; then
  echo "  Vault already exists at $VAULT_PATH — skipping clone."
elif [ -d "$VAULT_PATH" ]; then
  echo "  Directory exists at $VAULT_PATH but is not a git repo."
  echo "  Creating vault structure inside it..."
else
  echo "  Creating vault at $VAULT_PATH..."
  mkdir -p "$VAULT_PATH"
fi

# Create directory structure
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

echo "  ✓ Vault structure created"

# ─── Copy template files if they don't exist ────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

copy_if_missing() {
  local src="$1"
  local dest="$2"
  if [ ! -f "$dest" ] && [ -f "$src" ]; then
    cp "$src" "$dest"
    echo "  ✓ Created $(basename "$dest")"
  fi
}

# Core files
copy_if_missing "$SCRIPT_DIR/vault/INDEX.md" "$VAULT_PATH/INDEX.md"
copy_if_missing "$SCRIPT_DIR/vault/AGENTS.md" "$VAULT_PATH/AGENTS.md"

# MOCs
copy_if_missing "$SCRIPT_DIR/vault/01_thinking/growth.md" "$VAULT_PATH/01_thinking/growth.md"
copy_if_missing "$SCRIPT_DIR/vault/01_thinking/product.md" "$VAULT_PATH/01_thinking/product.md"
copy_if_missing "$SCRIPT_DIR/vault/01_thinking/leadership.md" "$VAULT_PATH/01_thinking/leadership.md"
copy_if_missing "$SCRIPT_DIR/vault/01_thinking/life.md" "$VAULT_PATH/01_thinking/life.md"
copy_if_missing "$SCRIPT_DIR/vault/01_thinking/content-creation.md" "$VAULT_PATH/01_thinking/content-creation.md"

# Content engine
copy_if_missing "$SCRIPT_DIR/vault/06_system/content-engine/voice-profile.md" "$VAULT_PATH/06_system/content-engine/voice-profile.md"
copy_if_missing "$SCRIPT_DIR/vault/06_system/content-engine/structures.md" "$VAULT_PATH/06_system/content-engine/structures.md"
copy_if_missing "$SCRIPT_DIR/vault/06_system/content-engine/learnings.md" "$VAULT_PATH/06_system/content-engine/learnings.md"

# Templates
copy_if_missing "$SCRIPT_DIR/vault/06_system/templates/note.md" "$VAULT_PATH/06_system/templates/note.md"
copy_if_missing "$SCRIPT_DIR/vault/06_system/templates/moc.md" "$VAULT_PATH/06_system/templates/moc.md"
copy_if_missing "$SCRIPT_DIR/vault/06_system/templates/book.md" "$VAULT_PATH/06_system/templates/book.md"
copy_if_missing "$SCRIPT_DIR/vault/06_system/templates/pipeline-post.md" "$VAULT_PATH/06_system/templates/pipeline-post.md"

# Scripts
copy_if_missing "$SCRIPT_DIR/vault/06_system/scripts/txt-to-md.sh" "$VAULT_PATH/06_system/scripts/txt-to-md.sh"
[ -f "$VAULT_PATH/06_system/scripts/txt-to-md.sh" ] && chmod +x "$VAULT_PATH/06_system/scripts/txt-to-md.sh"

echo ""

# ─── Install QMD ────────────────────────────────────────────────────

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
