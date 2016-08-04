_ = require("underscore")

module.exports = ProjectEditorHandler =
	buildProjectModelView: (project, members, invites) ->
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
			invites:     invites || []

		{owner, ownerFeatures, members} = @buildOwnerAndMembersViews(members)
		result.owner = owner
		result.members = members

		result.features = _.defaults(ownerFeatures or {}, {
			collaborators: -1 # Infinite
			versioning: false
			dropbox:false
			compileTimeout: 60
			compileGroup:"standard"
			templates: false
			references: false
		})

		return result

	buildOwnerAndMembersViews: (members) ->
		owner = null
		ownerFeatures = null
		filteredMembers = []
		for member in members
			if member.privilegeLevel == "owner"
				ownerFeatures = member.user.features
				owner = @buildUserModelView member.user, "owner"
			else
				filteredMembers.push @buildUserModelView member.user, member.privilegeLevel
		{owner: owner, ownerFeatures: ownerFeatures, members: filteredMembers}

	buildUserModelView: (user, privileges) ->
		_id        : user._id
		first_name : user.first_name
		last_name  : user.last_name
		email      : user.email
		privileges : privileges
		signUpDate : user.signUpDate

	buildFolderModelView: (folder) ->
		fileRefs = _.filter (folder.fileRefs or []), (file)-> file?
		_id        : folder._id
		name       : folder.name
		folders    : @buildFolderModelView childFolder for childFolder in (folder.folders or [])
		fileRefs   : @buildFileModelView file for file in fileRefs
		docs       : @buildDocModelView doc for doc in (folder.docs or [])

	buildFileModelView: (file) ->
		_id  : file._id
		name : file.name

	buildDocModelView: (doc) ->
		_id   : doc._id
		name  : doc.name
