define [
	"libs/backbone"
	"libs/mustache"
], () ->
	ContextMenuEntry = Backbone.View.extend
		template: $("#contextMenuEntryTemplate").html()

		events:
			"click a" : "onClick"

		render: () ->
			@setElement($(Mustache.to_html(@template, @options)))
			return @

		onClick: (e) ->
			if @options.onClick
				@options.onClick()

	ContextMenu = Backbone.View.extend
		template: $("#contextMenuTemplate").html()

		initialize: () ->
			@entries = []
			@render()
			@hide()

		render: () ->
			@setElement($(@template))
			$(document.body).append(@$el)
			return @

		hide: () -> @$el.hide()

		show: (left, top) ->
			page = $(document.body)
			page.on "click.hideContextMenu", (e) =>
				page.off "click.hideContextMenu"
				@hide()
			@$el.css
				position: "absolute"
				"z-index": 10000
				top: (top || 0) + "px"
				left: (left || 0) + "px"
			@$el.show()

		addEntry: (options) ->
			entry = new ContextMenuEntry(options)
			@$el.append entry.render().el
			@entries.push entry

		clearEntries: () ->
			while @entries.length > 0
				@entries.pop().remove()
			


