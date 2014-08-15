define [
	"libs/backbone"
	"models/user"
], (Backbone, User) ->
	ConnectedUsers = Backbone.Collection.extend
		model: User

		initialize: (models, options) ->
			{@chat, @room} = options
