async = require "async"
Settings = require "settings-sharelatex"
logger = require("logger-sharelatex")
queue = async.queue((task, cb)->
		task(cb)
	, Settings.parallelSqlQueryLimit)

queue.drain = ()->
	logger.debug('all items have been processed')

module.exports = 
	queue: queue

