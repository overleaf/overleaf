all: test-e2e

# We are updating the docker compose config via the host-admin service.
# The host-admin service is running inside docker and has its own file-system layout.
# We need to have both file-system layouts agree on the path for the docker compose project.
# Notable the container labels com.docker.compose.project.working_dir and com.docker.compose.project.config_files need to match when creating containers from the docker host (how you started things) and from host-admin (how tests reconfigure the instance).
export PWD = $(shell pwd)

export TEX_LIVE_DOCKER_IMAGE ?= quay.io/sharelatex/texlive-full:2023.1
export ALL_TEX_LIVE_DOCKER_IMAGES ?= quay.io/sharelatex/texlive-full:2023.1,quay.io/sharelatex/texlive-full:2022.1

test-e2e:
	docker compose up --build --no-log-prefix --exit-code-from=e2e e2e

test-e2e-open:
	docker compose up --build --no-log-prefix --exit-code-from=e2e-open e2e-open

clean:
	docker compose down --volumes --timeout 0

prefetch:
	docker compose pull e2e mongo redis
	docker compose build
	echo -n "$$ALL_TEX_LIVE_DOCKER_IMAGES" | xargs -d, -I% \
	sh -exc 'tag=%; re_tag=quay.io/sharelatex/$${tag#*/}; docker pull $$tag; docker tag $$tag $$re_tag'

.PHONY: test-e2e test-e2e-open
