define [
	"base"
], (App) ->
	App.factory "settings", ["ide", (ide) ->
		return {
			saveSettings: (data) ->
				data._csrf = window.csrfToken
				ide.$http.post "/user/settings", data

			saveProjectSettings: (data) ->
				data._csrf = window.csrfToken
				ide.$http.post "/project/#{ide.project_id}/settings", data
				
			saveProjectAdminSettings: (data) ->
				data._csrf = window.csrfToken
				ide.$http.post "/project/#{ide.project_id}/settings/admin", data
				
		}
	]