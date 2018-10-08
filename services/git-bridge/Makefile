# git-bridge makefile

run: package
	java -jar target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar config/local.json


build:
	mvn package


test:
	mvn test


clean:
	mvn clean


package:
	mvn package


.PHONY: build clean test
