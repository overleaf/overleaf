User = require('../models/User').User
Project = require('../models/Project').Project
sanitize = require('sanitizer')
path = require "path"
logger = require('logger-sharelatex')
_ = require('underscore')
fs = require('fs')
SecurityManager = require '../managers/SecurityManager'
Settings = require('settings-sharelatex')
projectCreationHandler = require '../Features/Project/ProjectCreationHandler'
projectDuplicator = require('../Features/Project/ProjectDuplicator')
projectDeleter = require("../Features/Project/ProjectDeleter")
ProjectZipStreamManager = require '../Features/Downloads/ProjectZipStreamManager'
metrics = require('../infrastructure/Metrics')
TagsHandler = require('../Features/Tags/TagsHandler')
SubscriptionLocator = require("../Features/Subscription/SubscriptionLocator")
SubscriptionFormatters = require("../Features/Subscription/SubscriptionFormatters")
FileStoreHandler = require("../Features/FileStore/FileStoreHandler")

module.exports = class ProjectController
	constructor: ()->


	startBufferingRequest: (req, res, next) ->
		req.bufferedChunks = []
		req.endEmitted = false
		bufferChunk = (chunk) -> req.bufferedChunks.push(chunk)
		req.on "data", bufferChunk
		endCallback = () -> req.endEmitted = true
		req.on "end", endCallback
		req.emitBufferedData = () ->
			logger.log chunks: @bufferedChunks.length, emittedEnd: @endEmitted, "emitting buffer chunks"
			@removeListener "data", bufferChunk
			while @bufferedChunks.length > 0
				@emit "data", @bufferedChunks.shift()
			@removeListener "end", endCallback
			@emit "end" if @endEmitted
		next()




