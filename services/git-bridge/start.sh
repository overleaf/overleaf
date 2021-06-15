#!/bin/bash
/opt/envsubst < /envsubst_template.json > /conf/runtime.json
exec java -Xms512m -Xmx3072m -jar /git-bridge.jar /conf/runtime.json
