Project = require('../models/Project').Project
Folder = require('../models/Folder').Folder
Doc = require('../models/Doc').Doc
File = require('../models/File').File
User = require('../models/User').User
logger = require('logger-sharelatex')
_ = require('underscore')
Settings = require('settings-sharelatex')
EmailHandler = require("../Features/Email/EmailHandler")
tpdsUpdateSender = require '../Features/ThirdPartyDataStore/TpdsUpdateSender'
projectCreationHandler = require '../Features/Project/ProjectCreationHandler'
projectEntityHandler = require '../Features/Project/ProjectEntityHandler'
ProjectEditorHandler = require '../Features/Project/ProjectEditorHandler'
FileStoreHandler = require "../Features/FileStore/FileStoreHandler"
projectLocator = require '../Features/Project/ProjectLocator'
mimelib = require("mimelib")
async = require('async')
tagsHandler = require('../Features/Tags/TagsHandler')

module.exports = class ProjectHandler




	addUserToProject: (project_id, email, privlages, callback)->
		if email != ''
			doAdd = (user)=>
				Project.findOne(_id: project_id )
					.select("name owner_ref")
					.populate('owner_ref')
					.exec (err, project)->
						emailOptions =
							to : email
							replyTo  : project.owner_ref.email
							project:
								name: project.name
								url: "#{Settings.siteUrl}/project/#{project._id}?" + [
										"project_name=#{encodeURIComponent(project.name)}"
										"user_first_name=#{encodeURIComponent(project.owner_ref.first_name)}"
										"new_email=#{encodeURIComponent(email)}"
										"r=#{project.owner_ref.referal_id}" # Referal
										"rs=ci" # referral source = collaborator invite
									].join("&")
							owner: project.owner_ref
						EmailHandler.sendEmail "projectSharedWithYou", emailOptions, ->
						if privlages == 'readAndWrite'
							level = {"collaberator_refs":user}
							logger.log privileges: "readAndWrite", user: user, project: project, "adding user"
						else if privlages == 'readOnly'
							level = {"readOnly_refs":user}
							logger.log privileges: "readOnly", user: user, project: project, "adding user"
						Project.update {_id: project_id}, {$push:level},{},(err)->
							projectEntityHandler.flushProjectToThirdPartyDataStore project_id, "", ->
								if callback?
									callback(user)

			emails = mimelib.parseAddresses(email)
			email = emails[0].address
			User.findOne {'email':email}, (err, user)->
				if(!user)
					user = new User 'email':email, holdingAccount:true
					user.save (err)->
						logger.log user: user, 'creating new empty user'
						doAdd user
				else
					doAdd user

	removeUserFromProject: (project_id, user_id, callback)->
		logger.log user_id: user_id, project_id: project_id, "removing user"
		conditions = _id:project_id
		update = $pull:{}
		update["$pull"] = collaberator_refs:user_id, readOnly_refs:user_id
		Project.update conditions, update, {}, (err)->
			if err?
				logger.err err: err, "problem removing user from project collaberators"
			if callback?
				callback()

	changeUsersPrivlageLevel: (project_id, user_id, newPrivalageLevel)->
		@removeUserFromProject project_id, user_id, ()=>
		  User.findById user_id, (err, user)=>
			if user
			  @addUserToProject project_id, user.email, newPrivalageLevel
