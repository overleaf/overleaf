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
	@set -e; \
	for makefile in $(MODULE_MAKEFILES); \
	do \
		cp Makefile.module $$makefile; \
	done

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

test_unit_modules:
	@set -e; \
	for dir in $(MODULE_DIRS); \
	do \
		if [ -e $$dir/test/unit ]; then \
			$(MAKE) test_unit_module MODULE=$$dir; \
		fi; \
	done

test_unit_module: $(MODULE_MAKEFILES)
	@if [ -e modules/$(MODULE_NAME)/test/unit ]; then \
		COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME)_$(MODULE_NAME) $(DOCKER_COMPOSE) down -v -t 0 \
		&& cd modules/$(MODULE_NAME) && COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME)_$(MODULE_NAME) $(MAKE) test_unit \
		&& cd $(CURDIR) && COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME)_$(MODULE_NAME) $(DOCKER_COMPOSE) down -v -t 0; \
	fi

#
# Frontend unit tests
#

test_frontend: compile build_test_frontend test_frontend_run

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

test_acceptance_modules:
	@set -e; \
	for dir in $(MODULE_DIRS); \
	do \
		if [ -e $$dir/test/acceptance ]; then \
			$(MAKE) test_acceptance_module MODULE=$$dir; \
		fi; \
	done

test_acceptance_module: $(MODULE_MAKEFILES)
	@if [ -e modules/$(MODULE_NAME)/test/acceptance ]; then \
		COMPOSE_PROJECT_NAME=acceptance_test_$(BUILD_DIR_NAME)_$(MODULE_NAME) $(DOCKER_COMPOSE) down -v -t 0 \
		&& cd modules/$(MODULE_NAME) && COMPOSE_PROJECT_NAME=acceptance_test_$(BUILD_DIR_NAME)_$(MODULE_NAME) $(MAKE) test_acceptance \
		&& cd $(CURDIR) && COMPOSE_PROJECT_NAME=acceptance_test_$(BUILD_DIR_NAME)_$(MODULE_NAME) $(DOCKER_COMPOSE) down -v -t 0; \
	fi

#
# CI tests
#

ci:
	MOCHA_ARGS="--reporter tap" \
	$(MAKE) test

#
# Lint & format
#

format:
	npm -q run format

format_fix:
	npm -q run format:fix

lint:
	npm -q run lint

#
# Build & publish
#

build:
	docker build --pull --tag ci/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) \
		--tag gcr.io/overleaf-ops/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) \
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

.PHONY:
	compile_modules compile_modules_full clean_ci \
	test test_module test_unit test_unit_app \
	test_unit_modules test_unit_module test_frontend test_frontend_run \
	test_frontend_build_run test_acceptance test_acceptance_app \
	test_acceptance_modules test_acceptance_module ci format format_fix lint \
	build build_test_frontend publish tar