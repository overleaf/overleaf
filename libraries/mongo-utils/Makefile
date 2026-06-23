# Run the test commands in the scope of the monorepo.
# Eslint and prettier (plus some configs) are on the root.
RUN_LINTING = ../../bin/run -w /overleaf/libraries/mongo-utils monorepo yarn run --silent
RUN_LINTING_MONOREPO = ../../bin/run monorepo yarn run --silent

WITH_CACHE_FOLDER = \
	lint \
	lint_ci \
	lint_fix \
	format \
	format_ci \
	format_fix \
	typecheck \
	typecheck_ci \

$(WITH_CACHE_FOLDER): ../../node_modules/.cache/prettier/
../../node_modules/.cache/prettier/:
	mkdir -p $@

$(WITH_CACHE_FOLDER): ../../node_modules/.cache/eslint/
../../node_modules/.cache/eslint/:
	mkdir -p $@

format:
	$(RUN_LINTING_MONOREPO) format libraries/mongo-utils

format_ci:
	$(RUN_LINTING_MONOREPO) format libraries/mongo-utils

format_fix:
	$(RUN_LINTING_MONOREPO) format:fix libraries/mongo-utils

lint:
	$(RUN_LINTING) lint

lint_ci:
	-$(RUN_LINTING) lint --format json --output-file reports/eslint.json
	sed -i 's_"filePath":"/overleaf_"filePath":"$(MONOREPO)_g' reports/eslint.json

lint_fix:
	$(RUN_LINTING) lint:fix

typecheck:
	$(RUN_LINTING) types:check

typecheck_ci:
	$(RUN_LINTING) types:check

test: test_unit
test_unit:
ifneq (,$(wildcard test/unit))
	$(RUN_LINTING) test:unit
endif

test: test_acceptance
test_acceptance:
ifneq (,$(wildcard test/acceptance))
	$(RUN_LINTING) test:acceptance
endif
