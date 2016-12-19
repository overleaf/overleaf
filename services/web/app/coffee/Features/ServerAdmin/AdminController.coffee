metrics = require("metrics-sharelatex")
logger = require('logger-sharelatex')
_ = require('underscore')
User = require('../../models/User').User
Project = require('../../models/Project').Project
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
Settings = require('settings-sharelatex')
util = require('util')
RecurlyWrapper = require('../Subscription/RecurlyWrapper')
SubscriptionHandler = require('../Subscription/SubscriptionHandler')
projectEntityHandler = require('../Project/ProjectEntityHandler')
TpdsUpdateSender = require("../ThirdPartyDataStore/TpdsUpdateSender")
EditorRealTimeController = require("../Editor/EditorRealTimeController")
SystemMessageManager = require("../SystemMessages/SystemMessageManager")

oneMinInMs = 60 * 1000

updateOpenConnetionsMetrics = ()->
	metrics.gauge "open_connections.socketio", require("../../infrastructure/Server").io?.sockets?.clients()?.length
	metrics.gauge "open_connections.http", _.size(require('http').globalAgent?.sockets)
	metrics.gauge "open_connections.https", _.size(require('https').globalAgent?.sockets)
	setTimeout updateOpenConnetionsMetrics, oneMinInMs

setTimeout updateOpenConnetionsMetrics, oneMinInMs



module.exports = AdminController =

	index : (req, res, next)=>
		http = require('http')
		openSockets = {}
		for url, agents of require('http').globalAgent.sockets
			openSockets["http://#{url}"] = (agent._httpMessage.path for agent in agents)
		for url, agents of require('https').globalAgent.sockets
			openSockets["https://#{url}"] = (agent._httpMessage.path for agent in agents)

		SystemMessageManager.getMessagesFromDB (error, systemMessages) ->
			return next(error) if error?
			res.render 'admin/index',
				title: 'System Admin'
				openSockets: openSockets
				systemMessages: systemMessages
	
	registerNewUser: (req, res, next) ->
		res.render 'admin/register'

	dissconectAllUsers: (req, res)=>
		logger.warn "disconecting everyone"
		EditorRealTimeController.emitToAll 'forceDisconnect', "Sorry, we are performing a quick update to the editor and need to close it down. Please refresh the page to continue."
		res.sendStatus(200)

	closeEditor : (req, res)->
		logger.warn "closing editor"
		Settings.editorIsOpen = req.body.isOpen
		res.sendStatus(200)

	writeAllToMongo : (req, res)->
		logger.log "writing all docs to mongo"
		Settings.mongo.writeAll = true
		DocumentUpdaterHandler.flushAllDocsToMongo ()->
			logger.log "all docs have been saved to mongo"
			res.send()

	syncUserToSubscription: (req, res)->
		{user_id, subscription_id} = req.body
		RecurlyWrapper.getSubscription subscription_id, {}, (err, subscription)->
			User.findById user_id, (err, user)->
				SubscriptionHandler.syncSubscriptionToUser subscription, user._id, (err)->
					logger.log user_id:user_id, subscription_id:subscription_id, "linked account to subscription"
					res.send()

	flushProjectToTpds: (req, res)->
		projectEntityHandler.flushProjectToThirdPartyDataStore req.body.project_id, (err)->
			res.sendStatus 200

	pollDropboxForUser: (req, res)->
		user_id = req.body.user_id
		TpdsUpdateSender.pollDropboxForUser user_id, () ->
			res.sendStatus 200
			
	createMessage: (req, res, next) ->
		SystemMessageManager.createMessage req.body.content, (error) ->
			return next(error) if error?
			res.sendStatus 200
			
	clearMessages: (req, res, next) ->
		SystemMessageManager.clearMessages (error) ->
			return next(error) if error?
			res.sendStatus 200
