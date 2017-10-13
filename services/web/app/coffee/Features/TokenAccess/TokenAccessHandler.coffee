Project = require('../../models/Project').Project
PublicAccessLevels = require '../Authorization/PublicAccessLevels'
ObjectId = require("mongojs").ObjectId

module.exports = TokenAccessHandler =

	findProjectWithReadOnlyToken: (token, callback=(err, project)->) ->
		Project.findOne {
			'tokens.readOnly': token,
			'publicAccesLevel': PublicAccessLevels.TOKEN_BASED
		}, {_id: 1, publicAccesLevel: 1}, callback

	findProjectWithReadAndWriteToken: (token, callback=(err, project)->) ->
		Project.findOne {
			'tokens.readAndWrite': token,
			'publicAccesLevel': PublicAccessLevels.TOKEN_BASED
		}, {_id: 1, publicAccesLevel: 1}, callback

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

	grantSessionReadOnlyTokenAccess: (req, projectId, token) ->
		if req.session?
			if !req.session.anonReadOnlyTokenAccess?
				req.session.anonReadOnlyTokenAccess = {}
			req.session.anonReadOnlyTokenAccess[projectId.toString()] = token.toString()

	getRequestToken: (req, projectId) ->
		token = (
			req?.session?.anonReadOnlyTokenAccess?[projectId.toString()] or
			req?.headers['x-sl-anon-token']
		)
		return token

	isValidReadOnlyToken: (projectId, token, callback=(err, allowed)->) ->
		if !token
			return callback null, false
		TokenAccessHandler.findProjectWithReadOnlyToken token, (err, project) ->
			return callback(err) if err?
			isAllowed = (
				project? and
				project.publicAccesLevel == PublicAccessLevels.TOKEN_BASED and
				project._id.toString() == projectId.toString()
			)
			callback null, isAllowed

