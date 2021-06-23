#!/bin/bash

/opt/envsubst < /envsubst_template.json > /conf/runtime.json

if [ "x$GIT_BRIDGE_JVM_ARGS" == "x" ]; then
  GIT_BRIDGE_JVM_ARGS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0"
fi

if [ "$ENABLE_PROFILE_AGENT" == "true" ]; then
  GIT_BRIDGE_JVM_ARGS="-agentpath:/opt/cprof/profiler_java_agent.so=-cprof_service=git-bridge,-cprof_service_version=1.0.0,-cprof_enable_heap_sampling=true ${GIT_BRIDGE_JVM_ARGS}"
fi

exec java $GIT_BRIDGE_JVM_ARGS -jar /git-bridge.jar /conf/runtime.json
