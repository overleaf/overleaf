define [
	"libs/backbone"
], () ->
	File = Backbone.Model.extend
		initialize: () ->
			@set("type", "file")


		previewUrl: () ->
			extension = @get("name").split(".").pop()?.toLowerCase()
			needsConverting = (["eps", "pdf"].indexOf(extension) != -1)
			queryString = if needsConverting then "?format=png" else ""
			url = "#{@downloadUrl()}#{queryString}"
			return url

		downloadUrl: ->
			url = "/project/#{userSettings.project_id}/file/#{@id}"
			return url


		parse: (rawAttributes) ->
			attributes =
				id: rawAttributes._id
				name: rawAttributes.name

