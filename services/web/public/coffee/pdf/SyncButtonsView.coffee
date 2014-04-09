define [
	"libs/backbone"
	"libs/mustache"
], () ->
	SyncButtonsView = Backbone.View.extend
		template: $("#syncButtonsTemplate").html()

		events:
			"click .sync-code-to-pdf": () ->
				ga('send', 'event', 'editor-interaction', 'sync-code-to-pdf')
				@trigger "click:sync-code-to-pdf"
			"click .sync-pdf-to-code": () ->
				ga('send', 'event', 'editor-interaction', 'sync-pdf-to-code')
				@trigger "click:sync-pdf-to-code"

		initialize: (options) ->
			@render()
			@ide = options.ide
			@ide.editor.on "resize", => @repositionLeft()

		render: () ->
			@setElement($(@template))

			### These keep screwing up in the UI :(
			@$(".sync-code-to-pdf").tooltip({
				title: "Go to code location in the output"
				animate: false
				placement: "top"
				trigger: "hover"
				delay:
					show: 800
					hide: 0
			})
			@$(".sync-pdf-to-code").tooltip({
				html: true
				title: "Go to output location in the code<br/>(Or double click the output)"
				animate: false
				placement: "bottom"
				trigger: "hover"
				delay:
					show: 800
					hide: 0
			})
			###
			return @

		hide: () ->
			@hidden = true
			@$el.hide()

		show: () ->
			@hidden = false
			@showIfNotHiddenAndOpen()

		showIfNotHiddenAndOpen: () ->
			state = @ide.editor.$splitter.layout().readState()
			if !@hidden and !state.east?.initClosed
				@$el.show()
			else
				@$el.hide()

		repositionLeft: () ->
			state = @ide.editor.$splitter.layout().readState()
			if state.east?
				@$el.css({right: state.east.size - 8})
			@showIfNotHiddenAndOpen();

