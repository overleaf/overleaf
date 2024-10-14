# Makefile
# Usage:
#  This makefile has two targets: build-base and build-community
#  Use environment VERSION and REV to specify TEX version and OCI Image tag revision number, e.g.:
#    VERSION=2022 REV=3 make
#  VERSION defaults to latest and REV defaults to 1
#  All variables below assigned with ?= can be safely overwritten by env

MONOREPO_ROOT := ../

REV ?= 1
VERSION ?= latest

ifeq ($(VERSION),latest)
MIRROR ?= https://mirror.ox.ac.uk/sites/ctan.org/systems/texlive/tlnet
else
MIRROR ?= https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/$(VERSION)/tlnet-final
endif

export MONOREPO_REVISION := $(shell git rev-parse HEAD)
OVERLEAF_BASE ?= ghcr.io/lcpu-club/sharelatex-base
OVERLEAF ?= ghcr.io/lcpu-club/sharelatex

ifeq ($(VERSION),latest)
YEAR ?= $(shell date '+%Y')
IS_LATEST ?= docker tag $(OVERLEAF_BASE):$(YEAR).$(REV) $(OVERLEAF_BASE):latest # && docker push $(OVERLEAF_BASE):latest
else
YEAR?=$(VERSION)
IS_LATEST ?= @true
endif

all: build-base build-community

build-base:
	cp .dockerignore $(MONOREPO_ROOT)
	docker build \
	  --build-arg BUILDKIT_INLINE_CACHE=1 \
	  --progress=plain \
	  --file Dockerfile-base \
	  --pull \
	  --cache-from $(OVERLEAF_BASE):$(YEAR).$(REV) \
	  --cache-from $(OVERLEAF_BASE):$(YEAR) \
	  --cache-from $(OVERLEAF_BASE):latest \
	  --tag $(OVERLEAF_BASE):$(YEAR).$(REV) \
	  --tag $(OVERLEAF_BASE):$(YEAR) \
	  --build-arg TEXLIVE_MIRROR=$(MIRROR) \
	  --build-arg TEXLIVE_VERSION=$(YEAR) \
	  $(MONOREPO_ROOT)
	#docker push $(OVERLEAF_BASE):$(YEAR).$(REV)
	$(IS_LATEST)

build-community:
	cp .dockerignore $(MONOREPO_ROOT)
	docker build \
	  --build-arg BUILDKIT_INLINE_CACHE=1 \
	  --progress=plain \
	  --build-arg OVERLEAF_BASE=$(OVERLEAF_BASE):latest \
	  --build-arg MONOREPO_REVISION \
	  --cache-from $(OVERLEAF):latest \
	  --file Dockerfile \
	  --tag $(OVERLEAF):latest \
	  --tag $(OVERLEAF):main-$(MONOREPO_REVISION) \
	  $(MONOREPO_ROOT)
	#docker push $(OVERLEAF):latest
	#docker push $(OVERLEAF):main-$(MONOREPO_REVISION)


.PHONY: all build-base build-community
