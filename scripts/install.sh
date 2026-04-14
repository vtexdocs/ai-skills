#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") <owner/repo> <path-in-repo> [destination] [folder-name]

Clones a GitHub repository and copies a specific folder to a local destination.
When <destination> is omitted, prompts you to choose between Claude and Cursor.
When <folder-name> is omitted, lists available folders at <path-in-repo> and
lets you pick one interactively.

Arguments:
  owner/repo      GitHub repository (e.g. vtex/faststore)
  path-in-repo    Path inside the repo to look for folders (use "." for root)
  destination     (Optional) A path or a keyword: "claude" (~/.claude/skills),
                  "cursor" (~/.cursor/skills). If omitted, you choose
                  interactively
  folder-name     (Optional) Folder to copy; if omitted, you choose interactively

Requirements:
  - git

Examples:
  $(basename "$0") vtex/faststore packages
  $(basename "$0") vtex/faststore packages cursor
  $(basename "$0") vtex/faststore packages claude
  $(basename "$0") vtex/faststore packages /tmp
  $(basename "$0") vtex/faststore packages /tmp ui
EOF
  exit 1
}

check_deps() {
  if ! command -v git &>/dev/null; then
    echo "Error: git is required but not installed." >&2
    exit 1
  fi
}

clone_repo() {
  local repo="$1" dest="$2"

  echo "Cloning ${repo}..."
  git clone --depth 1 "https://github.com/${repo}.git" "$dest" 2>&1 | sed 's/^/  /'
}

list_folders() {
  local base_dir="$1"

  local -a folders=()
  for entry in "$base_dir"/*/; do
    [[ -d "$entry" ]] && folders+=("$(basename "$entry")")
  done

  if (( ${#folders[@]} == 0 )); then
    echo "No folders found at that location." >&2
    exit 1
  fi

  printf '%s\n' "${folders[@]}"
}

pick_folder() {
  local -a folders=()
  while IFS= read -r name; do
    folders+=("$name")
  done

  if (( ${#folders[@]} == 0 )); then
    echo "No folders found at that location." >&2
    exit 1
  fi

  echo "Available folders:" >&2
  for i in "${!folders[@]}"; do
    printf "  %d) %s\n" $((i + 1)) "${folders[$i]}" >&2
  done

  local choice
  while true; do
    read -rp "Select a folder [1-${#folders[@]}]: " choice < /dev/tty
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#folders[@]} )); then
      echo "${folders[$((choice - 1))]}"
      return
    fi
    echo "Invalid selection. Try again." >&2
  done
}

copy_folder() {
  local repo="$1" repo_path="$2" folder="$3" dest="$4"

  clone_repo "$repo" "$tmp_dir/repo"

  local lookup_dir="$tmp_dir/repo"
  if [[ "$repo_path" != "." ]]; then
    lookup_dir="$tmp_dir/repo/${repo_path}"
  fi

  if [[ ! -d "$lookup_dir" ]]; then
    echo "Error: path '${repo_path}' does not exist in the repository." >&2
    exit 1
  fi

  if [[ -z "$folder" ]]; then
    local folder_list
    folder_list="$(list_folders "$lookup_dir")"
    folder="$(echo "$folder_list" | pick_folder)"
  fi

  local src="${lookup_dir}/${folder}"
  if [[ ! -d "$src" ]]; then
    echo "Error: folder '${folder}' not found under '${repo_path}'." >&2
    exit 1
  fi

  local target="${dest}/${folder}"
  if [[ -d "$target" ]]; then
    echo "Removing existing ${target}..."
    rm -rf "$target"
  fi

  mkdir -p "$dest"
  cp -R "$src" "$dest/"
  echo "Copied ${repo_path}/${folder} → ${target}"
}

resolve_destination() {
  local input
  input="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$input" in
    claude) echo "$HOME/.claude/skills" ;;
    cursor) echo "$HOME/.cursor/skills" ;;
    *)      echo "$input" ;;
  esac
}

pick_destination() {
  echo "Where do you want to install?" >&2
  echo "  1) Claude (~/.claude/skills)" >&2
  echo "  2) Cursor (~/.cursor/skills)" >&2

  local choice
  while true; do
    read -rp "Select a destination [1-2]: " choice < /dev/tty
    case "$choice" in
      1) echo "$HOME/.claude/skills"; return ;;
      2) echo "$HOME/.cursor/skills"; return ;;
      *) echo "Invalid selection. Try again." >&2 ;;
    esac
  done
}

main() {
  (( $# < 2 )) && usage
  check_deps

  local repo="$1"
  local repo_path="$2"
  local dest="${3:-}"
  local folder="${4:-}"

  if [[ -z "$dest" ]]; then
    dest="$(pick_destination)"
  else
    dest="$(resolve_destination "$dest")"
  fi

  copy_folder "$repo" "$repo_path" "$folder" "$dest"
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT SIGINT SIGTERM SIGHUP ERR
main "$@"
