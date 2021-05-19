redis = require "@overleaf/redis-wrapper"
rclient1 = redis.createClient(cluster: [{
	port: "7000"
	host: "localhost"
}])

rclient2 = redis.createClient(cluster: [{
	port: "7000"
	host: "localhost"
}])

counter = 0
sendPing = (cb = () ->) ->
	rclient1.publish "test-pubsub", counter, (error) ->
		console.error "[SENDING ERROR]", error.message if error?
		if !error?
			counter += 1
		cb()

previous = null
rclient2.subscribe "test-pubsub"
rclient2.on "message", (channel, value) ->
	value = parseInt(value, 10)
	if value % 10 == 0
		console.log "."
	if previous? and value != previous + 1
		console.error "[RECEIVING ERROR]", "Counter not in order. Got #{value}, expected #{previous + 1}"
	previous = value

PING_DELAY = 100
do sendPings = () ->
	sendPing () ->
		setTimeout sendPings, PING_DELAY
