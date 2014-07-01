define [
	"base"
], (App) ->
	App.factory "projectMembers", ["ide", "$q", (ide, $q) ->
		return {
			removeMember: (member) ->
				deferred = $q.defer()

				ide.socket.emit "removeUserFromProject", member._id, (error) =>
					if error?
						return deferred.reject(error)
					deferred.resolve()

				return deferred.promise

			addMember: (email, privileges) ->
				deferred = $q.defer()

				ide.socket.emit "addUserToProject", email, privileges, (error, user) =>
					if error?
						return deferred.reject(error)

					if !user
						deferred.reject()
					else
						deferred.resolve(user)

				return deferred.promise
		}
	]