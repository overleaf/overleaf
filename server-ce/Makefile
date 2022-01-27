# Makefile

export SHARELATEX_BASE_TAG := sharelatex/sharelatex-base
export SHARELATEX_TAG := sharelatex/sharelatex
export SHARELATEX_BASE_CACHE := $(shell echo $(SHARELATEX_BASE_TAG) | sed -E 's/(.+):.+/\1:latest/')
export MONOREPO_REVISION := $(shell git rev-parse HEAD)
MONOREPO_ROOT := ../
ARCH?=x86_64

build-base:
	cp .dockerignore $(MONOREPO_ROOT)
	docker pull $(SHARELATEX_BASE_CACHE) || echo "nothing cached yet"
	@if [ "${ARCH}" = "x86_64" ]; then\
		docker build -f Dockerfile-base --pull --cache-from $(SHARELATEX_BASE_CACHE) -t $(SHARELATEX_BASE_TAG) $(MONOREPO_ROOT);\
	elif [ "${ARCH}" = "arm64" ]; then\
		docker build -f Dockerfile-base.aarch64 --pull --cache-from $(SHARELATEX_BASE_CACHE) -t $(SHARELATEX_BASE_TAG) $(MONOREPO_ROOT);\
	else\
		echo "ERROR: Unknown architecture";\
	fi

build-community:
	cp .dockerignore $(MONOREPO_ROOT)
	docker build --build-arg SHARELATEX_BASE_TAG --build-arg MONOREPO_REVISION -f Dockerfile -t $(SHARELATEX_TAG) $(MONOREPO_ROOT)


.PHONY: build-base build-community
