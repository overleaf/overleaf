# git-bridge makefile

MVN_OPTS := "--no-transfer-progress"

run: package
	java -jar target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar conf/local.json


build:
	mvn $(MVN_OPTS) package -DskipTests


test:
	mvn $(MVN_OPTS) test


clean:
	mvn $(MVN_OPTS) clean


package: clean
	mvn $(MVN_OPTS) package -DskipTests


.PHONY: run package build clean test
