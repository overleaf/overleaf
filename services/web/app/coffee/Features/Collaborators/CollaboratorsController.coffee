ProjectGetter = require "../Project/ProjectGetter"
CollaboratorsHandler = require "./CollaboratorsHandler"
ProjectEditorHandler = require "../Project/ProjectEditorHandler"
EditorRealTimeController = require "../Editor/EditorRealTimeController"
LimitationsManager = require "../Subscription/LimitationsManager"
UserGetter = require "../User/UserGetter"
mimelib = require("mimelib")

module.exports = CollaboratorsController =
	getCollaborators: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		CollaboratorsHandler.getMembersWithPrivilegeLevels project_id, (error, members) ->
			return next(error) if error?
			CollaboratorsController._formatCollaborators members, (error, collaborators) ->
				return next(error) if error?
				res.json(collaborators)
			
	addUserToProject: (req, res, next) ->
		project_id = req.params.Project_id
		LimitationsManager.canAddXCollaborators project_id, 1, (error, allowed) =>
			return next(error) if error?

			if !allowed
				return res.json { user: false }
			else
				{email, privileges} = req.body
				
				email = mimelib.parseAddresses(email or "")[0]?.address?.toLowerCase()
				if !email? or email == ""
					return res.status(400).send("invalid email address")
					
				adding_user_id = req.session?.user?._id
				CollaboratorsHandler.addEmailToProject project_id, adding_user_id, email, privileges, (error, user_id) =>
					return next(error) if error?
					UserGetter.getUser user_id, (error, raw_user) ->
						return next(error) if error?
						user = ProjectEditorHandler.buildUserModelView(raw_user, privileges)
						EditorRealTimeController.emitToRoom(project_id, 'userAddedToProject', user, privileges)
						return res.json { user: user }

	removeUserFromProject: (req, res, next) ->
		project_id = req.params.Project_id
		user_id    = req.params.user_id
		CollaboratorsController._removeUserIdFromProject project_id, user_id, (error) ->
			return next(error) if error?
			res.sendStatus 204
	
	removeSelfFromProject: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		user_id    = req.session?.user?._id
		CollaboratorsController._removeUserIdFromProject project_id, user_id, (error) ->
			return next(error) if error?
			res.sendStatus 204

	_removeUserIdFromProject: (project_id, user_id, callback = (error) ->) ->
		CollaboratorsHandler.removeUserFromProject project_id, user_id, (error)->
			return callback(error) if error?
			EditorRealTimeController.emitToRoom(project_id, 'userRemovedFromProject', user_id)
			callback()

	_formatCollaborators: (members, callback = (error, collaborators) ->) ->
		collaborators = []

		pushCollaborator = (user, permissions, owner) ->
			collaborators.push {
				id: user._id.toString()
				first_name: user.first_name
				last_name: user.last_name
				email: user.email
				permissions: permissions
				owner: owner
			}
		
		for member in members
			{user, privilegeLevel} = member
			if privilegeLevel == "admin"
				pushCollaborator(user, ["read", "write", "admin"], true)
			else if privilegeLevel == "readAndWrite"
				pushCollaborator(user, ["read", "write"], false)
			else
				pushCollaborator(user, ["read"], false)

		callback null, collaborators
			
