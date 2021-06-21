#!/bin/bash
/opt/envsubst < /envsubst_template.json > /conf/runtime.json
exec java -XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0 -Xlog:gc* -jar /git-bridge.jar /conf/runtime.json
