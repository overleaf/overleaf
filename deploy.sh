#!/usr/bin/bash
# Usage:
#  1. Add font source to .env
#  2. Build OCI Images
#     1) To build overleaf image, run ./deploy.sh
#     2) To also build base image, run ./deploy.sh REV_NUMBER VERSIONS...
#        e.g. ./deploy.sh 2 latest 2023 2022 2021 2020

source .env

# download fonts
curl "$FONT_URL" --output fonts.zip

mkdir tmp_fonts
unzip fonts.zip -d tmp_fonts
mv tmp_fonts/fonts/* fonts

rm -rf tmp_fonts fonts.zip

cd server-ce

for version in "${@:2}"
do
    VERSION=$version REV=$1 make build-base
done

make build-community