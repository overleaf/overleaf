logger = require('logger-sharelatex')
crypto = require 'crypto'
Assert = require 'assert'
Settings = require 'settings-sharelatex'
User = require('../models/User').User
Project = require('../models/Project').Project
HomeController = require("../controllers/HomeController")
AuthenticationController = require("../Features/Authentication/AuthenticationController")
_ = require('underscore')
metrics = require('../infrastructure/Metrics')
querystring = require('querystring')

module.exports =
	restricted : (req, res, next)->
		if req.session.user?
			res.render 'user/restricted',
				title:'Restricted'
		else
			logger.log "user not logged in and trying to access #{req.url}, being redirected to login"
			res.redirect '/register'

	getCurrentUser: (req, callback) ->
		if req.session.user?
			User.findById req.session.user._id, callback
		else
			callback null, null

	requestCanAccessProject : (req, res, next)->
		doRequest = (req, res, next) ->
			getRequestUserAndProject req, res, {allow_auth_token: options?.allow_auth_token}, (err, user, project)->
				if !project?
					return HomeController.notFound(req, res, next)
				userCanAccessProject user, project, (canAccess, permissionLevel)->
					if canAccess
						next()
					else if user?
						logger.log "user_id: #{user._id} email: #{user.email} trying to access restricted page #{req.path}"
						res.redirect('/restricted')
					else
						logger.log "user not logged in and trying to access #{req.url}, being redirected to login"
						req.query.redir = req._parsedUrl.pathname
						url = "/register?#{querystring.stringify(req.query)}"
						res.redirect url
						email = "not logged in user"
		if arguments.length > 1
			options =
				allow_auth_token: false
			doRequest.apply(this, arguments)
		else
			options = req
			return doRequest

	requestCanModifyProject : (req, res, next)->
		getRequestUserAndProject req, res, {}, (err, user, project)=>
			userCanModifyProject user, project, (canModify)->
				if canModify
					next()
				else
					logger.log "user_id: #{user._id} email: #{user.email} can not modify project redirecting to restricted page"
					res.redirect('/restricted')

	userCanModifyProject : userCanModifyProject = (user, project, callback)->
		if !user? or !project?
			callback false
		else if userIsOwner user, project
			callback true
		else if userIsCollaberator user, project
			callback true
		else if project.publicAccesLevel == "readAndWrite"
			callback true
		else if user.isAdmin
			callback true
		else
			callback false


	requestIsOwner : (req, res, next)->
		getRequestUserAndProject req, res, {}, (err, user, project)->
			if userIsOwner user, project || user.isAdmin
				next()
			else
				logger.log user_id: user?._id, email: user?.email, "user is not owner of project redirecting to restricted page"
				res.redirect('/restricted')

	requestIsAdmin : isAdmin = (req, res, next)->
		logger.log "checking if user is admin"
		user = req.session.user
		if(user? && user.isAdmin)
			logger.log user: user, "User is admin"
			next()
		else
			res.redirect('/restricted')
			logger.log user:user, "is not admin redirecting to restricted page"

	userCanAccessProject : userCanAccessProject = (user, project, callback)=>
		if !user?
			user = {_id:'anonymous-user'}
		if !project?
			callback false
		logger.log user:user, project:project, "Checking if can access"
		if userIsOwner user, project
			callback true, "owner"
		else if userIsCollaberator user, project
			callback true, "readAndWrite"
		else if userIsReadOnly user, project
			callback true, "readOnly"
		else if user.isAdmin
			logger.log  user:user, project:project, "user is admin and can access project"
			callback true, "owner"
		else if project.publicAccesLevel == "readAndWrite"
			logger.log  user:user, project:project, "project is a public read and write project"
			callback true, "readAndWrite"
		else if project.publicAccesLevel == "readOnly"
			logger.log  user:user, project:project,  "project is a public read only project"
			callback true, "readOnly"
		else
			metrics.inc "security.denied"
			logger.log  user:user, project:project, "Security denied - user can not enter project"
			callback false

	userIsOwner : userIsOwner = (user, project)->
		if !user?
			return false
		else
			userId = user._id+''
			ownerRef = getProjectIdFromRef(project.owner_ref)
			if userId == ownerRef
				true
			else
				false

	userIsCollaberator : userIsCollaberator = (user, project)->
		if !user?
			return false
		else
			userId = user._id+''
			result = false
			_.each project.collaberator_refs, (colabRef)->
				colabRef = getProjectIdFromRef(colabRef)
				if colabRef == userId
					result = true
			return result

	userIsReadOnly : userIsReadOnly = (user, project)->
		if !user?
			return false
		else
			userId = user._id+''
			result = false
			_.each project.readOnly_refs, (readOnlyRef)->
				readOnlyRef = getProjectIdFromRef(readOnlyRef)
				
				if readOnlyRef == userId
					result = true
			return result

getRequestUserAndProject = (req, res, options, callback)->
	project_id = req.params.Project_id
	Project.findById project_id, 'name owner_ref readOnly_refs collaberator_refs publicAccesLevel', (err, project)=>
		if err?
			logger.err err:err, "error getting project for security check"
			return callback err
		AuthenticationController.getLoggedInUser req, options, (err, user)=>
			if err?
				logger.err err:err, "error getting last logged in user for security check"
			callback err, user, project

getProjectIdFromRef = (ref)->
	if ref._id?
		return ref._id+''
	else
		return ref+''


