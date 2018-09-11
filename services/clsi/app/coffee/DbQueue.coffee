async = require "async"
Settings = require "settings-sharelatex"

queue = async.queue((task, cb)->
		task(cb)
	, Settings.parallelSqlQueryLimit)

queue.drain = ()->
    console.log('HI all items have been processed')

module.exports = 
	queue: queue

