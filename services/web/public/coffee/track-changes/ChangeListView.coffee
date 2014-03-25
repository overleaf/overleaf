define [
	"moment"
	"libs/mustache"
	"libs/backbone"
], (moment)->

	moment.lang "en", calendar:
		lastDay : '[Yesterday]'
		sameDay : '[Today]'
		nextDay : '[Tomorrow]'
		lastWeek : "ddd, Do MMM YY"
		nextWeek : "ddd, Do MMM YY"
		sameElse : 'ddd, Do MMM YY'

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

		remove: () ->
			@undelegateEvents()

		addItem: (model) ->
			index = @collection.indexOf(model)
			previousModel = @collection.models[index - 1]
			view = new ChangeListItemView(model : model, previousModel: previousModel)
			@itemViews.push view
			elementAtIndex = @$(".change-list").children()[index]
			view.$el.insertBefore(elementAtIndex)

			view.on "click", (e, v) =>
				if e.shiftKey
					@selectRangeTo(index)
				else
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

			view.resetSelector(index, @selectedFromIndex, @selectedToIndex)

		setSelectionRange: (fromIndex, toIndex) ->
			@selectedFromIndex = fromIndex
			@selectedToIndex = toIndex
			@resetAllSelectors()
			@triggerChangeDiff()

		selectRangeTo: (index) ->
			return unless @selectedFromIndex? and @selectedToIndex?
			if index < @selectedToIndex
				@setSelectionRange(@selectedFromIndex, index)
			else
				@setSelectionRange(index, @selectedToIndex)

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
			@trigger "change_diff", @selectedFromIndex, @selectedToIndex

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
						if @collection.isAtEnd()
							@atEndOfCollection = true
							@showEmptyMessageIfCollectionEmpty()
							callback()
						else
							@loadUntilFull(callback)
							
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
			docNames = []
			for doc in @model.get("docs")
				if doc.entity?
					docNames.push doc.entity.get("name")
				else
					docNames.push "deleted"
			data = {
				day: moment(parseInt(@model.get("end_ts"), 10)).calendar()
				time: moment(parseInt(@model.get("end_ts"), 10)).format("h:mm a")
				users: userHtml.join("")
				docs: docNames.join(", ")
			}

			@$el.html Mustache.to_html(@templates.item, data)

			if @options.previousModel?
				prevDate = @options.previousModel.get("end_ts")
				date     = @model.get("end_ts")
				if not moment(prevDate).isSame(date, "day")
					@$el.addClass("first-in-day")
			else
				@$el.addClass("first-in-day")

			return this

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

		setSelected: (first, last) ->
			@$el.addClass("selected-change")
			if first
				@$el.addClass("selected-change-to")
			else
				@$el.removeClass("selected-change-to")
			if last
				@$el.addClass("selected-change-from")
			else
				@$el.removeClass("selected-change-from")

		setUnselected: () ->
			@$el.removeClass("selected-change-to")
			@$el.removeClass("selected-change-from")
			@$el.removeClass("selected-change")

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

