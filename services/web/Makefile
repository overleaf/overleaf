DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml

BUILD_NUMBER ?= local
ifeq ($(BRANCH_NAME),)
  export BRANCH_NAME := $(shell git rev-parse --abbrev-ref HEAD)
endif
BRANCH_NAME_TAG_SAFE := $(subst /,--,$(BRANCH_NAME))
ifeq ($(COMMIT_SHA),)
  export COMMIT_SHA := $(shell git rev-parse HEAD)
endif
PROJECT_NAME = web
BUILD_DIR_NAME := web
PWD := $(shell pwd)
ifeq ($(MONOREPO),)
	export MONOREPO := $(shell cd ../../ && pwd)
endif

export OVERLEAF_CONFIG ?= /overleaf/services/web/test/acceptance/config/settings.test.saas.js
export BASE_CONFIG ?= ${OVERLEAF_CONFIG}

CFG_SAAS=/overleaf/services/web/test/acceptance/config/settings.test.saas.js
CFG_SERVER_CE=/overleaf/services/web/test/acceptance/config/settings.test.server-ce.js
CFG_SERVER_PRO=/overleaf/services/web/test/acceptance/config/settings.test.server-pro.js

DOCKER_COMPOSE := BUILD_NUMBER=$(BUILD_NUMBER) \
	BRANCH_NAME=$(BRANCH_NAME_TAG_SAFE) \
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

SHARD_PROJECT_NAMES = \
	unit_test_$(BUILD_DIR_NAME) \
	unit_test_all_$(BUILD_DIR_NAME) \
	unit_test_esm_$(BUILD_DIR_NAME) \
	unit_test_esm_watch_$(BUILD_DIR_NAME) \
	unit_test_mocha_$(BUILD_DIR_NAME) \
	unit_test_parallel_$(BUILD_DIR_NAME) \
	unit_test_parallel_make_$(BUILD_DIR_NAME) \
	acceptance_test_saas_$(BUILD_DIR_NAME) \
	acceptance_test_server_ce_$(BUILD_DIR_NAME) \
	acceptance_test_server_pro_$(BUILD_DIR_NAME) \
	acceptance_test_modules_merged_saas_$(BUILD_DIR_NAME) \
	acceptance_test_modules_merged_saas_1_$(BUILD_DIR_NAME) \
	acceptance_test_modules_merged_saas_2_$(BUILD_DIR_NAME) \
	acceptance_test_modules_merged_saas_3_$(BUILD_DIR_NAME) \
	acceptance_test_modules_merged_saas_4_$(BUILD_DIR_NAME) \
	acceptance_test_modules_merged_server_ce_$(BUILD_DIR_NAME) \
	acceptance_test_modules_merged_server_pro_$(BUILD_DIR_NAME) \
	frontend_test_$(BUILD_DIR_NAME) \
	test_frontend_ct_$(BUILD_DIR_NAME) \
	test_frontend_ct_core_other_$(BUILD_DIR_NAME) \
	test_frontend_ct_core_features_$(BUILD_DIR_NAME) \
	test_frontend_ct_modules_$(BUILD_DIR_NAME) \
	test_frontend_ct_editor_other_$(BUILD_DIR_NAME) \
	test_frontend_ct_editor_visual_$(BUILD_DIR_NAME) \
	tar_$(BUILD_DIR_NAME) \

CLEAN_SHARDS=$(addprefix clean/,$(SHARD_PROJECT_NAMES))
clean: $(CLEAN_SHARDS)
	-docker run --rm --volume /dev/shm:/dev/shm --user root $(IMAGE_CI) rm -rf /dev/shm/overleaf
	-docker rmi --force $(IMAGE_CI) $(IMAGE_CI)-dev $(IMAGE_CI)-pug $(IMAGE_CI)-webpack $(IMAGE_REPO_FINAL)
	-docker compose down --remove-orphans --rmi local --timeout 0 --volumes
	-git clean -dfX data/

$(CLEAN_SHARDS): clean/%:
	-COMPOSE_PROJECT_NAME=$* docker compose down --remove-orphans --rmi local --timeout 0 --volumes

clean_ci:
	$(DOCKER_COMPOSE) down -v -t 0
	docker container list | grep 'days ago' | cut -d ' ' -f 1 - | xargs -r docker container stop
	docker image prune -af --filter "until=48h"
	docker network prune -f

#
# Tests
#

test: test_unit test_acceptance test_frontend test_frontend_ct test_writefull

test_module: test_unit_module test_acceptance_module

#
# Unit tests
#

test_unit: test_unit_all
test_unit_all: export COMPOSE_PROJECT_NAME=unit_test_all_$(BUILD_DIR_NAME)
test_unit_all: mongo_migrations_for_tests
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:all

test_unit_all_silent: export COMPOSE_PROJECT_NAME=unit_test_all_$(BUILD_DIR_NAME)
test_unit_all_silent: mongo_migrations_for_tests
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:all:silent

test_unit_app: export COMPOSE_PROJECT_NAME=unit_test_$(BUILD_DIR_NAME)
test_unit_app: mongo_migrations_for_tests
	$(DOCKER_COMPOSE) run --name unit_test_$(BUILD_DIR_NAME) --rm test_unit

test_unit_parallel: export JUNIT_ROOT_SUITE_NAME = ESM unit tests - parallel
test_unit_parallel: export COMPOSE_PROJECT_NAME=unit_test_parallel_$(BUILD_DIR_NAME)
test_unit_parallel: mongo_migrations_for_tests
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:parallel

test_unit_sequential: export JUNIT_ROOT_SUITE_NAME = ESM unit tests - sequential
test_unit_sequential: export COMPOSE_PROJECT_NAME=unit_test_sequential_$(BUILD_DIR_NAME)
test_unit_sequential: mongo_migrations_for_tests
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:sequential

test_unit_watch: export COMPOSE_PROJECT_NAME=unit_test_watch_$(BUILD_DIR_NAME)
test_unit_watch: mongo_migrations_for_tests
	$(DOCKER_COMPOSE) run --rm test_unit npm run test:unit:watch

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
test_unit_app_parallel_gnu_make_docker: mongo_migrations_for_tests
	$(DOCKER_COMPOSE) run --rm test_unit \
		make test_unit_app_parallel_gnu_make --output-sync -j $(J)

TEST_UNIT_MODULES = $(MODULE_DIRS:=/test_unit)
$(TEST_UNIT_MODULES): %/test_unit: %/Makefile
test_unit_modules: mongo_migrations_for_tests $(TEST_UNIT_MODULES)

test_unit_module: mongo_migrations_for_tests
	$(MAKE) modules/$(MODULE_NAME)/test_unit

mongo_migrations_for_tests:
	$(DOCKER_COMPOSE) run --rm --workdir /overleaf/tools/migrations test_unit npm run migrations -- migrate -t saas

#
# Frontend tests
#

test_frontend: export JUNIT_ROOT_SUITE_NAME = JSDOM frontend tests
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

#
# Writefull tests
#

test_writefull: export JUNIT_ROOT_SUITE_NAME = Writefull tests
test_writefull:
	COMPOSE_PROJECT_NAME=writefull_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm test_writefull
	COMPOSE_PROJECT_NAME=writefull_test_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

# Note: The below cypress targets are for CI only
build_test_frontend_ct:
	docker run --rm --volume /dev/shm:/dev/shm --user root $(IMAGE_CI) bash -ec 'for path in /overleaf/services/web/cypress/results /overleaf/services/web/node_modules/.cache; do mkdir -p $$path; chown -R node:node $$path; done && tar -cC / overleaf | tar -xC /dev/shm'

test_frontend_ct_core_other: export CYPRESS_DOWNLOADS=./cypress/downloads/core
test_frontend_ct_core_other: export CYPRESS_RESULTS=./cypress/results/core
test_frontend_ct_core_other: export CYPRESS_SPEC_PATTERN=./test/frontend/**/*.spec.{js,jsx,ts,tsx}
test_frontend_ct_core_other: export CYPRESS_EXCLUDE_SPEC_PATTERN=./test/frontend/features/**/*.spec.{js,jsx,ts,tsx}

test_frontend_ct_core_features: export CYPRESS_DOWNLOADS=./cypress/downloads/core
test_frontend_ct_core_features: export CYPRESS_RESULTS=./cypress/results/core
test_frontend_ct_core_features: export CYPRESS_SPEC_PATTERN=./test/frontend/features/**/*.spec.{js,jsx,ts,tsx}
test_frontend_ct_core_features: export CYPRESS_EXCLUDE_SPEC_PATTERN=./test/frontend/features/source-editor/**/*.spec.{js,jsx,ts,tsx}

test_frontend_ct_modules: export CYPRESS_DOWNLOADS=./cypress/downloads/modules
test_frontend_ct_modules: export CYPRESS_RESULTS=./cypress/results/modules
test_frontend_ct_modules: export CYPRESS_SPEC_PATTERN=./modules/**/test/frontend/**/*.spec.{js,jsx,ts,tsx}

test_frontend_ct_editor_other: export CYPRESS_DOWNLOADS=./cypress/downloads/editor_other
test_frontend_ct_editor_other: export CYPRESS_RESULTS=./cypress/results/editor_other
test_frontend_ct_editor_other: export CYPRESS_SPEC_PATTERN=./test/frontend/features/source-editor/**/*.spec.{js,jsx,ts,tsx}
test_frontend_ct_editor_other: export CYPRESS_EXCLUDE_SPEC_PATTERN=./test/frontend/features/source-editor/components/codemirror-editor-visual*.spec.{js,jsx,ts,tsx}

test_frontend_ct_editor_visual: export CYPRESS_DOWNLOADS=./cypress/downloads/editor_visual
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
test_acceptance_app_saas: export JUNIT_ROOT_SUITE_NAME = SaaS app acceptance tests
test_acceptance_app_saas: export COMPOSE_PROJECT_NAME=acceptance_test_saas_$(BUILD_DIR_NAME)
test_acceptance_app_saas: export OVERLEAF_CONFIG=$(CFG_SAAS)
test_acceptance_app_server_ce: export JUNIT_ROOT_SUITE_NAME = Server CE app acceptance tests
test_acceptance_app_server_ce: export COMPOSE_PROJECT_NAME=acceptance_test_server_ce_$(BUILD_DIR_NAME)
test_acceptance_app_server_ce: export OVERLEAF_CONFIG=$(CFG_SERVER_CE)
test_acceptance_app_server_pro: export JUNIT_ROOT_SUITE_NAME = Server Pro app acceptance tests
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
test_acceptance_modules_merged_saas: export JUNIT_ROOT_SUITE_NAME = SaaS modules acceptance tests
test_acceptance_modules_merged_saas: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_saas_$(BUILD_DIR_NAME)
test_acceptance_modules_merged_saas: export BASE_CONFIG = $(CFG_SAAS)

test_acceptance_modules_merged_server_ce: export JUNIT_ROOT_SUITE_NAME = Server CE modules acceptance tests
test_acceptance_modules_merged_server_ce: export COMPOSE_PROJECT_NAME = \
	acceptance_test_modules_merged_server_ce_$(BUILD_DIR_NAME)
test_acceptance_modules_merged_server_ce: export BASE_CONFIG = $(CFG_SERVER_CE)

test_acceptance_modules_merged_server_pro: export JUNIT_ROOT_SUITE_NAME = Server Pro modules acceptance tests
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
$(TEST_ACCEPTANCE_MODULES_MERGED_SPLIT_SAAS): export JUNIT_ROOT_SUITE_NAME = SaaS modules acceptance tests

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
	docker run --rm --env BRANCH_NAME --env CI --env COMMIT_SHA --env MONOREPO --volume ${PWD}/data/reports:/overleaf/services/web/data/reports ${IMAGE_CI}

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
ifeq ($(CI),true)
	-npm run lint -- --format json --output-file data/reports/eslint.json
	sed -i 's_"filePath":"/overleaf_"filePath":"$(MONOREPO)_g' data/reports/eslint.json
else
	npm run lint
endif

lint: lint_stylelint
lint_stylelint:
ifeq ($(CI),true)
	-npm run lint:styles -- --formatter json --output-file data/reports/stylelint.json
	sed -i 's_"source":"/overleaf_"source":"$(MONOREPO)_g' data/reports/stylelint.json
else
	npm run lint:styles
endif

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

format: format_pug
format_pug:
	npm run --silent format:pug

format: format_jenkins
format_jenkins:
	npm run --silent format:jenkins

format_fix:
	npm run --silent format:fix

format_styles_fix:
	npm run --silent format:styles:fix

format_pug_fix:
	npm run --silent format:pug:fix

format_jenkins_fix:
	npm run --silent format:jenkins:fix

format_in_docker:
	$(RUN_LINT_FORMAT) make format -j2 --output-sync

SHELLCHECK_OPTS = \
	--shell=bash \
	--external-sources
SHELLCHECK_COLOR := $(if $(CI),--color=never,--color)
SHELLCHECK_FILES := { git ls-files "*.sh" -z; git grep -Plz "\A\#\!.*bash"; } | sort -zu

shellcheck:
	@$(SHELLCHECK_FILES) | xargs -0 -r docker run --rm -v $(PWD):/mnt -w /mnt \
		koalaman/shellcheck:stable $(SHELLCHECK_OPTS) $(SHELLCHECK_COLOR)

shellcheck_fix:
	@$(SHELLCHECK_FILES) | while IFS= read -r -d '' file; do \
		diff=$$(docker run --rm -v $(PWD):/mnt -w /mnt koalaman/shellcheck:stable $(SHELLCHECK_OPTS) --format=diff "$$file" 2>/dev/null); \
		if [ -n "$$diff" ] && ! echo "$$diff" | patch -p1 >/dev/null 2>&1; then echo "\033[31m$$file\033[0m"; \
		elif [ -n "$$diff" ]; then echo "$$file"; \
		else echo "\033[2m$$file\033[0m"; fi \
	done

#
# Build & publish
#

IMAGE_CI ?= ci/$(PROJECT_NAME):$(BRANCH_NAME_TAG_SAFE)-$(BUILD_NUMBER)
IMAGE_REPO ?= us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME)
IMAGE_REPO_FINAL ?= $(IMAGE_REPO):$(BRANCH_NAME_TAG_SAFE)-$(BUILD_NUMBER)
# A shared scratch tag that is used by all the pipelines for pushing the layers of the production image ASAP from a parallel step.
# We do not want to make the image available before all the tests have passed.
# Using a single tag avoids generating cruft in our docker repository / AR.
IMAGE_SCRATCH ?= $(IMAGE_REPO):do-not-use-this-tag-for-deploys--it-is-used-for-early-pushes-in-ci
IMAGE_CACHE ?= $(IMAGE_REPO):cache-$(shell cat \
	$(MONOREPO)/package.json \
	$(MONOREPO)/package-lock.json \
	$(MONOREPO)/libraries/access-token-encryptor/package.json \
  $(MONOREPO)/libraries/eslint-plugin/package.json \
  $(MONOREPO)/libraries/fetch-utils/package.json \
  $(MONOREPO)/libraries/logger/package.json \
  $(MONOREPO)/libraries/metrics/package.json \
  $(MONOREPO)/libraries/mongo-utils/package.json \
  $(MONOREPO)/libraries/o-error/package.json \
  $(MONOREPO)/libraries/object-persistor/package.json \
  $(MONOREPO)/libraries/overleaf-editor-core/package.json \
  $(MONOREPO)/libraries/promise-utils/package.json \
  $(MONOREPO)/libraries/ranges-tracker/package.json \
  $(MONOREPO)/libraries/redis-wrapper/package.json \
  $(MONOREPO)/libraries/settings/package.json \
  $(MONOREPO)/libraries/stream-utils/package.json \
  $(MONOREPO)/libraries/validation-tools/package.json \
	$(MONOREPO)/services/web/package.json \
	$(MONOREPO)/patches/* \
| sha256sum | cut -d '-' -f1)

export SENTRY_RELEASE ?= ${COMMIT_SHA}

build_deps:
	docker build --pull \
		--build-arg BUILDKIT_INLINE_CACHE=1 \
		--cache-from $(IMAGE_CACHE) \
		--tag $(IMAGE_CACHE) \
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
		--tag $(IMAGE_CI)-webpack \
		--target webpack \
		--file Dockerfile \
		../..

build_pug:
	docker build \
		--build-arg SENTRY_RELEASE \
		--tag $(IMAGE_CI)-pug \
		--target pug \
		--file Dockerfile \
		../..

build:
	docker build \
		--build-arg SENTRY_RELEASE \
		--tag $(IMAGE_REPO_FINAL) \
		--tag $(IMAGE_SCRATCH) \
		--target app \
		--file Dockerfile \
		../..

publish:
	docker push $(IMAGE_REPO_FINAL)

push_branch:
	docker push $(IMAGE_CACHE)

push_scratch:
	docker push $(IMAGE_SCRATCH)

SENTRY_IMAGE=getsentry/sentry-cli:2.16.1
sentry_prefetch:
	docker pull $(SENTRY_IMAGE)

sentry_upload:
	docker run --rm \
		--volume $(MONOREPO):$(MONOREPO) --workdir $(PWD) \
		--user "$(shell id -u):$(shell id -g)" \
		--env BRANCH_NAME --env SENTRY_RELEASE \
		--entrypoint bin/sentry_upload \
		$(SENTRY_IMAGE)

tar:
	COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) run --rm tar
	COMPOSE_PROJECT_NAME=tar_$(BUILD_DIR_NAME) $(DOCKER_COMPOSE) down -v -t 0

build_storybook:
	npm run lezer-latex:generate
	mkdir -p data/storybook/
	npm run build-storybook -- --output-dir data/storybook/$(BRANCH_NAME)

storybook_index:
	mkdir -p data/storybook/
	m4 \
		-DLIST="$(shell gsutil ls "${BUCKET}/" \
										| sed -E "s@^${BUCKET}/([^/]+)/@\1@" \
										| grep -v -e index.html \
										| sort \
										| tr '\n' ,)" \
		-DBRANCH_NAME="${BRANCH_NAME}" .storybook/index.html.m4 \
	> data/storybook/index.html

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
	test test_module mongo_migrations_for_tests test_unit test_unit_app \
	test_unit_modules test_unit_module test_frontend \
	test_acceptance test_acceptance_app test_acceptance_modules \
	test_acceptance_module ci format format_fix lint \
	shellcheck shellcheck_fix \
	build publish tar
