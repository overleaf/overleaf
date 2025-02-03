# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_NAME = contacts
BUILD_DIR_NAME = $(shell pwd | xargs basename | tr -cd '[a-zA-Z0-9_.\-]')

DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml
DOCKER_COMPOSE := BUILD_NUMBER=$(BUILD_NUMBER) \
	BRANCH_NAME=$(BRANCH_NAME) \
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
	-docker rmi ci/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)
	-docker rmi us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)
	-$(DOCKER_COMPOSE_TEST_UNIT) down --rmi local
	-$(DOCKER_COMPOSE_TEST_ACCEPTANCE) down --rmi local

HERE=$(shell pwd)
MONOREPO=$(shell cd ../../ && pwd)
# Run the linting commands in the scope of the monorepo.
# Eslint and prettier (plus some configs) are on the root.
RUN_LINTING = docker run --rm -v $(MONOREPO):$(MONOREPO) -w $(HERE) node:20.18.2 npm run --silent

RUN_LINTING_CI = docker run --rm --volume $(MONOREPO)/.editorconfig:/overleaf/.editorconfig --volume $(MONOREPO)/.eslintignore:/overleaf/.eslintignore --volume $(MONOREPO)/.eslintrc:/overleaf/.eslintrc --volume $(MONOREPO)/.prettierignore:/overleaf/.prettierignore --volume $(MONOREPO)/.prettierrc:/overleaf/.prettierrc --volume $(MONOREPO)/tsconfig.backend.json:/overleaf/tsconfig.backend.json ci/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) npm run --silent

# Same but from the top of the monorepo
RUN_LINTING_MONOREPO = docker run --rm -v $(MONOREPO):$(MONOREPO) -w $(MONOREPO) node:20.18.2 npm run --silent

SHELLCHECK_OPTS = \
	--shell=bash \
	--external-sources
SHELLCHECK_COLOR := $(if $(CI),--color=never,--color)

shellcheck:
	find . -type f -name "*.sh" -print0 | xargs -0 -r docker run --rm -v $(HERE):/mnt -w /mnt \
		koalaman/shellcheck:stable $(SHELLCHECK_OPTS) $(SHELLCHECK_COLOR)

shellcheck_fix:
	@for file in $$(find . -type f -name "*.sh"); do \
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
	$(RUN_LINTING_CI) lint

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
	$(MAKE) test_unit_clean
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
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) up -d mongo
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) exec -T mongo sh -c ' \
		while ! mongosh --eval "db.version()" > /dev/null; do \
			echo "Waiting for Mongo..."; \
			sleep 1; \
		done; \
		mongosh --eval "rs.initiate({ _id: \"overleaf\", members: [ { _id: 0, host: \"mongo:27017\" } ] })"'
ifneq (,$(wildcard test/acceptance/js/scripts/pre-run))
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) run --rm test_acceptance test/acceptance/js/scripts/pre-run
endif

benchmarks:
	$(DOCKER_COMPOSE_TEST_ACCEPTANCE) run --rm test_acceptance npm run benchmarks

build:
	docker build \
		--pull \
		--build-arg BUILDKIT_INLINE_CACHE=1 \
		--tag ci/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) \
		--tag us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER) \
		--tag us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME):$(BRANCH_NAME) \
		--cache-from us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME):$(BRANCH_NAME) \
		--cache-from us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME):main \
		--file Dockerfile \
		../..

tar:
	$(DOCKER_COMPOSE) up tar

publish:

	docker push $(DOCKER_REPO)/$(PROJECT_NAME):$(BRANCH_NAME)-$(BUILD_NUMBER)


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
