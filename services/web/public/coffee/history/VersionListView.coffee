define [
	"./util"
	"history/VersionDetailView"
	"libs/mustache"
	"libs/backbone"
], (util, VersionDetailView)->
	VersionListView = Backbone.View.extend
		template: $("#versionListTemplate").html()

		events:
			"scroll" : "loadUntilFull"

		initialize: ->
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
			view = new VersionListItemView(model : model)
			@itemViews.push view
			index = @collection.indexOf(model)
			elementAtIndex = @$("#version-list").children()[index]
			view.$el.insertBefore(elementAtIndex)

		listShorterThanContainer: ->
			@$el.height() > @$("#version-list").height()
		
		atEndOfListView: ->
			@$el.scrollTop() + @$el.height() >= @$("#version-list").height() - 30

		loadUntilFull: (e, callback) ->
			if (@listShorterThanContainer() or @atEndOfListView()) and not @atEndOfCollection and not @loading
				@showLoading()
				@hideEmptyMessage()
				@collection.fetchNextBatch
					error: =>
						@hideLoading()
						@atEndOfCollection = true
						@showEmptyMessageIfCollectionEmpty()
						callback() if callback?
					success: =>
						@hideLoading()
						@loadUntilFull(e, callback)
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
			@$(".loading").show()
		
		hideLoading: ->
			@loading = false
			@$(".loading").hide()
	
	VersionListItemView = Backbone.View.extend
		tagName: "li"
		
		events:
			"click a": "showVersionDetail"
	
		template : $("#versionListItemTemplate").html()

		initialize: ->
			@render()

		render: ->
			@$el.html Mustache.to_html(@template, @modelView())
			return this
		
		modelView: ->
			modelView = @model.toJSON()
			modelView.date = util.formatDate(modelView.date)
			return modelView
	
		showVersionDetail: ->
			$("#versionListArea .active").removeClass "active"
			@$el.addClass "active"
			@model.fetch success: (model) ->
				view = new VersionDetailView(model: model)
				view.render()

	return VersionListView

