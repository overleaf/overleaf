#!/bin/bash
/opt/envsubst < /envsubst_template.json > /conf/runtime.json
exec java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -jar /git-bridge.jar /conf/runtime.json
