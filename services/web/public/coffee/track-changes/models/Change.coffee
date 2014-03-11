define [
	"models/User"
	"libs/backbone"
], (User)->
	Change = Backbone.Model.extend
		parse: (change) ->
			model = {
				start_ts: change.meta.start_ts
				end_ts: change.meta.end_ts
				fromVersion: change.fromV
				toVersion: change.toV
			}
			model.users = []
			for user in change.meta.users or []
				model.users.push User.findOrBuild(user.id, user)
			if model.users.length == 0
				model.users.push User.getAnonymousUser()
			return model