metrics = require("metrics-sharelatex")
logger = require('logger-sharelatex')
_ = require('underscore')
User = require('../../models/User').User
Quote = require('../../models/Quote').Quote
Project = require('../../models/Project').Project
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
Settings = require('settings-sharelatex')
util = require('util')
redis = require('redis')
rclient = redis.createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)
RecurlyWrapper = require('../Subscription/RecurlyWrapper')
SubscriptionHandler = require('../Subscription/SubscriptionHandler')
projectEntityHandler = require('../Project/ProjectEntityHandler')
TpdsPollingBackgroundTasks = require("../ThirdPartyDataStore/TpdsPollingBackgroundTasks")
EditorRealTimeController = require("../Editor/EditorRealTimeController")

oneMinInMs = 60 * 1000

updateOpenConnetionsMetrics = ()->
	metrics.gauge "open_connections.socketio", require("../../infrastructure/Server").io?.sockets?.clients()?.length
	metrics.gauge "open_connections.http", _.size(require('http').globalAgent?.sockets)
	metrics.gauge "open_connections.https", _.size(require('https').globalAgent?.sockets)
	setTimeout updateOpenConnetionsMetrics, oneMinInMs

setTimeout updateOpenConnetionsMetrics, oneMinInMs



module.exports = AdminController =

	index : (req, res)=>
		http = require('http')
		openSockets = {}
		for url, agents of require('http').globalAgent.sockets
			openSockets["http://#{url}"] = (agent._httpMessage.path for agent in agents)
		for url, agents of require('https').globalAgent.sockets
			openSockets["https://#{url}"] = (agent._httpMessage.path for agent in agents)
		memory = process.memoryUsage()
		io = require("../../infrastructure/Server").io
		allUsers = io.sockets.clients()
		users = []
		allUsers.forEach (user)->
			u = {}
			user.get "email", (err, email)->
				u.email = email
				user.get "first_name", (err, first_name)->
					u.first_name = first_name
					user.get "last_name", (err, last_name)->
						u.last_name = last_name
						user.get "project_id", (err, project_id)->
							u.project_id = project_id
							user.get "user_id", (err, user_id)->
								u.user_id = user_id
								user.get "signup_date", (err, signup_date)->
									u.signup_date = signup_date
									user.get "login_count", (err, login_count)->
										u.login_count = login_count
										user.get "connected_time", (err, connected_time)->
											now = new Date()
											connected_mins = (((now - new Date(connected_time))/1000)/60).toFixed(2)
											u.connected_mins = connected_mins
											users.push u

		d = new Date()
		today = d.getDate()+":"+(d.getMonth()+1)+":"+d.getFullYear()+":"
		yesterday = (d.getDate()-1)+":"+(d.getMonth()+1)+":"+d.getFullYear()+":"
		
		multi = rclient.multi()
		multi.get today+"docsets"
		multi.get yesterday+"docsets"
		multi.exec (err, replys)->
			redisstats =
				today:
					docsets: replys[0]
					compiles: replys[1]
				yesterday:
					docsets: replys[2]
					compiles: replys[3]
			DocumentUpdaterHandler.getNumberOfDocsInMemory (err, numberOfInMemoryDocs)=>
				User.count (err, totalUsers)->
					Project.count (err, totalProjects)->
						res.render 'admin',
							title: 'System Admin'
							currentConnectedUsers:allUsers.length
							users: users
							numberOfAceDocs : numberOfInMemoryDocs
							totalUsers: totalUsers
							totalProjects: totalProjects
							openSockets: openSockets
							redisstats: redisstats

	dissconectAllUsers: (req, res)=>
		logger.warn "disconecting everyone"
		EditorRealTimeController.emitToAll 'forceDisconnect', "Sorry, we are performing a quick update to the editor and need to close it down. Please refresh the page to continue."
		res.send(200)

	closeEditor : (req, res)->
		logger.warn "closing editor"
		Settings.editorIsOpen = req.body.isOpen
		res.send(200)

	writeAllToMongo : (req, res)->
		logger.log "writing all docs to mongo"
		Settings.mongo.writeAll = true
		DocumentUpdaterHandler.flushAllDocsToMongo ()->
			logger.log "all docs have been saved to mongo"
			res.send()

	addQuote : (req, res)->
		quote = new Quote
			author: req.body.author
			quote: req.body.quote
		quote.save (err)->
			res.send 200

	syncUserToSubscription: (req, res)->
		{user_id, subscription_id} = req.body
		RecurlyWrapper.getSubscription subscription_id, {}, (err, subscription)->
			User.findById user_id, (err, user)->
				SubscriptionHandler.syncSubscriptionToUser subscription, user._id, (err)->
					logger.log user_id:user_id, subscription_id:subscription_id, "linked account to subscription"
					res.send()

	flushProjectToTpds: (req, res)->
		projectEntityHandler.flushProjectToThirdPartyDataStore req.body.project_id, (err)->
			res.send 200

	pollUsersWithDropbox: (req, res)->
		TpdsPollingBackgroundTasks.pollUsersWithDropbox ->
			res.send 200

	updateProjectCompiler: (req, res, next = (error) ->)->
		Project.findOne _id: req.body.project_id, (error, project) ->
			return next(error) if error?
			project.useClsi2 = (req.body.new == "new")
			logger.log project_id: req.body.project_id, useClsi2: project.useClsi2, "updating project compiler"
			project.save (error) ->
				return next(error) if error?
				res.send(200)