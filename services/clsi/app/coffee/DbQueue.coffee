async = require "async"

queue = async.queue((task, cb)->
		console.log("running task")
		task(cb)
	, 1)

queue.drain = ()->
    console.log('HI all items have been processed')
    
module.exports = 
	queue: queue

