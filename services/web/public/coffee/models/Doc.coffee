define [
	"libs/backbone"
], () ->
	Doc = Backbone.Model.extend
		initialize: () ->
			@set("type", "doc")

		parse: (rawAttributes) ->
			attributes =
				id: rawAttributes._id
				name: rawAttributes.name
				deleted: !!rawAttributes.deleted
