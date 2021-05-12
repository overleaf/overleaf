#!/bin/bash
/opt/envsubst < /envsubst_template.json > /conf/runtime.json
exec java -jar /git-bridge.jar /conf/runtime.json
