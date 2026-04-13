#!/bin/sh
set -e

# Monday: include GtR historical grants. Other days: opportunities only.
if [ "$(date +%u)" = "1" ]; then
  node --import=tsx src/cli.ts ingest-all --include-gtr
else
  node --import=tsx src/cli.ts ingest-all
fi

node --import=tsx src/cli.ts cleanup
node --import=tsx src/cli.ts purge
