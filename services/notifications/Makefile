# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
BRANCH_NAME_TAG_SAFE = $(shell echo $(BRANCH_NAME) | sed 's/\//\-\-/g')
PROJECT_NAME = notifications
BUILD_DIR_NAME = $(shell pwd | xargs basename | tr -cd '[a-zA-Z0-9_.\-]')
HERE=$(shell pwd)
export MONOREPO ?= $(shell cd ../../ && pwd)
IMAGE_CI ?= ci/$(PROJECT_NAME):$(BRANCH_NAME_TAG_SAFE)-$(BUILD_NUMBER)
IMAGE_REPO ?= us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME)
IMAGE_REPO_FINAL ?= $(IMAGE_REPO):$(BRANCH_NAME_TAG_SAFE)-$(BUILD_NUMBER)
IMAGE_CACHE ?= $(IMAGE_REPO):cache-$(shell cat \
	$(MONOREPO)/package.json \
	$(MONOREPO)/package-lock.json \
	$(MONOREPO)/libraries/fetch-utils/package.json \
	$(MONOREPO)/libraries/logger/package.json \
	$(MONOREPO)/libraries/metrics/package.json \
	$(MONOREPO)/libraries/mongo-utils/package.json \
	$(MONOREPO)/libraries/o-error/package.json \
	$(MONOREPO)/libraries/promise-utils/package.json \
	$(MONOREPO)/libraries/settings/package.json \
	$(MONOREPO)/libraries/validation-tools/package.json \
	$(MONOREPO)/services/notifications/package.json \
	$(MONOREPO)/tools/migrations/package.json \
	$(MONOREPO)/patches/* \
| sha256sum | cut -d '-' -f1)

DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml
DOCKER_COMPOSE := BUILD_NUMBER=$(BUILD_NUMBER) \
	BRANCH_NAME=$(BRANCH_NAME_TAG_SAFE) \
	PROJECT_NAME=$(PROJECT_NAME) \
	MOCHA_GREP=${MOCHA_GREP} \
	docker compose ${DOCKER_COMPOSE_FLAGS}

COMPOSE_PROJECT_NAME_TEST_ACCEPTANCE ?= test_acceptance_$(BUILD_DIR_NAME)
DOCKER_COMPOSE_TEST_ACCEPTANCE = \
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME_TEST_ACCEPTANCE) $(DOCKER_COMPOSE)

COMPOSE_PROJECT_NAME_TEST_UNIT ?= test_unit_$(BUILD_DIR_NAME)
DOCKER_COMPOSE_TEST_UNIT = \
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME_TEST_UNIT) $(DOCKER_COMPOSE)

clean:
	-docker rmi $(IMAGE_CI)
	-docker rmi $(IMAGE_REPO_FINAL)
	-$(DOCKER_COMPOSE_TEST_UNIT) down --remove-orphans --rmi local --timeout 0 --volumes
	-$(DOCKER_COMPOSE_TEST_ACCEPTANCE) down --remove-orphans --rmi local --timeout 0 --volumes
	-rm -rf reports/

# Run the linting commands in the scope of the monorepo.
# Eslint and prettier (plus some configs) are on the root.
RUN_LINTING = docker run --rm -v $(MONOREPO):$(MONOREPO) -w $(HERE) node:22.18.0 npm run --silent

RUN_LINTING_CI = docker run --rm --volume $(MONOREPO)/.editorconfig:/overleaf/.editorconfig --volume $(MONOREPO)/.eslintignore:/overleaf/.eslintignore --volume $(MONOREPO)/.eslintrc:/overleaf/.eslintrc --volume $(MONOREPO)/.prettierignore:/overleaf/.prettierignore --volume $(MONOREPO)/.prettierrc:/overleaf/.prettierrc --volume $(MONOREPO)/tsconfig.backend.json:/overleaf/tsconfig.backend.json --volume $(MONOREPO)/services/notifications/reports:/overleaf/services/notifications/reports $(IMAGE_CI) npm run --silent

# Same but from the top of the monorepo
RUN_LINTING_MONOREPO = docker run --rm -v $(MONOREPO):$(MONOREPO) -w $(MONOREPO) node:22.18.0 npm run --silent

SHELLCHECK_OPTS = \
	--shell=bash \
	--external-sources
SHELLCHECK_COLOR := $(if $(CI),--color=never,--color)
SHELLCHECK_FILES := { git ls-files "*.sh" -z; git grep -Plz "\A\#\!.*bash"; } | sort -zu

shellcheck:
	@$(SHELLCHECK_FILES) | xargs -0 -r docker run --rm -v $(HERE):/mnt -w /mnt \
		koalaman/shellcheck:stable $(SHELLCHECK_OPTS) $(SHELLCHECK_COLOR)

shellcheck_fix:
	@$(SHELLCHECK_FILES) | while IFS= read -r -d '' file; do \
		diff=$$(docker run --rm -v $(HERE):/mnt -w /mnt koalaman/shellcheck:stable $(SHELLCHECK_OPTS) --format=diff "$$file" 2>/dev/null); \
		if [ -n "$$diff" ] && ! echo "$$diff" | patch -p1 >/dev/null 2>&1; then echo "\033[31m$$file\033[0m"; \
		elif [ -n "$$diff" ]; then echo "$$file"; \
		else echo "\033[2m$$file\033[0m"; fi \
	done

format:
	$(RUN_LINTING) format

format_ci:
	$(RUN_LINTING_CI) format

format_fix:
	$(RUN_LINTING) format:fix

lint:
	$(RUN_LINTING) lint

lint_ci:
	-$(RUN_LINTING_CI) lint -- --format json --output-file reports/eslint.json
	sed -i 's_"filePath":"/overleaf_"filePath":"$(MONOREPO)_g' reports/eslint.json

lint_fix:
	$(RUN_LINTING) lint:fix

typecheck:
	$(RUN_LINTING) types:check

typecheck_ci:
	$(RUN_LINTING_CI) types:check

test: format lint typecheck shellcheck test_unit test_acceptance

test_unit:
ifneq (,$(wildcard test/unit))
	$(DOCKER_COMPOSE_TEST_UNIT) run --rm test_unit
endif

test_clean: test_unit_clean
test_unit_clean:
ifneq (,$(wildcard test/unit))
	$(DOCKER_COMPOSE_TEST_UNIT) down -v -t 0
endif

test_acceptance: test_acceptance_clean test_acceptance_pre_run test_acceptance_run
	$(MAKE) test_acceptance_clean

test_acceptance_debug: test_acceptance_clean test_acceptance_pre_run test_acceptance_run_debug
	$(MAKE) test_acceptance_clean

test_acceptance_run:
ifneq (,$(wildcard test/acceptance))
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) run --rm test_acceptance
endif

test_acceptance_run_debug:
ifneq (,$(wildcard test/acceptance))
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) run -p 127.0.0.9:19999:19999 --rm test_acceptance npm run test:acceptance -- --inspect=0.0.0.0:19999 --inspect-brk
endif

test_clean: test_acceptance_clean
test_acceptance_clean:
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) down -v -t 0

test_acceptance_pre_run:
ifneq (,$(wildcard test/acceptance/js/scripts/pre-run))
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) run --rm test_acceptance test/acceptance/js/scripts/pre-run
endif

benchmarks:
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) run --rm test_acceptance npm run benchmarks

build:
	docker build \
		--pull \
		--build-arg BUILDKIT_INLINE_CACHE=1 \
		--tag $(IMAGE_CI) \
		--tag $(IMAGE_CACHE) \
		--tag $(IMAGE_REPO_FINAL) \
		--cache-from $(IMAGE_CACHE) \
		--file Dockerfile \
		../..

tar:
	$(DOCKER_COMPOSE) up tar

push:
	docker push $(IMAGE_REPO_FINAL)

push_branch:
	docker push $(IMAGE_CACHE)

.PHONY: clean \
	format format_fix \
	lint lint_fix \
	build_types typecheck \
	lint_ci format_ci typecheck_ci \
	shellcheck shellcheck_fix \
	test test_clean test_unit test_unit_clean \
	test_acceptance test_acceptance_debug test_acceptance_pre_run \
	test_acceptance_run test_acceptance_run_debug test_acceptance_clean \
	benchmarks \
	build tar publish \
