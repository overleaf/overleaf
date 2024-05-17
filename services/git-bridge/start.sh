#!/bin/sh

/opt/envsubst < /envsubst_template.json > /conf/runtime.json

VERSION=$(date +%y%m%d%H%M%S)

if [ -z "$GIT_BRIDGE_JVM_ARGS" ]; then
  GIT_BRIDGE_JVM_ARGS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0"
fi

if [ "$ENABLE_PROFILE_AGENT" = "true" ]; then
  GIT_BRIDGE_JVM_ARGS="-agentpath:/opt/cprof/profiler_java_agent.so=-cprof_service=git-bridge,-cprof_service_version=${VERSION},-cprof_enable_heap_sampling=true ${GIT_BRIDGE_JVM_ARGS}"
fi

exec java $GIT_BRIDGE_JVM_ARGS -jar /git-bridge.jar /conf/runtime.json
