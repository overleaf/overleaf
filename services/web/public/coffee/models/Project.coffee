define [
	"models/User"
	"models/ProjectMemberList"
	"models/Folder"
	"libs/backbone"
], (User, ProjectMemberList, Folder) ->
	Project = Backbone.Model.extend
		initialize: ->
			@on "change:ide", (project, ide) =>
				@bindToRootDocId()
				@bindToProjectName()
				@bindToPublicAccessLevel()
				@bindToCompiler()
				@bindToSpellingPreference()
				@bindToProjectDescription()

		parse: (rawAttributes) ->
			attributes =
				id                : rawAttributes._id
				name              : rawAttributes.name
				rootFolder        : new Folder(rawAttributes.rootFolder[0], parse: true)
				rootDoc_id        : rawAttributes.rootDoc_id
				publicAccesLevel  : rawAttributes.publicAccesLevel
				features          : rawAttributes.features
				compiler          : rawAttributes.compiler
				spellCheckLanguage: rawAttributes.spellCheckLanguage
				dropboxEnabled 	  : rawAttributes.dropboxEnabled
				description 	  : rawAttributes.description
				deletedByExternalDataSource: rawAttributes.deletedByExternalDataSource
				useOt             : rawAttributes.useOt

			attributes.members = members = new ProjectMemberList()

			attributes.owner = owner = User.findOrBuild rawAttributes.owner._id, rawAttributes.owner
			owner.set("privileges", "owner")
			members.add owner
 
			for rawMember in rawAttributes.members
				member = User.findOrBuild rawMember._id, rawMember
				members.add member

			return attributes
	
		bindToRootDocId: ->
			remoteChange = false
			@on "change:rootDoc_id", (project, docId) =>
				if !remoteChange
					@get("ide").socket.emit "setRootDoc", docId
			@get("ide").socket.on "rootDocUpdated", (docId) =>
				remoteChange = true
				@set("rootDoc_id", docId)
				remoteChange = false

		bindToProjectName: ->
			remoteChange = false
			@on "change:name", (project, name) =>
				if !remoteChange
					@get("ide").socket.emit "setProjectName", window.window_id, name
			@get("ide").socket.on "projectNameUpdated", (senderWindowId, name) =>
				remoteChange = true
				@set("name", name)
				remoteChange = false

		bindToCompiler: ->
			remoteChange = false
			@on "change:compiler", (project, name) =>
				if !remoteChange
					@get("ide").socket.emit "setCompiler", name
			@get("ide").socket.on "compilerUpdated", (compiler) =>
				remoteChange = true
				@set("compiler", compiler)
				remoteChange = false

		bindToSpellingPreference: ->
			@on "change:spellCheckLanguage", (project, languageCode) =>
				@get("ide").socket.emit "setSpellCheckLanguage", languageCode

		bindToPublicAccessLevel: ->
			remoteChange = false
			@on "change:publicAccesLevel", (project, level) =>
				if !remoteChange
					@get("ide").socket.emit "setPublicAccessLevel", level
			@get("ide").socket.on 'publicAccessLevelUpdated', (level) =>
				remoteChange = true
				@set("publicAccesLevel", level)
				remoteChange = false

		bindToProjectDescription: ->
			remoteChange = false
			@on "change:description", (project, description) =>
				if !remoteChange
					@get("ide").socket.emit "updateProjectDescription", description
			@get("ide").socket.on 'projectDescriptionUpdated', (description) =>
				remoteChange = true
				@set("description", description)
				remoteChange = false

		getRootDocumentsList: (callback) ->
			@get("ide").socket.emit "getRootDocumentsList", (err, listOfDocs) ->
				callback(listOfDocs)

