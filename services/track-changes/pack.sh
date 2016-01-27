#!/bin/bash

# find all the docHistories with unpacked ops and pack them

HOST=${1:-"localhost:3015"}
T=${2:-10}

echo packing all docHistory on $HOST with delay of $T
for n in $(seq 5 -1 1) ; do
    echo starting in $n seconds
    sleep 1
done

while docs=$(curl "$HOST/doc/list?limit=1000"); do
    if [ -z "$docs" ] ; then break ; fi
    for d in $docs ; do 
	echo "packing $d"
	curl -X POST "$HOST/doc/$d/pack"
	sleep $T
    done
done
