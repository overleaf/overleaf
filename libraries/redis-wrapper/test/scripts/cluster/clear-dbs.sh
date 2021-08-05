while true; do
  seq 0 8 \
  | xargs -I% redis-cli -p 700% FLUSHALL > /dev/null
done
