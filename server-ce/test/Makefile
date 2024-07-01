all: test-e2e

# We are updating the docker compose config via the host-admin service.
# The host-admin service is running inside docker and has its own file-system layout.
# We need to have both file-system layouts agree on the path for the docker compose project.
# Notable the container labels com.docker.compose.project.working_dir and com.docker.compose.project.config_files need to match when creating containers from the docker host (how you started things) and from host-admin (how tests reconfigure the instance).
export PWD = $(shell pwd)

export TEX_LIVE_DOCKER_IMAGE ?= quay.io/sharelatex/texlive-full:2023.1
export ALL_TEX_LIVE_DOCKER_IMAGES ?= quay.io/sharelatex/texlive-full:2023.1,quay.io/sharelatex/texlive-full:2022.1
export IMAGE_TAG_PRO ?= quay.io/sharelatex/sharelatex-pro:latest

test-e2e-native:
	docker compose -f docker-compose.yml -f docker-compose.native.yml up --build --no-log-prefix sharelatex host-admin -d
	CYPRESS_ADMIN_CLIENT_URL='http://localhost:8081' CYPRESS_GIT_BRIDGE_PUBLIC_HOST='localhost' CYPRESS_SAML_PUBLIC_HOST='localhost:8082' CYPRESS_OVERLEAF_PUBLIC_HOST='localhost:8082' npm run cypress:open

test-e2e:
	docker compose up --build --no-log-prefix --exit-code-from=e2e e2e

test-e2e-open:
	docker compose up --build --no-log-prefix --exit-code-from=e2e-open e2e-open

clean:
	docker compose down --volumes --timeout 0

prefetch:
	docker compose pull e2e mongo redis saml ldap
	docker compose build
	echo -n "$$ALL_TEX_LIVE_DOCKER_IMAGES" | xargs -d, -I% \
	sh -exc 'tag=%; re_tag=quay.io/sharelatex/$${tag#*/}; docker pull $$tag; docker tag $$tag $$re_tag'
	docker pull $(IMAGE_TAG_PRO:latest=4.2)
	docker pull $(IMAGE_TAG_PRO:latest=5.0.1-RC1)
	docker pull $(IMAGE_TAG_PRO:latest=5.0)

.PHONY: test-e2e test-e2e-open
