define [
	"libs/mustache"
	"libs/backbone"
], (util)->
	ChangeListView = Backbone.View.extend
		template: $("#changeListTemplate").html()

		events:
			"scroll" : "loadUntilFull"

		initialize: () ->
			@itemViews = []
			@atEndOfCollection = false

			self = this
			@collection.on "add", (model) ->
				self.addItem model
			@collection.on "reset", (collection) ->
				self.addItem model for model in collection.models

			@render()
			@hideLoading()

		render: ->
			@$el.html Mustache.to_html @template
			@$el.css
				overflow: "scroll"
			this

		addItem: (model) ->
			view = new ChangeListItemView(model : model)
			@itemViews.push view
			index = @collection.indexOf(model)
			elementAtIndex = @$(".change-list").children()[index]
			view.$el.insertBefore(elementAtIndex)
			view.on "click", (e, v) =>
				@trigger "change_diff", v.model.get("version")

		listShorterThanContainer: ->
			@$el.height() > @$(".change-list").height()
		
		atEndOfListView: ->
			@$el.scrollTop() + @$el.height() >= @$(".change-list").height() - 30

		loadUntilFull: (e, callback) ->
			if (@listShorterThanContainer() or @atEndOfListView()) and not @atEndOfCollection and not @loading
				@showLoading()
				@hideEmptyMessage()
				@collection.fetchNextBatch
					error: =>
						@hideLoading()
						@showEmptyMessageIfCollectionEmpty()
						callback() if callback?
					success: (collection, response) =>
						@hideLoading()
						if response.updates.length == @collection.batchSize
							@loadUntilFull(e, callback)
						else
							@atEndOfCollection = true
							@showEmptyMessageIfCollectionEmpty()
							callback() if callback?
							
			else
				callback() if callback?

		showEmptyMessageIfCollectionEmpty: ()->
			if @collection.isEmpty()
				@$(".empty-message").show()
			else
				@$(".empty-message").hide()

		hideEmptyMessage: () ->
			@$(".empty-message").hide()

		showLoading: ->
			@loading = true
			@$(".loading-changes").show()
		
		hideLoading: ->
			@loading = false
			@$(".loading-changes").hide()
	
	ChangeListItemView = Backbone.View.extend
		tagName: "li"

		events:
			"click a": "onClick"
	
		template : $("#changeListItemTemplate").html()

		initialize: ->
			@render()

		render: ->
			@$el.html Mustache.to_html(@template, @modelView())
			return this
		
		modelView: ->
			modelView = @model.toJSON()
			# modelView.start_ts = util.formatDate(modelView.start_ts)
			# modelView.end_ts = util.formatDate(modelView.end_ts)
			return modelView

		onClick: (e) ->
			e.preventDefault()
			@trigger "click", e, @

	return ChangeListView

