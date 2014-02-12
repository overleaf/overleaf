define [
	"libs/backbone"
], ()->
	Version = Backbone.Model.extend
		url: -> "/project/" + window.userSettings.project_id + "/version/" + @id
		parse: (json) ->
			if json.version
				json = json.version
			json.message = json.message.split("\n")[0]
			return json
