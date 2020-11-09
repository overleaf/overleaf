#!/bin/bash

# USAGE: $0 [NUMBER_OF_NODES, default: 9] [DATA_DIR, default: a new temp dir]
#
# ports are assigned from 7000 on
#
# NOTE: the cluster setup requires redis 5+

set -ex

COUNT=${1:-9}
DATA=$2

if [[ -z "$DATA" ]]; then
  IS_TEMP=1
  TEMP=`mktemp -d`
  DATA="$TEMP"
fi

HAS_DATA=
if [[ -e "$DATA/7000/node.conf" ]]; then
    HAS_DATA=1
fi

PIDs=""

cleanup() {
  # ensure that we delete the temp dir, no matter how the kill cmd exists
  set +e
  # invoke kill with at least one PID
  echo "$PIDs" | xargs -r kill
  if [[ ! -z "$IS_TEMP" ]]; then
    rm -rf "$TEMP"
  fi
}
trap cleanup exit

for NUM in `seq "$COUNT"`; do
  PORT=`expr 6999 + "$NUM"`
  CWD="$DATA/$PORT"
  mkdir -p "$CWD"
  pushd "$CWD"
  redis-server \
    --appendonly no \
    --cluster-enabled yes \
    --cluster-config-file node.conf \
    --port "$PORT" \
    --save "" \
    > /dev/null \
  &
  PIDs="$PIDs $!"
  popd
done

# initial nodes
if [[ -z "$HAS_DATA" ]]; then
  # confirm the setup
  echo yes \
  | redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002
fi

# scale up as requested
for NUM in `seq 4 "$COUNT"`; do
  PORT=`expr 6999 + "$NUM"`
  GUARD="$DATA/$PORT/.joined"
  if [[ ! -e "$GUARD" ]]; then
    redis-cli --cluster add-node "127.0.0.1:$PORT" 127.0.0.1:7000 --cluster-slave
    touch "$GUARD"
  fi
done

echo "CLUSTER IS READY" >&2
wait
