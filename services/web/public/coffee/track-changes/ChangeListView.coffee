define [
	"moment"
	"libs/mustache"
	"libs/backbone"
], (moment)->
	ChangeListView = Backbone.View.extend
		template: $("#changeListTemplate").html()

		events:
			"scroll" : () -> @loadUntilFull()

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
				@setSelectionRange(index, index)

			view.on "selected:to", (e, v) =>
				@setSelectionRange(@selectedFromIndex, index)

			view.on "selected:from", (e, v) =>
				@setSelectionRange(index, @selectedToIndex)

			view.on "mouseenter:to", (e) =>
				@hoverToIndex = index
				@resetHoverStates()

			view.on "mouseleave:to", (e) =>
				delete @hoverToIndex
				@resetHoverStates()

			view.on "mouseenter:from", (e) =>
				@hoverFromIndex = index
				@resetHoverStates()

			view.on "mouseleave:from", (e) =>
				delete @hoverFromIndex
				@resetHoverStates()

			view.on "click:restore", (e) =>
				@trigger "restore", view.model

			view.resetSelector(index, @selectedFromIndex, @selectedToIndex)

		setSelectionRange: (fromIndex, toIndex) ->
			@selectedFromIndex = fromIndex
			@selectedToIndex = toIndex
			@resetAllSelectors()
			@triggerChangeDiff()

		resetAllSelectors: () ->
			for view, i in @itemViews
				view.resetSelector(i, @selectedFromIndex, @selectedToIndex)

		resetHoverStates: () ->
			if @hoverToIndex? and @hoverToIndex != @selectedToIndex
				@$("ul").addClass("hover-state")
				for view, i in @itemViews
					view.resetHoverState(i, @selectedFromIndex, @hoverToIndex)
			else if @hoverFromIndex? and @hoverFromIndex != @selectedFromIndex
				@$("ul").addClass("hover-state")
				for view, i in @itemViews
					view.resetHoverState(i, @hoverFromIndex, @selectedToIndex)
			else
				@$("ul").removeClass("hover-state")
				for view, i in @itemViews
					view.setHoverUnselected()

		triggerChangeDiff: () ->
			@trigger "change_diff", @collection.models[@selectedFromIndex], @collection.models[@selectedToIndex]

		listShorterThanContainer: ->
			@$el.height() > @$(".change-list").height()
		
		atEndOfListView: ->
			@$el.scrollTop() + @$el.height() >= @$(".change-list").height() - 30

		loadUntilFull: (callback = (error) ->) ->
			if (@listShorterThanContainer() or @atEndOfListView()) and not @atEndOfCollection and not @loading
				@showLoading()
				@hideEmptyMessage()
				@collection.fetchNextBatch
					error: (error) =>
						@hideLoading()
						@showEmptyMessageIfCollectionEmpty()
						callback(error)
					success: (collection, response) =>
						@hideLoading()
						if response.updates.length == @collection.batchSize
							@loadUntilFull(callback)
						else
							@atEndOfCollection = true
							@showEmptyMessageIfCollectionEmpty()
							callback()
							
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
			"mouseenter .change-selector-to": (args...) ->
				@trigger "mouseenter:to", args...
			"mouseleave .change-selector-to": (args...) ->
				@trigger "mouseleave:to", args...
			"mouseenter .change-selector-from": (args...) ->
				@trigger "mouseenter:from", args...
			"mouseleave .change-selector-from": (args...) ->
				@trigger "mouseleave:from", args...
			"click .restore a": "onRestoreClick"

	
		templates:
			item: $("#changeListItemTemplate").html()
			user: $("#changeListItemUserTemplate").html()

		initialize: ->
			@render()

		render: ->
			userHtml = for user in @model.get("users")
				Mustache.to_html @templates.user, {
					hue:  user.hue()
					name: user.name()
				}
			data = {
				date: moment(parseInt(@model.get("end_ts"), 10)).calendar()
				users: userHtml.join("")
			}

			@$el.html Mustache.to_html(@templates.item, data)
			return this

		onClick: (e) ->
			e.preventDefault()
			@trigger "click", e, @

		onToSelectorClick: (e) ->
			@trigger "selected:to", e, @

		onFromSelectorClick: (e) ->
			@trigger "selected:from", e, @

		onRestoreClick: (e) ->
			e.preventDefault()
			@trigger "click:restore", e, @

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

		setSelected: (first, last) ->
			@$el.addClass("selected")
			if first
				@$el.addClass("selected-to")
			else
				@$el.removeClass("selected-to")
			if last
				@$el.addClass("selected-from")
			else
				@$el.removeClass("selected-from")

		setUnselected: () ->
			@$el.removeClass("selected-to")
			@$el.removeClass("selected-from")
			@$el.removeClass("selected")

		setHoverSelected: (first, last) ->
			@$el.addClass("hover-selected")
			if first
				@$el.addClass("hover-selected-to")
			else
				@$el.removeClass("hover-selected-to")
			if last
				@$el.addClass("hover-selected-from")
			else
				@$el.removeClass("hover-selected-from")

		setHoverUnselected: () ->
			@$el.removeClass("hover-selected-to")
			@$el.removeClass("hover-selected-from")
			@$el.removeClass("hover-selected")

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
				@setSelected(selectedToIndex == myIndex, selectedFromIndex == myIndex)
			else
				@setUnselected()

			@setFromChecked(myIndex == selectedFromIndex)
			@setToChecked(myIndex == selectedToIndex)

		resetHoverState: (myIndex, hoverFromIndex, hoverToIndex) ->
			if hoverToIndex <= myIndex <= hoverFromIndex
				@setHoverSelected(hoverToIndex == myIndex, hoverFromIndex == myIndex)
			else
				@setHoverUnselected()


	return ChangeListView

