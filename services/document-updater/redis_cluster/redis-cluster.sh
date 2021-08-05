#!/bin/sh

(cd 7000 && redis-server redis.conf) &
PID1="$!"

(cd 7001 && redis-server redis.conf) &
PID2="$!"

(cd 7002 && redis-server redis.conf) &
PID3="$!"

(cd 7003 && redis-server redis.conf) &
PID4="$!"

(cd 7004 && redis-server redis.conf) &
PID5="$!"

(cd 7005 && redis-server redis.conf) &
PID6="$!"

trap "kill $PID1 $PID2 $PID3 $PID4 $PID5 $PID6" exit INT TERM

wait