_ = require("underscore")

module.exports = ProjectEditorHandler =
	buildProjectModelView: (project, members) ->
		result =
			_id        : project._id
			name       : project.name
			rootDoc_id : project.rootDoc_id
			rootFolder : [@buildFolderModelView project.rootFolder[0]]
			publicAccesLevel  : project.publicAccesLevel
			dropboxEnabled 	  : !!project.existsInDropbox
			compiler   : project.compiler
			description: project.description
			spellCheckLanguage: project.spellCheckLanguage
			deletedByExternalDataSource : project.deletedByExternalDataSource || false
			deletedDocs: project.deletedDocs
			members:     []

		result.features = # defaults
			collaborators: -1 # Infinite
			versioning: false
			dropbox:false
			compileTimeout: 60
			compileGroup:"standard"
			templates: false
			references: false
		
		owner = null
		for member in members
			if member.privilegeLevel == "owner"
				owner = member.user
			else
				result.members.push @buildUserModelView member.user, member.privilegeLevel
		if owner?
			result.owner = @buildUserModelView owner, "owner"

		if owner?.features?
			if owner.features.collaborators?
				result.features.collaborators = owner.features.collaborators
			if owner.features.versioning?
				result.features.versioning = owner.features.versioning
			if owner.features.dropbox?
				result.features.dropbox = owner.features.dropbox
			if owner.features.compileTimeout?
				result.features.compileTimeout = owner.features.compileTimeout
			if owner.features.compileGroup?
				result.features.compileGroup = owner.features.compileGroup
			if owner.features.templates?
				result.features.templates = owner.features.templates
			if owner.features.references?
				result.features.references = owner.features.references

		return result

	buildUserModelView: (user, privileges) ->
		_id        : user._id
		first_name : user.first_name
		last_name  : user.last_name
		email      : user.email
		privileges : privileges
		signUpDate : user.signUpDate

	buildFolderModelView: (folder) ->
		fileRefs = _.filter folder.fileRefs, (file)-> file?
		_id        : folder._id
		name       : folder.name
		folders    : @buildFolderModelView childFolder for childFolder in folder.folders
		fileRefs   : @buildFileModelView file for file in fileRefs
		docs       : @buildDocModelView doc for doc in folder.docs

	buildFileModelView: (file) ->
		_id  : file._id
		name : file.name

	buildDocModelView: (doc) ->
		_id   : doc._id
		name  : doc.name
