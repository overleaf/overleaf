define [
	"models/User"
	"libs/backbone"
], (User)->
	Change = Backbone.Model.extend
		parse: (change) ->
			model = {
				start_ts: change.meta.start_ts
				end_ts: change.meta.end_ts
				version: change.v
			}
			if change.meta.user?
				model.user = User.findOrBuild(change.meta.user.id, change.meta.user)
			else
				model.user = User.getAnonymousUser()
			return model