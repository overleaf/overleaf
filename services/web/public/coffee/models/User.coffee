define [
	"libs/md5"
	"libs/backbone"
], () ->
	User = Backbone.Model.extend {
		gravatarUrl: (size = 32) ->
			email = @get("email").trim().toLowerCase()
			hash = CryptoJS.MD5(email)
			return "//www.gravatar.com/avatar/#{hash}.jpg?size=#{size}&d=mm"
	}, {
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
