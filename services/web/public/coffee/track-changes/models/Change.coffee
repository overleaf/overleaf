define [
	"libs/backbone"
], ()->
	Change = Backbone.Model.extend
		parse: (change) ->
			return {
				start_ts: change.meta.start_ts
				end_ts: change.meta.end_ts
				user_id: change.meta.user_id
				version: change.v
			}