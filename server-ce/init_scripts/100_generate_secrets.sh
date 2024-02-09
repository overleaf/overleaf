#!/bin/bash
set -e -o pipefail

# generate secrets and defines them as environment variables
# https://github.com/phusion/baseimage-docker#centrally-defining-your-own-environment-variables

WEB_API_PASSWORD_FILE=/etc/container_environment/WEB_API_PASSWORD
STAGING_PASSWORD_FILE=/etc/container_environment/STAGING_PASSWORD # HTTP auth for history-v1
V1_HISTORY_PASSWORD_FILE=/etc/container_environment/V1_HISTORY_PASSWORD
CRYPTO_RANDOM_FILE=/etc/container_environment/CRYPTO_RANDOM
OT_JWT_AUTH_KEY_FILE=/etc/container_environment/OT_JWT_AUTH_KEY

generate_secret () {
  dd if=/dev/urandom bs=1 count=32 2>/dev/null | base64 -w 0 | rev | cut -b 2- | rev | tr -d '\n+/'
}

if [ ! -f "$WEB_API_PASSWORD_FILE" ] ||
  [ ! -f "$STAGING_PASSWORD_FILE" ] ||
  [ ! -f "$V1_HISTORY_PASSWORD_FILE" ] ||
  [ ! -f "$CRYPTO_RANDOM_FILE" ] ||
  [ ! -f "$OT_JWT_AUTH_KEY_FILE" ]
then
    echo "generating random secrets"

    SECRET=$(generate_secret)
    echo "${SECRET}" > ${WEB_API_PASSWORD_FILE}

    SECRET=$(generate_secret)
    echo "${SECRET}" > ${STAGING_PASSWORD_FILE}
    echo "${SECRET}" > ${V1_HISTORY_PASSWORD_FILE}

    SECRET=$(generate_secret)
    echo "${SECRET}" > ${CRYPTO_RANDOM_FILE}

    SECRET=$(generate_secret)
    echo "${SECRET}" > ${OT_JWT_AUTH_KEY_FILE}
fi

