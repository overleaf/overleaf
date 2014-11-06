define [
	"base"
], (App) ->
	App.factory "projectMembers", ["ide", "$http", (ide, $http) ->
		return {
			removeMember: (member) ->
				$http({
					url: "/project/#{ide.project_id}/users/#{member._id}"
					method: "DELETE"
					headers:
						"X-Csrf-Token": window.csrfToken
				})

			addMember: (email, privileges) ->
				$http.post("/project/#{ide.project_id}/users", {
					email: email
					privileges: privileges
					_csrf: window.csrfToken
				})
		}
	]