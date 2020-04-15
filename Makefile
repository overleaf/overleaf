# Makefile

SHARELATEX_BASE_TAG := sharelatex/sharelatex-base
SHARELATEX_TAG := sharelatex/sharelatex

build-base:
	docker build -f Dockerfile-base -t  $(SHARELATEX_BASE_TAG) .


build-community:
	docker build -f Dockerfile -t $(SHARELATEX_TAG) .


PHONY: build-base build-community
