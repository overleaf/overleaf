define [
	"libs/backbone"
], () ->
	User = Backbone.Model.extend {}, {
		findOrBuild : (id, attributes) ->
			model = @find id
			if !model?
				model = @build id
			model.set model.parse attributes
			return model

		build: (id) ->
			model = new this(id : id)
			@loadedModel ||= {}
			@loadedModel[id] = model
			return model

		find: (id) ->
			@loadedModel ||= {}
			return @loadedModel[id]
	}
