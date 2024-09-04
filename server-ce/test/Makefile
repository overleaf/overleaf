all: test-e2e

# We are updating the docker compose config via the host-admin service.
# The host-admin service is running inside docker and has its own file-system layout.
# We need to have both file-system layouts agree on the path for the docker compose project.
# Notable the container labels com.docker.compose.project.working_dir and com.docker.compose.project.config_files need to match when creating containers from the docker host (how you started things) and from host-admin (how tests reconfigure the instance).
export PWD = $(shell pwd)

export TEX_LIVE_DOCKER_IMAGE ?= gcr.io/overleaf-ops/texlive-full:2023.1
export ALL_TEX_LIVE_DOCKER_IMAGES ?= gcr.io/overleaf-ops/texlive-full:2023.1,gcr.io/overleaf-ops/texlive-full:2022.1
export IMAGE_TAG_PRO ?= us-east1-docker.pkg.dev/overleaf-ops/ol-docker/pro:latest
export CYPRESS_SHARD ?=
export COMPOSE_PROJECT_NAME ?= test

test-e2e-native:
	docker compose -f docker-compose.yml -f docker-compose.native.yml up --no-log-prefix sharelatex host-admin -d
	CYPRESS_HOST_ADMIN_URL='http://localhost:8081' \
	CYPRESS_SAML_URL='http://localhost:8082' \
	CYPRESS_MAILTRAP_URL='http://localhost:8083' \
		npm run cypress:open

test-e2e:
	docker compose up --no-log-prefix --exit-code-from=e2e e2e

test-e2e-open:
	docker compose up --no-log-prefix --exit-code-from=e2e-open e2e-open

clean:
	docker compose down --volumes --timeout 0

prefetch: prefetch_default
prefetch_default: prefetch_default_compose
prefetch_default_compose:
	docker compose pull e2e mongo redis

prefetch_default: prefetch_default_compose_build
prefetch_default_compose_build:
	docker compose build host-admin

prefetch: prefetch_custom
prefetch_custom: prefetch_custom_compose_pull
prefetch_custom_compose_pull:
	docker compose pull saml ldap

prefetch_custom: prefetch_custom_texlive
prefetch_custom_texlive:
	echo -n "$$ALL_TEX_LIVE_DOCKER_IMAGES" | xargs -d, -I% \
	sh -exc 'tag=%; re_tag=quay.io/sharelatex/$${tag#*/*/}; docker pull $$tag; docker tag $$tag $$re_tag'

prefetch_custom: prefetch_old
prefetch_old:
	docker pull $(IMAGE_TAG_PRO:latest=4.2)
	docker pull $(IMAGE_TAG_PRO:latest=5.0.1-RC1)
	docker pull $(IMAGE_TAG_PRO:latest=5.0)

# Google Cloud Build runs on a very ancient Docker version that does not support the subdir flag.
# Use services -> mailtrap -> build -> context = https://github.com/dbck/docker-mailtrap.git#v1.5.0:build in docker-compose.yml eventually.
prefetch_default_compose_build: build_mailtrap
build_mailtrap:
	git clone https://github.com/dbck/docker-mailtrap.git || true && cd docker-mailtrap && git checkout v1.5.0
	docker build -t mailtrap docker-mailtrap/build

.PHONY: test-e2e test-e2e-open
