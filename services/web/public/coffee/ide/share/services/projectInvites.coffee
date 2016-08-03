define [
	"base"
], (App) ->
	App.factory "projectInvites", ["ide", "$http", (ide, $http) ->
		return {

			sendInvite: (email, privileges) ->
				$http.post("/project/#{ide.project_id}/invite", {
					email: email
					privileges: privileges
					_csrf: window.csrfToken
				})

			revokeInvite: (inviteId) ->
				$http({
					url: "/project/#{ide.project_id}/invite/#{inviteId}"
					method: "DELETE"
					headers:
						"X-Csrf-Token": window.csrfToken
				})

			resendInvite: (inviteId, privileges) ->
				$http.post("/project/#{ide.project_id}/invite/#{inviteId}/resend", {
					_csrf: window.csrfToken
				})

			getInvites: () ->
				$http.get("/project/#{ide.project_id}/invite", {
					json: true
					headers:
						"X-Csrf-Token": window.csrfToken
				})

		}
	]
