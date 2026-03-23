#!/bin/bash
set -e

# This init script starts and waits for embedded MongoDB and Redis.
# Only runs in simplified all-in-one mode (EMBEDDED_MONGO/EMBEDDED_REDIS=true).
# Numbered 010_ so it runs before 100_generate_secrets and 500_check_db_access.
#
# Note: Phusion my_init runs init scripts BEFORE runit starts services, so we
# must start the database processes here rather than relying on runit services.

start_and_wait_mongo() {
  echo "Starting embedded MongoDB..."
  mkdir -p /var/lib/mongodb
  chown -R mongodb:mongodb /var/lib/mongodb

  # Only start if not already running
  if ! mongosh --quiet --eval "db.runCommand({ping:1})" mongodb://127.0.0.1:27017/test >/dev/null 2>&1; then
    su -s /bin/bash mongodb -c \
      "mongod --dbpath /var/lib/mongodb --bind_ip 127.0.0.1 --port 27017 \
              --replSet overleaf --noauth --fork --logpath /var/log/mongodb/mongod.log"
  fi

  echo "Waiting for MongoDB to be ready..."
  local retries=0
  local max_retries=30
  while [ $retries -lt $max_retries ]; do
    if mongosh --quiet --eval "db.runCommand({ping:1})" mongodb://127.0.0.1:27017/test >/dev/null 2>&1; then
      echo "MongoDB is ready"
      break
    fi
    retries=$((retries + 1))
    sleep 1
  done
  if [ $retries -eq $max_retries ]; then
    echo "ERROR: MongoDB did not become ready after ${max_retries}s"
    return 1
  fi

  # Initiate replica set if not already done (required for transactions)
  if mongosh --quiet --eval "rs.status().ok" mongodb://127.0.0.1:27017/test 2>/dev/null | grep -q "^0$" || \
     mongosh --quiet --eval "rs.status().ok" mongodb://127.0.0.1:27017/test 2>&1 | grep -q "NotYetInitialized\|no replset config"; then
    echo "Initialising MongoDB replica set..."
    mongosh --quiet --eval "rs.initiate({_id:'overleaf',members:[{_id:0,host:'127.0.0.1:27017'}]})" \
            mongodb://127.0.0.1:27017/test >/dev/null
  fi

  # Wait for primary
  echo "Waiting for replica set primary..."
  local rs_retries=0
  local rs_max=30
  while [ $rs_retries -lt $rs_max ]; do
    if mongosh --quiet --eval "db.isMaster().ismaster" mongodb://127.0.0.1:27017/test 2>/dev/null | grep -q "true"; then
      echo "MongoDB replica set primary is ready"
      return 0
    fi
    rs_retries=$((rs_retries + 1))
    sleep 1
  done
  echo "ERROR: MongoDB replica set did not become primary after ${rs_max}s"
  return 1
}

start_and_wait_redis() {
  echo "Starting embedded Redis..."
  mkdir -p /var/lib/redis
  chown -R redis:redis /var/lib/redis 2>/dev/null || true

  # Only start if not already running
  if ! redis-cli -h 127.0.0.1 ping 2>/dev/null | grep -q PONG; then
    redis-server --daemonize yes --bind 127.0.0.1 --dir /var/lib/redis \
                 --logfile /var/log/redis/redis-server.log
  fi

  echo "Waiting for Redis to be ready..."
  local retries=0
  local max_retries=15
  while [ $retries -lt $max_retries ]; do
    if redis-cli -h 127.0.0.1 ping 2>/dev/null | grep -q PONG; then
      echo "Redis is ready"
      return 0
    fi
    retries=$((retries + 1))
    sleep 1
  done
  echo "ERROR: Redis did not become ready after ${max_retries}s"
  return 1
}

if [ "$EMBEDDED_MONGO" = "true" ]; then
  mkdir -p /var/log/mongodb
  start_and_wait_mongo
fi

if [ "$EMBEDDED_REDIS" = "true" ]; then
  mkdir -p /var/log/redis
  start_and_wait_redis
fi
