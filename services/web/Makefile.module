MODULE_NAME := $(notdir $(shell pwd))
MODULE_DIR := modules/$(MODULE_NAME)
COFFEE := ../../node_modules/.bin/coffee
APP_COFFEE_FILES := $(shell [ -e app/coffee ] && find app/coffee -name '*.coffee') \
	$(shell [ -e test/unit/coffee ] && find test/unit/coffee -name '*.coffee') \
	$(shell [ -e test/acceptance/coffee ] && find test/acceptance/coffee -name '*.coffee')
APP_JS_FILES := $(subst coffee,js,$(APP_COFFEE_FILES))
IDE_COFFEE_FILES := $(shell [ -e public/coffee/ide ] && find public/coffee/ide -name '*.coffee')
IDE_JS_FILES := $(subst public/coffee/ide,../../public/js/ide/$(MODULE_NAME),$(IDE_COFFEE_FILES))
IDE_JS_FILES := $(subst coffee,js,$(IDE_JS_FILES))
IDE_TEST_COFFEE_FILES := $(shell [ -e test/unit_frontend/coffee ] && find test/unit_frontend/coffee -name '*.coffee')
IDE_TEST_JS_FILES := $(subst test/unit_frontend/coffee/ide,../../test/unit_frontend/js/ide/$(MODULE_NAME),$(IDE_TEST_COFFEE_FILES))
IDE_TEST_JS_FILES := $(subst coffee,js,$(IDE_TEST_JS_FILES))
MAIN_COFFEE_FILES := $(shell [ -e public/coffee/main ] && find public/coffee/main -name '*.coffee')
MAIN_JS_FILES := $(subst public/coffee/main,../../public/js/main/$(MODULE_NAME),$(MAIN_COFFEE_FILES))
MAIN_JS_FILES := $(subst coffee,js,$(MAIN_JS_FILES))
DOCKER_COMPOSE_FLAGS := -f $(MODULE_DIR)/docker-compose.yml
DOCKER_COMPOSE := cd ../../ && MODULE_DIR=$(MODULE_DIR) docker-compose -f docker-compose.yml ${DOCKER_COMPOSE_FLAGS}

app/js/%.js: app/coffee/%.coffee
	@mkdir -p $(dir $@)
	$(COFFEE) --compile --print $< > $@

test/unit/js/%.js: test/unit/coffee/%.coffee
	@mkdir -p $(dir $@)
	$(COFFEE) --compile --print $< > $@

test/acceptance/js/%.js: test/acceptance/coffee/%.coffee
	@mkdir -p $(dir $@)
	$(COFFEE) --compile --print $< > $@

../../test/unit_frontend/js/ide/$(MODULE_NAME)/%.js: test/unit_frontend/coffee/ide/%.coffee
	@mkdir -p $(dir $@)
	$(COFFEE) --compile --print $< > $@

../../public/js/ide/$(MODULE_NAME)/%.js: public/coffee/ide/%.coffee
	@mkdir -p $(dir $@)
	$(COFFEE) --compile --print $< > $@

../../public/js/main/$(MODULE_NAME)/%.js: public/coffee/main/%.coffee
	@mkdir -p $(dir $@)
	$(COFFEE) --compile --print $< > $@

index.js: index.coffee
	$(COFFEE) --compile --print $< > $@

compile: $(APP_JS_FILES) $(IDE_JS_FILES) $(MAIN_JS_FILES) $(IDE_TEST_JS_FILES) index.js
	@echo > /dev/null

compile_full:
	if [ -e app/coffee ]; then $(COFFEE) -o app/js -c app/coffee; fi
	if [ -e test/unit/coffee ]; then $(COFFEE) -o test/unit/js -c test/unit/coffee; fi
	if [ -e test/acceptance/coffee ]; then $(COFFEE) -o test/acceptance/js -c test/acceptance/coffee; fi
	if [ -e public/coffee/ide/ ]; then $(COFFEE) -o ../../public/js/ide/$(MODULE_NAME) -c public/coffee/ide/; fi
	if [ -e public/coffee/main/ ]; then $(COFFEE) -o ../../public/js/main/$(MODULE_NAME) -c public/coffee/main/; fi
	@$(MAKE) compile

test_acceptance: test_acceptance_start_service test_acceptance_run
	$(MAKE) test_acceptance_stop_service

test_acceptance_start_service: test_acceptance_stop_service
	$(DOCKER_COMPOSE) up -d test_acceptance

test_acceptance_stop_service:
	$(DOCKER_COMPOSE) stop test_acceptance redis mongo

test_acceptance_run:
	$(DOCKER_COMPOSE) exec -T test_acceptance npm -q run test:acceptance:dir -- ${MOCHA_ARGS} $(MODULE_DIR)/test/acceptance/js
