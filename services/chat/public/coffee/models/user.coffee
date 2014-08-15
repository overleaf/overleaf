define [
	"libs/backbone"
], (Backbone, room) ->

	User = Backbone.Model.extend {},
		findOrCreate: (attributes) ->
			User.cache ||= {}
			if User.cache[attributes.id]?
				return User.cache[attributes.id]
			else
				user = new User(attributes)
				User.cache[attributes.id] = user
				return user