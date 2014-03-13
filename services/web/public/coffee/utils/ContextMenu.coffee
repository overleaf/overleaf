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
			e.preventDefault()
			if @options.onClick
				@options.onClick()

	ContextMenu = Backbone.View.extend
		templates:
			menu: $("#contextMenuTemplate").html()
			divider: $("#contextMenuDividerTemplate").html()

		initialize: (position, entries) ->
			if ContextMenu.currentMenu?
				ContextMenu.currentMenu.destroy()
			ContextMenu.currentMenu = @
			@render()
			for entry in entries
				@addEntry(entry)
			@show(position)

		render: () ->
			@setElement($(@templates.menu))
			$(document.body).append(@$el)
			return @

		destroy: () ->
			@$el.remove()
			@trigger "destroy"

		show: (position) ->
			page = $(document.body)
			page.on "click.hideContextMenu", (e) =>
				page.off "click.hideContextMenu"
				@destroy()
			@$el.css
				position: "absolute"
				"z-index": 10000
			@$el.css position

		addEntry: (options) ->
			if options.divider
				@$el.append $(@templates.divider)
			else
				entry = new ContextMenuEntry(options)
				@$el.append entry.render().el

			


