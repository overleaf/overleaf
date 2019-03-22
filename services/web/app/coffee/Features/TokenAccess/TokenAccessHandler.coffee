Project = require('../../models/Project').Project
CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
PublicAccessLevels = require '../Authorization/PublicAccessLevels'
PrivilegeLevels = require '../Authorization/PrivilegeLevels'
UserGetter = require '../User/UserGetter'
ObjectId = require("mongojs").ObjectId
Settings = require('settings-sharelatex')
V1Api = require "../V1/V1Api"
crypto = require 'crypto'

module.exports = TokenAccessHandler =

	ANONYMOUS_READ_AND_WRITE_ENABLED:
		Settings.allowAnonymousReadAndWriteSharing == true

	_extractNumericPrefix: (token) ->
		token.match(/^(\d+)\w+/)

	_getProjectByReadOnlyToken: (token, callback=(err, project)->) ->
		Project.findOne {
			'tokens.readOnly': token
		}, {_id: 1, tokens: 1, publicAccesLevel: 1, owner_ref: 1}, callback

	_getProjectByEitherToken: (token, callback=(err, project)->) ->
		TokenAccessHandler._getProjectByReadOnlyToken token, (err, project) ->
			return callback(err) if err?
			if project?
				return callback(null, project)
			TokenAccessHandler._getProjectByReadAndWriteToken token, (err, project) ->
				return callback(err) if err?
				callback(null, project)

	_getProjectByReadAndWriteToken: (token, callback=(err, project)->) ->
		numericPrefixMatch = TokenAccessHandler._extractNumericPrefix(token)
		if !numericPrefixMatch
			return callback(null, null)
		numerics = numericPrefixMatch[1]
		Project.findOne {
			'tokens.readAndWritePrefix': numerics
		}, {_id: 1, tokens: 1, publicAccesLevel: 1, owner_ref: 1}, (err, project) ->
			return callback(err) if err?
			if !project?
				return callback(null, null)
			if !crypto.timingSafeEqual(new Buffer(token), new Buffer(project.tokens.readAndWrite))
				logger.err {token}, "read-and-write token match on numeric section, but not on full token"
				return callback(null, null)
			callback(null, project)

	findProjectWithReadOnlyToken: (token, callback=(err, project, projectExists)->) ->
		TokenAccessHandler._getProjectByReadOnlyToken token, (err, project) ->
			if err?
				return callback(err)
			if !project?
				return callback(null, null, false) # Project doesn't exist, so we handle differently
			if project.publicAccesLevel != PublicAccessLevels.TOKEN_BASED
				return callback(null, null, true) # Project does exist, but it isn't token based
			return callback(null, project, true)

	findProjectWithReadAndWriteToken: (token, callback=(err, project, projectExists)->) ->
		TokenAccessHandler._getProjectByReadAndWriteToken token, (err, project) ->
			if err?
				return callback(err)
			if !project?
				return callback(null, null, false) # Project doesn't exist, so we handle differently
			if project.publicAccesLevel != PublicAccessLevels.TOKEN_BASED
					return callback(null, null, true) # Project does exist, but it isn't token based
			return callback(null, project, true)

	_userIsMember: (userId, projectId, callback=(err, isMember)->) ->
		CollaboratorsHandler.isUserInvitedMemberOfProject userId, projectId, callback

	findProjectWithHigherAccess: (token, userId, callback=(err, project)->) ->
		TokenAccessHandler._getProjectByEitherToken token, (err, project) ->
			return callback(err) if err?
			if !project?
				return callback(null, null)
			projectId = project._id
			TokenAccessHandler._userIsMember userId, projectId, (err, isMember) ->
				return callback(err) if err?
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
				project.tokens.readAndWritePrefix = ''
			if privilegeLevel != PrivilegeLevels.READ_ONLY
				project.tokens.readOnly = ''

	getV1DocPublishedInfo: (token, callback = (err, publishedInfo) ->) ->
		# default to allowing access
		return callback(null, {
			allow: true
		}) unless Settings.apis?.v1?

		V1Api.request { url: "/api/v1/sharelatex/docs/#{token}/is_published" }, (err, response, body) ->
			return callback err if err?
			callback null, body

	getV1DocInfo: (token, v2UserId, callback=(err, info)->) ->
		# default to not exported
		return callback(null, {
			exists: true
			exported: false
		}) unless Settings.apis?.v1?

		UserGetter.getUser v2UserId, { overleaf: 1 }, (err, user) ->
			return callback(err) if err?
			v1UserId = user.overleaf?.id
			V1Api.request { url: "/api/v1/sharelatex/users/#{v1UserId}/docs/#{token}/info" }, (err, response, body) ->
				return callback err if err?
				callback null, body

module.exports.READ_AND_WRITE_TOKEN_REGEX =  /^(\d+)(\w+)$/
module.exports.READ_AND_WRITE_URL_REGEX =  /^\/(\d+)(\w+)$/
module.exports.READ_ONLY_TOKEN_REGEX =  /^([a-z]{12})$/
module.exports.READ_ONLY_URL_REGEX =  /^\/read\/([a-z]{12})$/
