# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment
# Version: 1.0.0

BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_NAME = chat
DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml
DOCKER_COMPOSE := docker-compose ${DOCKER_COMPOSE_FLAGS}

clean:
	rm -f app.js
	rm -rf app/js
	rm -rf test/unit/js
	rm -rf test/acceptance/js

test: test_unit test_acceptance

test_unit:
	@[ -d test/unit ] && $(DOCKER_COMPOSE) run --rm test_unit -- ${MOCHA_ARGS} || echo "chat has no unit tests"

test_acceptance: test_clean # clear the database before each acceptance test run
	@[ -d test/acceptance ] && $(DOCKER_COMPOSE) run --rm test_acceptance -- ${MOCHA_ARGS} || echo "chat has no acceptance tests"

test_clean:
	$(DOCKER_COMPOSE) down

.PHONY: clean test test_unit test_acceptance test_clean build publish
