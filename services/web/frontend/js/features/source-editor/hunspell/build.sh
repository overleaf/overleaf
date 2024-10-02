#!/usr/bin/env bash
set -e

# build an Emscripten SDK Docker image with Hunspell's build dependencies installed
docker build --pull --tag overleaf/emsdk .

# compile Hunspell to WASM and copy the output files from the Docker container
docker run --rm \
  --workdir /opt \
  --volume "$(pwd)/wasm":/wasm \
  --volume "$(pwd)/compile.sh":/opt/compile.sh:ro \
  overleaf/emsdk \
  bash compile.sh
