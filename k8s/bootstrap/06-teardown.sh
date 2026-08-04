#!/usr/bin/env bash

echo "Deleting the overleaf cluster"
KIND_EXPERIMENTAL_PROVIDER=podman kind delete cluster -n overleaf
