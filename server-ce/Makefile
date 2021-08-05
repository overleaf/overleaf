# Makefile

SHARELATEX_BASE_TAG := sharelatex/sharelatex-base
SHARELATEX_TAG := sharelatex/sharelatex
SHARELATEX_BASE_CACHE := $(shell echo $(SHARELATEX_BASE_TAG) | sed -E 's/(.+):.+/\1:latest/')

build-base:
	docker pull $(SHARELATEX_BASE_CACHE)
	docker build -f Dockerfile-base --pull --cache-from $(SHARELATEX_BASE_CACHE) -t $(SHARELATEX_BASE_TAG) .


build-community:
	docker build --build-arg SHARELATEX_BASE_TAG=$(SHARELATEX_BASE_TAG) -f Dockerfile -t $(SHARELATEX_TAG) .


PHONY: build-base build-community
