#!/usr/bin/env bash

echo "Deleting the overleaf cluster"
kind delete cluster -n overleaf
