# git-bridge makefile

MVN_OPTS := --no-transfer-progress
MVN_TARGET := target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar

export BUILD_NUMBER ?= local
export BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
BRANCH_NAME_TAG_SAFE = $(shell echo $(BRANCH_NAME) | sed 's/\//\-\-/g')
export COMMIT_SHA ?= $(shell git rev-parse HEAD)
PROJECT_NAME = git-bridge

IMAGE_CI ?= ci/$(PROJECT_NAME):$(BRANCH_NAME_TAG_SAFE)-$(BUILD_NUMBER)
IMAGE_REPO ?= us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME)
IMAGE_REPO_BRANCH ?= $(IMAGE_REPO):$(BRANCH_NAME_TAG_SAFE)
IMAGE_REPO_MAIN ?= $(IMAGE_REPO):main
IMAGE_REPO_FINAL ?= $(IMAGE_REPO_BRANCH)-$(BUILD_NUMBER)

runtime-conf:
	/opt/envsubst < conf/envsubst_template.json > conf/runtime.json


run: $(MVN_TARGET) runtime-conf
	@exec java $(GIT_BRIDGE_JVM_ARGS) -jar $(MVN_TARGET) conf/runtime.json


$(MVN_TARGET): $(shell find src -type f) pom.xml
	mvn $(MVN_OPTS) package -DskipTests

build: $(MVN_TARGET)

docker_build_base:
	docker build --pull \
		--build-arg BUILDKIT_INLINE_CACHE=1 \
		--cache-from $(IMAGE_REPO_BRANCH) \
		--cache-from $(IMAGE_REPO_MAIN) \
		--tag $(IMAGE_CI) \
		--target base \
	.

docker_build:
	docker build --pull \
		--build-arg BUILDKIT_INLINE_CACHE=1 \
		--cache-from $(IMAGE_REPO_BRANCH) \
		--cache-from $(IMAGE_REPO_MAIN) \
		--tag $(IMAGE_REPO_BRANCH) \
		--tag $(IMAGE_REPO_FINAL) \
	.

format:
	mvn $(MVN_OPTS) com.spotify.fmt:fmt-maven-plugin:check

docker_format:
	docker run --rm -v $(PWD):$(PWD) -w $(PWD) --user node $(IMAGE_CI) make format

format_fix:
	mvn $(MVN_OPTS) com.spotify.fmt:fmt-maven-plugin:format


test:
	mvn $(MVN_OPTS) test

docker_test:
	docker run --rm -v $(PWD):$(PWD) -w $(PWD) --user node $(IMAGE_CI) make test

clean:
	mvn $(MVN_OPTS) clean


package: clean
	mvn $(MVN_OPTS) package -DskipTests

refresh_cache: refresh_cache_branch
refresh_cache_branch:
	docker inspect $(IMAGE_REPO_BRANCH) > /dev/null && docker pull $(IMAGE_REPO_BRANCH) || true
refresh_cache: refresh_cache_latest
refresh_cache_latest:
	docker inspect $(IMAGE_REPO_MAIN) > /dev/null && docker pull $(IMAGE_REPO_MAIN) || true

push:
	docker push $(IMAGE_REPO_FINAL)

push_branch:
	docker push $(IMAGE_REPO_BRANCH)

clean_ci:
	-docker rmi -f $(IMAGE_CI) $(IMAGE_REPO_FINAL)
	-git clean -xdf .

.PHONY: run package build clean test runtime-conf
