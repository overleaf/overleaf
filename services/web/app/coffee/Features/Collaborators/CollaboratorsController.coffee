ProjectGetter = require "../Project/ProjectGetter"
CollaboratorsHandler = require "./CollaboratorsHandler"


module.exports = CollaboratorsController =
	getCollaborators: (req, res, next = (error) ->) ->
		req.session.destroy()
		ProjectGetter.getProject req.params.Project_id, { owner_ref: true, collaberator_refs: true, readOnly_refs: true}, (error, project) ->
			return next(error) if error?
			ProjectGetter.populateProjectWithUsers project, (error, project) ->
				return next(error) if error?
				CollaboratorsController._formatCollaborators project, (error, collaborators) ->
					return next(error) if error?
					res.send(JSON.stringify(collaborators))

	removeSelfFromProject: (req, res, next = (error) ->) ->
		user_id = req.session?.user?._id
		if !user_id?
			return next(new Error("User should be logged in"))
		CollaboratorsHandler.removeUserFromProject req.params.project_id, user_id, (error) ->
			return next(error) if error?
			res.send 204

	_formatCollaborators: (project, callback = (error, collaborators) ->) ->
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
			
		if project.owner_ref?
			pushCollaborator(project.owner_ref, ["read", "write", "admin"], true)

		if project.collaberator_refs? and project.collaberator_refs.length > 0
			for user in project.collaberator_refs
				pushCollaborator(user, ["read", "write"], false)

		if project.readOnly_refs? and project.readOnly_refs.length > 0
			for user in project.readOnly_refs
				pushCollaborator(user, ["read"], false)

		callback null, collaborators
			
