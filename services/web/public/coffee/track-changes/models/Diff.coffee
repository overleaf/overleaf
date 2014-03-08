define [
	"models/User"
	"libs/backbone"
], (User) ->
	Diff = Backbone.Model.extend
		url: () ->
			"/project/#{@get("project_id")}/doc/#{@get("doc_id")}/diff?from=#{@get("from")}&to=#{@get("to")}"

		parse: (diff) ->
			for entry in diff.diff
				if entry.meta? and entry.meta.user?
					entry.meta.user = User.findOrBuild(entry.meta.user.id, entry.meta.user)
			return diff
