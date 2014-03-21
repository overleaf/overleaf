define [
	"models/User"
	"libs/backbone"
], (User) ->
	Diff = Backbone.Model.extend
		initialize: (attributes, options) ->
			@ide = options.ide
			@set "doc", @ide.fileTreeManager.getEntity(@get("doc_id"))

		url: () ->
			"/project/#{@get("project_id")}/doc/#{@get("doc_id")}/diff?from=#{@get("from")}&to=#{@get("to")}"

		parse: (diff) ->
			for entry in diff.diff
				if entry.meta?
					if entry.meta.user?
						entry.meta.user = User.findOrBuild(entry.meta.user.id, entry.meta.user)
					else
						entry.meta.user = User.getAnonymousUser()
			return diff

		restore: (callback = (error) ->) ->
			$.ajax {
				url: "/project/#{@get("project_id")}/doc/#{@get("doc_id")}/version/#{@get("from")}/restore"
				type: "POST"
				headers:
					"X-CSRF-Token": window.csrfToken
				success: () ->
					callback()
				error: (error) ->
					callback(error)
			}
