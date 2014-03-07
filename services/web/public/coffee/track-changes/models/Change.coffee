define [
	"models/User"
	"libs/backbone"
], (User)->
	Change = Backbone.Model.extend
		parse: (change) ->
			return {
				start_ts: change.meta.start_ts
				end_ts: change.meta.end_ts
				user: User.findOrBuild(change.meta.user.id, change.meta.user)
				version: change.v
			}