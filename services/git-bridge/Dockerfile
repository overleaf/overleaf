# Dockerfile for git-bridge


FROM ubuntu:latest


RUN apt-get update && \
  apt-get install -y git make maven openjdk-8-jdk && \
  update-alternatives --install /usr/bin/java java /usr/lib/jvm/java-8-openjdk-amd64/bin/java 100 && \
  update-alternatives --install /usr/bin/javac javac /usr/lib/jvm/java-8-openjdk-amd64/bin/javac 100 && \
  update-alternatives --set java /usr/lib/jvm/java-8-openjdk-amd64/bin/java && \
  update-alternatives --set javac /usr/lib/jvm/java-8-openjdk-amd64/bin/javac


RUN mkdir /app