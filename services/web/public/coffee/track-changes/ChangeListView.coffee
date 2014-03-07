define [
	"moment"
	"libs/mustache"
	"libs/backbone"
], (moment)->
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

			@selectedFromIndex = 0
			@selectedToIndex = 0

			@render()
			@hideLoading()

		render: ->
			@$el.html Mustache.to_html @template
			@$el.css
				overflow: "scroll"
			this

		addItem: (model) ->
			index = @collection.indexOf(model)
			view = new ChangeListItemView(model : model)
			@itemViews.push view
			elementAtIndex = @$(".change-list").children()[index]
			view.$el.insertBefore(elementAtIndex)

			view.on "click", (e, v) =>
				@selectedToIndex = index
				@selectedFromIndex = index
				@resetAllSelectors()
				@triggerChangeDiff()

			view.on "selected:to", (e, v) =>
				@selectedToIndex = index
				@resetAllSelectors()
				@triggerChangeDiff()

			view.on "selected:from", (e, v) =>
				@selectedFromIndex = index
				@resetAllSelectors()
				@triggerChangeDiff()

			view.resetSelector(index, @selectedFromIndex, @selectedToIndex)

		resetAllSelectors: () ->
			for view, i in @itemViews
				view.resetSelector(i, @selectedFromIndex, @selectedToIndex)

		triggerChangeDiff: () ->
			@trigger "change_diff", @collection.models[@selectedFromIndex], @collection.models[@selectedToIndex]

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
			"click .change-description"   : "onClick"
			"click .change-selector-from" : "onFromSelectorClick"
			"click .change-selector-to"   : "onToSelectorClick"
	
		template : $("#changeListItemTemplate").html()

		initialize: ->
			@render()

		render: ->
			@$el.html Mustache.to_html(@template, @modelView())
			return this
		
		modelView: ->
			modelView = {
				date: moment(parseInt(@model.get("end_ts"), 10)).calendar()
				name: @model.get("user").get("first_name") + " " + @model.get("user").get("last_name")
			}
			# modelView.start_ts = util.formatDate(modelView.start_ts)
			# modelView.end_ts = util.formatDate(modelView.end_ts)
			return modelView

		onClick: (e) ->
			e.preventDefault()
			@trigger "click", e, @

		onToSelectorClick: (e) ->
			@trigger "selected:to", e, @

		onFromSelectorClick: (e) ->
			@trigger "selected:from", e, @

		isSelectedFrom: () ->
			@$(".change-selector-from").is(":checked")

		isSelectedTo: () ->
			@$(".change-selector-to").is(":checked")

		hideFromSelector: () ->
			@$(".change-selector-from").hide()

		showFromSelector: () ->
			@$(".change-selector-from").show()

		hideToSelector: () ->
			@$(".change-selector-to").hide()

		showToSelector: () ->
			@$(".change-selector-to").show()

		setFromChecked: (checked) ->
			@$(".change-selector-from").prop("checked", checked)

		setToChecked: (checked) ->
			@$(".change-selector-to").prop("checked", checked)

		setSelected: () ->
			@$el.addClass("selected")

		setUnselected: () ->
			@$el.removeClass("selected")

		resetSelector: (myIndex, selectedFromIndex, selectedToIndex) ->
			if myIndex >= selectedToIndex
				@showFromSelector()
			else
				@hideFromSelector()

			if myIndex <= selectedFromIndex
				@showToSelector()
			else
				@hideToSelector()

			if selectedToIndex <= myIndex <= selectedFromIndex
				@setSelected()
			else
				@setUnselected()

			@setFromChecked(myIndex == selectedFromIndex)
			@setToChecked(myIndex == selectedToIndex)


	return ChangeListView

