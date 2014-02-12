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
			@on "change:rootDoc_id", (project, docId) =>
				@get("ide").socket.emit "setRootDoc", docId
			@get("ide").socket.on "rootDocUpdated", (docId) =>
				@set("rootDoc_id", docId)

		bindToProjectName: ->
			@on "change:name", (project, name) =>
				@get("ide").socket.emit "setProjectName", window.window_id, name
			@get("ide").socket.on "projectNameUpdated", (senderWindowId, name) =>
				@set("name", name)

		bindToCompiler: ->
			@on "change:compiler", (project, name) =>
				@get("ide").socket.emit "setCompiler", name
			@get("ide").socket.on "compilerUpdated", (compiler) =>
			 	@set("compiler", compiler)

		bindToSpellingPreference: ->
			@on "change:spellCheckLanguage", (project, languageCode) =>
				@get("ide").socket.emit "setSpellCheckLanguage", languageCode

		bindToPublicAccessLevel: ->
			@on "change:publicAccesLevel", (project, level) =>
				@get("ide").socket.emit "setPublicAccessLevel", level
			@get("ide").socket.on 'publicAccessLevelUpdated', (level) =>
				@set("publicAccesLevel", level)

		bindToProjectDescription: ->
			@on "change:description", (project, description) =>
				@get("ide").socket.emit "updateProjectDescription", description
			@get("ide").socket.on 'projectDescriptionUpdated', (description) =>
				@set("description", description)

		getRootDocumentsList: (callback) ->
			@get("ide").socket.emit "getRootDocumentsList", (err, listOfDocs) ->
				callback(listOfDocs)

