define ["libs/backbone"], () ->
	FileDiff = Backbone.Model.extend
		url: -> "/project/#{window.userSettings.project_id}/version/#{@get("version_id")}/file/#{@get("path")}"

		sync: (method, model, options) ->
			throw "FileDiffs can only be read" unless method == "read"
			options ||= {}
			params =
				url: @url()
				type: "GET"
			$.ajax(_.extend(params, options))

		parse: (response) ->
			content : response
