mongoose = require('mongoose')
Settings = require 'settings-sharelatex'
logger = require('logger-sharelatex')

mongoose.connect(Settings.mongo.url, {
	server: {poolSize: 10},
	config: {autoIndex: false}
})

mongoose.connection.on 'connected', () ->
	logger.log {url:Settings.mongo.url}, 'mongoose default connection open'

mongoose.connection.on 'error', (err) ->
	logger.err err:err, 'mongoose error on default connection';

mongoose.connection.on 'disconnected', () ->
	logger.log 'mongoose default connection disconnected'

if process.env.MONGOOSE_DEBUG
	mongoose.set 'debug', (collectionName, method, query, doc) ->
		logger.debug 'mongoose debug', collectionName: collectionName, method: method, query: query, doc: doc

module.exports = mongoose
