request = require("./request")
_ = require("underscore")
settings = require("settings-sharelatex")
{db, ObjectId} = require("../../../../app/js/infrastructure/mongojs")
UserModel = require("../../../../app/js/models/User").User
UserUpdater = require("../../../../app/js/Features/User/UserUpdater")
AuthenticationManager = require("../../../../app/js/Features/Authentication/AuthenticationManager")

count = 0

class User
	constructor: (options = {}) ->
		@emails = [
			email: "acceptance-test-#{count}@example.com"
			createdAt: new Date()
		]
		@email = @emails[0].email
		@password = "acceptance-test-#{count}-password"
		count++
		@jar = request.jar()
		@request = request.defaults({
			jar: @jar
		})

	setExtraAttributes: (user) ->
		throw new Error("User does not exist") unless user?._id?
		@id = user._id.toString()
		@_id = user._id.toString()
		@first_name = user.first_name
		@referal_id = user.referal_id

	get: (callback = (error, user)->) ->
		db.users.findOne { _id: ObjectId(@_id) }, callback

	mongoUpdate: (updateOp, callback=(error)->) ->
		db.users.update {_id: ObjectId(@_id)}, updateOp, callback

	register: (callback = (error, user) ->) ->
		@registerWithQuery('', callback)

	registerWithQuery: (query, callback = (error, user) ->) ->
		return callback(new Error('User already registered')) if @_id?
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.post {
				url: '/register' + query
				json: { @email, @password }
			}, (error, response, body) =>
				return callback(error) if error?
				db.users.findOne { email: @email }, (error, user) =>
					return callback(error) if error?
					@setExtraAttributes user
					callback(null, user)

	login: (callback = (error) ->) ->
		@loginWith(@email, callback)

	loginWith: (email, callback = (error) ->) ->
		@ensureUserExists (error) =>
			return callback(error) if error?
			@getCsrfToken (error) =>
				return callback(error) if error?
				@request.post {
					url: if settings.enableLegacyLogin then "/login/legacy" else "/login"
					json: { email, @password }
				}, callback

	ensureUserExists: (callback = (error) ->) ->
		filter = {@email}
		options = {upsert: true, new: true, setDefaultsOnInsert: true}
		UserModel.findOneAndUpdate filter, {}, options, (error, user) =>
			return callback(error) if error?
			AuthenticationManager.setUserPassword user._id, @password, (error) =>
				return callback(error) if error?
				UserUpdater.updateUser user._id, $set: emails: @emails, (error) =>
					return callback(error) if error?
					@setExtraAttributes user
					callback(null, @password)

	setFeatures: (features, callback = (error) ->) ->
		update = {}
		for key, value of features
			update["features.#{key}"] = value
		UserModel.update { _id: @id }, update, callback

	setOverleafId: (overleaf_id, callback = (error) ->) ->
		UserModel.update { _id: @id }, { 'overleaf.id': overleaf_id }, callback

	logout: (callback = (error) ->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.get {
				url: "/logout"
				json:
					email: @email
					password: @password
			}, (error, response, body) =>
				return callback(error) if error?
				db.users.findOne {email: @email}, (error, user) =>
					return callback(error) if error?
					@id = user?._id?.toString()
					@_id = user?._id?.toString()
					callback()

	addEmail: (email, callback = (error) ->) ->
		@emails.push(email: email, createdAt: new Date())
		UserUpdater.addEmailAddress @id, email, callback

	confirmEmail: (email, callback = (error) ->) ->
		for emailData, idx in @emails
			@emails[idx].confirmedAt = new Date() if emailData.email == email
		UserUpdater.confirmEmail @id, email, callback

	ensure_admin: (callback = (error) ->) ->
		db.users.update {_id: ObjectId(@id)}, { $set: { isAdmin: true }}, callback

	upgradeFeatures: (callback = (error) -> ) ->
		features = {
			collaborators: -1 # Infinite
			versioning: true
			dropbox:true
			compileTimeout: 60
			compileGroup:"priority"
			templates: true
			references: true
			trackChanges: true
			trackChangesVisible: true
		}
		db.users.update {_id: ObjectId(@id)}, { $set: { features: features }}, callback

	downgradeFeatures: (callback = (error) -> ) ->
		features = {
			collaborators: 1
			versioning: false
			dropbox:false
			compileTimeout: 60
			compileGroup:"standard"
			templates: false
			references: false
			trackChanges: false
			trackChangesVisible: false
		}
		db.users.update {_id: ObjectId(@id)}, { $set: { features: features }}, callback

	defaultFeatures: (callback = (error) -> ) ->
		features = settings.defaultFeatures
		db.users.update {_id: ObjectId(@id)}, { $set: { features: features }}, callback

	full_delete_user: (email, callback = (error) ->) ->
		db.users.findOne {email: email}, (error, user) =>
			if !user?
				return callback()
			user_id = user._id
			db.projects.remove owner_ref:ObjectId(user_id), {multi:true}, (err)->
				if err?
					callback(err)
				db.users.remove {_id: ObjectId(user_id)}, callback

	getProject: (project_id, callback = (error, project)->) ->
		db.projects.findOne {_id: ObjectId(project_id.toString())}, callback

	saveProject: (project, callback=(error)->) ->
		db.projects.update {_id: project._id}, project, callback

	createProject: (name, options, callback = (error, oroject_id) ->) ->
		if typeof options == "function"
			callback = options
			options = {}

		@request.post {
			url: "/project/new",
			json: Object.assign({projectName: name}, options)
		}, (error, response, body) ->
			return callback(error) if error?
			if !body?.project_id?
				error = new Error("SOMETHING WENT WRONG CREATING PROJECT", response.statusCode, response.headers["location"], body)
				callback error
			else
				callback(null, body.project_id)

	deleteProject: (project_id, callback=(error)) ->
		@request.delete {
			url: "/project/#{project_id}"
		}, (error, response, body) ->
			return callback(error) if error?
			callback(null)

	deleteProjects: (callback=(error)) ->
		db.projects.remove owner_ref:ObjectId(@id), {multi:true}, (err)->
			callback(err)

	openProject: (project_id, callback=(error)) ->
		@request.get {
			url: "/project/#{project_id}"
		}, (error, response, body) ->
			return callback(error) if error?
			if response.statusCode != 200
				err = new Error("Non-success response when opening project: #{response.statusCode}")
				return callback(err)
			callback(null)

	createDocInProject: (project_id, parent_folder_id, name, callback=(error, doc_id)->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.post {
				url: "/project/#{project_id}/doc",
				json: {
					name: name,
					parent_folder_id: parent_folder_id
				}
			}, (error, response, body) =>
				callback(null, body._id)

	addUserToProject: (project_id, user, privileges, callback = (error, user) ->) ->
		if privileges == 'readAndWrite'
			updateOp = {$addToSet: {collaberator_refs: user._id.toString()}}
		else if privileges == 'readOnly'
			updateOp = {$addToSet: {readOnly_refs: user._id.toString()}}
		db.projects.update {_id: db.ObjectId(project_id)}, updateOp, (err) ->
			callback(err)

	makePublic: (project_id, level, callback = (error) ->) ->
		@request.post {
			url: "/project/#{project_id}/settings/admin",
			json:
				publicAccessLevel: level
		}, (error, response, body) ->
			return callback(error) if error?
			callback(null)

	makePrivate: (project_id, callback = (error) ->) ->
		@request.post {
			url: "/project/#{project_id}/settings/admin",
			json:
				publicAccessLevel: 'private'
		}, (error, response, body) ->
			return callback(error) if error?
			callback(null)

	makeTokenBased: (project_id, callback = (error) ->) ->
		@request.post {
			url: "/project/#{project_id}/settings/admin",
			json:
				publicAccessLevel: 'tokenBased'
		}, (error, response, body) ->
			return callback(error) if error?
			callback(null)

	getCsrfToken: (callback = (error) ->) ->
		@request.get {
			url: "/dev/csrf"
		}, (err, response, body) =>
			return callback(err) if err?
			@csrfToken = body
			@request = @request.defaults({
				headers:
					"x-csrf-token": @csrfToken
			})
			callback()

	changePassword: (callback = (error) ->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.post {
				url: "/user/password/update"
				json:
					currentPassword: @password
					newPassword1: @password
					newPassword2: @password
			}, (error, response, body) =>
				return callback(error) if error?
				db.users.findOne {email: @email}, (error, user) =>
					return callback(error) if error?
					callback()

	getUserSettingsPage: (callback = (error, statusCode) ->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.get {
				url: "/user/settings"
			}, (error, response, body) =>
				return callback(error) if error?
				callback(null, response.statusCode)

	activateSudoMode: (callback = (error)->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.post {
				uri: '/confirm-password',
				json:
					password: @password
			}, callback

	updateSettings: (newSettings, callback = (error, response, body) ->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.post {
				url: '/user/settings'
				json: newSettings
			}, callback

	getProjectListPage: (callback=(error, statusCode)->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.get {
				url: "/project"
			}, (error, response, body) =>
				return callback(error) if error?
				callback(null, response.statusCode)

	isLoggedIn: (callback = (error, loggedIn) ->) ->
		@request.get "/user/personal_info", (error, response, body) ->
			return callback(error) if error?
			if response.statusCode == 200
				return callback(null, true)
			else if response.statusCode == 302
				return callback(null, false)
			else
				return callback(new Error("unexpected status code from /user/personal_info: #{response.statusCode}"))

	setV1Id: (v1Id, callback) ->
		UserModel.update {
			_id: @_id
		}, {
			overleaf:
				id: v1Id
		}, callback

module.exports = User
