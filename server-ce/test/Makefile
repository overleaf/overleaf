all: test-e2e

test-e2e:
	docker compose down -v -t 0
	docker compose -f docker-compose.yml run --rm e2e
	docker compose down -v -t 0

test-e2e-open:
	docker compose down -v -t 0
	docker compose -f docker-compose.yml run --rm e2e-open
	docker compose down -v -t 0

.PHONY: test-e2e test-e2e-open
