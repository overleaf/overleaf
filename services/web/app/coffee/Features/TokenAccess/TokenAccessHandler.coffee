Project = require('../../models/Project').Project
CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
PublicAccessLevels = require '../Authorization/PublicAccessLevels'
PrivilegeLevels = require '../Authorization/PrivilegeLevels'
ObjectId = require("mongojs").ObjectId
Settings = require('settings-sharelatex')

module.exports = TokenAccessHandler =

	ANONYMOUS_READ_AND_WRITE_ENABLED:
		Settings.allowAnonymousReadAndWriteSharing == true

	findProjectWithReadOnlyToken: (token, callback=(err, project, projectExists)->) ->
		Project.findOne {
			'tokens.readOnly': token
		}, {_id: 1, publicAccesLevel: 1, owner_ref: 1}, (err, project) ->
			if err?
				return callback(err)
			if !project?
				return callback(null, null, false) # Project doesn't exist, so we handle differently
			if project.publicAccesLevel != PublicAccessLevels.TOKEN_BASED
				return callback(null, null, true) # Project does exist, but it isn't token based
			return callback(null, project, true)

	findProjectWithReadAndWriteToken: (token, callback=(err, project, projectExists)->) ->
		Project.findOne {
			'tokens.readAndWrite': token
		}, {_id: 1, publicAccesLevel: 1, owner_ref: 1}, (err, project) ->
			if err?
				return callback(err)
			if !project?
				return callback(null, null, false) # Project doesn't exist, so we handle differently
			if project.publicAccesLevel != PublicAccessLevels.TOKEN_BASED
				return callback(null, null, true) # Project does exist, but it isn't token based
			return callback(null, project, true)

	findProjectWithHigherAccess: (token, userId, callback=(err, project)->) ->
		Project.findOne {
			$or: [
				{'tokens.readAndWrite': token},
				{'tokens.readOnly': token}
			]
		}, {_id: 1}, (err, project) ->
			if err?
				return callback(err)
			if !project?
				return callback(null, null)
			projectId = project._id
			CollaboratorsHandler.isUserInvitedMemberOfProject userId, projectId, (err, isMember) ->
				if err?
					return callback(err)
				callback(
					null,
					if isMember == true then project else null
				)

	addReadOnlyUserToProject: (userId, projectId, callback=(err)->) ->
		userId = ObjectId(userId.toString())
		projectId = ObjectId(projectId.toString())
		Project.update {
			_id: projectId
		}, {
			$addToSet: {tokenAccessReadOnly_refs: userId}
		}, callback

	addReadAndWriteUserToProject: (userId, projectId, callback=(err)->) ->
		userId = ObjectId(userId.toString())
		projectId = ObjectId(projectId.toString())
		Project.update {
			_id: projectId
		}, {
			$addToSet: {tokenAccessReadAndWrite_refs: userId}
		}, callback

	grantSessionTokenAccess: (req, projectId, token) ->
		if req.session?
			if !req.session.anonTokenAccess?
				req.session.anonTokenAccess = {}
			req.session.anonTokenAccess[projectId.toString()] = token.toString()

	getRequestToken: (req, projectId) ->
		token = (
			req?.session?.anonTokenAccess?[projectId.toString()] or
			req?.headers['x-sl-anonymous-access-token']
		)
		return token

	isValidToken: (projectId, token, callback=(err, isValidReadAndWrite, isValidReadOnly)->) ->
		if !token
			return callback null, false, false
		_validate = (project) ->
			project? and
			project.publicAccesLevel == PublicAccessLevels.TOKEN_BASED and
			project._id.toString() == projectId.toString()
		TokenAccessHandler.findProjectWithReadAndWriteToken token, (err, readAndWriteProject) ->
			return callback(err) if err?
			isValidReadAndWrite = _validate(readAndWriteProject)
			TokenAccessHandler.findProjectWithReadOnlyToken token, (err, readOnlyProject) ->
				return callback(err) if err?
				isValidReadOnly = _validate(readOnlyProject)
				callback null, isValidReadAndWrite, isValidReadOnly

	protectTokens: (project, privilegeLevel) ->
		if project? && project.tokens?
			if privilegeLevel == PrivilegeLevels.OWNER
				return
			if privilegeLevel != PrivilegeLevels.READ_AND_WRITE
				project.tokens.readAndWrite = ''
			if privilegeLevel != PrivilegeLevels.READ_ONLY
				project.tokens.readOnly = ''
