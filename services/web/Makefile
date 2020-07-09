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

test: test_unit test_karma test_acceptance test_frontend

test_module: test_unit_module test_acceptance_module

#
# Unit tests
#

test_unit: test_unit_app test_unit_modules

test_unit_app:
	COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0
	COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --name unit_test_$(BUILD_DIR_NAME) --rm test_unit
	COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

TEST_SUITES = $(sort $(filter-out \
	$(wildcard test/unit/src/helpers/*), \
	$(wildcard test/unit/src/*/*)))

MOCHA_CMD_LINE = \
	mocha \
		--exit \
		--file test/unit/bootstrap.js \
		--grep=${MOCHA_GREP} \
		--reporter spec \
		--timeout 25000 \

.PHONY: $(TEST_SUITES)
$(TEST_SUITES):
	$(MOCHA_CMD_LINE) $@

J ?= 1
test_unit_app_parallel_gnu_make: $(TEST_SUITES)
test_unit_app_parallel_gnu_make_docker: export COMPOSE_PROJECT_NAME = \
	unit_test_parallel_make_$(BUILD_DIR_NAME)
test_unit_app_parallel_gnu_make_docker:
	$(DOCKER_COMPOSE) down -v -t 0
	$(DOCKER_COMPOSE) run --rm test_unit \
		make test_unit_app_parallel_gnu_make --output-sync -j $(J)
	$(DOCKER_COMPOSE) down -v -t 0

test_unit_app_parallel: test_unit_app_parallel_gnu_parallel
test_unit_app_parallel_gnu_parallel: export COMPOSE_PROJECT_NAME = \
	unit_test_parallel_$(BUILD_DIR_NAME)
test_unit_app_parallel_gnu_parallel:
	$(DOCKER_COMPOSE) down -v -t 0
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:app:parallel
	$(DOCKER_COMPOSE) down -v -t 0

TEST_UNIT_MODULES = $(MODULE_DIRS:=/test_unit)
$(TEST_UNIT_MODULES): %/test_unit: %/Makefile
test_unit_modules: $(TEST_UNIT_MODULES)

test_unit_module:
	$(MAKE) modules/$(MODULE_NAME)/test_unit

#
# Karma frontend tests
#

test_karma: build_test_karma test_karma_run

test_karma_run:
	COMPOSE_PROJECT_NAME=karma_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0
	COMPOSE_PROJECT_NAME=karma_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm test_karma
	COMPOSE_PROJECT_NAME=karma_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

test_karma_build_run: build_test_karma test_karma_run

#
# Frontend tests
#

test_frontend:
	COMPOSE_PROJECT_NAME=frontend_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0
	COMPOSE_PROJECT_NAME=frontend_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm test_frontend
	COMPOSE_PROJECT_NAME=frontend_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

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
	docker run --rm ci/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)

NODE_MODULES_PATH := ${PATH}:${PWD}/node_modules/.bin:/app/node_modules/.bin
WITH_NODE_MODULES_PATH = \
	format_backend \
	format_frontend \
	format_misc \
	format_test \
	$(TEST_SUITES) \

$(WITH_NODE_MODULES_PATH): export PATH=$(NODE_MODULES_PATH)

format: format_backend
format_backend:
	prettier-eslint \
		app.js \
		'app/**/*.js' \
		'modules/*/index.js' \
		'modules/*/app/**/*.js' \
	 	--list-different

format: format_frontend
format_frontend:
	prettier-eslint \
		'frontend/**/*.{js,less}' \
		'modules/*/frontend/**/*.{js,less}' \
		--list-different

format: format_test
format_test:
	prettier-eslint \
		'test/**/*.js' \
		'modules/*/test/**/*.js' \
		--list-different

format: format_misc
# migrations, scripts, webpack config, karma config
format_misc:
	prettier-eslint \
		'**/*.{js,less}' \
		--ignore app.js \
		--ignore 'app/**/*.js' \
		--ignore 'modules/*/app/**/*.js' \
		--ignore 'modules/*/index.js' \
		--ignore 'frontend/**/*.{js,less}' \
		--ignore 'modules/*/frontend/**/*.{js,less}' \
		--ignore 'test/**/*.js' \
		--ignore 'modules/*/test/**/*.js' \
		--list-different

format_in_docker:
	$(RUN_LINT_FORMAT) make format -j --output-sync

format_fix:
	npm -q run format:fix

lint:
	npm -q run lint

lint_in_docker:
	$(RUN_LINT_FORMAT) make lint

#
# Build & publish
#

IMAGE_CI ?= ci/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)
IMAGE_REPO ?= gcr.io/overleaf-ops/$(PROJECT_NAME)
IMAGE_REPO_BRANCH ?= $(IMAGE_REPO):$(BRANCH_NAME)
IMAGE_REPO_MASTER ?= $(IMAGE_REPO):master
IMAGE_REPO_FINAL ?= $(IMAGE_REPO_BRANCH)-$(BUILD_NUMBER)

export SENTRY_RELEASE ?= ${COMMIT_SHA}

build_deps:
	docker build --pull \
		--cache-from $(IMAGE_REPO_BRANCH)-deps \
		--cache-from $(IMAGE_REPO_MASTER)-deps \
		--tag $(IMAGE_REPO_BRANCH)-deps \
		--target deps \
		.

build_dev:
	docker build \
		--build-arg SENTRY_RELEASE \
		--cache-from $(IMAGE_REPO_BRANCH)-deps \
		--cache-from $(IMAGE_CI)-dev \
		--tag $(IMAGE_CI) \
		--tag $(IMAGE_CI)-dev \
		--target dev \
		.

build_webpack:
	docker build \
		--build-arg SENTRY_RELEASE \
		--cache-from $(IMAGE_CI)-dev \
		--cache-from $(IMAGE_CI)-webpack \
		--tag $(IMAGE_CI)-webpack \
		--target webpack \
		.

build:
	docker build \
		--build-arg SENTRY_RELEASE \
		--cache-from $(IMAGE_CI)-webpack \
		--cache-from $(IMAGE_REPO_FINAL) \
		--tag $(IMAGE_REPO_FINAL) \
		.

build_test_karma:
	COMPOSE_PROJECT_NAME=karma_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) build test_karma

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
	test_unit_modules test_unit_module test_karma test_karma_run \
	test_karma_build_run test_frontend test_acceptance test_acceptance_app \
	test_acceptance_modules test_acceptance_module ci format format_fix lint \
	build build_test_karma publish tar
