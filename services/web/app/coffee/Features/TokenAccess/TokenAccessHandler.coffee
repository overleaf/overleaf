ProjectGetter = require '../Project/ProjectGetter'
Project = require('../../models/Project').Project
AuthenticationController = require '../Authentication/AuthenticationController'
PublicAccessLevels = require '../Authorization/PublicAccessLevels'
ObjectId = require("mongojs").ObjectId

module.exports = TokenAccessHandler =

	findProjectWithReadOnlyToken: (token, callback=(err, project)->) ->
		Project.findOne {
			'tokens.readOnly': token,
			'publicAccesLevel': PublicAccessLevels.TOKEN_BASED
		}, {_id: 1}, (err, project) ->
			return callback(err) if err?
			callback(null, project)

	findProjectWithReadAndWriteToken: (token, callback=(err, project)->) ->
		Project.findOne {
			'tokens.readAndWrite': token,
			'publicAccesLevel': PublicAccessLevels.TOKEN_BASED
		}, {_id: 1}, (err, project) ->
			return callback(err) if err?
			callback(null, project)

	addReadOnlyUserToProject: (userId, projectId, callback=(err)->) ->
		userId = ObjectId(userId.toString())
		projectId = ObjectId(projectId.toString())
		Project.update {
			_id: projectId
		}, {
			$addToSet: {tokenAccessReadOnly_refs: userId}
		}, (err) ->
			callback(err)

	addReadAndWriteUserToProject: (userId, projectId, callback=(err)->) ->
		userId = ObjectId(userId.toString())
		projectId = ObjectId(projectId.toString())
		Project.update {
			_id: projectId
		}, {
			$addToSet: {tokenAccessReadAndWrite_refs: userId}
		}, (err) ->
			callback(err)

	grantAnonymousUserTokenAccessViaSession: (req, projectId) ->
		if req.session?
			if !req.session.anonReadOnlyTokenAccess?
				req.session.anonReadOnlyTokenAccess = {}
			req.session.anonReadOnlyTokenAccess[projectId.toString()] = true

	anonymousUserHasTokenAccessViaSession: (req, projectId) ->
		req?.session?.anonReadOnlyTokenAccess?[projectId.toString()] == true


