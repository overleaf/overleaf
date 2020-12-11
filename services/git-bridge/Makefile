# git-bridge makefile


run: package
	java -jar target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar conf/local.json


build:
	mvn --no-transfer-progress package -DskipTests


test:
	mvn --no-transfer-progress test


clean:
	mvn clean


package: clean
	mvn --no-transfer-progress package -DskipTests


.PHONY: run package build clean test
