define [
	"models/User"
	"libs/backbone"
], (User)->
	Change = Backbone.Model.extend
		parse: (change) ->
			model = {
				start_ts: change.meta.start_ts
				end_ts: change.meta.end_ts
			}
			model.users = []
			for user in change.meta.users or []
				model.users.push User.findOrBuild(user.id, user)
			if model.users.length == 0
				model.users.push User.getAnonymousUser()
			model.docs = []
			for doc_id, data of change.docs
				model.docs.push
					id: doc_id
					fromV: data.fromV
					toV: data.toV
					# TODO: We should not use a global reference here, but 
					# it's hard to get @ide into Backbone at this point.
					entity: ide.fileTreeManager.getEntity(doc_id, include_deleted: true)

			return model