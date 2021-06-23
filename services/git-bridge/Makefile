# git-bridge makefile

MVN_OPTS := "--no-transfer-progress"

runtime-conf:
	/opt/envsubst < conf/envsubst_template.json > conf/runtime.json


run: package runtime-conf
	java $(GIT_BRIDGE_JVM_ARGS) -jar \
	target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar \
	conf/runtime.json


build:
	mvn $(MVN_OPTS) package -DskipTests


test:
	mvn $(MVN_OPTS) test


clean:
	mvn $(MVN_OPTS) clean


package: clean
	mvn $(MVN_OPTS) package -DskipTests


.PHONY: run package build clean test runtime-conf
