# git-bridge makefile

MVN_OPTS := --no-transfer-progress
MVN_TARGET := target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar

runtime-conf:
	/opt/envsubst < conf/envsubst_template.json > conf/runtime.json


run: $(MVN_TARGET) runtime-conf
	java $(GIT_BRIDGE_JVM_ARGS) -jar $(MVN_TARGET) conf/runtime.json


$(MVN_TARGET): $(shell find src -type f)
	mvn $(MVN_OPTS) package -DskipTests


test:
	mvn $(MVN_OPTS) test


clean:
	mvn $(MVN_OPTS) clean


package: clean
	mvn $(MVN_OPTS) package -DskipTests


.PHONY: run package clean test runtime-conf
