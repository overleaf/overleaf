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

LESSC := node_modules/.bin/lessc
CLEANCSS := node_modules/.bin/cleancss

LESS_FILES := $(shell find public/stylesheets -name '*.less')
LESSC_COMMON_FLAGS := --source-map --autoprefix="last 2 versions, ie >= 10"
CLEANCSS_FLAGS := --s0 --source-map

LESS_SL_FILE := public/stylesheets/sl-style.less
CSS_SL_FILE := public/stylesheets/sl-style.css
LESS_OL_FILE := public/stylesheets/style.less
CSS_OL_FILE := public/stylesheets/style.css
LESS_OL_LIGHT_FILE := public/stylesheets/light-style.less
CSS_OL_LIGHT_FILE := public/stylesheets/light-style.css
LESS_OL_IEEE_FILE := public/stylesheets/ieee-style.less
CSS_OL_IEEE_FILE := public/stylesheets/ieee-style.css

CSS_FILES := $(CSS_SL_FILE) $(CSS_OL_FILE) $(CSS_OL_LIGHT_FILE) $(CSS_OL_IEEE_FILE)

public/stylesheets/%.css: $(LESS_FILES)
	$(LESSC) $(LESSC_COMMON_FLAGS) $(@D)/$*.less $(@D)/$*.css

css_full: $(CSS_FILES)

css: $(CSS_OL_FILE)

minify: $(CSS_FILES)
	$(CLEANCSS) $(CLEANCSS_FLAGS) -o $(CSS_SL_FILE) $(CSS_SL_FILE)
	$(CLEANCSS) $(CLEANCSS_FLAGS) -o $(CSS_OL_FILE) $(CSS_OL_FILE)
	$(CLEANCSS) $(CLEANCSS_FLAGS) -o $(CSS_OL_LIGHT_FILE) $(CSS_OL_LIGHT_FILE)
	$(CLEANCSS) $(CLEANCSS_FLAGS) -o $(CSS_OL_IEEE_FILE) $(CSS_OL_IEEE_FILE)

compile: css

compile_full: css_full

$(MODULE_MAKEFILES): Makefile.module
	@set -e; \
	for makefile in $(MODULE_MAKEFILES); \
	do \
		cp Makefile.module $$makefile; \
	done

#
# Clean
#

clean:
	rm -f public/stylesheets/*.css*

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
		.

build_test_frontend:
	COMPOSE_PROJECT_NAME=frontend_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) build test_frontend

publish:
	docker push $(DOCKER_REPO)/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)

tar:
	COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm tar
	COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

.PHONY:
	css_full css minify minify_css minify_es compile compile_full \
	compile_css_full compile_modules compile_modules_full clean clean_frontend \
	clean_css clean_tests clean_ci test test_module test_unit test_unit_app \
	test_unit_modules test_unit_module test_frontend test_frontend_run \
	test_frontend_build_run test_acceptance test_acceptance_app \
	test_acceptance_modules test_acceptance_module ci format format_fix lint \
	build build_test_frontend publish tar