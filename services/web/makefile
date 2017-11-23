NPM := docker-compose -f docker-compose.yml ${DOCKER_COMPOSE_FLAGS} run --rm npm npm
BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_NAME = web

all: install test
	@echo "Run:"
	@echo "	make install		to set up the project dependencies (in docker)"
	@echo "	make test       to run all the tests for the project (in docker)"

add:
	$(NPM) install --save ${P}

add_dev:
	$(NPM) install --save-dev ${P}

install:
	$(NPM) install

clean:
	rm app.js
	rm -r app/js
	rm -r test/unit/js
	rm -r test/acceptance/js

test: test_unit test_acceptance

test_unit:
	docker-compose -f docker-compose.yml ${DOCKER_COMPOSE_FLAGS} run --rm test_unit npm run test:unit -- ${MOCHA_ARGS}

test_acceptance: test_acceptance_start_service test_acceptance_run test_acceptance_stop_service

test_acceptance_start_service:
	docker-compose -f docker-compose.yml ${DOCKER_COMPOSE_FLAGS} up -d test_acceptance

test_acceptance_stop_service:
	docker-compose -f docker-compose.yml ${DOCKER_COMPOSE_FLAGS} stop test_acceptance

test_acceptance_run:
	docker-compose -f docker-compose.yml ${DOCKER_COMPOSE_FLAGS} exec -T test_acceptance npm run test:acceptance -- ${MOCHA_ARGS}

.PHONY:
	add install update test test_unit test_acceptance \
	test_acceptance_start_service test_acceptance_stop_service \
	test_acceptance_run
