#!/bin/sh
METADATA=http://metadata.google.internal./computeMetadata/v1
SVC_ACCT=$METADATA/instance/service-accounts/default
ACCESS_TOKEN=$(curl -s -H 'Metadata-Flavor: Google' $SVC_ACCT/token | cut -d'"' -f 4)
if [ -z "$ACCESS_TOKEN" ]; then
	echo "No acccess token to download texlive-full images from google container, continuing without downloading. This is likely not a google cloud enviroment."
	exit 0
fi
docker login -u '_token' -p $ACCESS_TOKEN https://gcr.io
docker pull --all-tags gcr.io/henry-terraform-admin/texlive-full #TODO NEED TO MAKE THIS AN ENV VAR
cp /app/bin/synctex /app/bin/synctex-mount/synctex
echo "Finished downloading texlive-full images"


