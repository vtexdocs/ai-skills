#!/usr/bin/env bash
set -euo pipefail

SKILLS_DIR="${1:-$HOME/.cursor/skills}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SKILLS_DIR"

for skill_dir in "$REPO_DIR"/skills/*/; do
  skill_name="$(basename "$skill_dir")"
  target="$SKILLS_DIR/$skill_name"

  if [ -L "$target" ]; then
    existing="$(readlink "$target")"
    if [ "$existing" = "$skill_dir" ] || [ "$existing" = "${skill_dir%/}" ]; then
      echo "✓ $skill_name — symlink já existe"
      continue
    fi
    echo "↻ $skill_name — atualizando symlink (apontava para $existing)"
    rm "$target"
  elif [ -e "$target" ]; then
    echo "⚠ $skill_name — $target já existe e não é um symlink, pulando"
    continue
  fi

  ln -s "${skill_dir%/}" "$target"
  echo "✓ $skill_name — symlink criado → $target"
done

echo ""
echo "Instalação concluída. Reinicie o Cursor ou abra um novo chat para carregar as skills."