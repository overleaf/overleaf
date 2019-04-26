# Dockerfile for git-bridge


FROM ubuntu:latest


RUN apt-get update && \
  apt-get install -y git make maven openjdk-8-jdk curl && \
  update-alternatives --install /usr/bin/java java /usr/lib/jvm/java-8-openjdk-amd64/bin/java 100 && \
  update-alternatives --install /usr/bin/javac javac /usr/lib/jvm/java-8-openjdk-amd64/bin/javac 100 && \
  update-alternatives --set java /usr/lib/jvm/java-8-openjdk-amd64/bin/java && \
  update-alternatives --set javac /usr/lib/jvm/java-8-openjdk-amd64/bin/javac


RUN mkdir /app
WORKDIR /app

COPY . /app
RUN mvn clean package \
# The name of the created jar contains the current version tag.
# Rename it to a static path that can be used for copying.
&&  find /app/target \
      -name 'writelatex-git-bridge*jar-with-dependencies.jar' \
      -exec mv {} /git-bridge.jar \;

FROM openjdk:8-jre

RUN apt-get update \
 && apt-get install --no-install-recommends -y \
      git \
 && rm -rf \
      /var/lib/apt/lists/*

USER www-data

ENTRYPOINT ["java", "-jar", "/git-bridge.jar"]
CMD ["/conf/runtime.json"]

COPY --from=0 /git-bridge.jar /
