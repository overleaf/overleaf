#!/bin/bash
/opt/envsubst < /envsubst_template.json > /conf/runtime.json

if [ "x$GIT_BRIDGE_JVM_ARGS" == "x" ]; then
  GIT_BRIDGE_JVM_ARGS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0"
fi

exec java $GIT_BRIDGE_JVM_ARGS -jar /git-bridge.jar /conf/runtime.json
