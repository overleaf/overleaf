# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment
# Version: 1.1.0

BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_NAME = clsi
DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml
DOCKER_COMPOSE := BUILD_NUMBER=$(BUILD_NUMBER) \
	BRANCH_NAME=$(BRANCH_NAME) \
	PROJECT_NAME=$(PROJECT_NAME) \
	docker-compose ${DOCKER_COMPOSE_FLAGS}

clean:
	rm -f app.js
	rm -rf app/js
	rm -rf test/unit/js
	rm -rf test/acceptance/js

test: test_unit test_acceptance

test_unit:
	@[ -d test/unit ] && $(DOCKER_COMPOSE) run --rm test_unit -- ${MOCHA_ARGS} || echo "clsi has no unit tests"

test_acceptance: test_clean # clear the database before each acceptance test run
	@[ -d test/acceptance ] && $(DOCKER_COMPOSE) run --rm test_acceptance -- ${MOCHA_ARGS} || echo "clsi has no acceptance tests"

test_clean:
	$(DOCKER_COMPOSE) down -t 0
build:
	docker build --pull --tag quay.io/sharelatex/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) .

publish:
	docker push quay.io/sharelatex/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)
	
ci:
	# On the CI server, we want to run our tests in the image that we
	# have built for deployment, which is what the docker-compose.ci.yml
	# override does.
	PROJECT_NAME=$(PROJECT_NAME) \
	BRANCH_NAME=$(BRANCH_NAME) \
	BUILD_NUMBER=$(BUILD_NUMBER) \
	DOCKER_COMPOSE_FLAGS="-f docker-compose.ci.yml" \
	$(MAKE) build test publish


.PHONY: clean test test_unit test_acceptance test_clean build publish
