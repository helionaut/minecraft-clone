#!/usr/bin/env bash

set -euo pipefail

required_node_major=22
required_npm_major=10

node_major="$(node --version | sed 's/^v//' | cut -d. -f1)"
npm_major="$(npm --version | cut -d. -f1)"

if [[ "$node_major" -lt "$required_node_major" ]]; then
  echo "Node.js $required_node_major+ is required. Found $(node --version)." >&2
  exit 1
fi

if [[ "$npm_major" -lt "$required_npm_major" ]]; then
  echo "npm $required_npm_major+ is required. Found $(npm --version)." >&2
  exit 1
fi

echo "Host dependencies satisfied:"
echo "  node $(node --version)"
echo "  npm $(npm --version)"
