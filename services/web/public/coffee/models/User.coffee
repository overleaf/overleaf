define [
	"libs/md5"
	"libs/backbone"
], () ->
	User = Backbone.Model.extend {
		gravatarUrl: (size = 32) ->
			email = @get("email").trim().toLowerCase()
			hash = CryptoJS.MD5(email)
			return "//www.gravatar.com/avatar/#{hash}.jpg?size=#{size}&d=mm"

		OWNER_HUE: 200
		hue: () ->
			if window.user.id == @get("id")
				hue = @OWNER_HUE
			else
				hash = CryptoJS.MD5(@get("id"))
				hue = parseInt(hash.toString().slice(0,8), 16) % 320
				# Avoid 20 degrees either side of the owner
				if hue > @OWNER_HUE - 20
					hue = hue + 40
			return hue

		name: () ->
			if window.user.id == @get("id")
				return "you"
			parts = []
			first_name = @get("first_name")
			if first_name? and first_name.length > 0
				parts.push first_name
			last_name = @get("last_name")
			if last_name? and last_name.length > 0
				parts.push last_name
			return parts.join(" ")

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

		getAnonymousUser: () ->
			return User.findOrBuild("anonymous", { first_name: "Anonymous", email: "anon@sharelatex.com" })
	}
