DOCKER_COMPOSE_FLAGS ?= -f docker-compose.yml
NPM := docker-compose ${DOCKER_COMPOSE_FLAGS} run --rm npm npm
BUILD_NUMBER ?= local
BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_NAME = web

all: install test
	@echo "Run:"
	@echo "	make install		to set up the project dependencies (in docker)"
	@echo "	make test       to run all the tests for the project (in docker)"

add: docker-shared.yml
	$(NPM) install --save ${P}

add_dev: docker-shared.yml
	$(NPM) install --save-dev ${P}

install: docker-shared.yml
	$(NPM) install

clean:
	rm -f app.js
	rm -rf app/js
	rm -rf test/unit/js
	rm -rf test/acceptance/js
	for dir in modules/*; \
	do \
		rm -f $$dir/index.js; \
		rm -rf $$dir/app/js; \
		rm -rf $$dir/test/unit/js; \
		rm -rf $$dir/test/acceptance/js; \
	done
	# Deletes node_modules volume
	docker-compose down --volumes
	# Regenerate docker-shared.yml - not stictly a 'clean',
	# but lets `make clean install` work nicely
	bin/generate_volumes_file

# Need regenerating if you change the web modules you have installed
docker-shared.yml:
	bin/generate_volumes_file

test: test_unit test_acceptance

test_unit: docker-shared.yml
	docker-compose ${DOCKER_COMPOSE_FLAGS} run --rm test_unit npm run test:unit -- ${MOCHA_ARGS}

test_acceptance: test_acceptance_app test_acceptance_modules

test_acceptance_app: test_acceptance_app_start_service test_acceptance_app_run test_acceptance_app_stop_service

test_acceptance_app_start_service: test_acceptance_app_stop_service docker-shared.yml
	docker-compose ${DOCKER_COMPOSE_FLAGS} up -d test_acceptance

test_acceptance_app_stop_service: docker-shared.yml
	docker-compose ${DOCKER_COMPOSE_FLAGS} stop test_acceptance redis mongo

test_acceptance_app_run: docker-shared.yml
	docker-compose ${DOCKER_COMPOSE_FLAGS} exec -T test_acceptance npm run test:acceptance -- ${MOCHA_ARGS}

test_acceptance_modules: docker-shared.yml
	for dir in modules/*; \
	do \
		if [ -e $$dir/makefile ]; then \
			(make test_acceptance_module MODULE=$$dir) \
		fi \
	done

test_acceptance_module: docker-shared.yml
	cd $(MODULE) && make test_acceptance

.PHONY:
	all add install update test test_unit test_acceptance \
	test_acceptance_start_service test_acceptance_stop_service \
	test_acceptance_run
