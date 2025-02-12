DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml

BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_NAME = web
BUILD_DIR_NAME = $(shell pwd | xargs basename | tr -cd '[a-zA-Z0-9_.\-]')

export OVERLEAF_CONFIG ?= /overleaf/services/web/test/acceptance/config/settings.test.saas.js
export BASE_CONFIG ?= ${OVERLEAF_CONFIG}

CFG_SAAS=/overleaf/services/web/test/acceptance/config/settings.test.saas.js
CFG_SERVER_CE=/overleaf/services/web/test/acceptance/config/settings.test.server-ce.js
CFG_SERVER_PRO=/overleaf/services/web/test/acceptance/config/settings.test.server-pro.js

DOCKER_COMPOSE := BUILD_NUMBER=$(BUILD_NUMBER) \
	BRANCH_NAME=$(BRANCH_NAME) \
	PROJECT_NAME=$(PROJECT_NAME) \
	MOCHA_GREP=${MOCHA_GREP} \
	docker compose ${DOCKER_COMPOSE_FLAGS}

MODULE_DIRS := $(shell find modules -mindepth 1 -maxdepth 1 -type d -not -name '.git' )
MODULE_MAKEFILES := $(MODULE_DIRS:=/Makefile)
MODULE_NAME=$(shell basename $(MODULE))

$(MODULE_MAKEFILES): Makefile.module
	cp Makefile.module $@ || diff Makefile.module $@

#
# Clean
#

clean:
	-$(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=unit_test_all_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=unit_test_parallel_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=unit_test_parallel_make_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_test_saas_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_test_server_ce_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_test_server_pro_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_modules_merged_saas_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_modules_merged_saas_1_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_modules_merged_saas_2_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_modules_merged_saas_3_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_modules_merged_saas_4_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_modules_merged_server_ce_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=acceptance_modules_merged_server_pro_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=test_frontend_ct_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local
	-COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down --rmi local

clean_ci:
	$(DOCKER_COMPOSE) down -v -t 0
	docker container list | grep 'days ago' | cut -d ' ' -f 1 - | xargs -r docker container stop
	docker image prune -af --filter "until=48h"
	docker network prune -f

#
# Tests
#

test: test_unit test_acceptance test_frontend test_frontend_ct

test_module: test_unit_module test_acceptance_module

#
# Unit tests
#

test_unit: test_unit_all
test_unit_all: export COMPOSE_PROJECT_NAME=unit_test_all_$(BUILD_DIR_NAME)
test_unit_all:
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:all
	$(DOCKER_COMPOSE) down -v -t 0

test_unit_all_silent: export COMPOSE_PROJECT_NAME=unit_test_all_$(BUILD_DIR_NAME)
test_unit_all_silent:
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:all:silent
	$(DOCKER_COMPOSE) down -v -t 0

test_unit_app: export COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME)
test_unit_app:
	$(DOCKER_COMPOSE) run --name unit_test_$(BUILD_DIR_NAME) --rm test_unit
	$(DOCKER_COMPOSE) down -v -t 0

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
	$(DOCKER_COMPOSE) run --rm test_unit \
		make test_unit_app_parallel_gnu_make --output-sync -j $(J)
	$(DOCKER_COMPOSE) down -v -t 0

TEST_UNIT_MODULES = $(MODULE_DIRS:=/test_unit)
$(TEST_UNIT_MODULES): %/test_unit: %/Makefile
test_unit_modules: $(TEST_UNIT_MODULES)

test_unit_module:
	$(MAKE) modules/$(MODULE_NAME)/test_unit


#
# Frontend tests
#

test_frontend:
	COMPOSE_PROJECT_NAME=frontend_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm test_frontend
	COMPOSE_PROJECT_NAME=frontend_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

#
# Frontend component tests in Cypress
#
# Local development: use $ make test_frontend_ct
#
TEST_FRONTEND_CT_VARIANTS = \
	test_frontend_ct \
	test_frontend_ct_core_other \
	test_frontend_ct_core_features \
	test_frontend_ct_modules \
	test_frontend_ct_editor_other \
	test_frontend_ct_editor_visual \

# Note: The below cypress targets are for CI only
build_test_frontend_ct:
	docker run --rm --volume /dev/shm:/dev/shm --user root $(IMAGE_CI) bash -ec 'tar -cC / overleaf | tar -xC /dev/shm'

test_frontend_ct_core_other: export CYPRESS_RESULTS=./cypress/results/core
test_frontend_ct_core_other: export CYPRESS_SPEC_PATTERN=./test/frontend/**/*.spec.{js,jsx,ts,tsx}
test_frontend_ct_core_other: export CYPRESS_EXCLUDE_SPEC_PATTERN=./test/frontend/features/**/*.spec.{js,jsx,ts,tsx}

test_frontend_ct_core_features: export CYPRESS_RESULTS=./cypress/results/core
test_frontend_ct_core_features: export CYPRESS_SPEC_PATTERN=./test/frontend/features/**/*.spec.{js,jsx,ts,tsx}
test_frontend_ct_core_features: export CYPRESS_EXCLUDE_SPEC_PATTERN=./test/frontend/features/source-editor/**/*.spec.{js,jsx,ts,tsx}

test_frontend_ct_modules: export CYPRESS_RESULTS=./cypress/results/modules
test_frontend_ct_modules: export CYPRESS_SPEC_PATTERN=./modules/**/test/frontend/**/*.spec.{js,jsx,ts,tsx}

test_frontend_ct_editor_other: export CYPRESS_RESULTS=./cypress/results/editor_other
test_frontend_ct_editor_other: export CYPRESS_SPEC_PATTERN=./test/frontend/features/source-editor/**/*.spec.{js,jsx,ts,tsx}
test_frontend_ct_editor_other: export CYPRESS_EXCLUDE_SPEC_PATTERN=./test/frontend/features/source-editor/components/codemirror-editor-visual*.spec.{js,jsx,ts,tsx}

test_frontend_ct_editor_visual: export CYPRESS_RESULTS=./cypress/results/editor_visual
test_frontend_ct_editor_visual: export CYPRESS_SPEC_PATTERN=./test/frontend/features/source-editor/components/codemirror-editor-visual*.spec.{js,jsx,ts,tsx}

$(TEST_FRONTEND_CT_VARIANTS):
	COMPOSE_PROJECT_NAME=$@_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm test_frontend_ct
	COMPOSE_PROJECT_NAME=$@_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

#
# Acceptance tests
#

test_acceptance: test_acceptance_app test_acceptance_modules
test_acceptance_saas: test_acceptance_app_saas test_acceptance_modules_merged_saas
test_acceptance_server_ce: test_acceptance_app_server_ce test_acceptance_modules_merged_server_ce
test_acceptance_server_pro: test_acceptance_app_server_pro test_acceptance_modules_merged_server_pro

TEST_ACCEPTANCE_APP :=  \
	test_acceptance_app_saas \
	test_acceptance_app_server_ce \
	test_acceptance_app_server_pro \

test_acceptance_app: $(TEST_ACCEPTANCE_APP)
test_acceptance_app_saas: export COMPOSE_PROJECT_NAME=acceptance_test_saas_$(BUILD_DIR_NAME)
test_acceptance_app_saas: export OVERLEAF_CONFIG=$(CFG_SAAS)
test_acceptance_app_server_ce: export COMPOSE_PROJECT_NAME=acceptance_test_server_ce_$(BUILD_DIR_NAME)
test_acceptance_app_server_ce: export OVERLEAF_CONFIG=$(CFG_SERVER_CE)
test_acceptance_app_server_pro: export COMPOSE_PROJECT_NAME=acceptance_test_server_pro_$(BUILD_DIR_NAME)
test_acceptance_app_server_pro: export OVERLEAF_CONFIG=$(CFG_SERVER_PRO)

$(TEST_ACCEPTANCE_APP):
	$(DOCKER_COMPOSE) run --rm test_acceptance
	$(DOCKER_COMPOSE) down -v -t 0

# We are using _make magic_ for turning these file-targets into calls to
#  sub-Makefiles in the individual modules.
# These sub-Makefiles need to be kept in sync with the template, hence we
#  add a dependency on each modules Makefile and cross-link that to the
#  template at the very top of this file.
# Example: `web$ make modules/server-ce-scripts/test_acceptance_server_ce`
# Description: Run the acceptance tests of the server-ce-scripts module in an
#               Overleaf Community Edition Environment.
# Break down:
#  Target: modules/server-ce-scripts/test_acceptance_server_ce
#    -> depends on modules/server-ce-scripts/Makefile
#    -> add environment variable BASE_CONFIG=$(CFG_SERVER_CE)
#    -> BASE_CONFIG=/overleaf/services/web/test/acceptance/config/settings.test.server-ce.js
#    -> automatic target: `make -C server-ce-scripts test_acceptance_server_ce`
#    -> automatic target: run `make test_acceptance_server_ce` in module
#  Target: modules/server-ce-scripts/Makefile
#    -> depends on Makefile.module
#    -> automatic target: copies the file when changed
TEST_ACCEPTANCE_MODULES = $(MODULE_DIRS:=/test_acceptance)
$(TEST_ACCEPTANCE_MODULES): %/test_acceptance: %/Makefile
$(TEST_ACCEPTANCE_MODULES): modules/%/test_acceptance:
	$(MAKE) test_acceptance_module MODULE_NAME=$*

TEST_ACCEPTANCE_MODULES_SAAS = $(MODULE_DIRS:=/test_acceptance_saas)
$(TEST_ACCEPTANCE_MODULES_SAAS): %/test_acceptance_saas: %/Makefile
$(TEST_ACCEPTANCE_MODULES_SAAS): export BASE_CONFIG = $(CFG_SAAS)

# This line adds `/test_acceptance_saas` suffix to all items in $(MODULE_DIRS).
TEST_ACCEPTANCE_MODULES_SERVER_CE = $(MODULE_DIRS:=/test_acceptance_server_ce)
# This line adds a dependency on the modules Makefile.
$(TEST_ACCEPTANCE_MODULES_SERVER_CE): %/test_acceptance_server_ce: %/Makefile
# This line adds the environment variable BASE_CONFIG=$(CFG_SERVER_CE) to all
#  invocations of `web$ make modules/foo/test_acceptance_server_ce`.
$(TEST_ACCEPTANCE_MODULES_SERVER_CE): export BASE_CONFIG = $(CFG_SERVER_CE)

TEST_ACCEPTANCE_MODULES_SERVER_PRO = $(MODULE_DIRS:=/test_acceptance_server_pro)
$(TEST_ACCEPTANCE_MODULES_SERVER_PRO): %/test_acceptance_server_pro: %/Makefile
$(TEST_ACCEPTANCE_MODULES_SERVER_PRO): export BASE_CONFIG = $(CFG_SERVER_PRO)

CLEAN_TEST_ACCEPTANCE_MODULES = $(MODULE_DIRS:=/clean_test_acceptance)
$(CLEAN_TEST_ACCEPTANCE_MODULES): %/clean_test_acceptance: %/Makefile
clean_test_acceptance_modules: $(CLEAN_TEST_ACCEPTANCE_MODULES)
clean_ci: clean_test_acceptance_modules

test_acceptance_module_noop:
	@echo
	@echo Module '$(MODULE_NAME)' does not run in ${LABEL}.
	@echo

TEST_ACCEPTANCE_MODULE_MAYBE_IN := \
	test_acceptance_module_maybe_in_saas \
	test_acceptance_module_maybe_in_server_ce \
	test_acceptance_module_maybe_in_server_pro \

test_acceptance_module: $(TEST_ACCEPTANCE_MODULE_MAYBE_IN)
test_acceptance_module_maybe_in_saas: export BASE_CONFIG=$(CFG_SAAS)
test_acceptance_module_maybe_in_server_ce: export BASE_CONFIG=$(CFG_SERVER_CE)
test_acceptance_module_maybe_in_server_pro: export BASE_CONFIG=$(CFG_SERVER_PRO)

# We need to figure out whether the module is loaded in a given environment.
# This information is stored in the (base-)settings.
# We get the full list of modules and check for a matching module entry.
# Either the grep will find and emit the module, or exits with code 1, which
#  we handle with a fallback to a noop make target.
# Run the node command in a docker compose container which provides the needed
#  npm dependencies (from disk in dev-env or from the CI image in CI).
# Pick the test_unit service which is very light-weight -- the test_acceptance
#  service would start mongo/redis.
$(TEST_ACCEPTANCE_MODULE_MAYBE_IN): test_acceptance_module_maybe_in_%:
	$(MAKE) $(shell \
		OVERLEAF_CONFIG=$(BASE_CONFIG) \
		$(DOCKER_COMPOSE) run --rm test_unit \
		node test/acceptance/getModuleTargets test_acceptance_$* \
		| grep -e /$(MODULE_NAME)/ || echo test_acceptance_module_noop LABEL=$* \
	)

# See docs for test_acceptance_server_ce how this works.
test_acceptance_module_saas: export BASE_CONFIG = $(CFG_SAAS)
test_acceptance_module_saas:
	$(MAKE) modules/$(MODULE_NAME)/test_acceptance_saas

test_acceptance_module_server_ce: export BASE_CONFIG = $(CFG_SERVER_CE)
test_acceptance_module_server_ce:
	$(MAKE) modules/$(MODULE_NAME)/test_acceptance_server_ce

test_acceptance_module_server_pro: export BASE_CONFIG = $(CFG_SERVER_PRO)
test_acceptance_module_server_pro:
	$(MAKE) modules/$(MODULE_NAME)/test_acceptance_server_pro

# See docs for test_acceptance_server_ce how this works.
TEST_ACCEPTANCE_MODULES_MERGED_INNER = $(MODULE_DIRS:=/test_acceptance_merged_inner)
$(TEST_ACCEPTANCE_MODULES_MERGED_INNER): %/test_acceptance_merged_inner: %/Makefile
test_acceptance_modules_merged_inner:
	$(MAKE) $(shell \
		OVERLEAF_CONFIG=$(BASE_CONFIG) \
		node test/acceptance/getModuleTargets test_acceptance_merged_inner \
	)

# inner loop for running saas tests in parallel
no_more_targets:

# If we ever have more than 40 modules, we need to add _5 targets to all the places and have it START at 41.
test_acceptance_modules_merged_inner_1: export START=1
test_acceptance_modules_merged_inner_2: export START=11
test_acceptance_modules_merged_inner_3: export START=21
test_acceptance_modules_merged_inner_4: export START=31
TEST_ACCEPTANCE_MODULES_MERGED_INNER_SPLIT = \
	test_acceptance_modules_merged_inner_1 \
	test_acceptance_modules_merged_inner_2 \
	test_acceptance_modules_merged_inner_3 \
	test_acceptance_modules_merged_inner_4 \

# The node script prints one module per line.
# Using tail and head we skip over the first n=START entries and print the last 10.
# Finally we check with grep for any targets in a batch and print a fallback if none were found.
$(TEST_ACCEPTANCE_MODULES_MERGED_INNER_SPLIT):
	$(MAKE) $(shell \
		OVERLEAF_CONFIG=$(BASE_CONFIG) \
		node test/acceptance/getModuleTargets test_acceptance_merged_inner \
		| tail -n+$(START) | head -n 10 \
		| grep -e . || echo no_more_targets \
	)

# See docs for test_acceptance_server_ce how this works.
test_acceptance_modules_merged_saas: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_saas_$(BUILD_DIR_NAME)
test_acceptance_modules_merged_saas: export BASE_CONFIG = $(CFG_SAAS)

test_acceptance_modules_merged_server_ce: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_server_ce_$(BUILD_DIR_NAME)
test_acceptance_modules_merged_server_ce: export BASE_CONFIG = $(CFG_SERVER_CE)

test_acceptance_modules_merged_server_pro: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_server_pro_$(BUILD_DIR_NAME)
test_acceptance_modules_merged_server_pro: export BASE_CONFIG = $(CFG_SERVER_PRO)

# All these variants run the same command.
# Each target has a different set of environment defined above.
TEST_ACCEPTANCE_MODULES_MERGED_VARIANTS = \
	test_acceptance_modules_merged_saas \
	test_acceptance_modules_merged_server_ce \
	test_acceptance_modules_merged_server_pro \

$(TEST_ACCEPTANCE_MODULES_MERGED_VARIANTS):
	$(DOCKER_COMPOSE) run --rm test_acceptance make test_acceptance_modules_merged_inner
	$(DOCKER_COMPOSE) down -v -t 0

# outer loop for running saas tests in parallel
TEST_ACCEPTANCE_MODULES_MERGED_SPLIT_SAAS = \
	test_acceptance_modules_merged_saas_1 \
	test_acceptance_modules_merged_saas_2 \
	test_acceptance_modules_merged_saas_3 \
	test_acceptance_modules_merged_saas_4 \

test_acceptance_modules_merged_saas_1: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_saas_1_$(BUILD_DIR_NAME)
test_acceptance_modules_merged_saas_2: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_saas_2_$(BUILD_DIR_NAME)
test_acceptance_modules_merged_saas_3: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_saas_3_$(BUILD_DIR_NAME)
test_acceptance_modules_merged_saas_4: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_saas_4_$(BUILD_DIR_NAME)
$(TEST_ACCEPTANCE_MODULES_MERGED_SPLIT_SAAS): export BASE_CONFIG = $(CFG_SAAS)

$(TEST_ACCEPTANCE_MODULES_MERGED_SPLIT_SAAS): test_acceptance_modules_merged_saas_%:
	$(DOCKER_COMPOSE) run --rm test_acceptance make test_acceptance_modules_merged_inner_$*
	$(DOCKER_COMPOSE) down -v -t 0

test_acceptance_modules: $(TEST_ACCEPTANCE_MODULES_MERGED_VARIANTS)

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

NODE_MODULES_PATH := ${PATH}:${PWD}/node_modules/.bin:/overleaf/services/web/node_modules/.bin
WITH_NODE_MODULES_PATH = \
	format_backend \
	format_frontend \
	format_misc \
	format_styles \
	format_test_app_unit \
	format_test_app_rest \
	format_test_modules \
	$(TEST_SUITES) \

$(WITH_NODE_MODULES_PATH): export PATH=$(NODE_MODULES_PATH)

lint: lint_eslint
lint_eslint:
	npm run lint

lint: lint_stylelint
lint_stylelint:
	npm run lint:styles

lint: lint_pug
lint_pug:
	bin/lint_pug_templates

lint: lint_locales
lint_locales:
	bin/lint_locales

lint: check_extracted_translations
check_extracted_translations:
	bin/check_extracted_translations

sort_locales:
	 node scripts/translations/sort.js

cleanup_unused_locales:
	 node scripts/translations/cleanupUnusedLocales.js

lint: lint_flag_res_send_usage
lint_flag_res_send_usage:
	bin/lint_flag_res_send_usage

lint: lint_overleafModuleImports
lint_overleafModuleImports:
	node scripts/check_overleafModuleImports.mjs

lint: typecheck_frontend
typecheck_frontend:
	npm run --silent type-check

lint: typecheck_backend
typecheck_backend:
	npm run --silent type-check:backend

lint_in_docker:
	$(RUN_LINT_FORMAT) make lint -j2 --output-sync

format: format_js
format_js:
	npm run --silent format

format: format_styles
format_styles:
	npm run --silent format:styles

format_fix:
	npm run --silent format:fix

format_styles_fix:
	npm run --silent format:styles:fix

format_in_docker:
	$(RUN_LINT_FORMAT) make format -j2 --output-sync

#
# Build & publish
#

IMAGE_CI ?= ci/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)
IMAGE_REPO ?= us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME)
IMAGE_REPO_BRANCH ?= $(IMAGE_REPO):$(BRANCH_NAME)
IMAGE_REPO_MAIN ?= $(IMAGE_REPO):main
IMAGE_REPO_FINAL ?= $(IMAGE_REPO_BRANCH)-$(BUILD_NUMBER)

export SENTRY_RELEASE ?= ${COMMIT_SHA}

build_deps:
	docker build --pull \
		--build-arg BUILDKIT_INLINE_CACHE=1 \
		--cache-from $(IMAGE_REPO_BRANCH)-deps \
		--cache-from $(IMAGE_REPO_MAIN)-deps \
		--tag $(IMAGE_REPO_BRANCH)-deps \
		--target deps \
		--file Dockerfile \
		../..

build_dev:
	docker build \
		--build-arg SENTRY_RELEASE \
		--tag $(IMAGE_CI) \
		--tag $(IMAGE_CI)-dev \
		--target dev \
		--file Dockerfile \
		../..

build_webpack:
	$(MAKE) build_webpack_once \
	|| $(MAKE) build_webpack_once

build_webpack_once:
	docker build \
		--build-arg SENTRY_RELEASE \
		--cache-from $(IMAGE_CI)-dev \
		--cache-from $(IMAGE_CI)-webpack \
		--tag $(IMAGE_CI)-webpack \
		--target webpack \
		--file Dockerfile \
		../..

build_pug:
	docker build \
		--build-arg SENTRY_RELEASE \
		--cache-from $(IMAGE_CI)-dev \
		--tag $(IMAGE_CI)-pug \
		--target pug \
		--file Dockerfile \
		../..

build:
	docker build \
		--build-arg SENTRY_RELEASE \
		--cache-from $(IMAGE_CI)-webpack \
		--cache-from $(IMAGE_CI)-pug \
		--cache-from $(IMAGE_REPO_FINAL) \
		--tag $(IMAGE_REPO_FINAL) \
		--target app \
		--file Dockerfile \
		../..

publish:
	docker push $(IMAGE_REPO_FINAL)

tar:
	COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm tar
	COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

build_storybook:
	npm run lezer-latex:generate
	npm run build-storybook
	if [ -n "$(BRANCH_NAME)" ]; then \
	  echo "Renaming storybook-static -> $(BRANCH_NAME)."; \
	  d=$$(dirname "$(BRANCH_NAME)"); \
	  mkdir -p "storybook-output/$$d"; \
	  mv storybook-static "storybook-output/$$d/$$(basename "$(BRANCH_NAME)")/"; \
	fi

MODULE_TARGETS = \
	$(TEST_ACCEPTANCE_MODULES_SAAS) \
	$(TEST_ACCEPTANCE_MODULES_SERVER_CE) \
	$(TEST_ACCEPTANCE_MODULES_SERVER_PRO) \
	$(TEST_ACCEPTANCE_MODULES_MERGED_INNER) \
	$(CLEAN_TEST_ACCEPTANCE_MODULES) \
	$(TEST_UNIT_MODULES) \

$(MODULE_TARGETS):
	$(MAKE) -C $(dir $@) $(notdir $@) BUILD_DIR_NAME=$(BUILD_DIR_NAME)

.PHONY:
	$(MODULE_TARGETS) \
	compile_modules compile_modules_full clean_ci \
	test test_module test_unit test_unit_app \
	test_unit_modules test_unit_module test_frontend \
	test_acceptance test_acceptance_app test_acceptance_modules \
	test_acceptance_module ci format format_fix lint \
	build publish tar
