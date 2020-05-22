DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml --log-level ERROR

BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_NAME = web
BUILD_DIR_NAME = $(shell pwd | xargs basename | tr -cd '[a-zA-Z0-9_.\-]')

DOCKER_COMPOSE := BUILD_NUMBER=$(BUILD_NUMBER) \
	BRANCH_NAME=$(BRANCH_NAME) \
	PROJECT_NAME=$(PROJECT_NAME) \
	MOCHA_GREP=${MOCHA_GREP} \
	SHARELATEX_CONFIG=/app/test/acceptance/config/settings.test.coffee \
	docker-compose ${DOCKER_COMPOSE_FLAGS}

MODULE_DIRS := $(shell find modules -mindepth 1 -maxdepth 1 -type d -not -name '.git' )
MODULE_MAKEFILES := $(MODULE_DIRS:=/Makefile)
MODULE_NAME=$(shell basename $(MODULE))

$(MODULE_MAKEFILES): Makefile.module
	cp Makefile.module $@

#
# Clean
#

clean_ci:
	$(DOCKER_COMPOSE) down -v -t 0
	docker container list | grep 'days ago' | cut -d ' ' -f 1 - | xargs -r docker container stop
	docker image prune -af --filter "until=48h"
	docker network prune -f

#
# Tests
#

test: test_unit test_frontend test_acceptance

test_module: test_unit_module test_acceptance_module

#
# Unit tests
#

test_unit: test_unit_app test_unit_modules

test_unit_app:
	COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0
	COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --name unit_test_$(BUILD_DIR_NAME) --rm test_unit
	COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

test_unit_app_parallel: export COMPOSE_PROJECT_NAME = \
	unit_test_parallel_$(BUILD_DIR_NAME)
test_unit_app_parallel:
	$(DOCKER_COMPOSE) down -v -t 0
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:app:parallel
	$(DOCKER_COMPOSE) down -v -t 0

TEST_UNIT_MODULES = $(MODULE_DIRS:=/test_unit)
$(TEST_UNIT_MODULES): %/test_unit: %/Makefile
test_unit_modules: $(TEST_UNIT_MODULES)

test_unit_module:
	$(MAKE) modules/$(MODULE_NAME)/test_unit

#
# Frontend unit tests
#

test_frontend: build_test_frontend test_frontend_run

test_frontend_run:
	COMPOSE_PROJECT_NAME=frontend_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0
	COMPOSE_PROJECT_NAME=frontend_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm test_frontend
	COMPOSE_PROJECT_NAME=frontend_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

test_frontend_build_run: build_test_frontend test_frontend_run

#
# Acceptance tests
#

test_acceptance: test_acceptance_app test_acceptance_modules

test_acceptance_app:
	COMPOSE_PROJECT_NAME=acceptance_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0
	COMPOSE_PROJECT_NAME=acceptance_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm test_acceptance
	COMPOSE_PROJECT_NAME=acceptance_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

TEST_ACCEPTANCE_MODULES = $(MODULE_DIRS:=/test_acceptance)
$(TEST_ACCEPTANCE_MODULES): %/test_acceptance: %/Makefile
test_acceptance_modules: $(TEST_ACCEPTANCE_MODULES)

CLEAN_TEST_ACCEPTANCE_MODULES = $(MODULE_DIRS:=/clean_test_acceptance)
$(CLEAN_TEST_ACCEPTANCE_MODULES): %/clean_test_acceptance: %/Makefile
clean_test_acceptance_modules: $(CLEAN_TEST_ACCEPTANCE_MODULES)
clean_ci: clean_test_acceptance_modules

test_acceptance_module:
	$(MAKE) modules/$(MODULE_NAME)/test_acceptance

#
# CI tests
#

ci:
	MOCHA_ARGS="--reporter tap" \
	$(MAKE) test

#
# Lint & format
#
ORG_PATH = /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN_LINT_FORMAT ?= \
	docker run --rm \
		--volume $(PWD):/src \
		--workdir /src \
		--env NODE_PATH=/app/node_modules \
		--env PATH=$(ORG_PATH):/app/node_modules/.bin \
		gcr.io/overleaf-ops/$(PROJECT_NAME):$(BRANCH_NAME)-deps

format:
	npm -q run format

format_in_docker:
	$(RUN_LINT_FORMAT) make format

format_fix:
	npm -q run format:fix

lint:
	npm -q run lint

lint_in_docker:
	$(RUN_LINT_FORMAT) make lint

#
# Build & publish
#

build_deps:
	docker build --pull \
		--tag gcr.io/overleaf-ops/$(PROJECT_NAME):$(BRANCH_NAME)-deps \
		--cache-from gcr.io/overleaf-ops/$(PROJECT_NAME):$(BRANCH_NAME)-deps \
		--cache-from gcr.io/overleaf-ops/$(PROJECT_NAME):master-deps \
		--target deps \
		.

build: build_deps
	docker build --pull --tag ci/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) \
		--tag gcr.io/overleaf-ops/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) \
		--cache-from gcr.io/overleaf-ops/$(PROJECT_NAME):$(BRANCH_NAME)-deps \
		--build-arg SENTRY_RELEASE=${COMMIT_SHA} \
		--build-arg BRANCH_NAME=$(BRANCH_NAME) \
		.

build_test_frontend:
	COMPOSE_PROJECT_NAME=frontend_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) build test_frontend

publish:
	docker push $(DOCKER_REPO)/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)

tar:
	COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm tar
	COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

MODULE_TARGETS = \
	$(TEST_ACCEPTANCE_MODULES) \
	$(CLEAN_TEST_ACCEPTANCE_MODULES) \
	$(TEST_UNIT_MODULES) \

$(MODULE_TARGETS):
	$(MAKE) -C $(dir $@) $(notdir $@) BUILD_DIR_NAME=$(BUILD_DIR_NAME)

.PHONY:
	$(MODULE_TARGETS) \
	compile_modules compile_modules_full clean_ci \
	test test_module test_unit test_unit_app \
	test_unit_modules test_unit_module test_frontend test_frontend_run \
	test_frontend_build_run test_acceptance test_acceptance_app \
	test_acceptance_modules test_acceptance_module ci format format_fix lint \
	build build_test_frontend publish tar
