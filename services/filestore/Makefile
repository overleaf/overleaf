NPM := docker-compose -f docker-compose.yml ${DOCKER_COMPOSE_FLAGS} run --rm npm npm
BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_NAME = filestore
DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml
DOCKER_COMPOSE := docker-compose ${DOCKER_COMPOSE_FLAGS}

all: install test
	@echo "Run:"
	@echo "	make install		to set up the project dependencies (in docker)"
	@echo "	make test       to run all the tests for the project (in docker)"
	@echo " make run        to run the app (natively)"

install:
	$(NPM) install

run: 
	$(NPM) run start

clean:
	rm -f app.js
	rm -rf app/js
	rm -rf test/unit/js
	rm -rf test/acceptance/js
	# Deletes node_modules volume
	docker-compose down --volumes

test: test_unit test_acceptance

test_unit:
	$(DOCKER_COMPOSE) run --rm test_unit -- ${MOCHA_ARGS}

test_acceptance: ci_clean # clear the database before each acceptance test run
	$(DOCKER_COMPOSE) run --rm test_acceptance -- ${MOCHA_ARGS}

build:
	docker build --pull --tag gcr.io/csh-gcdm-test/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) .

publish:
	docker push gcr.io/csh-gcdm-test/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)

ci:
	# On the CI server, we want to run our tests in the image that we
	# have built for deployment, which is what the docker-compose.ci.yml
	# override does.
	PROJECT_NAME=$(PROJECT_NAME) \
	BRANCH_NAME=$(BRANCH_NAME) \
	BUILD_NUMBER=$(BUILD_NUMBER) \
	DOCKER_COMPOSE_FLAGS="-f docker-compose.ci.yml" \
	$(MAKE) build test publish

ci_clean:
	PROJECT_NAME=$(PROJECT_NAME) \
	BRANCH_NAME=$(BRANCH_NAME) \
	BUILD_NUMBER=$(BUILD_NUMBER) \
	DOCKER_COMPOSE_FLAGS="-f docker-compose.ci.yml" \
	$(DOCKER_COMPOSE) down

.PHONY:
	all install compile clean test test_unit test_acceptance \
	test_acceptance_start_service test_acceptance_stop_service \
	test_acceptance_run build publish ci ci_clean
