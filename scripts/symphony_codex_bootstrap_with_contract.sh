#!/usr/bin/env bash
set -euo pipefail

repo_dir=""
model="gpt-5.4"
reasoning="medium"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-dir)
      repo_dir="${2:?--repo-dir requires a value}"
      shift 2
      ;;
    --model)
      model="${2:?--model requires a value}"
      shift 2
      ;;
    model_reasoning_effort=*)
      reasoning="${1#model_reasoning_effort=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$repo_dir" ]]; then
  echo "--repo-dir is required" >&2
  exit 1
fi

exec /mnt/c/!codex/scripts/symphony_codex_bootstrap.sh "$repo_dir" "$model" "$reasoning"
