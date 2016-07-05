define [
	"base"
], (App) ->
	App.factory "settings", ["ide", "event_tracking", (ide, event_tracking) ->
		return {
			saveSettings: (data) ->
				for key in Object.keys(data)
					changedSetting = key
					changedSettingVal = data[key]
					event_tracking.send "setting-changed", { changedSetting, changedSettingVal }

				data._csrf = window.csrfToken
				ide.$http.post "/user/settings", data


			saveProjectSettings: (data) ->
				for key in Object.keys(data)
					changedSetting = key
					changedSettingVal = data[key]
					event_tracking.send "project-setting-changed", { changedSetting, changedSettingVal}

				data._csrf = window.csrfToken
				ide.$http.post "/project/#{ide.project_id}/settings", data

				
			saveProjectAdminSettings: (data) ->
				for key in Object.keys(data)
					changedSetting = key
					changedSettingVal = data[key]
					event_tracking.send "project-admin-setting-changed", { changedSetting, changedSettingVal }

				data._csrf = window.csrfToken
				ide.$http.post "/project/#{ide.project_id}/settings/admin", data

				
		}
	]