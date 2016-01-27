while docs=$(curl "localhost:3015/doc/list?limit=1000"); do
    if [ -z "$docs" ] ; then break ; fi
    for d in $docs ; do 
	echo "packing $d"
	curl -X POST "localhost:3015/doc/$d/pack"
    done
done
