#!/bin/bash
set -e -o pipefail

# generate secrets and defines them as environment variables
# https://github.com/phusion/baseimage-docker#centrally-defining-your-own-environment-variables

WEB_API_PASSWORD_FILE=/etc/container_environment/WEB_API_PASSWORD
CRYPTO_RANDOM_FILE=/etc/container_environment/CRYPTO_RANDOM

if [ ! -f "$WEB_API_PASSWORD_FILE" ] || [ ! -f "$CRYPTO_RANDOM_FILE" ]; then

    echo "generating random secrets"

    SECRET=$(dd if=/dev/urandom bs=1 count=32 2>/dev/null | base64 -w 0 | rev | cut -b 2- | rev | tr -d '\n+/')
    echo ${SECRET} > ${WEB_API_PASSWORD_FILE}

    SECRET=$(dd if=/dev/urandom bs=1 count=32 2>/dev/null | base64 -w 0 | rev | cut -b 2- | rev | tr -d '\n+/')
    echo ${SECRET} > ${CRYPTO_RANDOM_FILE}
fi

