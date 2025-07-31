#!/bin/sh
node storage/scripts/persist_redis_chunks.mjs --queue --max-time 270
node storage/scripts/expire_redis_chunks.js --post-request
