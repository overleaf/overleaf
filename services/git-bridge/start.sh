#!/bin/bash
envsubst < /envsubst_template.json > /conf/runtime.json
java -jar /git-bridge.jar /conf/runtime.json
