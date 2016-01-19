_ = require("underscore")

module.exports = ProjectEditorHandler =
	buildProjectModelView: (project, options) ->
		options ||= {}
		if !options.includeUsers?
			options.includeUsers = true
			
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

		if options.includeUsers
			result.features =
				collaborators: -1 # Infinite
				versioning: false
				dropbox:false
				compileTimeout: 60
				compileGroup:"standard"
				templates: false
				references: false

			if project.owner_ref.features?
				if project.owner_ref.features.collaborators?
					result.features.collaborators = project.owner_ref.features.collaborators
				if project.owner_ref.features.versioning?
					result.features.versioning = project.owner_ref.features.versioning
				if project.owner_ref.features.dropbox?
					result.features.dropbox = project.owner_ref.features.dropbox
				if project.owner_ref.features.compileTimeout?
					result.features.compileTimeout = project.owner_ref.features.compileTimeout
				if project.owner_ref.features.compileGroup?
					result.features.compileGroup = project.owner_ref.features.compileGroup
				if project.owner_ref.features.templates?
					result.features.templates = project.owner_ref.features.templates
				if project.owner_ref.features.references?
					result.features.references = project.owner_ref.features.references

					
			result.owner = @buildUserModelView project.owner_ref, "owner"
			result.members = []
			for ref in project.readOnly_refs
				result.members.push @buildUserModelView ref, "readOnly"
			for ref in project.collaberator_refs
				result.members.push @buildUserModelView ref, "readAndWrite"
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
