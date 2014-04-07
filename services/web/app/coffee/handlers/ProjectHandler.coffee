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

	confirmFolder = (project_id, folder_id, callback)->
		logger.log folder: folder_id, project_id: project_id, "confirming existence of folder"
		if folder_id+'' == 'undefined'
			Project.findById project_id, (err, project)->
				callback(project.rootFolder[0]._id)
		else if folder_id != null
			callback folder_id
		else
			Project.findById project_id, (err, project)->
				callback(project.rootFolder[0]._id)

	renameEntity: (project_id, entity_id, entityType, newName, callback)->
		logger.log(entity_id: entity_id, project_id: project_id, ('renaming '+entityType))
		if !entityType?
			logger.err err: "No entityType set", project_id: project_id, entity_id: entity_id
			return callback("No entityType set")
		entityType = entityType.toLowerCase()
		Project.findById project_id, (err, project)=>
			projectLocator.findElement {project:project, element_id:entity_id, type:entityType}, (err, entity, path, folder)=>
				if err?
					return callback err
				conditons = {_id:project_id}
				update = "$set":{}
				namePath = path.mongo+".name"
				update["$set"][namePath] = newName
				endPath = path.fileSystem.replace(entity.name, newName)
				tpdsUpdateSender.moveEntity({project_id:project_id, startPath:path.fileSystem, endPath:endPath, project_name:project.name, rev:entity.rev})
				Project.update conditons, update, {}, (err)->
					if callback?
						callback err

	renameProject: (project_id, window_id, newName, callback)->
		logger.log project_id: project_id, "renaming project"
		conditons = {_id:project_id}
		Project.findOne conditons, "name", (err, project)->
			oldProjectName = project.name
			Project.update conditons, {name: newName}, {},(err, project)=>
				tpdsUpdateSender.moveEntity {project_id:project_id, project_name:oldProjectName, newProjectName:newName}
				if callback?
					callback err

	deleteProject: (project_id, callback = (error) ->)->
		logger.log project_id:project_id, "deleting project"
		Project.findById project_id, (err, project)=>
			if project?
				require('../Features/DocumentUpdater/DocumentUpdaterHandler').flushProjectToMongoAndDelete project_id, (error) ->
					return callback(error) if error?
					Project.applyToAllFilesRecursivly project.rootFolder[0], (file)=>
						FileStoreHandler.deleteFile project_id, file._id, ->
					Project.remove {_id:project_id}, (err)->
						if callback?
							callback(err)
					require('../Features/Versioning/AutomaticSnapshotManager').unmarkProjectAsUpdated project_id, ->
					tagsHandler.removeProjectFromAllTags project.owner_ref, project_id,->
					project.collaberator_refs.forEach (collaberator_ref)->
						tagsHandler.removeProjectFromAllTags collaberator_ref, project_id, ->
					project.readOnly_refs.forEach (readOnly_ref)->
						tagsHandler.removeProjectFromAllTags readOnly_ref, project_id,->
			else
				if callback?
					callback(err)

	setPublicAccessLevel : (project_id, newAccessLevel, callback)->
		logger.log project_id: project_id, level: newAccessLevel, "set public access level"
		if project_id? && newAccessLevel?
			if _.include ['readOnly', 'readAndWrite', 'private'], newAccessLevel
				Project.update {_id:project_id},{publicAccesLevel:newAccessLevel},{}, (err)->
					if callback?
						callback()

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
