define [
	"models/User"
	"libs/backbone"
], (User) ->
	ProjectMemberList = Backbone.Collection.extend
		model: User

		numberOfCollaborators: () ->
			collaborators = 0
			for member in @models
				if member.get("privileges") != "owner"
					collaborators += 1
			return collaborators
	
