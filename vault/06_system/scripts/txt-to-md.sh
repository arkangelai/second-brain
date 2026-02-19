#!/bin/bash
# Convert all .txt files in the vault to .md files
# Usage: ./txt-to-md.sh [directory]

DIR="${1:-.}"

find "$DIR" -name "*.txt" -type f | while read -r file; do
  md_file="${file%.txt}.md"
  if [ ! -f "$md_file" ]; then
    mv "$file" "$md_file"
    echo "Converted: $file → $md_file"
  else
    echo "Skipped (already exists): $md_file"
  fi
done

echo ""
echo "Done. Run 'qmd update && qmd embed' to re-index."
