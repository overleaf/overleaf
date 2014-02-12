define [
	"libs/backbone"
	"libs/mustache"
], () ->
	EntityView = Backbone.View.extend
		entityTemplate: $("#entityTemplate").html()

		initialize: () ->
			@ide = @options.manager.ide
			@manager = @options.manager
			@manager.registerView(@model.id, @)
			@bindToModel()

		events: () ->
			events = {}
			events["click ##{@model.id} > .js-clickable"] = "parentOnClick"
			return events

		render: () ->
			@$el.append(Mustache.to_html @entityTemplate, @model.attributes)
			@_bindToDomElements()
			@_makeEditable()
			return @

		_bindToDomElements: () ->
			@$nameEl = @$(".name")
			@$inputEl = @$("input.js-rename")
			@$entityListItemEl = @$el.children(".entity-list-item")

		_makeEditable: () ->
			if @ide.isAllowedToDoIt "readAndWrite"
				@_initializeRenameBox()
				@_initializeDrag()
			@hideRenameBox()

		bindToModel: () ->
			@model.on "change:name", (model) =>
				@$nameEl.text(model.get("name"))

		hideRenameBox: () ->
			@$nameEl.show()
			@$inputEl.hide()

		showRenameBox: () ->
			@$nameEl.hide()
			@$inputEl.show()

		select: () ->
			@selected = true
			@$entityListItemEl.addClass("selected")

		deselect: () ->
			@selected = false
			@$entityListItemEl.removeClass("selected")

		isSelected: () ->
			@selected

		parentOnClick: (e) ->
			doubleClickInterval = 600
			e.preventDefault()
			if @lastClick and new Date() - @lastClick < doubleClickInterval
				@onDoubleClick(e)
			else
				@lastClick = new Date()
				@onClick(e)

		onDoubleClick: (e) ->
			e.preventDefault()
			e.stopPropagation()
			if @ide.isAllowedToDoIt "readAndWrite"
				@startRename()

		_initializeDrag: () ->
			@$entityListItemEl.draggable
				delay: 250
				opacity: 0.7
				helper: "clone"
				scroll: true

		_initializeRenameBox: () ->
			@$inputEl.click (e) -> e.stopPropagation() # Don't stop rename on click in input
			@$inputEl.keydown (event) =>
				code = event.keyCode || event.which
				if code == 13
					@_finishRename()
			@hideRenameBox()

		startRename: () ->
			if !@renaming
				@renaming = true
				@showRenameBox()
				name = @model.get("name")
				@$inputEl.val(name).focus()
				if @$inputEl[0].setSelectionRange?
					selectionEnd = name.indexOf(".")
					if selectionEnd == -1
						selectionEnd = name.length
					@$inputEl[0].setSelectionRange(0, selectionEnd)
				setTimeout =>
					$(document.body).on "click.entity-rename", () =>
						@_finishRename()
				, 0

		_finishRename: () ->
			$(document.body).off "click.entity-rename"
			@renaming = false
			name = @$inputEl.val()
			@manager.renameEntity(@model, name)
			@hideRenameBox()

			

