#!/bin/sh
node storage/scripts/persist_redis_chunks.js
node storage/scripts/expire_redis_chunks.js
